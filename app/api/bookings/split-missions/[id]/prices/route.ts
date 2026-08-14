import {
  createHash,
} from "crypto";

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

// KLYX_SPLIT_PRICE_RECONCILIATION_API_13_23

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

  client_profile_id:
    string;

  confirmation_id:
    string;

  status:
    string;

  expected_booking_count:
    number;

  created_booking_count:
    number;
};

type ItemRow = {
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

type PlanConfirmationRow = {
  id:
    string;

  plan_snapshot:
    unknown;
};

type PriceConfirmationRow = {
  id:
    string;

  price_hash:
    string;

  total_amount_cents:
    number;

  currency:
    string;

  confirmed_at:
    string;
};

type CanonicalPriceItem = {
  slotId:
    string;

  position:
    number;

  bookingId:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  budgetMaxCents:
    number | null;

  overBudget:
    boolean;
};

type CanonicalSnapshot = {
  batchId:
    string;

  itemCount:
    number;

  currency:
    string;

  totalAmountCents:
    number;

  items:
    CanonicalPriceItem[];
};

function asRecord(
  value:
    unknown
): JsonRow | null {
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

  return value as JsonRow;
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

function bookingAmountCents(
  booking:
    JsonRow
): number | null {
  const estimated =
    numberValue(
      booking.estimated_amount_cents
    );

  if (
    estimated !==
      null &&
    estimated >=
      0
  ) {
    return Math.round(
      estimated
    );
  }

  const total =
    numberValue(
      booking.amount_total
    );

  if (
    total !==
      null &&
    total >=
      0
  ) {
    return Math.round(
      total
    );
  }

  return null;
}

function bookingCurrency(
  booking:
    JsonRow
): string {
  const currency =
    text(
      booking.currency
    )
      .toUpperCase();

  return currency.length ===
    3
    ? currency
    : "";
}

function acceptedBooking(
  booking:
    JsonRow
): boolean {
  const status =
    text(
      booking.status
    )
      .toLowerCase();

  const serviceStatus =
    text(
      booking.service_status
    )
      .toLowerCase();

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
      "arrived",
      "ongoing",
      "in_progress",
      "completed",
    ].includes(
      serviceStatus
    )
  ) {
    return true;
  }

  return false;
}

function rejectedBooking(
  booking:
    JsonRow
): boolean {
  const status =
    text(
      booking.status
    )
      .toLowerCase();

  return (
    status ===
      "rejected" ||
    status ===
      "cancelled"
  );
}

function budgetMap(
  snapshot:
    unknown
): Map<
  string,
  number | null
> {
  const result =
    new Map<
      string,
      number | null
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

    if (!id) {
      continue;
    }

    const budget =
      numberValue(
        slot.budgetMax
      );

    result.set(
      id,
      budget ===
        null
        ? null
        : Math.round(
            budget *
            100
          )
    );
  }

  return result;
}

function hashSnapshot(
  snapshot:
    CanonicalSnapshot
): string {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        snapshot
      )
    )
    .digest(
      "hex"
    );
}

