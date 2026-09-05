import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  ConfirmedMultiSlot,
} from "@/lib/brain-multi-slot-proof";

// KLYX_MULTI_SLOT_PROVIDER_MATCHING_12_83

type UserServiceRow = {
  id: string;
  user_id: string;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BookingRow = {
  id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type MultiSlotCandidate = {
  providerProfileId: string;
  coverageCount: number;
  slotCount: number;
  fullCoverage: boolean;
};

function minutes(
  value: string
) {
  const match =
    /^(\d{2}):(\d{2})/.exec(
      value
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) *
      60 +
    Number(match[2])
  );
}

function dayNumber(
  date: string
) {
  return Math.floor(
    Date.parse(
      date +
      "T00:00:00Z"
    ) /
      86400000
  );
}

function absoluteInterval(
  date: string,
  startTime: string,
  endTime: string
) {
  const start =
    minutes(startTime);

  const rawEnd =
    minutes(endTime);

  if (
    start == null ||
    rawEnd == null
  ) {
    return null;
  }

  const day =
    dayNumber(date);

  let end =
    rawEnd;

  if (
    end <= start
  ) {
    end += 1440;
  }

  return {
    start:
      day * 1440 +
      start,
    end:
      day * 1440 +
      end,
  };
}

function overlaps(
  first: {
    start: number;
    end: number;
  },
  second: {
    start: number;
    end: number;
  }
) {
  return (
    first.start <
      second.end &&
    first.end >
      second.start
  );
}

function weekday(
  date: string
) {
  return new Date(
    date +
    "T12:00:00Z"
  ).getUTCDay();
}

function availabilityCovers(
  slot: ConfirmedMultiSlot,
  availability: AvailabilityRow
) {
  if (
    Number(
      availability.day_of_week
    ) !==
    weekday(slot.date)
  ) {
    return false;
  }

  const requestStart =
    minutes(
      slot.startTime
    );

  let requestEnd =
    minutes(
      slot.endTime
    );

  const availableStart =
    minutes(
      availability.start_time
    );

  let availableEnd =
    minutes(
      availability.end_time
    );

  if (
    requestStart == null ||
    requestEnd == null ||
    availableStart == null ||
    availableEnd == null
  ) {
    return false;
  }

  if (
    requestEnd <=
    requestStart
  ) {
    requestEnd += 1440;
  }

  if (
    availableEnd <=
    availableStart
  ) {
    availableEnd += 1440;
  }

  return (
    requestStart >=
      availableStart &&
    requestEnd <=
      availableEnd
  );
}

function previousDate(
  date: string
) {
  const value =
    new Date(
      date +
      "T12:00:00Z"
    );

  value.setUTCDate(
    value.getUTCDate() - 1
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function nextDate(
  date: string
) {
  const value =
    new Date(
      date +
      "T12:00:00Z"
    );

  value.setUTCDate(
    value.getUTCDate() + 1
  );

  return value
    .toISOString()
    .slice(0, 10);
}

export async function rankProvidersForMultiSlots(
  params: {
    serviceId: string;
    slots: ConfirmedMultiSlot[];
  }
): Promise<MultiSlotCandidate[]> {
  const {
    data: userServiceData,
    error: userServiceError,
  } = await supabaseAdmin
    .from("user_services")
    .select(
      "id, user_id"
    )
    .eq(
      "service_id",
      params.serviceId
    )
    .eq(
      "active",
      true
    )
    .eq(
      "provider_enabled",
      true
    );

  if (userServiceError) {
    throw new Error(
      userServiceError.message
    );
  }

  const userServices =
    (
      userServiceData ??
      []
    ) as UserServiceRow[];

  if (
    userServices.length === 0
  ) {
    return [];
  }

  const userServiceIds =
    userServices.map(
      (item) => item.id
    );

  const providerIds =
    [
      ...new Set(
        userServices.map(
          (item) =>
            item.user_id
        )
      ),
    ];

  const dates =
    [
      ...new Set(
        params.slots.flatMap(
          (slot) => [
            previousDate(
              slot.date
            ),
            slot.date,
            nextDate(
              slot.date
            ),
          ]
        )
      ),
    ];

  const [
    availabilityResult,
    bookingsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        "availability_slots"
      )
      .select(
        "user_service_id, day_of_week, start_time, end_time"
      )
      .in(
        "user_service_id",
        userServiceIds
      )
      .eq(
        "is_active",
        true
      ),

    supabaseAdmin
      .from("bookings")
      .select(
        "id, provider_id, babysitter_id, booking_date, start_time, end_time, status"
      )
      .in(
        "booking_date",
        dates
      )
      .in(
        "status",
        [
          "accepted",
          "completed",
        ]
      ),
  ]);

  if (
    availabilityResult.error
  ) {
    throw new Error(
      availabilityResult
        .error.message
    );
  }

  if (
    bookingsResult.error
  ) {
    throw new Error(
      bookingsResult
        .error.message
    );
  }

  const availability =
    (
      availabilityResult.data ??
      []
    ) as AvailabilityRow[];

  const providerSet =
    new Set(
      providerIds
    );

  const bookings =
    (
      bookingsResult.data ??
      []
    )
      .filter(
        (booking) => {
          const providerId =
            booking.provider_id ??
            booking.babysitter_id;

          return (
            providerId &&
            providerSet.has(
              providerId
            )
          );
        }
      ) as BookingRow[];

  const serviceIdsByProvider =
    new Map<
      string,
      string[]
    >();

  for (
    const item
    of userServices
  ) {
    const current =
      serviceIdsByProvider.get(
        item.user_id
      ) ?? [];

    current.push(
      item.id
    );

    serviceIdsByProvider.set(
      item.user_id,
      current
    );
  }

  const result:
    MultiSlotCandidate[] = [];

  for (
    const providerId
    of providerIds
  ) {
    const providerServiceIds =
      serviceIdsByProvider.get(
        providerId
      ) ?? [];

    const providerAvailability =
      availability.filter(
        (item) =>
          providerServiceIds.includes(
            item.user_service_id
          )
      );

    const providerBookings =
      bookings.filter(
        (booking) =>
          (
            booking.provider_id ??
            booking.babysitter_id
          ) ===
          providerId
      );

    let coverageCount = 0;

    for (
      const slot
      of params.slots
    ) {
      const hasAvailability =
        providerAvailability.some(
          (item) =>
            availabilityCovers(
              slot,
              item
            )
        );

      if (
        !hasAvailability
      ) {
        continue;
      }

      const requestedInterval =
        absoluteInterval(
          slot.date,
          slot.startTime,
          slot.endTime
        );

      if (
        !requestedInterval
      ) {
        continue;
      }

      const hasConflict =
        providerBookings.some(
          (booking) => {
            const interval =
              absoluteInterval(
                booking.booking_date,
                booking.start_time,
                booking.end_time
              );

            return (
              interval != null &&
              overlaps(
                requestedInterval,
                interval
              )
            );
          }
        );

      if (
        !hasConflict
      ) {
        coverageCount += 1;
      }
    }

    result.push({
      providerProfileId:
        providerId,
      coverageCount,
      slotCount:
        params.slots.length,
      fullCoverage:
        coverageCount ===
        params.slots.length,
    });
  }

  return result.sort(
    (first, second) => {
      if (
        first.fullCoverage !==
        second.fullCoverage
      ) {
        return first.fullCoverage
          ? -1
          : 1;
      }

      return (
        second.coverageCount -
        first.coverageCount
      );
    }
  );
}

export async function notifyFullCoverageProviders(
  params: {
    marketRequestId: string;
    candidates: MultiSlotCandidate[];
    serviceName: string;
    city: string;
    slotCount: number;
  }
) {
  const providerIds =
    params.candidates
      .filter(
        (item) =>
          item.fullCoverage
      )
      .map(
        (item) =>
          item.providerProfileId
      );

  if (
    providerIds.length === 0
  ) {
    return;
  }

  const rows =
    providerIds.map(
      (providerId) => ({
        user_id:
          providerId,
        booking_id:
          null,
        market_request_id:
          params.marketRequestId,
        type:
          "market_update",
        title:
          "Mission multi-creneaux compatible",
        message:
          params.serviceName +
          " · " +
          params.city +
          " · " +
          String(
            params.slotCount
          ) +
          " creneaux. Ton planning couvre actuellement tous les creneaux.",
        href:
          "/provider/jobs",
        idempotency_key:
          `market-provider:${params.marketRequestId}:${providerId}`,
      })
    );

  const { error } =
    await supabaseAdmin
      .from(
        "user_notifications"
      )
      .upsert(rows, {
        onConflict:
          "idempotency_key",
        ignoreDuplicates:
          true,
      });

  if (error) {
    console.error(
      "Multi-slot notification error:",
      error.message
    );

    throw new Error(
      "KLYX_MULTI_SLOT_PROVIDER_NOTIFICATION_DELIVERY_FAILED"
    );
  }
}