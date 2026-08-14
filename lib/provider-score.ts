import "server-only";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_AWARE_PROVIDER_SCORE_13_00

type BookingRow = {
  id: string;

  provider_id:
    | string
    | null;

  babysitter_id:
    | string
    | null;

  booking_group_id:
    | string
    | null;

  status: string;
};

type BookingGroupRow = {
  id: string;

  provider_profile_id:
    string;

  status:
    string;

  slot_count:
    number;
};

type UserServiceRow = {
  id: string;
  user_id: string;
};

type ReviewRow = {
  rating:
    | number
    | null;

  booking_group_id?:
    | string
    | null;
};

export type ProviderScoreResult = {
  providerId: string;

  updatedServices: number;

  /*
    Missions commerciales :
    - reservation simple = 1
    - groupe multi-slot = 1
  */
  completedJobs: number;
  cancelledJobs: number;
  totalJobs: number;

  /*
    Volume reel d execution :
    un groupe de 4 slots = 4 slots.
  */
  completedSlots: number;
  cancelledSlots: number;
  totalSlots: number;

  singleMissionCount: number;
  groupedMissionCount: number;

  cancellationRate: number;

  averageRating: number;
  reviewCount: number;

  klyxScore: number;

  groupAware: true;
};

function clampScore(
  value: number
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        value.toFixed(
          2
        )
      )
    )
  );
}

function calculateKlyxScore(
  params: {
    completedJobs: number;
    cancelledJobs: number;
    totalJobs: number;
    averageRating: number;
    reviewCount: number;
  }
): number {
  const {
    completedJobs,
    cancelledJobs,
    totalJobs,
    averageRating,
    reviewCount,
  } =
    params;

  /*
    KLYX SCORE v3 GROUP-AWARE

    Base confiance                     40
    Activite / experience             20
    Taux de completion                15
    Fiabilite / faible annulation     10
    Avis verifies                     15

    IMPORTANT :
    Les valeurs ci-dessus utilisent des
    MISSIONS COMMERCIALES et non le nombre
    brut de lignes bookings.

    Exemple :
    groupe lundi + mardi + mercredi
    = 1 mission commerciale,
    = 3 slots d execution.
  */

  const baseScore =
    40;

  const activityScore =
    Math.min(
      completedJobs *
        2,
      20
    );

  const completionRate =
    totalJobs >
    0
      ? completedJobs /
        totalJobs
      : 0;

  const completionScore =
    completionRate *
    15;

  const cancellationRate =
    totalJobs >
    0
      ? cancelledJobs /
        totalJobs
      : 0;

  const reliabilityScore =
    Math.max(
      0,
      10 -
        cancellationRate *
          10
    );

  /*
    Aucun avis ne penalise
    un nouveau profil.

    Une mission groupee produit
    un seul avis depuis KLYX 12.88.
  */
  const ratingWeight =
    reviewCount ===
    0
      ? 0
      : Math.min(
          1,
          reviewCount /
            5
        );

  const normalizedRating =
    reviewCount ===
    0
      ? 0
      : (
          averageRating /
          5
        ) *
        15;

  const reviewScore =
    normalizedRating *
    ratingWeight;

  return clampScore(
    baseScore +
      activityScore +
      completionScore +
      reliabilityScore +
      reviewScore
  );
}

function isCompleted(
  status: string
) {
  return (
    status ===
    "completed"
  );
}

function isCancelled(
  status: string
) {
  return (
    status ===
      "cancelled" ||
    status ===
      "rejected"
  );
}

function safeSlotCount(
  value: unknown
) {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      1
  ) {
    return 1;
  }

  return parsed;
}

