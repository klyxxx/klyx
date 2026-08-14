import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_GROUP_LIFECYCLE_12_87

type GroupRow = {
  id: string;
  market_request_id: string;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  slot_count: number;
};

type BookingRow = {
  id: string;
  group_position: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  service_status: string | null;
  provider_finished_at: string | null;
  client_confirmed_at: string | null;
};

export type BookingGroupProgressState =
  | "awaiting_provider"
  | "awaiting_payment"
  | "upcoming"
  | "active"
  | "awaiting_client_confirmation"
  | "completed"
  | "cancelled"
  | "attention";

export type BookingGroupProgress = {
  groupId: string;
  groupStatus: string;
  paymentStatus: string;
  state: BookingGroupProgressState;

  total: number;
  completed: number;
  active: number;
  upcoming: number;
  pending: number;
  awaitingClientConfirmation: number;
  cancelled: number;

  progressPercent: number;
  allCompleted: boolean;

  nextBookingId: string | null;
};

function isCompleted(
  booking: BookingRow
) {
  return (
    booking.status ===
      "completed" ||
    booking.service_status ===
      "completed"
  );
}

function isActive(
  booking: BookingRow
) {
  return [
    "en_route",
    "arrived",
    "in_progress",
  ].includes(
    booking.service_status ??
      ""
  );
}

function isCancelled(
  booking: BookingRow
) {
  return (
    [
      "cancelled",
      "rejected",
    ].includes(
      booking.status
    ) ||
    booking.service_status ===
      "cancelled"
  );
}

function sortBookings(
  bookings: BookingRow[]
) {
  return [...bookings].sort(
    (first, second) => {
      const firstKey =
        first.booking_date +
        "T" +
        first.start_time;

      const secondKey =
        second.booking_date +
        "T" +
        second.start_time;

      return firstKey.localeCompare(
        secondKey
      );
    }
  );
}

function deriveState(
  params: {
    group: GroupRow;
    completed: number;
    total: number;
    active: number;
    awaitingClient: number;
    cancelled: number;
  }
): BookingGroupProgressState {
  if (
    params.total > 0 &&
    params.completed ===
      params.total
  ) {
    return "completed";
  }

  if (
    params.group.status ===
      "rejected" ||
    params.group.status ===
      "cancelled"
  ) {
    return "cancelled";
  }

  if (
    params.cancelled > 0
  ) {
    return "attention";
  }

  if (
    params.group.status ===
    "pending_provider"
  ) {
    return "awaiting_provider";
  }

  if (
    params.group.status ===
      "accepted" &&
    params.group.payment_status !==
      "paid"
  ) {
    return "awaiting_payment";
  }

  if (
    params.awaitingClient >
    0
  ) {
    return "awaiting_client_confirmation";
  }

  if (
    params.active > 0
  ) {
    return "active";
  }

  return "upcoming";
}

async function notifyGroupCompleted(
  group: GroupRow,
  firstBookingId: string | null
) {
  if (!firstBookingId) {
    return;
  }

  const rows = [
    {
      user_id:
        group.client_profile_id,
      booking_id:
        firstBookingId,
      market_request_id:
        group.market_request_id,
      type:
        "system",
      title:
        "Mission groupee terminee",
      message:
        "Tous les creneaux de cette mission sont maintenant termines et confirmes.",
      href:
        "/booking-groups/" +
        group.id,
      deduplication_key:
        "booking-group:" +
        group.id +
        ":completed:client",
    },

    {
      user_id:
        group.provider_profile_id,
      booking_id:
        firstBookingId,
      market_request_id:
        group.market_request_id,
      type:
        "system",
      title:
        "Mission groupee terminee",
      message:
        "Tous les creneaux de cette mission ont ete confirmes par le client.",
      href:
        "/booking-groups/" +
        group.id,
      deduplication_key:
        "booking-group:" +
        group.id +
        ":completed:provider",
    },
  ];

  const {
    error,
  } = await supabaseAdmin
    .from(
      "user_notifications"
    )
    .upsert(
      rows,
      {
        onConflict:
          "deduplication_key",
        ignoreDuplicates:
          true,
      }
    );

  if (error) {
    console.error(
      "Booking group completion notification:",
      error.message
    );
  }
}

