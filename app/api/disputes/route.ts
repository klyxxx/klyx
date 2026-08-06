import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

const REASONS = [
  "provider_absent",
  "client_absent",
  "major_delay",
  "unfinished_work",
  "unsatisfactory_work",
  "unsafe_behavior",
  "payment_problem",
  "other",
] as const;

type Reason = (typeof REASONS)[number];

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
};

function priorityFor(reason: Reason): "normal" | "high" | "urgent" {
  if (reason === "unsafe_behavior") return "urgent";
  if (
    reason === "provider_absent" ||
    reason === "client_absent" ||
    reason === "payment_problem"
  ) {
    return "high";
  }

  return "normal";
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    const { data, error } = await supabaseAdmin
      .from("disputes")
      .select(
        "id, booking_id, opened_by, against_profile_id, reason, description, status, priority, resolution, resolved_at, created_at, updated_at"
      )
      .or(
        `opened_by.eq.${profile.id},against_profile_id.eq.${profile.id}`
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ disputes: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les litiges.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      bookingId?: unknown;
      reason?: unknown;
      description?: unknown;
    };

    const bookingId =
      typeof body.bookingId === "string"
        ? body.bookingId.trim()
        : "";
    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 2000)
        : "";

    if (!bookingId) {
      return NextResponse.json(
        { error: "Choisis une réservation." },
        { status: 400 }
      );
    }

    if (!REASONS.includes(reason as Reason)) {
      return NextResponse.json(
        { error: "Motif invalide." },
        { status: 400 }
      );
    }

    if (description.length < 20) {
      return NextResponse.json(
        {
          error:
            "Décris le problème avec au moins 20 caractères.",
        },
        { status: 400 }
      );
    }

    const { data: bookingData, error: bookingError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          "id, parent_id, provider_id, babysitter_id, status"
        )
        .eq("id", bookingId)
        .maybeSingle();

    if (bookingError) throw new Error(bookingError.message);

    if (!bookingData) {
      return NextResponse.json(
        { error: "Réservation introuvable." },
        { status: 404 }
      );
    }

    const booking = bookingData as BookingRow;
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

    if (booking.status === "pending") {
      return NextResponse.json(
        {
          error:
            "Un litige ne peut être ouvert qu’après acceptation de la réservation.",
        },
        { status: 409 }
      );
    }

    const againstProfileId = isClient
      ? providerId
      : booking.parent_id;

    if (!againstProfileId) {
      return NextResponse.json(
        {
          error:
            "L’autre participant de la réservation est introuvable.",
        },
        { status: 409 }
      );
    }

    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from("disputes")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("opened_by", profile.id)
        .in("status", [
          "open",
          "under_review",
          "waiting_user",
        ])
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      return NextResponse.json(
        {
          error:
            "Tu as déjà un litige actif pour cette réservation.",
          disputeId: existing.id,
        },
        { status: 409 }
      );
    }

    const selectedReason = reason as Reason;

    const { data: dispute, error: insertError } =
      await supabaseAdmin
        .from("disputes")
        .insert({
          booking_id: booking.id,
          opened_by: profile.id,
          against_profile_id: againstProfileId,
          reason: selectedReason,
          description,
          priority: priorityFor(selectedReason),
          status: "open",
        })
        .select("id")
        .single();

    if (insertError) throw new Error(insertError.message);

    const { error: eventError } = await supabaseAdmin
      .from("dispute_events")
      .insert({
        dispute_id: dispute.id,
        actor_id: profile.id,
        event_type: "opened",
        note: description,
      });

    if (eventError) {
      console.error("Dispute event error:", eventError.message);
    }

    const { error: notificationError } =
      await supabaseAdmin
        .from("user_notifications")
        .insert({
          user_id: againstProfileId,
          booking_id: booking.id,
          type: "system",
          title: "Un litige a été ouvert",
          message:
            "Un participant a signalé un problème concernant cette réservation.",
          href: "/trust",
          deduplication_key:
            `dispute:${dispute.id}:opened`,
        });

    if (notificationError) {
      console.error(
        "Dispute notification error:",
        notificationError.message
      );
    }

    return NextResponse.json({
      disputeId: dispute.id,
      message:
        "Signalement enregistré. KLYX conserve maintenant l’historique du dossier.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’ouvrir le litige.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
