import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBookingTrackingTimingError } from "@/lib/booking-tracking-time";
import {
  syncBookingGroupLifecycle,
} from "@/lib/booking-group-lifecycle";

// KLYX_GROUP_TRACKING_SYNC_12_87
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { reviewRequestEmail } from "@/lib/email/lifecycle-templates";
import {
  logServerError,
} from "@/lib/server-log";

type ServiceStatus =
  | "scheduled"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type TrackingAction =
  | ServiceStatus
  | "provider_finished"
  | "client_confirmed";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  booking_date: string;
  start_time: string;
  status: string;
  payment_status: string | null;
  service_status: ServiceStatus | null;
  provider_finished_at: string | null;
  client_confirmed_at: string | null;
};

const PROVIDER_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  scheduled: ["en_route"],
  en_route: ["arrived"],
  arrived: ["in_progress"],
  in_progress: [],
  completed: [],
  cancelled: [],
};

function timestampColumn(status: ServiceStatus): Record<string, string> {
  const now = new Date().toISOString();

  if (status === "en_route") return { en_route_at: now };
  if (status === "arrived") return { arrived_at: now };
  if (status === "in_progress") return { started_at: now };
  if (status === "completed") return { completed_at: now };

  return {};
}

async function createNotification(params: {
  userId: string;
  bookingId: string;
  type: "tracking_updated" | "review_required" | "system";
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
      href: `/tracking/${params.bookingId}`,
      deduplication_key: params.deduplicationKey,
    },
    {
      onConflict: "deduplication_key",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    logServerError({
      event:
        "tracking_notification_failed",
      route:
        "/api/bookings/tracking",
      method: "POST",
      status: 500,
      code:
        "tracking_notification_failed",
      error,
    });
  }
}

