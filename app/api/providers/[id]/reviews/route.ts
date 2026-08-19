import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PUBLIC_REVIEW_PRIVACY_12B_12B

type ReviewRow = {
  id: string;
  booking_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  provider_id: string | null;
  babysitter_id: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function publicAuthorName(
  profile: ProfileRow | undefined
): string {
  if (!profile) {
    return "Client KLYX";
  }

  const firstName =
    profile.first_name?.trim() || "Client";
  const lastName =
    profile.last_name?.trim() || "";
  const lastInitial =
    lastName.slice(0, 1).toUpperCase();

  return lastInitial
    ? `${firstName} ${lastInitial}.`
    : firstName === "Client"
      ? "Client KLYX"
      : firstName;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const startedAt = Date.now();

  try {
    const { id: providerId } = await context.params;

    const { data: reviewsData, error: reviewsError } =
      await supabaseAdmin
        .from("reviews")
        .select(
          "id, booking_id, author_id, target_id, rating, comment, created_at"
        )
        .eq("target_id", providerId)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

    if (reviewsError) {
      throw reviewsError;
    }

    const reviews = (reviewsData ?? []) as ReviewRow[];

    if (reviews.length === 0) {
      return NextResponse.json({
        averageRating: 0,
        reviewCount: 0,
        reviews: [],
      });
    }

    const bookingIds = [
      ...new Set(
        reviews.map((review) => review.booking_id)
      ),
    ];

    const { data: bookingsData, error: bookingsError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          "id, status, provider_id, babysitter_id"
        )
        .in("id", bookingIds);

    if (bookingsError) {
      throw bookingsError;
    }

    const bookings = (bookingsData ?? []) as BookingRow[];

    const validBookingIds = new Set(
      bookings
        .filter((booking) => {
          const bookingProviderId =
            booking.provider_id ??
            booking.babysitter_id;

          return (
            booking.status === "completed" &&
            bookingProviderId === providerId
          );
        })
        .map((booking) => booking.id)
    );

    const verifiedReviews = reviews.filter(
      (review) =>
        validBookingIds.has(review.booking_id) &&
        Number(review.rating) >= 1 &&
        Number(review.rating) <= 5
    );

    if (verifiedReviews.length === 0) {
      return NextResponse.json({
        averageRating: 0,
        reviewCount: 0,
        reviews: [],
      });
    }

    const authorIds = [
      ...new Set(
        verifiedReviews.map((review) => review.author_id)
      ),
    ];

    const { data: profilesData, error: profilesError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", authorIds);

    if (profilesError) {
      throw profilesError;
    }

    const profileMap = new Map(
      ((profilesData ?? []) as ProfileRow[]).map(
        (profile) => [profile.id, profile]
      )
    );

    const averageRating =
      verifiedReviews.reduce(
        (sum, review) => sum + Number(review.rating),
        0
      ) / verifiedReviews.length;

    return NextResponse.json({
      averageRating: Number(averageRating.toFixed(2)),
      reviewCount: verifiedReviews.length,
      reviews: verifiedReviews.map((review) => {
        const author = profileMap.get(review.author_id);

        return {
          id: review.id,
          rating: Number(review.rating),
          comment: review.comment ?? "",
          createdAt: review.created_at,
          authorName: publicAuthorName(author),
          authorAvatarUrl: null,
          verified: true,
        };
      }),
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_public_reviews_load_failed",
      route: "/api/providers/[id]/reviews",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_PUBLIC_REVIEWS_LOAD_FAILED",
      startedAt,
    });
  }
}
