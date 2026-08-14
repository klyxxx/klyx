import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { isPastBookingStart } from "@/lib/brussels-time";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";

type BookingStatus = "accepted" | "rejected" | "cancelled";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  stripe_payment_intent_id: string | null;
  refund_status: string | null;
  stripe_refund_id: string | null;
};

type ScheduleRow = {
  id: string;
  start_time: string;
  end_time: string;
};

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);

  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function overlaps(first: BookingRow, second: ScheduleRow): boolean {
  const firstStart = timeToMinutes(first.start_time);
  const firstEnd = timeToMinutes(first.end_time);
  const secondStart = timeToMinutes(second.start_time);
  const secondEnd = timeToMinutes(second.end_time);

  if (
    firstStart === null ||
    firstEnd === null ||
    secondStart === null ||
    secondEnd === null
  ) {
    return false;
  }

  return firstStart < secondEnd && firstEnd > secondStart;
}

async function createNotification(params: {
  userId: string;
  bookingId: string;
  type:
    | "booking_accepted"
    | "booking_rejected"
    | "booking_cancelled"
    | "system";
  title: string;
  message: string;
  deduplicationKey: string;
}) {
  const { error } = await supabaseAdmin.from("user_notifications").upsert(
    {
      user_id: params.userId,
      booking_id: params.bookingId,
      type: params.type,
      title: params.title,
      message: params.message,
      href: `/bookings/${params.bookingId}`,
      deduplication_key: params.deduplicationKey,
    },
    {
      onConflict: "deduplication_key",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.error("Booking notification error:", error.message);
  }
}

async function providerHasConflict(
  booking: BookingRow,
  providerId: string
) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("booking_date", booking.booking_date)
    .or(
      `provider_id.eq.${providerId},babysitter_id.eq.${providerId}`
    )
    .in("status", ["accepted", "completed"])
    .neq("id", booking.id);

  if (error) throw new Error(error.message);

  return ((data ?? []) as ScheduleRow[]).some((item) =>
    overlaps(booking, item)
  );
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("Variable manquante : STRIPE_SECRET_KEY");
  }

  return new Stripe(key);
}

