import "server-only";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_MULTI_SLOT_LIVE_COVERAGE_12_95

const DAY_MS =
  24 * 60 * 60 * 1000;

type MarketSlotRow = {
  id: string;
  position: number;
  requested_date: string;

  start_time:
    | string
    | null;

  end_time:
    | string
    | null;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type LiveCoverageSlot = {
  id: string;
  position: number;
  date: string;

  startTime:
    | string
    | null;

  endTime:
    | string
    | null;

  insideAvailability:
    boolean;

  conflictBookingId:
    | string
    | null;

  covered:
    boolean;

  reason:
    | "covered"
    | "missing_time"
    | "invalid_time"
    | "outside_availability"
    | "booking_conflict";
};

export type LiveCoverageResult = {
  requestId: string;
  providerProfileId: string;
  slotCount: number;
  coverageCount: number;
  fullCoverage: boolean;
  checkedAt: string;
  slots: LiveCoverageSlot[];
};

function minutes(
  value: string
): number | null {
  const match =
    /^(\d{2}):(\d{2})/.exec(
      value
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(
      match[1]
    );

  const mins =
    Number(
      match[2]
    );

  if (
    hours < 0 ||
    hours > 23 ||
    mins < 0 ||
    mins > 59
  ) {
    return null;
  }

  return (
    hours * 60 +
    mins
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

function previousWeekday(
  value: number
) {
  return (
    value + 6
  ) % 7;
}

function dateShift(
  date: string,
  days: number
) {
  const value =
    new Date(
      date +
      "T12:00:00Z"
    );

  value.setUTCDate(
    value.getUTCDate() +
    days
  );

  return value
    .toISOString()
    .slice(
      0,
      10
    );
}

function intervalTimestamp(
  date: string,
  startTime: string,
  endTime: string
) {
  const start =
    Date.parse(
      date +
      "T" +
      startTime.slice(
        0,
        5
      ) +
      ":00Z"
    );

  let end =
    Date.parse(
      date +
      "T" +
      endTime.slice(
        0,
        5
      ) +
      ":00Z"
    );

  if (
    !Number.isFinite(
      start
    ) ||
    !Number.isFinite(
      end
    )
  ) {
    return null;
  }

  if (
    end <= start
  ) {
    end +=
      DAY_MS;
  }

  return {
    start,
    end,
  };
}

function insideRecurringAvailability(
  slot: MarketSlotRow,
  availability: AvailabilityRow[]
) {
  if (
    !slot.start_time ||
    !slot.end_time
  ) {
    return false;
  }

  const targetStart =
    minutes(
      slot.start_time
    );

  const rawTargetEnd =
    minutes(
      slot.end_time
    );

  if (
    targetStart ===
      null ||
    rawTargetEnd ===
      null
  ) {
    return false;
  }

  const targetEnd =
    rawTargetEnd <=
    targetStart
      ? rawTargetEnd +
        1440
      : rawTargetEnd;

  const currentDay =
    weekday(
      slot.requested_date
    );

  const previousDay =
    previousWeekday(
      currentDay
    );

  for (
    const availabilitySlot
    of availability
  ) {
    const availabilityStart =
      minutes(
        availabilitySlot
          .start_time
      );

    const rawAvailabilityEnd =
      minutes(
        availabilitySlot
          .end_time
      );

    if (
      availabilityStart ===
        null ||
      rawAvailabilityEnd ===
        null
    ) {
      continue;
    }

    const crossesMidnight =
      rawAvailabilityEnd <=
      availabilityStart;

    if (
      Number(
        availabilitySlot
          .day_of_week
      ) ===
      currentDay
    ) {
      const availabilityEnd =
        crossesMidnight
          ? rawAvailabilityEnd +
            1440
          : rawAvailabilityEnd;

      if (
        targetStart >=
          availabilityStart &&
        targetEnd <=
          availabilityEnd
      ) {
        return true;
      }
    }

    /*
      Exemple :
      disponibilite dimanche 22h-03h,
      mission lundi 01h-02h.
    */
    if (
      crossesMidnight &&
      Number(
        availabilitySlot
          .day_of_week
      ) ===
        previousDay
    ) {
      const previousStart =
        availabilityStart -
        1440;

      const previousEnd =
        rawAvailabilityEnd;

      if (
        targetStart >=
          previousStart &&
        targetEnd <=
          previousEnd
      ) {
        return true;
      }
    }
  }

  return false;
}

function conflictBooking(
  slot: MarketSlotRow,
  bookings: BookingRow[]
) {
  if (
    !slot.start_time ||
    !slot.end_time
  ) {
    return null;
  }

  const target =
    intervalTimestamp(
      slot.requested_date,
      slot.start_time,
      slot.end_time
    );

  if (!target) {
    return null;
  }

  for (
    const booking
    of bookings
  ) {
    const interval =
      intervalTimestamp(
        booking.booking_date,
        booking.start_time,
        booking.end_time
      );

    if (!interval) {
      continue;
    }

    const overlaps =
      target.start <
        interval.end &&
      interval.start <
        target.end;

    if (overlaps) {
      return booking.id;
    }
  }

  return null;
}

export async function validateProviderLiveMultiSlotCoverage(
  params: {
    requestId: string;
    providerProfileId: string;
    userServiceId: string;
    expectedSlotCount: number;
  }
): Promise<LiveCoverageResult> {
  const {
    requestId,
    providerProfileId,
    userServiceId,
    expectedSlotCount,
  } = params;

  const {
    data:
      slotData,

    error:
      slotError,
  } = await supabaseAdmin
    .from(
      "market_service_request_slots"
    )
    .select(
      "id, position, requested_date, start_time, end_time"
    )
    .eq(
      "market_request_id",
      requestId
    )
    .order(
      "position",
      {
        ascending:
          true,
      }
    );

  if (slotError) {
    throw new Error(
      slotError.message
    );
  }

  const slots =
    (
      slotData ??
      []
    ) as unknown as
      MarketSlotRow[];

  if (
    slots.length !==
    expectedSlotCount ||
    slots.length < 2
  ) {
    return {
      requestId,
      providerProfileId,
      slotCount:
        slots.length,

      coverageCount: 0,
      fullCoverage: false,

      checkedAt:
        new Date()
          .toISOString(),

      slots:
        slots.map(
          (slot) => ({
            id:
              slot.id,

            position:
              Number(
                slot.position
              ),

            date:
              slot.requested_date,

            startTime:
              slot.start_time,

            endTime:
              slot.end_time,

            insideAvailability:
              false,

            conflictBookingId:
              null,

            covered:
              false,

            reason:
              "invalid_time",
          })
        ),
    };
  }

  const {
    data:
      availabilityData,

    error:
      availabilityError,
  } = await supabaseAdmin
    .from(
      "availability_slots"
    )
    .select(
      "day_of_week, start_time, end_time"
    )
    .eq(
      "user_service_id",
      userServiceId
    )
    .eq(
      "is_active",
      true
    );

  if (availabilityError) {
    throw new Error(
      availabilityError.message
    );
  }

  const availability =
    (
      availabilityData ??
      []
    ) as unknown as
      AvailabilityRow[];

  const dates =
    slots
      .map(
        (slot) =>
          slot.requested_date
      )
      .sort();

  const firstDate =
    dates[0];

  const lastDate =
    dates[
      dates.length - 1
    ];

  /*
    -1 / +1 permet de detecter aussi
    les missions existantes qui traversent minuit.
  */
  const bookingDateFrom =
    dateShift(
      firstDate,
      -1
    );

  const bookingDateTo =
    dateShift(
      lastDate,
      1
    );

  const {
    data:
      bookingData,

    error:
      bookingError,
  } = await supabaseAdmin
    .from(
      "bookings"
    )
    .select(
      "id, booking_date, start_time, end_time, status"
    )
    .or(
      "provider_id.eq." +
      providerProfileId +
      ",babysitter_id.eq." +
      providerProfileId
    )
    .gte(
      "booking_date",
      bookingDateFrom
    )
    .lte(
      "booking_date",
      bookingDateTo
    )
    .in(
      "status",
      [
        "accepted",
        "completed",
      ]
    );

  if (bookingError) {
    throw new Error(
      bookingError.message
    );
  }

  const bookings =
    (
      bookingData ??
      []
    ) as unknown as
      BookingRow[];

  const checkedSlots:
    LiveCoverageSlot[] =
    [];

  for (
    const slot
    of slots
  ) {
    if (
      !slot.start_time ||
      !slot.end_time
    ) {
      checkedSlots.push({
        id:
          slot.id,

        position:
          Number(
            slot.position
          ),

        date:
          slot.requested_date,

        startTime:
          slot.start_time,

        endTime:
          slot.end_time,

        insideAvailability:
          false,

        conflictBookingId:
          null,

        covered:
          false,

        reason:
          "missing_time",
      });

      continue;
    }

    const start =
      minutes(
        slot.start_time
      );

    const end =
      minutes(
        slot.end_time
      );

    if (
      start === null ||
      end === null
    ) {
      checkedSlots.push({
        id:
          slot.id,

        position:
          Number(
            slot.position
          ),

        date:
          slot.requested_date,

        startTime:
          slot.start_time,

        endTime:
          slot.end_time,

        insideAvailability:
          false,

        conflictBookingId:
          null,

        covered:
          false,

        reason:
          "invalid_time",
      });

      continue;
    }

    const insideAvailability =
      insideRecurringAvailability(
        slot,
        availability
      );

    if (
      !insideAvailability
    ) {
      checkedSlots.push({
        id:
          slot.id,

        position:
          Number(
            slot.position
          ),

        date:
          slot.requested_date,

        startTime:
          slot.start_time,

        endTime:
          slot.end_time,

        insideAvailability:
          false,

        conflictBookingId:
          null,

        covered:
          false,

        reason:
          "outside_availability",
      });

      continue;
    }

    const conflictId =
      conflictBooking(
        slot,
        bookings
      );

    if (conflictId) {
      checkedSlots.push({
        id:
          slot.id,

        position:
          Number(
            slot.position
          ),

        date:
          slot.requested_date,

        startTime:
          slot.start_time,

        endTime:
          slot.end_time,

        insideAvailability:
          true,

        conflictBookingId:
          conflictId,

        covered:
          false,

        reason:
          "booking_conflict",
      });

      continue;
    }

    checkedSlots.push({
      id:
        slot.id,

      position:
        Number(
          slot.position
        ),

      date:
        slot.requested_date,

      startTime:
        slot.start_time,

      endTime:
        slot.end_time,

      insideAvailability:
        true,

      conflictBookingId:
        null,

      covered:
        true,

      reason:
        "covered",
    });
  }

  const coverageCount =
    checkedSlots.filter(
      (slot) =>
        slot.covered
    ).length;

  return {
    requestId,
    providerProfileId,

    slotCount:
      checkedSlots.length,

    coverageCount,

    fullCoverage:
      checkedSlots.length ===
        expectedSlotCount &&
      coverageCount ===
        expectedSlotCount,

    checkedAt:
      new Date()
        .toISOString(),

    slots:
      checkedSlots,
  };
}