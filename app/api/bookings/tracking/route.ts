import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

type ServiceStatus =
  | "scheduled"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
  service_status: ServiceStatus | null;
};

const ALLOWED_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  scheduled: ["en_route"],
  en_route: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

function timestampColumn(status: ServiceStatus): Record<string, string> {
  const now = new Date().toISOString();

  if (status === "en_route") {
    return { en_route_at: now };
  }

  if (status === "arrived") {
    return { arrived_at: now };
  }

  if (status === "in_progress") {
    return { started_at: now };
  }

  if (status === "completed") {
    return { completed_at: now };
  }

  return {};
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      bookingId?: string;
      status?: ServiceStatus;
      note?: string;
    };

    const bookingId = body.bookingId?.trim();
    const nextStatus = body.status;
    const note = body.note?.trim() || null;

    if (!bookingId || !nextStatus) {
      return NextResponse.json(
        { error: "Réservation ou statut manquant." },
        { status: 400 }
      );
    }

    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, status, service_status"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      throw new Error(bookingError.message);
    }

    if (!bookingData) {
      return NextResponse.json(
        { error: "Réservation introuvable." },
        { status: 404 }
      );
    }

    const booking = bookingData as BookingRow;
    const providerId = booking.provider_id ?? booking.babysitter_id;

    if (!providerId || providerId !== profile.id) {
      return NextResponse.json(
        { error: "Seul le prestataire peut mettre à jour le suivi." },
        { status: 403 }
      );
    }

    if (booking.status !== "accepted" && booking.status !== "completed") {
      return NextResponse.json(
        { error: "La réservation doit être acceptée." },
        { status: 400 }
      );
    }

    const currentStatus = booking.service_status ?? "scheduled";
    const allowed = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Transition impossible : ${currentStatus} → ${nextStatus}.`,
        },
        { status: 400 }
      );
    }

    const bookingUpdate: Record<string, unknown> = {
      service_status: nextStatus,
      ...timestampColumn(nextStatus),
    };

    if (nextStatus === "completed") {
      bookingUpdate.status = "completed";
    }

    if (nextStatus === "cancelled") {
      bookingUpdate.status = "cancelled";
    }

    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update(bookingUpdate)
      .eq("id", booking.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: eventError } = await supabaseAdmin
      .from("booking_tracking_events")
      .insert({
        booking_id: booking.id,
        actor_id: profile.id,
        status: nextStatus,
        note,
      });

    if (eventError) {
      throw new Error(eventError.message);
    }

    if (nextStatus === "completed") {
      const [{ error: statusEventError }, { error: notificationError }] =
        await Promise.all([
          supabaseAdmin.from("booking_status_events").insert({
            booking_id: booking.id,
            actor_id: profile.id,
            previous_status: booking.status,
            new_status: "completed",
            note: note || "Prestation marquée comme terminée par le prestataire.",
          }),
          supabaseAdmin.from("user_notifications").insert({
            user_id: booking.parent_id,
            booking_id: booking.id,
            type: "booking_completed",
            title: "Prestation terminée",
            message: "La prestation est terminée. Tu peux maintenant laisser un avis.",
            href: `/bookings/${booking.id}`,
          }),
        ]);

      if (statusEventError) {
        console.error("Booking completion event error:", statusEventError.message);
      }

      if (notificationError) {
        console.error("Booking completion notification error:", notificationError.message);
      }
    }

    return NextResponse.json({
      serviceStatus: nextStatus,
      message: "Suivi mis à jour.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de mettre à jour le suivi.";

    const status = apiErrorStatus(message);

    return NextResponse.json({ error: message }, { status });
  }
}