async function refundPaidBooking(params: {
  booking: BookingRow;
  actorId: string;
  reason: string;
}) {
  const { booking, actorId, reason } = params;

  if (booking.refund_status === "succeeded") {
    return {
      refundId: booking.stripe_refund_id,
      amount: booking.amount_total ?? 0,
      alreadyRefunded: true,
    };
  }

  if (!booking.stripe_payment_intent_id) {
    throw new Error(
      "Le paiement Stripe de cette réservation est introuvable."
    );
  }

  if (!booking.amount_total || booking.amount_total <= 0) {
    throw new Error("Le montant à rembourser est invalide.");
  }

  const { data: lockedBooking, error: lockError } =
    await supabaseAdmin
      .from("bookings")
      .update({
        refund_status: "processing",
        refund_reason: reason,
        refund_requested_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("payment_status", "paid")
      .or("refund_status.is.null,refund_status.eq.failed")
      .select("id")
      .maybeSingle();

  if (lockError) throw new Error(lockError.message);

  if (!lockedBooking) {
    const { data: refreshed, error: refreshError } =
      await supabaseAdmin
        .from("bookings")
        .select("refund_status, stripe_refund_id, amount_total")
        .eq("id", booking.id)
        .maybeSingle();

    if (refreshError) throw new Error(refreshError.message);

    if (refreshed?.refund_status === "succeeded") {
      return {
        refundId: refreshed.stripe_refund_id,
        amount: refreshed.amount_total ?? booking.amount_total,
        alreadyRefunded: true,
      };
    }

    throw new Error(
      "Un remboursement est déjà en cours. Actualise dans quelques secondes."
    );
  }

  try {
    const stripe = stripeClient();

    const refundParameters: Stripe.RefundCreateParams = {
      payment_intent: booking.stripe_payment_intent_id,
      amount: booking.amount_total,
      reason: "requested_by_customer",
      metadata: {
        booking_id: booking.id,
        requested_by: actorId,
      },
    };

    if (booking.payment_mode === "connect_destination") {
      refundParameters.reverse_transfer = true;
      refundParameters.refund_application_fee = true;
    }

    const refund = await stripe.refunds.create(
      refundParameters,
      {
        idempotencyKey: `klyx-booking-refund-${booking.id}`,
      }
    );

    if (refund.status === "failed" || refund.status === "canceled") {
      throw new Error(
        "Stripe n’a pas pu terminer le remboursement."
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        refund_status:
          refund.status === "succeeded" ? "succeeded" : "processing",
        stripe_refund_id: refund.id,
        refunded_amount_cents: refund.amount,
        refunded_at:
          refund.status === "succeeded" ? now : null,
        refund_reason: reason,
        refund_requested_by: actorId,
        updated_at: now,
      })
      .eq("id", booking.id);

    if (updateError) throw new Error(updateError.message);

    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey: `booking:${booking.id}:refund:${refund.id}`,
      entryType: "refund_succeeded",
      status:
        refund.status === "succeeded"
          ? "succeeded"
          : "processing",
      currency: booking.currency,
      grossAmountCents: booking.amount_total,
      refundAmountCents: refund.amount,
      paymentMode: booking.payment_mode,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
      stripeRefundId: refund.id,
    });

    return {
      refundId: refund.id,
      amount: refund.amount,
      alreadyRefunded: false,
    };
  } catch (error) {
    await supabaseAdmin
      .from("bookings")
      .update({
        refund_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("refund_status", "processing");

    const failureMessage =
      error instanceof Error
        ? error.message
        : "Remboursement Stripe impossible.";

    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey: `booking:${booking.id}:refund-failed`,
      entryType: "refund_failed",
      status: "failed",
      currency: booking.currency,
      grossAmountCents: booking.amount_total,
      refundAmountCents: booking.amount_total,
      paymentMode: booking.payment_mode,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
      failureCode: "refund_failed",
      failureMessage,
    });

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      bookingId?: string;
      status?: BookingStatus;
      note?: string;
    };

    const bookingId = body.bookingId?.trim();
    const nextStatus = body.status;
    const note = body.note?.trim().slice(0, 500) || null;

    if (!bookingId || !nextStatus) {
      return NextResponse.json(
        { error: "Réservation ou statut manquant." },
        { status: 400 }
      );
    }

    if (
      !["accepted", "rejected", "cancelled"].includes(nextStatus)
    ) {
      return NextResponse.json(
        { error: "Statut invalide." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, booking_group_id, booking_date, start_time, end_time, status, payment_status, payment_mode, amount_total, currency, stripe_payment_intent_id, refund_status, stripe_refund_id"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { error: "Réservation introuvable." },
        { status: 404 }
      );
    }

    const booking = data as BookingRow;

    // KLYX_GROUP_STATUS_GUARD_12_85
    if (booking.booking_group_id) {
      return NextResponse.json(
        {
          error:
            "Cette reservation appartient a un groupe. Modifie le groupe complet depuis KLYX.",
          code: "GROUP_STATUS_REQUIRED",
          groupId: booking.booking_group_id,
        },
        { status: 409 }
      );
    }


    const providerId =
      booking.provider_id ?? booking.babysitter_id;
    const isClient = booking.parent_id === profile.id;
    const isProvider = providerId === profile.id;

    if (!isClient && !isProvider) {
      return NextResponse.json(
        { error: "Accès refusé." },
        { status: 403 }
      );
    }

    if (
      nextStatus === "accepted" ||
      nextStatus === "rejected"
    ) {
      if (!isProvider) {
        return NextResponse.json(
          {
            error:
              "Seul le prestataire peut accepter ou refuser cette demande.",
          },
          { status: 403 }
        );
      }

      if (booking.status !== "pending") {
        return NextResponse.json(
          { error: "Cette demande n’est plus en attente." },
          { status: 409 }
        );
      }

      if (nextStatus === "accepted" && providerId) {
        const hasConflict = await providerHasConflict(
          booking,
          providerId
        );

        if (hasConflict) {
          return NextResponse.json(
            {
              error:
                "Un autre rendez-vous accepté occupe déjà ce créneau.",
            },
            { status: 409 }
          );
        }
      }
    }

    let refundCompleted = false;
    let refundConfirmed = false;

    if (nextStatus === "cancelled") {
      if (!["pending", "accepted"].includes(booking.status)) {
        return NextResponse.json(
          {
            error:
              "Cette réservation ne peut plus être annulée.",
          },
          { status: 409 }
        );
      }

      if (!note || note.length < 5) {
        return NextResponse.json(
          {
            error:
              "Indique un motif d’annulation d’au moins 5 caractères.",
          },
          { status: 400 }
        );
      }

      if (booking.status === "pending" && isProvider) {
        return NextResponse.json(
          {
            error:
              "Refuse la demande au lieu de l’annuler.",
          },
          { status: 400 }
        );
      }

      if (
        booking.payment_status === "paid" &&
        isPastBookingStart(
          booking.booking_date,
          booking.start_time
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Une prestation déjà commencée nécessite un litige, pas une annulation automatique.",
          },
          { status: 409 }
        );
      }

      if (booking.payment_status === "paid") {
        await refundPaidBooking({
          booking,
          actorId: profile.id,
          reason: note,
        });
        refundCompleted = true;

        const { data: refundState, error: refundStateError } =
          await supabaseAdmin
            .from("bookings")
            .select("refund_status")
            .eq("id", booking.id)
            .maybeSingle();

        if (refundStateError) {
          throw new Error(refundStateError.message);
        }

        refundConfirmed =
          refundState?.refund_status === "succeeded";
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    };

    if (nextStatus === "accepted") {
      updatePayload.accepted_at = now;
      updatePayload.provider_response = note;
      updatePayload.service_status = "scheduled";
    }

    if (nextStatus === "rejected") {
      updatePayload.rejected_at = now;
      updatePayload.provider_response = note;
      updatePayload.service_status = "cancelled";
    }

    if (nextStatus === "cancelled") {
      updatePayload.cancelled_at = now;
      updatePayload.cancelled_by = profile.id;
      updatePayload.cancellation_reason = note;
      updatePayload.service_status = "cancelled";
    }

    const { data: updatedBooking, error: updateError } =
      await supabaseAdmin
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking.id)
        .eq("status", booking.status)
        .select("id")
        .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (!updatedBooking) {
      return NextResponse.json(
        {
          error:
            "La réservation vient d’être modifiée. Actualise la page.",
        },
        { status: 409 }
      );
    }

    const eventNote =
      nextStatus === "cancelled" && refundCompleted
        ? `${note} Remboursement Stripe demandé automatiquement.`
        : note;

    const { error: eventError } = await supabaseAdmin
      .from("booking_status_events")
      .insert({
        booking_id: booking.id,
        actor_id: profile.id,
        previous_status: booking.status,
        new_status: nextStatus,
        note: eventNote,
      });

    if (eventError) {
      console.error("Booking event error:", eventError.message);
    }

    if (nextStatus === "accepted") {
      await createNotification({
        userId: booking.parent_id,
        bookingId: booking.id,
        type: "booking_accepted",
        title: "Réservation acceptée",
        message:
          "Le prestataire a accepté ta demande. Tu peux maintenant payer.",
        deduplicationKey:
          `booking:${booking.id}:accepted`,
      });
    }

    if (nextStatus === "rejected") {
      await createNotification({
        userId: booking.parent_id,
        bookingId: booking.id,
        type: "booking_rejected",
        title: "Réservation refusée",
        message:
          note ||
          "Le prestataire n’est pas disponible pour cette demande.",
        deduplicationKey:
          `booking:${booking.id}:rejected`,
      });
    }

    if (nextStatus === "cancelled") {
      const recipientId = isClient
        ? providerId
        : booking.parent_id;

      if (recipientId) {
        await createNotification({
          userId: recipientId,
          bookingId: booking.id,
          type: "booking_cancelled",
          title: "Réservation annulée",
          message: refundCompleted
            ? `${note} Le paiement a été remboursé automatiquement.`
            : note || "La réservation a été annulée.",
          deduplicationKey:
            `booking:${booking.id}:cancelled:${profile.id}`,
        });
      }

      if (refundCompleted) {
        await createNotification({
          userId: booking.parent_id,
          bookingId: booking.id,
          type: "system",
          title: refundConfirmed
            ? "Remboursement confirmé"
            : "Remboursement lancé",
          message: refundConfirmed
            ? "Stripe a confirmé le remboursement de cette réservation."
            : "Stripe a reçu la demande de remboursement. Le délai bancaire peut varier.",
          deduplicationKey: refundConfirmed
            ? `booking:${booking.id}:refund-confirmed`
            : `booking:${booking.id}:refund`,
        });
      }
    }

    return NextResponse.json({
      status: nextStatus,
      refunded: refundCompleted,
      message:
        nextStatus === "accepted"
          ? "Réservation acceptée."
          : nextStatus === "rejected"
            ? "Réservation refusée."
            : refundCompleted
              ? "Réservation annulée et remboursement lancé."
              : "Réservation annulée.",
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Impossible de modifier la réservation.";
    const conflict = rawMessage.includes(
      "KLYX_PROVIDER_TIME_CONFLICT"
    );
    const message = conflict
      ? "Un autre rendez-vous accepté occupe déjà ce créneau."
      : rawMessage;
    const status = conflict ? 409 : apiErrorStatus(message);

    return NextResponse.json({ error: message }, { status });
  }
}


