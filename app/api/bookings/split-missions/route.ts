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

// KLYX_SPLIT_MISSION_API_13_21

type RouteContextRow =
  Record<string, unknown>;

type BatchRow = {
  id:
    string;

  market_request_id:
    string;

  client_profile_id:
    string;

  confirmation_id:
    string;

  plan_hash:
    string;

  status:
    string;

  expected_booking_count:
    number;

  provider_count:
    number;

  created_booking_count:
    number;

  created_at:
    string;

  completed_at:
    string | null;

  failed_at:
    string | null;

  failure_reason:
    string | null;

  updated_at:
    string;
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

type ConfirmationRow = {
  id:
    string;

  plan_snapshot:
    unknown;
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

type ServiceRow = {
  id:
    string;

  name:
    string | null;

  slug:
    string | null;
};

type RequestRow = {
  id:
    string;

  service_id:
    string | null;
};

type PlanSlot = {
  id:
    string;

  position:
    number;

  date:
    string;

  startTime:
    string;

  endTime:
    string;

  budgetMax:
    number | null;

  providerId:
    string;

  userServiceId:
    string;
};

type MissionState =
  | "creating"
  | "recovery_required"
  | "awaiting_providers"
  | "partially_accepted"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "mixed_issue";

function asRecord(
  value:
    unknown
): RouteContextRow | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as RouteContextRow;
}

function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function numberValue(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
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

function parsePlanSlots(
  snapshot:
    unknown
): PlanSlot[] {
  const root =
    asRecord(
      snapshot
    );

  if (
    !root ||
    !Array.isArray(
      root.slots
    )
  ) {
    return [];
  }

  const result:
    PlanSlot[] =
    [];

  for (
    const rawSlot
    of root.slots
  ) {
    const slot =
      asRecord(
        rawSlot
      );

    if (!slot) {
      continue;
    }

    const id =
      text(
        slot.id
      );

    const providerId =
      text(
        slot.providerId
      );

    const userServiceId =
      text(
        slot.userServiceId
      );

    const date =
      text(
        slot.date
      );

    const startTime =
      text(
        slot.startTime
      );

    const endTime =
      text(
        slot.endTime
      );

    const position =
      Number(
        slot.position
      );

    if (
      !id ||
      !providerId ||
      !userServiceId ||
      !date ||
      !startTime ||
      !endTime ||
      !Number.isFinite(
        position
      )
    ) {
      continue;
    }

    result.push({
      id,

      position:
        Math.trunc(
          position
        ),

      date,

      startTime,

      endTime,

      budgetMax:
        numberValue(
          slot.budgetMax
        ),

      providerId,

      userServiceId,
    });
  }

  return result.sort(
    (
      first,
      second
    ) =>
      first.position -
      second.position
  );
}

function bookingProviderId(
  row:
    RouteContextRow | undefined
): string {
  if (!row) {
    return "";
  }

  return (
    text(
      row.provider_id
    ) ||
    text(
      row.provider_profile_id
    ) ||
    text(
      row.babysitter_id
    )
  );
}

function bookingStatus(
  row:
    RouteContextRow | undefined
): string {
  if (!row) {
    return "missing";
  }

  return (
    text(
      row.status
    )
      .toLowerCase() ||
    "unknown"
  );
}

function serviceStatus(
  row:
    RouteContextRow | undefined
): string {
  if (!row) {
    return "";
  }

  return text(
    row.service_status
  )
    .toLowerCase();
}

function missionState(
  batch:
    BatchRow,

  slots:
    Array<{
      booking:
        RouteContextRow |
        null;
    }>
): MissionState {
  if (
    batch.status ===
    "failed"
  ) {
    return "recovery_required";
  }

  if (
    batch.status ===
    "creating"
  ) {
    return "creating";
  }

  if (
    slots.length !==
      Number(
        batch.expected_booking_count
      ) ||
    slots.some(
      (
        slot
      ) =>
        !slot.booking
    )
  ) {
    return "recovery_required";
  }

  const statuses =
    slots.map(
      (
        slot
      ) =>
        bookingStatus(
          slot.booking ??
          undefined
        )
    );

  const serviceStatuses =
    slots.map(
      (
        slot
      ) =>
        serviceStatus(
          slot.booking ??
          undefined
        )
    );

  const completed =
    statuses.filter(
      (
        status
      ) =>
        status ===
          "completed"
    ).length;

  if (
    completed ===
    statuses.length
  ) {
    return "completed";
  }

  const cancelled =
    statuses.filter(
      (
        status
      ) =>
        status ===
          "cancelled" ||
        status ===
          "rejected"
    ).length;

  if (
    cancelled ===
    statuses.length
  ) {
    return "cancelled";
  }

  if (
    cancelled >
    0
  ) {
    return "mixed_issue";
  }

  if (
    serviceStatuses.some(
      (
        status
      ) =>
        [
          "started",
          "in_progress",
          "arrived",
          "ongoing",
        ].includes(
          status
        )
    )
  ) {
    return "in_progress";
  }

  const accepted =
    statuses.filter(
      (
        status
      ) =>
        status ===
          "accepted" ||
        status ===
          "confirmed"
    ).length;

  if (
    accepted ===
    statuses.length
  ) {
    return "confirmed";
  }

  if (
    accepted >
    0
  ) {
    return "partially_accepted";
  }

  return "awaiting_providers";
}

export async function GET(
  request:
    Request
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

    const url =
      new URL(
        request.url
      );

    const batchId =
      url.searchParams
        .get(
          "batchId"
        )
        ?.trim() ??
      "";

    let batchQuery =
      supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .select(
          "id, market_request_id, client_profile_id, confirmation_id, plan_hash, status, expected_booking_count, provider_count, created_booking_count, created_at, completed_at, failed_at, failure_reason, updated_at"
        )
        .eq(
          "client_profile_id",
          profile.id
        );

    if (
      batchId
    ) {
      batchQuery =
        batchQuery.eq(
          "id",
          batchId
        );
    }

    const {
      data:
        batchData,

      error:
        batchError,
    } =
      await batchQuery
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          batchId
            ? 1
            : 100
        );

    if (
      batchError
    ) {
      throw new Error(
        batchError.message
      );
    }

    const batches =
      (
        batchData ??
        []
      ) as unknown as
        BatchRow[];

    if (
      batches.length ===
      0
    ) {
      return NextResponse.json({
        missions:
          [],

        childBookingIds:
          [],

        missionCount:
          0,

        automaticBooking:
          false,

        automaticPayment:
          false,
      });
    }

    const batchIds =
      batches.map(
        (
          batch
        ) =>
          batch.id
      );

    const confirmationIds =
      Array.from(
        new Set(
          batches.map(
            (
              batch
            ) =>
              batch.confirmation_id
          )
        )
      );

    const requestIds =
      Array.from(
        new Set(
          batches.map(
            (
              batch
            ) =>
              batch.market_request_id
          )
        )
      );

    const [
      itemsResult,
      confirmationsResult,
      requestsResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from(
            "split_booking_batch_items"
          )
          .select(
            "id, batch_id, booking_id, slot_id, slot_position, provider_profile_id, user_service_id"
          )
          .in(
            "batch_id",
            batchIds
          ),

        supabaseAdmin
          .from(
            "market_split_plan_confirmations"
          )
          .select(
            "id, plan_snapshot"
          )
          .in(
            "id",
            confirmationIds
          ),

        supabaseAdmin
          .from(
            "market_service_requests"
          )
          .select(
            "id, service_id"
          )
          .in(
            "id",
            requestIds
          ),
      ]);

    if (
      itemsResult.error
    ) {
      throw new Error(
        itemsResult.error.message
      );
    }

    if (
      confirmationsResult.error
    ) {
      throw new Error(
        confirmationsResult.error.message
      );
    }

    if (
      requestsResult.error
    ) {
      throw new Error(
        requestsResult.error.message
      );
    }

    const items =
      (
        itemsResult.data ??
        []
      ) as unknown as
        ItemRow[];

    const confirmations =
      (
        confirmationsResult.data ??
        []
      ) as unknown as
        ConfirmationRow[];

    const requestRows =
      (
        requestsResult.data ??
        []
      ) as unknown as
        RequestRow[];

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
      RouteContextRow[] =
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
            "id, provider_id, babysitter_id, status, service_status"
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
          RouteContextRow[];
    }

    const confirmationById =
      new Map(
        confirmations.map(
          (
            confirmation
          ) => [
            confirmation.id,
            confirmation,
          ]
        )
      );

    const requestById =
      new Map(
        requestRows.map(
          (
            row
          ) => [
            row.id,
            row,
          ]
        )
      );

    const bookingById =
      new Map<
        string,
        RouteContextRow
      >();

    for (
      const booking
      of bookings
    ) {
      const id =
        text(
          booking.id
        );

      if (
        id
      ) {
        bookingById.set(
          id,
          booking
        );
      }
    }

    const itemByBatchAndSlot =
      new Map<
        string,
        ItemRow
      >();

    for (
      const item
      of items
    ) {
      itemByBatchAndSlot.set(
        item.batch_id +
          ":" +
          item.slot_id,
        item
      );
    }

    const providerIds =
      new Set<string>();

    const serviceIds =
      new Set<string>();

    for (
      const batch
      of batches
    ) {
      const confirmation =
        confirmationById.get(
          batch.confirmation_id
        );

      const slots =
        parsePlanSlots(
          confirmation
            ?.plan_snapshot
        );

      for (
        const slot
        of slots
      ) {
        providerIds.add(
          slot.providerId
        );
      }

      const requestRow =
        requestById.get(
          batch.market_request_id
        );

      if (
        requestRow
          ?.service_id
      ) {
        serviceIds.add(
          requestRow.service_id
        );
      }
    }

    const [
      profilesResult,
      servicesResult,
    ] =
      await Promise.all([
        providerIds.size >
          0
          ? supabaseAdmin
              .from(
                "profiles"
              )
              .select(
                "id, first_name, last_name, avatar_url"
              )
              .in(
                "id",
                Array.from(
                  providerIds
                )
              )
          : Promise.resolve({
              data:
                [] as ProfileRow[],

              error:
                null,
            }),

        serviceIds.size >
          0
          ? supabaseAdmin
              .from(
                "services"
              )
              .select(
                "id, name, slug"
              )
              .in(
                "id",
                Array.from(
                  serviceIds
                )
              )
          : Promise.resolve({
              data:
                [] as ServiceRow[],

              error:
                null,
            }),
      ]);

    if (
      profilesResult.error
    ) {
      throw new Error(
        profilesResult.error.message
      );
    }

    if (
      servicesResult.error
    ) {
      throw new Error(
        servicesResult.error.message
      );
    }

    const profileById =
      new Map(
        (
          (
            profilesResult.data ??
            []
          ) as unknown as
            ProfileRow[]
        ).map(
          (
            row
          ) => [
            row.id,
            row,
          ]
        )
      );

    const serviceById =
      new Map(
        (
          (
            servicesResult.data ??
            []
          ) as unknown as
            ServiceRow[]
        ).map(
          (
            row
          ) => [
            row.id,
            row,
          ]
        )
      );

    const missions =
      batches.map(
        (
          batch
        ) => {
          const confirmation =
            confirmationById.get(
              batch.confirmation_id
            );

          const planSlots =
            parsePlanSlots(
              confirmation
                ?.plan_snapshot
            );

          const missionSlots =
            planSlots.map(
              (
                slot
              ) => {
                const item =
                  itemByBatchAndSlot.get(
                    batch.id +
                      ":" +
                      slot.id
                  );

                const booking =
                  item
                    ? bookingById.get(
                        item.booking_id
                      ) ??
                      null
                    : null;

                const providerId =
                  slot.providerId ||
                  item
                    ?.provider_profile_id ||
                  bookingProviderId(
                    booking ??
                    undefined
                  );

                const provider =
                  profileById.get(
                    providerId
                  );

                return {
                  slotId:
                    slot.id,

                  position:
                    slot.position,

                  date:
                    slot.date,

                  startTime:
                    slot.startTime,

                  endTime:
                    slot.endTime,

                  budgetMax:
                    slot.budgetMax,

                  providerId,

                  providerName:
                    providerName(
                      provider
                    ),

                  providerAvatar:
                    provider
                      ?.avatar_url ??
                    null,

                  userServiceId:
                    slot.userServiceId,

                  bookingId:
                    item
                      ?.booking_id ??
                    null,

                  bookingStatus:
                    bookingStatus(
                      booking ??
                      undefined
                    ),

                  serviceStatus:
                    serviceStatus(
                      booking ??
                      undefined
                    ),
                };
              }
            );

          const requestRow =
            requestById.get(
              batch.market_request_id
            );

          const service =
            requestRow
              ?.service_id
              ? serviceById.get(
                  requestRow.service_id
                )
              : undefined;

          const state =
            missionState(
              batch,
              missionSlots.map(
                (
                  slot
                ) => ({
                  booking:
                    slot.bookingId
                      ? bookingById.get(
                          slot.bookingId
                        ) ??
                        null
                      : null,
                })
              )
            );

          const missionProviderIds =
            Array.from(
              new Set(
                missionSlots
                  .map(
                    (
                      slot
                    ) =>
                      slot.providerId
                  )
                  .filter(
                    Boolean
                  )
              )
            );

          const firstDate =
            missionSlots[0]
              ?.date ??
            null;

          const lastDate =
            missionSlots[
              missionSlots.length -
              1
            ]?.date ??
            null;

          return {
            id:
              batch.id,

            batchId:
              batch.id,

            marketRequestId:
              batch.market_request_id,

            confirmationId:
              batch.confirmation_id,

            status:
              state,

            batchStatus:
              batch.status,

            serviceId:
              requestRow
                ?.service_id ??
              null,

            serviceName:
              service
                ?.name ??
              "Service KLYX",

            serviceSlug:
              service
                ?.slug ??
              null,

            slotCount:
              Number(
                batch.expected_booking_count
              ),

            createdBookingCount:
              Number(
                batch.created_booking_count
              ),

            providerCount:
              missionProviderIds.length ||
              Number(
                batch.provider_count
              ),

            firstDate,

            lastDate,

            createdAt:
              batch.created_at,

            failureReason:
              batch.failure_reason,

            actionRequired:
              state ===
                "recovery_required" ||
              state ===
                "mixed_issue",

            slots:
              missionSlots,

            childBookingIds:
              missionSlots
                .map(
                  (
                    slot
                  ) =>
                    slot.bookingId
                )
                .filter(
                  (
                    value
                  ): value is string =>
                    Boolean(
                      value
                    )
                ),

            automaticBooking:
              false,

            automaticPayment:
              false,
          };
        }
      );

    const childBookingIds =
      Array.from(
        new Set(
          missions.flatMap(
            (
              mission
            ) =>
              mission
                .childBookingIds
          )
        )
      );

    return NextResponse.json({
      missions,

      childBookingIds,

      missionCount:
        missions.length,

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
        "split_mission_overview_failed",
      route:
        "/api/bookings/split-missions",
      method: "GET",
      status: 500,
      code:
        "split_mission_overview_failed",
      startedAt,
      details: {
        automaticBooking:
          false,
        automaticPayment:
          false,
      },
    });
  }
}