async function addTrackingEvent(params: {
  bookingId: string;
  actorId: string;
  status: ServiceStatus;
  note: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("booking_tracking_events")
    .insert({
      booking_id: params.bookingId,
      actor_id: params.actorId,
      status: params.status,
      note: params.note,
    });

  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      bookingId?: string;
      action?: TrackingAction;
      status?: TrackingAction;
      note?: string;
    };

    const bookingId = body.bookingId?.trim();
    const action = body.action ?? body.status;
    const note = body.note?.trim().slice(0, 500) || null;

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: "Réservation ou action manquante." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, booking_group_id, booking_date, start_time, status, payment_status, service_status, provider_finished_at, client_confirmed_at"
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
    const providerId =
      booking.provider_id ?? booking.babysitter_id;
    const isProvider = providerId === profile.id;
    const isClient = booking.parent_id === profile.id;

    if (!isProvider && !isClient) {
      return NextResponse.json(
        { error: "Accès refusé." },
        { status: 403 }
      );
    }

    if (booking.status !== "accepted") {
      return NextResponse.json(
        { error: "La réservation doit être acceptée." },
        { status: 409 }
      );
    }

    if (booking.payment_status !== "paid") {
      return NextResponse.json(
        {
          error:
            "Le paiement doit être confirmé avant le suivi de la mission.",
        },
        { status: 409 }
      );
    }

    // KLYX_TRACKING_TEMPORAL_GUARD_2026
    const timingError = getBookingTrackingTimingError({
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      action,
    });

    if (timingError) {
      return NextResponse.json(
        { error: timingError },
        { status: 409 }
      );
    }

    const currentStatus =
      booking.service_status ?? "scheduled";
    const now = new Date().toISOString();

    if (action === "provider_finished") {
      if (!isProvider) {
        return NextResponse.json(
          {
            error:
              "Seul le prestataire peut déclarer la mission terminée.",
          },
          { status: 403 }
        );
      }

      if (currentStatus !== "in_progress") {
        return NextResponse.json(
          {
            error:
              "La prestation doit être en cours avant d’être déclarée terminée.",
          },
          { status: 409 }
        );
      }

      if (booking.provider_finished_at) {
        return NextResponse.json({
          serviceStatus: currentStatus,
          awaitingClientConfirmation: true,
          message:
            "La fin de mission attend déjà la confirmation du client.",
        });
      }

      const { data: updated, error: updateError } =
        await supabaseAdmin
          .from("bookings")
          .update({
            provider_finished_at: now,
            provider_finish_note: note,
            updated_at: now,
          })
          .eq("id", booking.id)
          .is("provider_finished_at", null)
          .select("id")
          .maybeSingle();

      if (updateError) throw new Error(updateError.message);

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "La mission vient d’être modifiée. Actualise la page.",
          },
          { status: 409 }
        );
      }

      await addTrackingEvent({
        bookingId: booking.id,
        actorId: profile.id,
        status: "in_progress",
        note:
          note ||
          "Le prestataire déclare la mission terminée. Confirmation du client attendue.",
      });

      after(async () => {
        await createNotification({
          userId: booking.parent_id,
          bookingId: booking.id,
          type: "tracking_updated",
          title: "Mission à confirmer",
          message:
            "Le prestataire a terminé la mission. Confirme la fin après vérification.",
          deduplicationKey:
            `booking:${booking.id}:provider-finished`,
        });
      });

      return NextResponse.json({
        serviceStatus: "in_progress",
        awaitingClientConfirmation: true,
        message:
          "Mission déclarée terminée. Le client doit maintenant confirmer.",
      });
    }

    if (action === "client_confirmed") {
      if (!isClient) {
        return NextResponse.json(
          {
            error:
              "Seul le client peut confirmer la fin de mission.",
          },
          { status: 403 }
        );
      }

      if (!booking.provider_finished_at) {
        return NextResponse.json(
          {
            error:
              "Le prestataire n’a pas encore déclaré la mission terminée.",
          },
          { status: 409 }
        );
      }

      if (booking.client_confirmed_at) {
        return NextResponse.json({
          serviceStatus: "completed",
          message: "La mission est déjà confirmée.",
        });
      }

      const { data: updated, error: updateError } =
        await supabaseAdmin
          .from("bookings")
          .update({
            status: "completed",
            service_status: "completed",
            client_confirmed_at: now,
            completed_at: now,
            updated_at: now,
          })
          .eq("id", booking.id)
          .eq("status", "accepted")
          .is("client_confirmed_at", null)
          .select("id")
          .maybeSingle();

      if (updateError) throw new Error(updateError.message);

      if (!updated) {
        return NextResponse.json(
          {
            error:
              "La mission vient d’être confirmée ou modifiée. Actualise la page.",
          },
          { status: 409 }
        );
      }

      await addTrackingEvent({
        bookingId: booking.id,
        actorId: profile.id,
        status: "completed",
        note:
          note ||
          "Le client confirme que la mission est terminée.",
      });

      const { error: statusEventError } =
        await supabaseAdmin
          .from("booking_status_events")
          .insert({
            booking_id: booking.id,
            actor_id: profile.id,
            previous_status: "accepted",
            new_status: "completed",
            note:
              note ||
              "Mission terminée et confirmée par le client.",
          });

      if (statusEventError) {
        logServerError({
          event:
            "tracking_completion_event_failed",
          route:
            "/api/bookings/tracking",
          method: "POST",
          status: 500,
          code:
            "tracking_completion_event_failed",
          error:
            statusEventError,
        });
      }

      after(async () => {
        const notifications = [
          createNotification({
            userId: booking.parent_id,
            bookingId: booking.id,
            type: "review_required",
            title: "Donne ton avis",
            message:
              "La mission est terminée. Ton avis aidera les prochains utilisateurs.",
            deduplicationKey:
              `booking:${booking.id}:review-client`,
          }),
          sendKlyxDeduplicatedEmail({
            deduplicationKey: `booking:${booking.id}:review-request:client`,
            templateKey: "booking.review_request.client",
            profileId: booking.parent_id,
            ...reviewRequestEmail(booking.id),
          }),
        ];

        if (providerId) {
          notifications.push(
            createNotification({
              userId: providerId,
              bookingId: booking.id,
              type: "system",
              title: "Mission confirmée",
              message:
                "Le client a confirmé la fin de la mission.",
              deduplicationKey:
                `booking:${booking.id}:completed-provider`,
            })
          );
        }

        await Promise.all(notifications);
      });

      if (booking.booking_group_id) {
        await syncBookingGroupLifecycle(
          booking.booking_group_id
        );
      }

      return NextResponse.json({
        serviceStatus: "completed",
        message:
          "Mission confirmée. Tu peux maintenant laisser un avis.",
      });
    }

    if (!isProvider) {
      return NextResponse.json(
        {
          error:
            "Seul le prestataire peut mettre à jour cette étape.",
        },
        { status: 403 }
      );
    }

    if (
      ![
        "scheduled",
        "en_route",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ].includes(action)
    ) {
      return NextResponse.json(
        { error: "Action de suivi invalide." },
        { status: 400 }
      );
    }

    const nextStatus = action as ServiceStatus;
    const allowed = PROVIDER_TRANSITIONS[currentStatus];

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Transition impossible : ${currentStatus} → ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    if (booking.provider_finished_at) {
      return NextResponse.json(
        {
          error:
            "La mission attend déjà la confirmation du client.",
        },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      service_status: nextStatus,
      updated_at: now,
      ...timestampColumn(nextStatus),
    };

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("bookings")
        .update(updatePayload)
        .eq("id", booking.id)
        .eq("service_status", currentStatus)
        .select("id")
        .maybeSingle();

    if (updateError) throw new Error(updateError.message);

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Le suivi vient d’être modifié. Actualise la page.",
        },
        { status: 409 }
      );
    }

    await addTrackingEvent({
      bookingId: booking.id,
      actorId: profile.id,
      status: nextStatus,
      note,
    });

    after(async () => {
      await createNotification({
        userId: booking.parent_id,
        bookingId: booking.id,
        type: "tracking_updated",
        title: "Suivi de mission mis à jour",
        message:
          nextStatus === "en_route"
            ? "Le prestataire est en route."
            : nextStatus === "arrived"
              ? "Le prestataire indique être arrivé."
              : "La prestation vient de commencer.",
        deduplicationKey:
          `booking:${booking.id}:tracking:${nextStatus}`,
      });
    });

    return NextResponse.json({
      serviceStatus: nextStatus,
      message: "Suivi mis à jour.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de mettre à jour le suivi.";
    const status =
      apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event:
        "booking_tracking_update_failed",
      route:
        "/api/bookings/tracking",
      method: "POST",
      code:
        "booking_tracking_update_failed",
      status,
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}
