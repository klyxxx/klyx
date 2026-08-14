import {
  NextResponse,
} from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_PROVIDER_GROUP_ACTIVITY_API_13_02

type BookingRow = {
  id:
    string;

  booking_group_id:
    | string
    | null;

  status:
    string;
};

type BookingGroupRow = {
  id:
    string;

  status:
    string;

  slot_count:
    number;
};

function completed(
  status: string
) {
  return (
    status ===
    "completed"
  );
}

function cancelled(
  status: string
) {
  return (
    status ===
      "cancelled" ||
    status ===
      "rejected"
  );
}

function safeSlots(
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
    parsed < 1
  ) {
    return 1;
  }

  return parsed;
}

function percent(
  numerator: number,
  denominator: number
) {
  if (
    denominator <= 0
  ) {
    return 0;
  }

  return Number(
    (
      (
        numerator /
        denominator
      ) *
      100
    ).toFixed(
      2
    )
  );
}

export async function GET(
  request: Request
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "provider"
    );

    const [
      directBookingsResult,
      legacyBookingsResult,
      groupsResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from(
            "bookings"
          )
          .select(
            "id, booking_group_id, status"
          )
          .eq(
            "provider_id",
            profile.id
          ),

        supabaseAdmin
          .from(
            "bookings"
          )
          .select(
            "id, booking_group_id, status"
          )
          .is(
            "provider_id",
            null
          )
          .eq(
            "babysitter_id",
            profile.id
          ),

        supabaseAdmin
          .from(
            "booking_groups"
          )
          .select(
            "id, status, slot_count"
          )
          .eq(
            "provider_profile_id",
            profile.id
          ),
      ]);

    if (
      directBookingsResult.error
    ) {
      throw new Error(
        directBookingsResult
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
      groupsResult.error
    ) {
      throw new Error(
        groupsResult
          .error.message
      );
    }

    /*
      Protection defensive contre une
      eventuelle duplication legacy.
    */
    const bookingMap =
      new Map<
        string,
        BookingRow
      >();

    const rawBookings = [
      ...(
        (
          directBookingsResult.data ??
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
      ne deviennent jamais plusieurs
      missions commerciales.
    */
    const singleBookings =
      bookings.filter(
        (booking) =>
          !booking.booking_group_id
      );

    const groups =
      (
        groupsResult.data ??
        []
      ) as unknown as
        BookingGroupRow[];

    const completedSingles =
      singleBookings.filter(
        (booking) =>
          completed(
            booking.status
          )
      ).length;

    const cancelledSingles =
      singleBookings.filter(
        (booking) =>
          cancelled(
            booking.status
          )
      ).length;

    const completedGroups =
      groups.filter(
        (group) =>
          completed(
            group.status
          )
      ).length;

    const cancelledGroups =
      groups.filter(
        (group) =>
          cancelled(
            group.status
          )
      ).length;

    // ========================================================
    // MISSIONS COMMERCIALES
    // ========================================================

    const totalMissions =
      singleBookings.length +
      groups.length;

    const completedMissions =
      completedSingles +
      completedGroups;

    const cancelledMissions =
      cancelledSingles +
      cancelledGroups;

    const activeMissions =
      Math.max(
        totalMissions -
          completedMissions -
          cancelledMissions,
        0
      );

    // ========================================================
    // VOLUME EXECUTION
    // ========================================================

    const groupedSlots =
      groups.reduce(
        (
          total,
          group
        ) =>
          total +
          safeSlots(
            group.slot_count
          ),
        0
      );

    const completedGroupedSlots =
      groups
        .filter(
          (group) =>
            completed(
              group.status
            )
        )
        .reduce(
          (
            total,
            group
          ) =>
            total +
            safeSlots(
              group.slot_count
            ),
          0
        );

    const totalSlots =
      singleBookings.length +
      groupedSlots;

    const completedSlots =
      completedSingles +
      completedGroupedSlots;

    return NextResponse.json({
      // KLYX_PROVIDER_ACTIVITY_GROUP_AWARE_13_02
      groupAware:
        true,

      missions: {
        total:
          totalMissions,

        active:
          activeMissions,

        completed:
          completedMissions,

        cancelled:
          cancelledMissions,

        single:
          singleBookings.length,

        grouped:
          groups.length,

        completionRate:
          percent(
            completedMissions,
            totalMissions
          ),

        cancellationRate:
          percent(
            cancelledMissions,
            totalMissions
          ),
      },

      execution: {
        totalSlots,

        completedSlots,

        groupedSlots,
      },

      semantics: {
        singleBookingEqualsMission:
          true,

        bookingGroupEqualsMission:
          true,

        groupChildrenCountAsExtraMissions:
          false,
      },

      /*
        Cette route observe uniquement.
        Elle ne cree/modifie aucun booking,
        paiement ou choix prestataire.
      */
      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les statistiques prestataire.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}