import {
  NextResponse,
} from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_SPLIT_BOOKING_RECOVERY_API_13_20

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

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

  invalidated_at:
    string | null;
};

type JsonRecord =
  Record<string, unknown>;

type RecoveryState =
  | "created"
  | "creating"
  | "creating_stale"
  | "clean_failed"
  | "partial_survivors"
  | "complete_but_unfinalized"
  | "integrity_error";

function asRecord(
  value:
    unknown
): JsonRecord | null {
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

  return value as JsonRecord;
}

function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value
    : "";
}

function bookingProviderId(
  booking:
    JsonRecord
): string {
  return (
    text(
      booking.provider_profile_id
    ) ||
    text(
      booking.provider_id
    )
  );
}

function bookingClientId(
  booking:
    JsonRecord
): string {
  return (
    text(
      booking.client_profile_id
    ) ||
    text(
      booking.client_id
    )
  );
}

function bookingDate(
  booking:
    JsonRecord
): string {
  return (
    text(
      booking.booking_date
    ) ||
    text(
      booking.date
    )
  );
}

function bookingStart(
  booking:
    JsonRecord
): string {
  return (
    text(
      booking.start_time
    ) ||
    text(
      booking.startTime
    )
  );
}

function bookingEnd(
  booking:
    JsonRecord
): string {
  return (
    text(
      booking.end_time
    ) ||
    text(
      booking.endTime
    )
  );
}

function timePrefix(
  value:
    string
): string {
  return value
    .slice(
      0,
      5
    );
}

function planSlots(
  snapshot:
    unknown
): Map<
  string,
  JsonRecord
> {
  const result =
    new Map<
      string,
      JsonRecord
    >();

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
    return result;
  }

  for (
    const raw
    of root.slots
  ) {
    const slot =
      asRecord(
        raw
      );

    if (!slot) {
      continue;
    }

    const id =
      text(
        slot.id
      );

    if (id) {
      result.set(
        id,
        slot
      );
    }
  }

  return result;
}

async function inspectBatch(
  batch:
    BatchRow
) {
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
    items.map(
      (
        item
      ) =>
        item.booking_id
    );

  let bookingRows:
    JsonRecord[] =
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

    bookingRows =
      (
        data ??
        []
      ) as unknown as
        JsonRecord[];
  }

  const {
    data:
      confirmationData,

    error:
      confirmationError,
  } =
    await supabaseAdmin
      .from(
        "market_split_plan_confirmations"
      )
      .select(
        "id, plan_snapshot, invalidated_at"
      )
      .eq(
        "id",
        batch.confirmation_id
      )
      .maybeSingle();

  if (
    confirmationError
  ) {
    throw new Error(
      confirmationError.message
    );
  }

  const confirmation =
    confirmationData as unknown as
      ConfirmationRow |
      null;

  const slots =
    planSlots(
      confirmation?.plan_snapshot
    );

  const bookingById =
    new Map<
      string,
      JsonRecord
    >();

  for (
    const row
    of bookingRows
  ) {
    const id =
      text(
        row.id
      );

    if (id) {
      bookingById.set(
        id,
        row
      );
    }
  }

  let integrityError =
    false;

  const verifiedBookingIds:
    string[] =
    [];

  for (
    const item
    of items
  ) {
    const booking =
      bookingById.get(
        item.booking_id
      );

    if (!booking) {
      continue;
    }

    const slot =
      slots.get(
        item.slot_id
      );

    if (!slot) {
      integrityError =
        true;

      continue;
    }

    const providerId =
      bookingProviderId(
        booking
      );

    if (
      providerId &&
      providerId !==
        item.provider_profile_id
    ) {
      integrityError =
        true;

      continue;
    }

    const clientId =
      bookingClientId(
        booking
      );

    if (
      clientId &&
      clientId !==
        batch.client_profile_id
    ) {
      integrityError =
        true;

      continue;
    }

    const expectedDate =
      text(
        slot.date
      );

    const actualDate =
      bookingDate(
        booking
      );

    if (
      expectedDate &&
      actualDate &&
      expectedDate !==
        actualDate
    ) {
      integrityError =
        true;

      continue;
    }

    const expectedStart =
      timePrefix(
        text(
          slot.startTime
        )
      );

    const actualStart =
      timePrefix(
        bookingStart(
          booking
        )
      );

    if (
      expectedStart &&
      actualStart &&
      expectedStart !==
        actualStart
    ) {
      integrityError =
        true;

      continue;
    }

    const expectedEnd =
      timePrefix(
        text(
          slot.endTime
        )
      );

    const actualEnd =
      timePrefix(
        bookingEnd(
          booking
        )
      );

    if (
      expectedEnd &&
      actualEnd &&
      expectedEnd !==
        actualEnd
    ) {
      integrityError =
        true;

      continue;
    }

    verifiedBookingIds.push(
      item.booking_id
    );
  }

  const verifiedCount =
    verifiedBookingIds.length;

  const expected =
    Number(
      batch.expected_booking_count
    );

  const itemCount =
    items.length;

  const ageMs =
    Date.now() -
    new Date(
      batch.updated_at
    ).getTime();

  const stale =
    Number.isFinite(
      ageMs
    ) &&
    ageMs >
      10 * 60 * 1000;

  let state:
    RecoveryState =
    "creating";

  if (
    integrityError
  ) {
    state =
      "integrity_error";
  }
  else if (
    batch.status ===
      "created" &&
    verifiedCount ===
      expected &&
    itemCount ===
      expected
  ) {
    state =
      "created";
  }
  else if (
    verifiedCount ===
      expected &&
    itemCount ===
      expected
  ) {
    state =
      "complete_but_unfinalized";
  }
  else if (
    verifiedCount >
      0 ||
    itemCount >
      0
  ) {
    state =
      "partial_survivors";
  }
  else if (
    batch.status ===
      "failed"
  ) {
    state =
      "clean_failed";
  }
  else if (
    batch.status ===
      "creating" &&
    stale
  ) {
    state =
      "creating_stale";
  }

  return {
    state,

    batch,

    items,

    expectedBookingCount:
      expected,

    itemCount,

    verifiedBookingCount:
      verifiedCount,

    verifiedBookingIds,

    integrityError,

    stale,

    confirmationInvalidated:
      Boolean(
        confirmation
          ?.invalidated_at
      ),

    canFinalize:
      state ===
        "complete_but_unfinalized",

    canAutoRetry:
      false,

    automaticBooking:
      false,

    automaticPayment:
      false,
  };
}

