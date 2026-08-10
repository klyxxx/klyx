import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
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

function providerIdFromBooking(booking: BookingRow): string | null {
  return booking.provider_id ?? booking.babysitter_id ?? null;
}

async function bookingForReview(
  bookingId: string,
  clientProfileId: string
): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, status"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Réservation introuvable.");

  const booking = data as BookingRow;

  if (booking.parent_id !== clientProfileId) {
    throw new Error(
      "Seul le client de cette réservation peut laisser un avis."
    );
  }

  if (booking.status !== "completed") {
    throw new Error(
      "La mission doit être terminée avant de laisser un avis."
    );
  }

  if (!providerIdFromBooking(booking)) {
    throw new Error(
      "Le prestataire associé à cette réservation est introuvable."
    );
  }

  return booking;
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType !== "client") {
      return NextResponse.json(
        { error: "Cette action est réservée au client." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const bookingId = url.searchParams.get("bookingId")?.trim();

    if (!bookingId) {
      return NextResponse.json(
        { error: "Réservation manquante." },
        { status: 400 }
      );
    }

    const booking = await bookingForReview(
      bookingId,
      profile.id
    );

    const providerId = providerIdFromBooking(booking)!;

    const [
      { data: provider, error: providerError },
      { data: review, error: reviewError },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, avatar_url"
        )
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

    if (providerError) throw new Error(providerError.message);
    if (reviewError) throw new Error(reviewError.message);

    const targetName =
      provider?.full_name?.trim() ||
      `${provider?.first_name ?? ""} ${
        provider?.last_name ?? ""
      }`.trim() ||
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
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger l'avis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType !== "client") {
      return NextResponse.json(
        { error: "Cette action est réservée au client." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      bookingId?: string;
      rating?: number;
      comment?: string;
    };

    const bookingId = body.bookingId?.trim();
    const rating = Number(body.rating);
    const comment =
      body.comment?.trim().slice(0, 1000) || null;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Réservation manquante." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { error: "La note doit être comprise entre 1 et 5." },
        { status: 400 }
      );
    }

    const booking = await bookingForReview(
      bookingId,
      profile.id
    );

    const providerId = providerIdFromBooking(booking)!;

    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from("reviews")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("author_id", profile.id)
        .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    let review: ReviewRow | null = null;

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
        .select(
          "id, booking_id, author_id, target_id, rating, comment"
        )
        .single();

      if (error) throw new Error(error.message);
      review = data as ReviewRow;
    } else {
      const { data, error } = await supabaseAdmin
        .from("reviews")
        .insert({
          booking_id: booking.id,
          author_id: profile.id,
          target_id: providerId,
          rating,
          comment,
        })
        .select(
          "id, booking_id, author_id, target_id, rating, comment"
        )
        .single();

      if (error) throw new Error(error.message);
      review = data as ReviewRow;
    }

    const { error: notificationError } =
      await supabaseAdmin
        .from("user_notifications")
        .upsert(
          {
            user_id: providerId,
            booking_id: booking.id,
            type: "system",
            title: "Nouvel avis reçu",
            message: `Un client a laissé une note de ${rating}/5 après une mission terminée.`,
            href: `/providers/${providerId}`,
            deduplication_key:
              `booking:${booking.id}:review-provider`,
          },
          {
            onConflict: "deduplication_key",
            ignoreDuplicates: true,
          }
        );

    if (notificationError) {
      console.error(
        "Review notification error:",
        notificationError.message
      );
    }

    return NextResponse.json({
      review: {
        id: review.id,
        rating: Number(review.rating),
        comment: review.comment ?? "",
      },
      providerId,
      message: existing
        ? "Avis modifié."
        : "Avis publié.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'enregistrer l'avis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