async function inspectPrices(
  batchId:
    string,

  profileId:
    string
) {
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
        "id, client_profile_id, confirmation_id, status, expected_booking_count, created_booking_count"
      )
      .eq(
        "id",
        batchId
      )
      .eq(
        "client_profile_id",
        profileId
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
    return null;
  }

  const [
    itemsResult,
    planResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from(
          "split_booking_batch_items"
        )
        .select(
          "batch_id, booking_id, slot_id, slot_position, provider_profile_id, user_service_id"
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
        ),

      supabaseAdmin
        .from(
          "market_split_plan_confirmations"
        )
        .select(
          "id, plan_snapshot"
        )
        .eq(
          "id",
          batch.confirmation_id
        )
        .maybeSingle(),
    ]);

  if (
    itemsResult.error
  ) {
    throw new Error(
      itemsResult.error.message
    );
  }

  if (
    planResult.error
  ) {
    throw new Error(
      planResult.error.message
    );
  }

  const items =
    (
      itemsResult.data ??
      []
    ) as unknown as
      ItemRow[];

  const plan =
    planResult.data as unknown as
      PlanConfirmationRow |
      null;

  const bookingIds =
    items.map(
      (
        item
      ) =>
        item.booking_id
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

  const budgets =
    budgetMap(
      plan?.plan_snapshot
    );

  const normalizedItems:
    CanonicalPriceItem[] =
    [];

  let missingPriceCount =
    0;

  let missingCurrencyCount =
    0;

  let rejectedCount =
    0;

  let pendingAcceptanceCount =
    0;

  let missingBookingCount =
    0;

  for (
    const item
    of items
  ) {
    const booking =
      bookingById.get(
        item.booking_id
      );

    if (!booking) {
      missingBookingCount +=
        1;

      continue;
    }

    if (
      rejectedBooking(
        booking
      )
    ) {
      rejectedCount +=
        1;
    }

    if (
      !rejectedBooking(
        booking
      ) &&
      !acceptedBooking(
        booking
      )
    ) {
      pendingAcceptanceCount +=
        1;
    }

    const amountCents =
      bookingAmountCents(
        booking
      );

    const currency =
      bookingCurrency(
        booking
      );

    if (
      amountCents ===
      null
    ) {
      missingPriceCount +=
        1;
    }

    if (!currency) {
      missingCurrencyCount +=
        1;
    }

    if (
      amountCents ===
        null ||
      !currency
    ) {
      continue;
    }

    const budgetMaxCents =
      budgets.has(
        item.slot_id
      )
        ? budgets.get(
            item.slot_id
          ) ??
          null
        : null;

    const overBudget =
      budgetMaxCents !==
        null &&
      amountCents >
        budgetMaxCents;

    normalizedItems.push({
      slotId:
        item.slot_id,

      position:
        item.slot_position,

      bookingId:
        item.booking_id,

      providerId:
        item.provider_profile_id,

      amountCents,

      currency,

      budgetMaxCents,

      overBudget,
    });
  }

  normalizedItems.sort(
    (
      first,
      second
    ) =>
      first.position -
      second.position
  );

  const currencies =
    Array.from(
      new Set(
        normalizedItems.map(
          (
            item
          ) =>
            item.currency
        )
      )
    );

  const mixedCurrency =
    currencies.length >
    1;

  const currency =
    currencies.length ===
      1
      ? currencies[0]
      : "";

  const totalAmountCents =
    normalizedItems.reduce(
      (
        total,
        item
      ) =>
        total +
        item.amountCents,
      0
    );

  const expectedCount =
    Number(
      batch.expected_booking_count
    );

  const technicalMismatch =
    batch.status !==
      "created" ||
    items.length !==
      expectedCount ||
    bookings.length !==
      expectedCount ||
    Number(
      batch.created_booking_count
    ) !==
      expectedCount ||
    missingBookingCount >
      0;

  const allProvidersAccepted =
    !technicalMismatch &&
    rejectedCount ===
      0 &&
    pendingAcceptanceCount ===
      0 &&
    expectedCount >
      0;

  const completePriceData =
    !technicalMismatch &&
    missingPriceCount ===
      0 &&
    missingCurrencyCount ===
      0 &&
    !mixedCurrency &&
    normalizedItems.length ===
      expectedCount &&
    Boolean(
      currency
    );

  const snapshot:
    CanonicalSnapshot = {
    batchId:
      batch.id,

    itemCount:
      normalizedItems.length,

    currency,

    totalAmountCents,

    items:
      normalizedItems,
  };

  const priceHash =
    completePriceData
      ? hashSnapshot(
          snapshot
        )
      : "";

  const overBudgetItems =
    normalizedItems.filter(
      (
        item
      ) =>
        item.overBudget
    );

  const {
    data:
      confirmationData,

    error:
      confirmationError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_price_confirmations"
      )
      .select(
        "id, price_hash, total_amount_cents, currency, confirmed_at"
      )
      .eq(
        "batch_id",
        batch.id
      )
      .is(
        "invalidated_at",
        null
      )
      .order(
        "confirmed_at",
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
    confirmationError
  ) {
    throw new Error(
      confirmationError.message
    );
  }

  let activeConfirmation =
    confirmationData as unknown as
      PriceConfirmationRow |
      null;

  let priceChangedAfterConfirmation =
    false;

  if (
    activeConfirmation &&
    (
      !priceHash ||
      activeConfirmation.price_hash !==
        priceHash
    )
  ) {
    priceChangedAfterConfirmation =
      true;

    const {
      error:
        invalidateError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_price_confirmations"
        )
        .update({
          invalidated_at:
            new Date()
              .toISOString(),

          invalidation_reason:
            "live_price_changed",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          activeConfirmation.id
        )
        .is(
          "invalidated_at",
          null
        );

    if (
      invalidateError
    ) {
      throw new Error(
        invalidateError.message
      );
    }

    activeConfirmation =
      null;
  }

  const confirmed =
    Boolean(
      activeConfirmation &&
      priceHash &&
      activeConfirmation.price_hash ===
        priceHash
    );

  const canConfirm =
    completePriceData &&
    allProvidersAccepted;

  return {
    batch,

    snapshot,

    priceHash,

    confirmed,

    activeConfirmation,

    canConfirm,

    completePriceData,

    allProvidersAccepted,

    technicalMismatch,

    priceChangedAfterConfirmation,

    expectedBookingCount:
      expectedCount,

    itemCount:
      items.length,

    missingBookingCount,

    missingPriceCount,

    missingCurrencyCount,

    mixedCurrency,

    currency:
      currency ||
      null,

    totalAmountCents,

    overBudgetCount:
      overBudgetItems.length,

    overBudgetItems,

    items:
      normalizedItems,
  };
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
        batchId,
    } =
      await context.params;

    const state =
      await inspectPrices(
        batchId,
        profile.id
      );

    if (!state) {
      return NextResponse.json(
        {
          error:
            "Mission KLYX introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    return NextResponse.json({
      batchId:
        state.batch.id,

      confirmed:
        state.confirmed,

      confirmationId:
        state.activeConfirmation
          ?.id ??
        null,

      confirmedAt:
        state.activeConfirmation
          ?.confirmed_at ??
        null,

      priceHash:
        state.priceHash ||
        null,

      canConfirm:
        state.canConfirm,

      allProvidersAccepted:
        state.allProvidersAccepted,

      completePriceData:
        state.completePriceData,

      technicalMismatch:
        state.technicalMismatch,

      priceChangedAfterConfirmation:
        state.priceChangedAfterConfirmation,

      reconfirmationRequired:
        !state.confirmed,

      expectedBookingCount:
        state.expectedBookingCount,

      itemCount:
        state.itemCount,

      missingBookingCount:
        state.missingBookingCount,

      missingPriceCount:
        state.missingPriceCount,

      missingCurrencyCount:
        state.missingCurrencyCount,

      mixedCurrency:
        state.mixedCurrency,

      currency:
        state.currency,

      totalAmountCents:
        state.totalAmountCents,

      overBudgetCount:
        state.overBudgetCount,

      items:
        state.items,

      explicitPriceConfirmationRequired:
        true,

      overBudgetAcknowledgementRequired:
        state.overBudgetCount >
        0,

      automaticProviderSelection:
        false,

      automaticBooking:
        false,

      automaticPayment:
        false,

      paymentCreated:
        false,
    });
  }
  catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de vérifier les prix de la mission.",

        detail:
          error instanceof Error
            ? error.message
            : "SPLIT_PRICE_RECONCILIATION_FAILED",

        confirmed:
          false,

        explicitPriceConfirmationRequired:
          true,

        automaticBooking:
          false,

        automaticPayment:
          false,

        paymentCreated:
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
        batchId,
    } =
      await context.params;

    const rawBody =
      await request.json();

    const body =
      asRecord(
        rawBody
      );

    if (
      !body ||
      body.priceConfirmed !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Confirmation explicite des prix requise.",

          code:
            "SPLIT_PRICE_CONFIRMATION_REQUIRED",

          automaticPayment:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            400,
        }
      );
    }

    const state =
      await inspectPrices(
        batchId,
        profile.id
      );

    if (!state) {
      return NextResponse.json(
        {
          error:
            "Mission KLYX introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      state.technicalMismatch
    ) {
      return NextResponse.json(
        {
          error:
            "La mission doit être récupérée avant de confirmer les prix.",

          code:
            "SPLIT_PRICE_RECOVERY_REQUIRED",

          automaticPayment:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      !state.allProvidersAccepted
    ) {
      return NextResponse.json(
        {
          error:
            "Tous les prestataires doivent avoir accepté avant la confirmation des prix.",

          code:
            "SPLIT_PRICE_ACCEPTANCE_REQUIRED",

          automaticPayment:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      !state.completePriceData ||
      !state.priceHash ||
      !state.currency
    ) {
      return NextResponse.json(
        {
          error:
            "Les montants de toutes les réservations ne sont pas encore exploitables.",

          code:
            "SPLIT_PRICE_DATA_INCOMPLETE",

          automaticPayment:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      state.overBudgetCount >
        0 &&
      body.overBudgetAcknowledged !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Le dépassement de budget doit être accepté explicitement.",

          code:
            "SPLIT_PRICE_OVER_BUDGET_ACK_REQUIRED",

          overBudgetCount:
            state.overBudgetCount,

          automaticPayment:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      state.confirmed &&
      state.activeConfirmation
    ) {
      return NextResponse.json({
        confirmed:
          true,

        existing:
          true,

        confirmationId:
          state.activeConfirmation.id,

        priceHash:
          state.priceHash,

        totalAmountCents:
          state.totalAmountCents,

        currency:
          state.currency,

        automaticPayment:
          false,

        paymentCreated:
          false,
      });
    }

    const {
      data:
        rpcData,

      error:
        rpcError,
    } =
      await supabaseAdmin
        .rpc(
          "klyx_confirm_split_booking_prices_13_23",
          {
            p_batch_id:
              state.batch.id,

            p_client_profile_id:
              profile.id,

            p_price_hash:
              state.priceHash,

            p_price_snapshot:
              state.snapshot,

            p_item_count:
              state.snapshot.itemCount,

            p_total_amount_cents:
              state.totalAmountCents,

            p_currency:
              state.currency,
          }
        );

    if (
      rpcError
    ) {
      throw new Error(
        rpcError.message
      );
    }

    const confirmationId =
      typeof rpcData ===
        "string"
        ? rpcData
        : String(
            rpcData
          );

    return NextResponse.json({
      confirmed:
        true,

      existing:
        false,

      confirmationId,

      priceHash:
        state.priceHash,

      totalAmountCents:
        state.totalAmountCents,

      currency:
        state.currency,

      overBudgetAcknowledged:
        state.overBudgetCount >
          0,

      explicitPriceConfirmation:
        true,

      automaticProviderSelection:
        false,

      automaticBooking:
        false,

      automaticPayment:
        false,

      paymentCreated:
        false,
    });
  }
  catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de confirmer les prix de cette mission.",

        detail:
          error instanceof Error
            ? error.message
            : "SPLIT_PRICE_CONFIRMATION_FAILED",

        confirmed:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,

        paymentCreated:
          false,
      },
      {
        status:
          500,
      }
    );
  }
}