async function loadBatch(
  requestId:
    string,

  profileId:
    string,

  batchId:
    string
): Promise<
  BatchRow |
  null
> {
  let query =
    supabaseAdmin
      .from(
        "split_booking_batches"
      )
      .select(
        "id, market_request_id, client_profile_id, confirmation_id, plan_hash, status, expected_booking_count, provider_count, created_booking_count, created_at, completed_at, failed_at, failure_reason, updated_at"
      )
      .eq(
        "market_request_id",
        requestId
      )
      .eq(
        "client_profile_id",
        profileId
      );

  if (
    batchId
  ) {
    query =
      query.eq(
        "id",
        batchId
      );
  }

  const {
    data,
    error,
  } =
    await query
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return data as unknown as
    BatchRow |
    null;
}

export async function GET(
  request:
    Request,

  context:
    RouteContext
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
      "client"
    );

    const {
      id:
        requestId,
    } =
      await context.params;

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

    const batch =
      await loadBatch(
        requestId,
        profile.id,
        batchId
      );

    if (!batch) {
      return NextResponse.json({
        found:
          false,

        state:
          null,

        canFinalize:
          false,

        canAutoRetry:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      });
    }

    const inspection =
      await inspectBatch(
        batch
      );

    return NextResponse.json({
      found:
        true,

      ...inspection,
    });
  }
  catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de vérifier la récupération de la réservation fractionnée.",

        detail:
          error instanceof Error
            ? error.message
            : "SPLIT_BOOKING_RECOVERY_FAILED",

        canFinalize:
          false,

        canAutoRetry:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          500,
      }
    );
  }
}

export async function POST(
  request:
    Request,

  context:
    RouteContext
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
      "client"
    );

    const {
      id:
        requestId,
    } =
      await context.params;

    const body =
      asRecord(
        await request.json()
      );

    if (
      !body ||
      body.action !==
        "finalize" ||
      body.recoveryConfirmed !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Confirmation explicite de récupération requise.",

          automaticBooking:
            false,

          automaticPayment:
            false,
        },
        {
          status:
            400,
        }
      );
    }

    const batchId =
      text(
        body.batchId
      );

    if (!batchId) {
      return NextResponse.json(
        {
          error:
            "Batch KLYX requis.",
        },
        {
          status:
            400,
        }
      );
    }

    const batch =
      await loadBatch(
        requestId,
        profile.id,
        batchId
      );

    if (!batch) {
      return NextResponse.json(
        {
          error:
            "Batch KLYX introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    const before =
      await inspectBatch(
        batch
      );

    if (
      before.state !==
      "complete_but_unfinalized"
    ) {
      return NextResponse.json(
        {
          error:
            "Ce batch ne peut pas être finalisé automatiquement.",

          recoveryState:
            before.state,

          automaticRetry:
            false,

          automaticBooking:
            false,

          automaticPayment:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    const now =
      new Date()
        .toISOString();

    const {
      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .update({
          status:
            "created",

          completed_at:
            now,

          failed_at:
            null,

          failure_reason:
            null,

          updated_at:
            now,
        })
        .eq(
          "id",
          batch.id
        )
        .eq(
          "client_profile_id",
          profile.id
        );

    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }

    const refreshed =
      await loadBatch(
        requestId,
        profile.id,
        batch.id
      );

    if (!refreshed) {
      throw new Error(
        "SPLIT_BOOKING_RECOVERY_REFRESH_FAILED"
      );
    }

    const after =
      await inspectBatch(
        refreshed
      );

    if (
      after.state !==
      "created"
    ) {
      throw new Error(
        "SPLIT_BOOKING_RECOVERY_FINALIZATION_FAILED"
      );
    }

    return NextResponse.json({
      recovered:
        true,

      ...after,

      automaticRetry:
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
    return NextResponse.json(
      {
        error:
          "Impossible de finaliser la récupération KLYX.",

        detail:
          error instanceof Error
            ? error.message
            : "SPLIT_BOOKING_RECOVERY_FINALIZE_FAILED",

        automaticRetry:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          500,
      }
    );
  }
}