export async function recalculateProviderScores(
  providerId: string
): Promise<ProviderScoreResult> {
  const [
    userServicesResult,
    providerBookingsResult,
    legacyBookingsResult,
    bookingGroupsResult,
    reviewsResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from(
          "user_services"
        )
        .select(
          "id, user_id"
        )
        .eq(
          "user_id",
          providerId
        )
        .eq(
          "active",
          true
        )
        .eq(
          "provider_enabled",
          true
        ),

      supabaseAdmin
        .from(
          "bookings"
        )
        .select(
          "id, provider_id, babysitter_id, booking_group_id, status"
        )
        .eq(
          "provider_id",
          providerId
        ),

      supabaseAdmin
        .from(
          "bookings"
        )
        .select(
          "id, provider_id, babysitter_id, booking_group_id, status"
        )
        .is(
          "provider_id",
          null
        )
        .eq(
          "babysitter_id",
          providerId
        ),

      supabaseAdmin
        .from(
          "booking_groups"
        )
        .select(
          "id, provider_profile_id, status, slot_count"
        )
        .eq(
          "provider_profile_id",
          providerId
        ),

      supabaseAdmin
        .from(
          "reviews"
        )
        .select(
          "rating, booking_group_id"
        )
        .eq(
          "target_id",
          providerId
        ),
    ]);

  if (
    userServicesResult.error
  ) {
    throw new Error(
      userServicesResult
        .error.message
    );
  }

  if (
    providerBookingsResult.error
  ) {
    throw new Error(
      providerBookingsResult
        .error.message
    );
  }

  if (
    legacyBookingsResult.error
  ) {
    throw new Error(
      legacyBookingsResult
        .error.message
    );
  }

  if (
    bookingGroupsResult.error
  ) {
    throw new Error(
      bookingGroupsResult
        .error.message
    );
  }

  if (
    reviewsResult.error
  ) {
    throw new Error(
      reviewsResult
        .error.message
    );
  }

  const userServices =
    (
      userServicesResult.data ??
      []
    ) as unknown as
      UserServiceRow[];

  const rawBookings = [
    ...(
      (
        providerBookingsResult.data ??
        []
      ) as unknown as
        BookingRow[]
    ),

    ...(
      (
        legacyBookingsResult.data ??
        []
      ) as unknown as
        BookingRow[]
    ),
  ];

  /*
    Deduplication defensive :
    normalement provider_id et babysitter_id
    ne devraient pas dupliquer la meme ligne,
    mais le score ne doit jamais doubler une mission.
  */
  const bookingMap =
    new Map<
      string,
      BookingRow
    >();

  for (
    const booking
    of rawBookings
  ) {
    bookingMap.set(
      booking.id,
      booking
    );
  }

  const bookings =
    Array.from(
      bookingMap.values()
    );

  /*
    Les enfants d un booking group
    ne sont PAS des missions commerciales
    independantes.
  */
  const singleBookings =
    bookings.filter(
      (booking) =>
        !booking.booking_group_id
    );

  const bookingGroups =
    (
      bookingGroupsResult.data ??
      []
    ) as unknown as
      BookingGroupRow[];

  /*
    Semantique metier :
    1 booking group = 1 mission commerciale.
  */

  const singleCompleted =
    singleBookings.filter(
      (booking) =>
        isCompleted(
          booking.status
        )
    ).length;

  const singleCancelled =
    singleBookings.filter(
      (booking) =>
        isCancelled(
          booking.status
        )
    ).length;

  const groupCompleted =
    bookingGroups.filter(
      (group) =>
        isCompleted(
          group.status
        )
    ).length;

  const groupCancelled =
    bookingGroups.filter(
      (group) =>
        isCancelled(
          group.status
        )
    ).length;

  /*
    METRIQUES COMMERCIALES
  */
  const completedJobs =
    singleCompleted +
    groupCompleted;

  const cancelledJobs =
    singleCancelled +
    groupCancelled;

  const totalJobs =
    singleBookings.length +
    bookingGroups.length;

  /*
    METRIQUES EXECUTION

    Booking simple = 1 slot.

    Booking groupe :
    slot_count indique le volume
    d execution de cette mission.
  */
  const completedGroupSlots =
    bookingGroups
      .filter(
        (group) =>
          isCompleted(
            group.status
          )
      )
      .reduce(
        (
          total,
          group
        ) =>
          total +
          safeSlotCount(
            group.slot_count
          ),
        0
      );

  const cancelledGroupSlots =
    bookingGroups
      .filter(
        (group) =>
          isCancelled(
            group.status
          )
      )
      .reduce(
        (
          total,
          group
        ) =>
          total +
          safeSlotCount(
            group.slot_count
          ),
        0
      );

  const totalGroupSlots =
    bookingGroups.reduce(
      (
        total,
        group
      ) =>
        total +
        safeSlotCount(
          group.slot_count
        ),
      0
    );

  const completedSlots =
    singleCompleted +
    completedGroupSlots;

  const cancelledSlots =
    singleCancelled +
    cancelledGroupSlots;

  const totalSlots =
    singleBookings.length +
    totalGroupSlots;

  const cancellationRate =
    totalJobs >
    0
      ? Number(
          (
            (
              cancelledJobs /
              totalJobs
            ) *
            100
          ).toFixed(
            2
          )
        )
      : 0;

  const reviews =
    (
      reviewsResult.data ??
      []
    ) as unknown as
      ReviewRow[];

  const validRatings =
    reviews
      .map(
        (review) =>
          Number(
            review.rating
          )
      )
      .filter(
        (rating) =>
          Number.isFinite(
            rating
          ) &&
          rating >=
            1 &&
          rating <=
            5
      );

  const reviewCount =
    validRatings.length;

  const averageRating =
    reviewCount >
    0
      ? Number(
          (
            validRatings.reduce(
              (
                sum,
                rating
              ) =>
                sum +
                rating,
              0
            ) /
            reviewCount
          ).toFixed(
            2
          )
        )
      : 0;

  const klyxScore =
    calculateKlyxScore({
      completedJobs,
      cancelledJobs,
      totalJobs,
      averageRating,
      reviewCount,
    });

  if (
    userServices.length >
    0
  ) {
    const userServiceIds =
      userServices.map(
        (service) =>
          service.id
      );

    /*
      Les colonnes historiques gardent
      leur nom pour compatibilite.

      completed_jobs devient maintenant
      le nombre de missions commerciales
      terminees, et non le nombre brut
      de bookings enfants.
    */
    const {
      error:
        updateError,
    } = await supabaseAdmin
      .from(
        "service_profiles"
      )
      .update({
        klyx_score:
          klyxScore,

        completed_jobs:
          completedJobs,

        cancellation_rate:
          cancellationRate,

        rating:
          reviewCount >
          0
            ? averageRating
            : 0,

        review_count:
          reviewCount,

        last_score_at:
          new Date()
            .toISOString(),
      })
      .in(
        "user_service_id",
        userServiceIds
      );

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }
  }

  return {
    providerId,

    updatedServices:
      userServices.length,

    completedJobs,
    cancelledJobs,
    totalJobs,

    completedSlots,
    cancelledSlots,
    totalSlots,

    singleMissionCount:
      singleBookings.length,

    groupedMissionCount:
      bookingGroups.length,

    cancellationRate,

    averageRating,
    reviewCount,

    klyxScore,

    groupAware:
      true,
  };
}