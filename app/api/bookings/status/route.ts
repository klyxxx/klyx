import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";

type BookingStatus = "accepted" | "rejected" | "cancelled";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
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
  type: string;
  title: string;
  message: string;
}) {
  const { error } = await supabaseAdmin.from("user_notifications").insert({
    user_id: params.userId,
    booking_id: params.bookingId,
    type: params.type,
    title: params.title,
    message: params.message,
    href: `/bookings/${params.bookingId}`,
  });

  if (error) {
    console.error("Booking notification error:", error.message);
  }
}

async function providerHasConflict(booking: BookingRow, providerId: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("booking_date", booking.booking_date)
    .or(`provider_id.eq.${providerId},babysitter_id.eq.${providerId}`)
    .in("status", ["accepted", "completed"])
    .neq("id", booking.id);

  if (error) throw new Error(error.message);

  return ((data ?? []) as ScheduleRow[]).some((item) => overlaps(booking, item));
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

    if (!["accepted", "rejected", "cancelled"].includes(nextStatus)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, booking_date, start_time, end_time, status, payment_status"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
    }

    const booking = data as BookingRow;
    const providerId = booking.provider_id ?? booking.babysitter_id;
    const isClient = booking.parent_id === profile.id;
    const isProvider = providerId === profile.id;

    if (!isClient && !isProvider) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    if (nextStatus === "accepted" || nextStatus === "rejected") {
      if (!isProvider) {
        return NextResponse.json(
          { error: "Seul le prestataire peut accepter ou refuser cette demande." },
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
        const hasConflict = await providerHasConflict(booking, providerId);

        if (hasConflict) {
          return NextResponse.json(
            { error: "Un autre rendez-vous accepté occupe déjà ce créneau." },
            { status: 409 }
          );
        }
      }
    }

    if (nextStatus === "cancelled") {
      if (!["pending", "accepted"].includes(booking.status)) {
        return NextResponse.json(
          { error: "Cette réservation ne peut plus être annulée." },
          { status: 409 }
        );
      }

      if (booking.status === "pending" && isProvider) {
        return NextResponse.json(
          { error: "Refuse la demande au lieu de l’annuler." },
          { status: 400 }
        );
      }

      if (booking.payment_status === "paid") {
        return NextResponse.json(
          {
            error:
              "Cette réservation est déjà payée. Le remboursement sécurisé sera activé avec la prochaine évolution Stripe.",
          },
          { status: 409 }
        );
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

    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update(updatePayload)
      .eq("id", booking.id)
      .eq("status", booking.status)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (!updatedBooking) {
      return NextResponse.json(
        { error: "La réservation vient d’être modifiée. Actualise la page." },
        { status: 409 }
      );
    }

    const { error: eventError } = await supabaseAdmin
      .from("booking_status_events")
      .insert({
        booking_id: booking.id,
        actor_id: profile.id,
        previous_status: booking.status,
        new_status: nextStatus,
        note,
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
        message: "Le prestataire a accepté ta demande. Tu peux maintenant payer.",
      });
    }

    if (nextStatus === "rejected") {
      await createNotification({
        userId: booking.parent_id,
        bookingId: booking.id,
        type: "booking_rejected",
        title: "Réservation refusée",
        message: note || "Le prestataire n’est pas disponible pour cette demande.",
      });
    }

    if (nextStatus === "cancelled") {
      const recipientId = isClient ? providerId : booking.parent_id;

      if (recipientId) {
        await createNotification({
          userId: recipientId,
          bookingId: booking.id,
          type: "booking_cancelled",
          title: "Réservation annulée",
          message: note || "L’autre participant a annulé la réservation.",
        });
      }
    }

    return NextResponse.json({
      status: nextStatus,
      message:
        nextStatus === "accepted"
          ? "Réservation acceptée."
          : nextStatus === "rejected"
            ? "Réservation refusée."
            : "Réservation annulée.",
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Impossible de modifier la réservation.";
    const conflict = rawMessage.includes("KLYX_PROVIDER_TIME_CONFLICT");
    const message = conflict
      ? "Un autre rendez-vous accepté occupe déjà ce créneau."
      : rawMessage;
    const status = conflict ? 409 : apiErrorStatus(message);

    return NextResponse.json({ error: message }, { status });
  }
}
