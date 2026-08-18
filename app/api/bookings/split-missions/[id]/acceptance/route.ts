import {
  NextResponse,
} from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  secureApiErrorResponse,
} from "@/lib/api-error";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_SPLIT_PROVIDER_ACCEPTANCE_API_13_22

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

type JsonRow =
  Record<string, unknown>;

type BatchRow = {
  id:
    string;

  market_request_id:
    string;

  client_profile_id:
    string;

  status:
    string;

  expected_booking_count:
    number;

  provider_count:
    number;

  created_booking_count:
    number;
};

type ItemRow = {
  id:
    string;

  batch_id:
    string;

  booking_id:
    string;

  slot_id:
    string;

  slot_position:
    number;

  provider_profile_id:
    string;

  user_service_id:
    string;
};

type ProfileRow = {
  id:
    string;

  first_name:
    string | null;

  last_name:
    string | null;

  avatar_url:
    string | null;
};

type ProviderState =
  | "pending"
  | "accepted"
  | "rejected"
  | "recovery_required";

type AggregateState =
  | "waiting"
  | "partially_accepted"
  | "all_accepted"
  | "rebuild_required"
  | "recovery_required";

function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function bookingStatus(
  booking:
    JsonRow | undefined
): string {
  if (!booking) {
    return "";
  }

  return text(
    booking.status
  ).toLowerCase();
}

function serviceStatus(
  booking:
    JsonRow | undefined
): string {
  if (!booking) {
    return "";
  }

  return text(
    booking.service_status
  ).toLowerCase();
}