export async function getBookingGroupProgress(
  groupId: string
): Promise<BookingGroupProgress> {
  const {
    data: groupData,
    error: groupError,
  } = await supabaseAdmin
    .from(
      "booking_groups"
    )
    .select(
      "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, slot_count"
    )
    .eq(
      "id",
      groupId
    )
    .maybeSingle();

  if (groupError) {
    throw new Error(
      groupError.message
    );
  }

  if (!groupData) {
    throw new Error(
      "Reservation groupee introuvable."
    );
  }

  const group =
    groupData as GroupRow;

  const {
    data: bookingData,
    error: bookingError,
  } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, group_position, booking_date, start_time, end_time, status, payment_status, service_status, provider_finished_at, client_confirmed_at"
    )
    .eq(
      "booking_group_id",
      groupId
    )
    .order(
      "group_position",
      {
        ascending: true,
      }
    );

  if (bookingError) {
    throw new Error(
      bookingError.message
    );
  }

  const bookings =
    sortBookings(
      (
        bookingData ??
        []
      ) as BookingRow[]
    );

  const total =
    bookings.length;

  const completed =
    bookings.filter(
      isCompleted
    ).length;

  const active =
    bookings.filter(
      (booking) =>
        !isCompleted(
          booking
        ) &&
        isActive(
          booking
        )
    ).length;

  const awaitingClient =
    bookings.filter(
      (booking) =>
        Boolean(
          booking.provider_finished_at
        ) &&
        !booking.client_confirmed_at &&
        !isCompleted(
          booking
        )
    ).length;

  const cancelled =
    bookings.filter(
      isCancelled
    ).length;

  const pending =
    bookings.filter(
      (booking) =>
        booking.status ===
        "pending"
    ).length;

  const upcoming =
    bookings.filter(
      (booking) =>
        booking.status ===
          "accepted" &&
        !isCompleted(
          booking
        ) &&
        !isActive(
          booking
        ) &&
        !booking.provider_finished_at
    ).length;

  const allCompleted =
    total > 0 &&
    completed === total;

  const progressPercent =
    total > 0
      ? Math.round(
          completed /
            total *
            100
        )
      : 0;

  const nextBooking =
    bookings.find(
      (booking) =>
        !isCompleted(
          booking
        ) &&
        !isCancelled(
          booking
        )
    ) ??
    null;

  return {
    groupId:
      group.id,

    groupStatus:
      group.status,

    paymentStatus:
      group.payment_status,

    state:
      deriveState({
        group,
        completed,
        total,
        active,
        awaitingClient,
        cancelled,
      }),

    total,
    completed,
    active,
    upcoming,
    pending,

    awaitingClientConfirmation:
      awaitingClient,

    cancelled,

    progressPercent,
    allCompleted,

    nextBookingId:
      nextBooking?.id ??
      null,
  };
}

export async function syncBookingGroupLifecycle(
  groupId:
    string | null
) {
  if (!groupId) {
    return null;
  }

  const progress =
    await getBookingGroupProgress(
      groupId
    );

  if (
    !progress.allCompleted ||
    progress.groupStatus ===
      "completed"
  ) {
    return progress;
  }

  const now =
    new Date()
      .toISOString();

  const {
    data: updated,
    error,
  } = await supabaseAdmin
    .from(
      "booking_groups"
    )
    .update({
      status:
        "completed",
      updated_at:
        now,
    })
    .eq(
      "id",
      groupId
    )
    .eq(
      "status",
      "accepted"
    )
    .select(
      "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, slot_count"
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (updated) {
    const {
      data: firstBooking,
    } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq(
        "booking_group_id",
        groupId
      )
      .order(
        "group_position",
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle();

    await notifyGroupCompleted(
      updated as GroupRow,
      firstBooking?.id ??
        null
    );
  }

  return {
    ...progress,
    groupStatus:
      updated
        ? "completed"
        : progress.groupStatus,
    state:
      "completed" as const,
  };
}