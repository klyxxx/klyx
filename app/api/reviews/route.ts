import { after, NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { reviewReceivedEmail } from "@/lib/email/lifecycle-templates";
import { recalculateProviderScores } from "@/lib/provider-score";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_SINGLE_REVIEW_GROUP_GUARD_12_88

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  status: string;
};

type ReviewRow = {
  id: string;
  booking_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  created_at?: string | null;
};

function providerIdFromBooking(booking: BookingRow) {
  return booking.provider_id ?? booking.babysitter_id ?? null;
}

async function bookingForReview(
  bookingId: string,
  clientProfileId: string
): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_group_id, status"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Reservation introuvable.");

  const booking = data as BookingRow;

  if (booking.parent_id !== clientProfileId) {
    throw new Error(
      "Seul le client de cette reservation peut laisser un avis."
    );
  }

  if (booking.status !== "completed") {
    throw new Error(
      "La mission doit etre terminee avant de laisser un avis."
    );
  }

  if (!providerIdFromBooking(booking)) {
    throw new Error("Prestataire introuvable.");
  }

  return booking;
}

function groupedReviewResponse(booking: BookingRow) {
  return NextResponse.json(
    {
      error:
        "Cette reservation appartient a une mission groupee. Un seul avis doit evaluer tous les creneaux.",
      code: "GROUP_REVIEW_REQUIRED",
      groupId: booking.booking_group_id,
      href: "/reviews/group/" + booking.booking_group_id,
    },
    { status: 409 }
  );
}

function reviewErrorStatus(error: unknown): number {
  const message =
    error instanceof Error ? error.message : "Impossible de traiter l avis.";
  const baseStatus = apiErrorStatus(message);

  if (baseStatus < 500) return baseStatus;
  if (message === "Reservation introuvable.") return 404;
  if (
    message ===
    "Seul le client de cette reservation peut laisser un avis."
  ) {
    return 403;
  }
  if (
    message ===
    "La mission doit etre terminee avant de laisser un avis."
  ) {
    return 409;
  }
  if (message === "Prestataire introuvable.") return 404;

  return 500;
}

function secureReviewError(
  error: unknown,
  method: "GET" | "POST",
  event: string,
  code: string,
  startedAt: number
) {
  const message =
    error instanceof Error ? error.message : "Impossible de traiter l avis.";
  const status = reviewErrorStatus(error);

  return secureApiErrorResponse({
    error,
    event,
    route: "/api/reviews",
    method,
    status,
    code,
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

function logReviewSideEffectFailure(
  error: unknown,
  event: string,
  code: string,
  startedAt: number
) {
  logServerError({
    error,
    event,
    route: "/api/reviews",
    method: "POST",
    status: 500,
    code,
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType !== "client") {
      return NextResponse.json(
        { error: "Cette action est reservee au client." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const bookingId = url.searchParams.get("bookingId")?.trim();

    if (!bookingId) {
      return NextResponse.json(
        { error: "Reservation manquante." },
        { status: 400 }
      );
    }

    const booking = await bookingForReview(bookingId, profile.id);

    if (booking.booking_group_id) {
      return groupedReviewResponse(booking);
    }

    const providerId = providerIdFromBooking(booking)!;

    const [providerResult, reviewResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, first_name, last_name, avatar_url")
        .eq("id", providerId)
        .maybeSingle(),
      supabaseAdmin
        .from("reviews")
        .select(
          "id, booking_id, author_id, target_id, rating, comment, created_at"
        )
        .eq("booking_id", booking.id)
        .eq("author_id", profile.id)
        .maybeSingle(),
    ]);

    if (providerResult.error) throw providerResult.error;
    if (reviewResult.error) throw reviewResult.error;

    const provider = providerResult.data;
    const review = reviewResult.data;
    const targetName =
      provider?.full_name?.trim() ||
      [provider?.first_name, provider?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "Prestataire KLYX";

    return NextResponse.json({
      bookingId: booking.id,
      providerId,
      targetName,
      avatarUrl: provider?.avatar_url ?? null,
      review: review
        ? {
            id: review.id,
            rating: Number(review.rating),
            comment: review.comment ?? "",
          }
        : null,
    });
  } catch (error) {
    return secureReviewError(
      error,
      "GET",
      "review_load_failed",
      "KLYX_REVIEW_LOAD_FAILED",
      startedAt
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType !== "client") {
      return NextResponse.json(
        { error: "Cette action est reservee au client." },
        { status: 403 }
      );
    }

    let body: {
      bookingId?: string;
      rating?: number;
      comment?: string;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Requete invalide." },
        { status: 400 }
      );
    }

    const bookingId = body.bookingId?.trim();
    const rating = Number(body.rating);
    const comment = body.comment?.trim().slice(0, 1000) || null;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Reservation manquante." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La note doit etre comprise entre 1 et 5." },
        { status: 400 }
      );
    }

    const booking = await bookingForReview(bookingId, profile.id);

    if (booking.booking_group_id) {
      return groupedReviewResponse(booking);
    }

    const providerId = providerIdFromBooking(booking)!;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("author_id", profile.id)
      .maybeSingle();

    if (existingError) throw existingError;

    let review: ReviewRow;

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .update({
          target_id: providerId,
          rating,
          comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("author_id", profile.id)
        .select("id, booking_id, author_id, target_id, rating, comment")
        .single();

      if (error) throw error;
      review = data as ReviewRow;
    } else {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .insert({
          booking_id: booking.id,
          booking_group_id: null,
          author_id: profile.id,
          target_id: providerId,
          rating,
          comment,
        })
        .select("id, booking_id, author_id, target_id, rating, comment")
        .single();

      if (error) throw error;
      review = data as ReviewRow;
    }

    const { error: notificationError } = await supabaseAdmin
      .from("user_notifications")
      .upsert(
        {
          user_id: providerId,
          booking_id: booking.id,
          type: "system",
          title: "Nouvel avis recu",
          message:
            "Un client a laisse une note de " + String(rating) +
            "/5 apres une mission terminee.",
          href: "/providers/" + providerId,
          deduplication_key: "booking:" + booking.id + ":review-provider",
        },
        {
          onConflict: "deduplication_key",
          ignoreDuplicates: true,
        }
      );

    if (notificationError) {
      logReviewSideEffectFailure(
        notificationError,
        "review_notification_failed",
        "KLYX_REVIEW_NOTIFICATION_FAILED",
        startedAt
      );
    }

    if (!existing) {
      after(async () => {
        await sendKlyxDeduplicatedEmail({
          deduplicationKey: `review:${review.id}:received:provider`,
          templateKey: "review.received.provider",
          profileId: providerId,
          ...reviewReceivedEmail(),
        });
      });
    }

    try {
      await recalculateProviderScores(providerId);
    } catch (scoreError) {
      logReviewSideEffectFailure(
        scoreError,
        "review_score_recalculation_failed",
        "KLYX_REVIEW_SCORE_RECALCULATION_FAILED",
        startedAt
      );
    }

    return NextResponse.json({
      review: {
        id: review.id,
        rating: Number(review.rating),
        comment: review.comment ?? "",
      },
      providerId,
      message: existing ? "Avis modifie." : "Avis publie.",
    });
  } catch (error) {
    return secureReviewError(
      error,
      "POST",
      "review_save_failed",
      "KLYX_REVIEW_SAVE_FAILED",
      startedAt
    );
  }
}