function providerName(
  profile:
    ProfileRow | undefined
): string {
  if (!profile) {
    return "Prestataire KLYX";
  }

  const value =
    [
      profile.first_name,
      profile.last_name,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
      .trim();

  return value ||
    "Prestataire KLYX";
}

function isRejected(
  booking:
    JsonRow
): boolean {
  const status =
    bookingStatus(
      booking
    );

  return (
    status ===
      "rejected" ||
    status ===
      "cancelled"
  );
}

function isAccepted(
  booking:
    JsonRow
): boolean {
  const status =
    bookingStatus(
      booking
    );

  const liveStatus =
    serviceStatus(
      booking
    );

  if (
    [
      "accepted",
      "confirmed",
      "completed",
    ].includes(
      status
    )
  ) {
    return true;
  }

  if (
    [
      "started",
      "in_progress",
      "arrived",
      "ongoing",
      "completed",
    ].includes(
      liveStatus
    )
  ) {
    return true;
  }

  return false;
}

export async function GET(
  request:
    Request,

  context:
    RouteContext
) {
  const startedAt =
    Date.now();

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const {
      id:
        batchId,
    } =
      await context.params;

    const {
      data:
        batchData,

      error:
        batchError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .select(
          "id, market_request_id, client_profile_id, status, expected_booking_count, provider_count, created_booking_count"
        )
        .eq(
          "id",
          batchId
        )
        .eq(
          "client_profile_id",
          profile.id
        )
        .maybeSingle();

    if (
      batchError
    ) {
      throw new Error(
        batchError.message
      );
    }

    const batch =
      batchData as unknown as
        BatchRow |
        null;

    if (!batch) {
      return NextResponse.json(
        {
          error:
            "Mission multi-prestataires introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    const {
      data:
        itemData,

      error:
        itemError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batch_items"
        )
        .select(
          "id, batch_id, booking_id, slot_id, slot_position, provider_profile_id, user_service_id"
        )
        .eq(
          "batch_id",
          batch.id
        )
        .order(
          "slot_position",
          {
            ascending:
              true,
          }
        );

    if (
      itemError
    ) {
      throw new Error(
        itemError.message
      );
    }

    const items =
      (
        itemData ??
        []
      ) as unknown as
        ItemRow[];

    const bookingIds =
      Array.from(
        new Set(
          items.map(
            (
              item
            ) =>
              item.booking_id
          )
        )
      );

    let bookings:
      JsonRow[] =
      [];

    if (
      bookingIds.length >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "bookings"
          )
          .select(
            "*"
          )
          .in(
            "id",
            bookingIds
          );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      bookings =
        (
          data ??
          []
        ) as unknown as
          JsonRow[];
    }

    const bookingById =
      new Map<
        string,
        JsonRow
      >();

    for (
      const booking
      of bookings
    ) {
      const id =
        text(
          booking.id
        );

      if (id) {
        bookingById.set(
          id,
          booking
        );
      }
    }

    const providerIds =
      Array.from(
        new Set(
          items.map(
            (
              item
            ) =>
              item.provider_profile_id
          )
        )
      );

    let profiles:
      ProfileRow[] =
      [];

    if (
      providerIds.length >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .select(
            "id, first_name, last_name, avatar_url"
          )
          .in(
            "id",
            providerIds
          );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      profiles =
        (
          data ??
          []
        ) as unknown as
          ProfileRow[];
    }

    const profileById =
      new Map(
        profiles.map(
          (
            profileRow
          ) => [
            profileRow.id,
            profileRow,
          ]
        )
      );

    const providerItems =
      new Map<
        string,
        ItemRow[]
      >();

    for (
      const item
      of items
    ) {
      const current =
        providerItems.get(
          item.provider_profile_id
        ) ??
        [];

      current.push(
        item
      );

      providerItems.set(
        item.provider_profile_id,
        current
      );
    }

    const providers =
      providerIds.map(
        (
          providerId
        ) => {
          const slots =
            providerItems.get(
              providerId
            ) ??
            [];

          let acceptedSlots =
            0;

          let pendingSlots =
            0;

          let rejectedSlots =
            0;

          let missingSlots =
            0;

          for (
            const slot
            of slots
          ) {
            const booking =
              bookingById.get(
                slot.booking_id
              );

            if (!booking) {
              missingSlots +=
                1;

              continue;
            }

            if (
              isRejected(
                booking
              )
            ) {
              rejectedSlots +=
                1;

              continue;
            }

            if (
              isAccepted(
                booking
              )
            ) {
              acceptedSlots +=
                1;

              continue;
            }

            pendingSlots +=
              1;
          }

          let state:
            ProviderState =
            "pending";

          if (
            missingSlots >
            0
          ) {
            state =
              "recovery_required";
          }

          if (
            missingSlots ===
              0 &&
            rejectedSlots >
              0
          ) {
            state =
              "rejected";
          }

          if (
            missingSlots ===
              0 &&
            rejectedSlots ===
              0 &&
            acceptedSlots ===
              slots.length &&
            slots.length >
              0
          ) {
            state =
              "accepted";
          }

          const provider =
            profileById.get(
              providerId
            );

          return {
            providerId,

            providerName:
              providerName(
                provider
              ),

            providerAvatar:
              provider
                ?.avatar_url ??
              null,

            state,

            slotCount:
              slots.length,

            acceptedSlots,

            pendingSlots,

            rejectedSlots,

            missingSlots,

            bookingIds:
              slots.map(
                (
                  slot
                ) =>
                  slot.booking_id
              ),
          };
        }
      );

    const expectedCount =
      Number(
        batch.expected_booking_count
      );

    const createdCount =
      Number(
        batch.created_booking_count
      );

    const providerCount =
      providers.length;

    const acceptedProviders =
      providers.filter(
        (
          provider
        ) =>
          provider.state ===
          "accepted"
      ).length;

    const pendingProviders =
      providers.filter(
        (
          provider
        ) =>
          provider.state ===
          "pending"
      ).length;

    const rejectedProviders =
      providers.filter(
        (
          provider
        ) =>
          provider.state ===
          "rejected"
      ).length;

    const recoveryProviders =
      providers.filter(
        (
          provider
        ) =>
          provider.state ===
          "recovery_required"
      ).length;

    let aggregateState:
      AggregateState =
      "waiting";

    const technicalMismatch =
      batch.status ===
        "failed" ||
      items.length !==
        expectedCount ||
      bookings.length !==
        expectedCount ||
      createdCount !==
        expectedCount ||
      recoveryProviders >
        0;

    if (
      technicalMismatch
    ) {
      aggregateState =
        "recovery_required";
    }

    if (
      !technicalMismatch &&
      rejectedProviders >
        0
    ) {
      aggregateState =
        "rebuild_required";
    }

    if (
      !technicalMismatch &&
      rejectedProviders ===
        0 &&
      acceptedProviders >
        0 &&
      acceptedProviders <
        providerCount
    ) {
      aggregateState =
        "partially_accepted";
    }

    if (
      !technicalMismatch &&
      rejectedProviders ===
        0 &&
      providerCount >
        0 &&
      acceptedProviders ===
        providerCount
    ) {
      aggregateState =
        "all_accepted";
    }

    const missionReadyForNextStep =
      aggregateState ===
      "all_accepted";

    const rebuildRecommended =
      aggregateState ===
      "rebuild_required";

    return NextResponse.json({
      batchId:
        batch.id,

      marketRequestId:
        batch.market_request_id,

      aggregateState,

      missionReadyForNextStep,

      rebuildRecommended,

      expectedBookingCount:
        expectedCount,

      createdBookingCount:
        createdCount,

      providerCount,

      acceptedProviders,

      pendingProviders,

      rejectedProviders,

      recoveryProviders,

      providers,

      clientConfirmationRequiredBeforeRebuild:
        true,

      automaticProviderReplacement:
        false,

      automaticRebuild:
        false,

      automaticBooking:
        false,

      automaticPayment:
        false,
    });
  }
  catch (
    error
  ) {
    return secureApiErrorResponse({
      error,
      event:
        "split_provider_acceptance_failed",
      route:
        "/api/bookings/split-missions/[id]/acceptance",
      method: "GET",
      status: 500,
      code:
        "split_provider_acceptance_failed",
      startedAt,
      details: {
        missionReadyForNextStep:
          false,
        rebuildRecommended:
          false,
        clientConfirmationRequiredBeforeRebuild:
          true,
        automaticProviderReplacement:
          false,
        automaticRebuild:
          false,
        automaticBooking:
          false,
        automaticPayment:
          false,
      },
    });
  }
}
