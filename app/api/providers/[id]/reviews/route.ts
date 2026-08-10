import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

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
  full_name: string | null;
  avatar_url: string | null;
};

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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
      throw new Error(reviewsError.message);
    }

    const reviews =
      (reviewsData ?? []) as ReviewRow[];

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
      throw new Error(bookingsError.message);
    }

    const bookings =
      (bookingsData ?? []) as BookingRow[];

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
        verifiedReviews.map(
          (review) => review.author_id
        )
      ),
    ];

    const { data: profilesData, error: profilesError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, first_name, last_name, full_name, avatar_url"
        )
        .in("id", authorIds);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const profileMap = new Map(
      ((profilesData ?? []) as ProfileRow[]).map(
        (profile) => [profile.id, profile]
      )
    );

    const averageRating =
      verifiedReviews.reduce(
        (sum, review) =>
          sum + Number(review.rating),
        0
      ) / verifiedReviews.length;

    return NextResponse.json({
      averageRating: Number(
        averageRating.toFixed(2)
      ),
      reviewCount: verifiedReviews.length,
      reviews: verifiedReviews.map((review) => {
        const author =
          profileMap.get(review.author_id);

        const authorName =
          author?.full_name?.trim() ||
          `${author?.first_name ?? ""} ${
            author?.last_name ?? ""
          }`.trim() ||
          "Client KLYX";

        return {
          id: review.id,
          rating: Number(review.rating),
          comment: review.comment ?? "",
          createdAt: review.created_at,
          authorName,
          authorAvatarUrl:
            author?.avatar_url ?? null,
          verified: true,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les avis.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
