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

// KLYX_SPLIT_PAYMENT_CONTRACT_API_13_24

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

  status:
    string;

  expected_booking_count:
    number;

  created_booking_count:
    number;
};

type BatchItemRow = {
  booking_id:
    string;

  slot_id:
    string;

  slot_position:
    number;

  provider_profile_id:
    string;
};

type PriceConfirmationRow = {
  id:
    string;

  price_hash:
    string;

  price_snapshot:
    unknown;

  item_count:
    number;

  total_amount_cents:
    number;

  currency:
    string;

  confirmed_at:
    string;
};

type SnapshotItem = {
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
};

type PaymentAllocation = {
  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  bookingIds:
    string[];

  slotIds:
    string[];

  slotCount:
    number;
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
  const value =
    text(
      booking.currency
    )
      .toUpperCase();

  return value.length ===
    3
    ? value
    : "";
}

function bookingAccepted(
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

  return [
    "started",
    "arrived",
    "ongoing",
    "in_progress",
    "completed",
  ].includes(
    serviceStatus
  );
}

function parseSnapshotItems(
  value:
    unknown
): SnapshotItem[] {
  const snapshot =
    asRecord(
      value
    );

  if (
    !snapshot ||
    !Array.isArray(
      snapshot.items
    )
  ) {
    return [];
  }

  const result:
    SnapshotItem[] =
    [];

  for (
    const rawItem
    of snapshot.items
  ) {
    const item =
      asRecord(
        rawItem
      );

    if (!item) {
      continue;
    }

    const slotId =
      text(
        item.slotId
      );

    const bookingId =
      text(
        item.bookingId
      );

    const providerId =
      text(
        item.providerId
      );

    const currency =
      text(
        item.currency
      )
        .toUpperCase();

    const position =
      numberValue(
        item.position
      );

    const amountCents =
      numberValue(
        item.amountCents
      );

    if (
      !slotId ||
      !bookingId ||
      !providerId ||
      currency.length !==
        3 ||
      position ===
        null ||
      amountCents ===
        null ||
      amountCents <
        0
    ) {
      continue;
    }

    result.push({
      slotId,

      position:
        Math.round(
          position
        ),

      bookingId,

      providerId,

      amountCents:
        Math.round(
          amountCents
        ),

      currency,
    });
  }

  result.sort(
    (
      first,
      second
    ) =>
      first.position -
      second.position
  );

  return result;
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
          "id, client_profile_id, status, expected_booking_count, created_booking_count"
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

    const [
      itemResult,
      confirmationResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from(
            "split_booking_batch_items"
          )
          .select(
            "booking_id, slot_id, slot_position, provider_profile_id"
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
            "split_booking_price_confirmations"
          )
          .select(
            "id, price_hash, price_snapshot, item_count, total_amount_cents, currency, confirmed_at"
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
          .maybeSingle(),
      ]);

    if (
      itemResult.error
    ) {
      throw new Error(
        itemResult.error.message
      );
    }

    if (
      confirmationResult.error
    ) {
      throw new Error(
        confirmationResult.error.message
      );
    }

    const batchItems =
      (
        itemResult.data ??
        []
      ) as unknown as
        BatchItemRow[];

    const confirmation =
      confirmationResult.data as unknown as
        PriceConfirmationRow |
        null;

    if (!confirmation) {
      return NextResponse.json({
        batchId:
          batch.id,

        strategy:
          "separate_provider_payments",

        paymentPlanReady:
          false,

        blockReason:
          "PRICE_CONFIRMATION_REQUIRED",

        allocations:
          [],

        paymentUnitCount:
          0,

        explicitPaymentConfirmationRequired:
          true,

        automaticPayment:
          false,

        paymentCreated:
          false,

        stripeCheckoutCreated:
          false,
      });
    }

    const snapshotItems =
      parseSnapshotItems(
        confirmation.price_snapshot
      );

    const bookingIds =
      snapshotItems.map(
        (
          item
        ) =>
          item.bookingId
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

    const batchItemByBooking =
      new Map<
        string,
        BatchItemRow
      >();

    for (
      const item
      of batchItems
    ) {
      batchItemByBooking.set(
        item.booking_id,
        item
      );
    }

    let liveMismatch =
      false;

    let acceptanceMismatch =
      false;

    let liveTotalAmountCents =
      0;

    for (
      const item
      of snapshotItems
    ) {
      const booking =
        bookingById.get(
          item.bookingId
        );

      const batchItem =
        batchItemByBooking.get(
          item.bookingId
        );

      if (
        !booking ||
        !batchItem
      ) {
        liveMismatch =
          true;

        continue;
      }

      if (
        batchItem.slot_id !==
          item.slotId ||
        batchItem.provider_profile_id !==
          item.providerId
      ) {
        liveMismatch =
          true;
      }

      const liveAmount =
        bookingAmountCents(
          booking
        );

      const liveCurrency =
        bookingCurrency(
          booking
        );

      if (
        liveAmount ===
          null ||
        liveAmount !==
          item.amountCents ||
        liveCurrency !==
          item.currency
      ) {
        liveMismatch =
          true;
      }

      if (
        !bookingAccepted(
          booking
        )
      ) {
        acceptanceMismatch =
          true;
      }

      if (
        liveAmount !==
        null
      ) {
        liveTotalAmountCents +=
          liveAmount;
      }
    }

    const expectedCount =
      Number(
        batch.expected_booking_count
      );

    const confirmedCount =
      Number(
        confirmation.item_count
      );

    const structureMismatch =
      batch.status !==
        "created" ||
      Number(
        batch.created_booking_count
      ) !==
        expectedCount ||
      batchItems.length !==
        expectedCount ||
      snapshotItems.length !==
        expectedCount ||
      bookings.length !==
        expectedCount ||
      confirmedCount !==
        expectedCount;

    const currency =
      text(
        confirmation.currency
      )
        .toUpperCase();

    const mixedCurrency =
      snapshotItems.some(
        (
          item
        ) =>
          item.currency !==
          currency
      );

    const totalMismatch =
      liveTotalAmountCents !==
        Number(
          confirmation.total_amount_cents
        );

    const exactProofValid =
      !structureMismatch &&
      !liveMismatch &&
      !acceptanceMismatch &&
      !mixedCurrency &&
      !totalMismatch &&
      currency.length ===
        3;

    const allocationMap =
      new Map<
        string,
        PaymentAllocation
      >();

    for (
      const item
      of snapshotItems
    ) {
      const existing =
        allocationMap.get(
          item.providerId
        );

      if (existing) {
        existing.amountCents +=
          item.amountCents;

        existing.bookingIds.push(
          item.bookingId
        );

        existing.slotIds.push(
          item.slotId
        );

        existing.slotCount +=
          1;

        continue;
      }

      allocationMap.set(
        item.providerId,
        {
          providerId:
            item.providerId,

          amountCents:
            item.amountCents,

          currency:
            item.currency,

          bookingIds:
            [
              item.bookingId,
            ],

          slotIds:
            [
              item.slotId,
            ],

          slotCount:
            1,
        }
      );
    }

    const allocations =
      Array.from(
        allocationMap.values()
      );

    const allocationTotal =
      allocations.reduce(
        (
          total,
          allocation
        ) =>
          total +
          allocation.amountCents,
        0
      );

    const allocationMismatch =
      allocationTotal !==
        Number(
          confirmation.total_amount_cents
        );

    const paymentPlanReady =
      exactProofValid &&
      !allocationMismatch &&
      allocations.length >=
        2;

    let blockReason:
      string |
      null =
      null;

    if (
      structureMismatch
    ) {
      blockReason =
        "MISSION_STRUCTURE_CHANGED";
    }

    if (
      !structureMismatch &&
      acceptanceMismatch
    ) {
      blockReason =
        "PROVIDER_ACCEPTANCE_CHANGED";
    }

    if (
      !structureMismatch &&
      !acceptanceMismatch &&
      liveMismatch
    ) {
      blockReason =
        "LIVE_PRICE_CHANGED";
    }

    if (
      !structureMismatch &&
      !acceptanceMismatch &&
      !liveMismatch &&
      (
        mixedCurrency ||
        totalMismatch ||
        allocationMismatch
      )
    ) {
      blockReason =
        "PRICE_PROOF_MISMATCH";
    }

    if (
      exactProofValid &&
      allocations.length <
        2
    ) {
      blockReason =
        "MULTI_PROVIDER_ALLOCATION_REQUIRED";
    }

    return NextResponse.json({
      batchId:
        batch.id,

      priceConfirmationId:
        confirmation.id,

      priceHash:
        confirmation.price_hash,

      priceConfirmedAt:
        confirmation.confirmed_at,

      strategy:
        "separate_provider_payments",

      architectureVersion:
        "13.24",

      paymentPlanReady,

      blockReason,

      totalAmountCents:
        Number(
          confirmation.total_amount_cents
        ),

      currency,

      providerCount:
        allocations.length,

      paymentUnitCount:
        allocations.length,

      allocations,

      invariants: {
        onePaymentUnitPerProvider:
          true,

        singleMissionForClient:
          true,

        oneDestinationPerPaymentUnit:
          true,

        livePriceMustMatchProof:
          true,

        allProvidersMustRemainAccepted:
          true,

        sameCurrencyRequired:
          true,
      },

      explicitPaymentConfirmationRequired:
        true,

      providerStripeReadinessChecked:
        false,

      automaticProviderSelection:
        false,

      automaticBooking:
        false,

      automaticPayment:
        false,

      paymentCreated:
        false,

      stripeCheckoutCreated:
        false,

      platformChargeWithTransfers:
        false,
    });
  }
  catch (
    error
  ) {
    return secureApiErrorResponse({
      error,
      event:
        "split_payment_plan_failed",
      route:
        "/api/bookings/split-missions/[id]/payment-plan",
      method: "GET",
      status: 500,
      code:
        "split_payment_plan_failed",
      startedAt,
      details: {
        paymentPlanReady:
          false,
        explicitPaymentConfirmationRequired:
          true,
        automaticPayment:
          false,
        paymentCreated:
          false,
        stripeCheckoutCreated:
          false,
      },
    });
  }
}
