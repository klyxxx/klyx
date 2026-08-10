import { supabaseAdmin } from "@/lib/supabase-admin";

type BookingRow = {
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
};

type UserServiceRow = {
  id: string;
  user_id: string;
};

type ReviewRow = {
  rating: number | null;
};

export type ProviderScoreResult = {
  providerId: string;
  updatedServices: number;
  completedJobs: number;
  cancelledJobs: number;
  totalJobs: number;
  cancellationRate: number;
  averageRating: number;
  reviewCount: number;
  klyxScore: number;
};

function clampScore(value: number): number {
  return Math.max(
    0,
    Math.min(100, Number(value.toFixed(2)))
  );
}

function calculateKlyxScore(params: {
  completedJobs: number;
  cancelledJobs: number;
  totalJobs: number;
  averageRating: number;
  reviewCount: number;
}): number {
  const {
    completedJobs,
    cancelledJobs,
    totalJobs,
    averageRating,
    reviewCount,
  } = params;

  /*
    KLYX SCORE v2 — 100 points

    Base confiance                     40
    Activité / expérience             20
    Taux de complétion                15
    Fiabilité / faible annulation     10
    Avis vérifiés                     15
  */

  const baseScore = 40;

  const activityScore = Math.min(
    completedJobs * 2,
    20
  );

  const completionRate =
    totalJobs > 0
      ? completedJobs / totalJobs
      : 0;

  const completionScore =
    completionRate * 15;

  const cancellationRate =
    totalJobs > 0
      ? cancelledJobs / totalJobs
      : 0;

  const reliabilityScore =
    Math.max(0, 10 - cancellationRate * 10);

  /*
    Aucun avis ne pénalise pas un nouveau profil.
    Dès le premier avis vérifié, la qualité entre
    progressivement dans le score.
  */
  const ratingWeight =
    reviewCount === 0
      ? 0
      : Math.min(1, reviewCount / 5);

  const normalizedRating =
    reviewCount === 0
      ? 0
      : (averageRating / 5) * 15;

  const reviewScore =
    normalizedRating * ratingWeight;

  return clampScore(
    baseScore +
      activityScore +
      completionScore +
      reliabilityScore +
      reviewScore
  );
}

export async function recalculateProviderScores(
  providerId: string
): Promise<ProviderScoreResult> {
  const [
    userServicesResult,
    providerBookingsResult,
    legacyBookingsResult,
    reviewsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("user_services")
      .select("id, user_id")
      .eq("user_id", providerId)
      .eq("active", true)
      .eq("provider_enabled", true),

    supabaseAdmin
      .from("bookings")
      .select(
        "provider_id, babysitter_id, status"
      )
      .eq("provider_id", providerId),

    supabaseAdmin
      .from("bookings")
      .select(
        "provider_id, babysitter_id, status"
      )
      .is("provider_id", null)
      .eq("babysitter_id", providerId),

    supabaseAdmin
      .from("reviews")
      .select("rating")
      .eq("target_id", providerId),
  ]);

  if (userServicesResult.error) {
    throw new Error(
      userServicesResult.error.message
    );
  }

  if (providerBookingsResult.error) {
    throw new Error(
      providerBookingsResult.error.message
    );
  }

  if (legacyBookingsResult.error) {
    throw new Error(
      legacyBookingsResult.error.message
    );
  }

  if (reviewsResult.error) {
    throw new Error(
      reviewsResult.error.message
    );
  }

  const userServices =
    (userServicesResult.data ?? []) as UserServiceRow[];

  const bookings = [
    ...((providerBookingsResult.data ??
      []) as BookingRow[]),
    ...((legacyBookingsResult.data ??
      []) as BookingRow[]),
  ];

  const completedJobs = bookings.filter(
    (booking) => booking.status === "completed"
  ).length;

  const cancelledJobs = bookings.filter(
    (booking) => booking.status === "cancelled"
  ).length;

  const totalJobs = bookings.length;

  const cancellationRate =
    totalJobs > 0
      ? Number(
          (
            (cancelledJobs / totalJobs) *
            100
          ).toFixed(2)
        )
      : 0;

  const reviews =
    (reviewsResult.data ?? []) as ReviewRow[];

  const validRatings = reviews
    .map((review) => Number(review.rating))
    .filter(
      (rating) =>
        Number.isFinite(rating) &&
        rating >= 1 &&
        rating <= 5
    );

  const reviewCount = validRatings.length;

  const averageRating =
    reviewCount > 0
      ? Number(
          (
            validRatings.reduce(
              (sum, rating) => sum + rating,
              0
            ) / reviewCount
          ).toFixed(2)
        )
      : 0;

  const klyxScore = calculateKlyxScore({
    completedJobs,
    cancelledJobs,
    totalJobs,
    averageRating,
    reviewCount,
  });

  if (userServices.length > 0) {
    const userServiceIds = userServices.map(
      (service) => service.id
    );

    const { error: updateError } =
      await supabaseAdmin
        .from("service_profiles")
        .update({
          klyx_score: klyxScore,
          completed_jobs: completedJobs,
          cancellation_rate: cancellationRate,
          rating:
            reviewCount > 0
              ? averageRating
              : 0,
          review_count: reviewCount,
          last_score_at: new Date().toISOString(),
        })
        .in("user_service_id", userServiceIds);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    providerId,
    updatedServices: userServices.length,
    completedJobs,
    cancelledJobs,
    totalJobs,
    cancellationRate,
    averageRating,
    reviewCount,
    klyxScore,
  };
}
