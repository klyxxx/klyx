import {
  createHash,
} from "crypto";

import {
  NextResponse,
} from "next/server";

import Stripe from "stripe";

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

// KLYX_SPLIT_PAYMENT_CONFIRMATION_API_13_26

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
};

type PaymentConfirmationRow = {
  id:
    string;

  payment_plan_hash:
    string;

  confirmed_at:
    string;

  consumed_at:
    string | null;
};

type PriceItem = {
  bookingId:
    string;

  slotId:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;
};

type PaymentUnit = {
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

  stripeAccountId:
    string;
};

type CanonicalPaymentPlan = {
  batchId:
    string;

  priceConfirmationId:
    string;

  providerCount:
    number;

  paymentUnitCount:
    number;

  totalAmountCents:
    number;

  currency:
    string;

  units:
    PaymentUnit[];
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

function stripeAccountId(
  profile:
    JsonRow | undefined
): string | null {
  if (!profile) {
    return null;
  }

  const fields =
    [
      "stripe_account_id",
      "stripe_connect_account_id",
      "connect_account_id",
      "stripeAccountId",
      "stripeConnectAccountId",
    ];

  for (
    const field
    of fields
  ) {
    const value =
      text(
        profile[field]
      );

    if (
      value.startsWith(
        "acct_"
      )
    ) {
      return value;
    }
  }

  return null;
}

function parsePriceItems(
  value:
    unknown
): PriceItem[] {
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
    PriceItem[] =
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

    const bookingId =
      text(
        item.bookingId
      );

    const slotId =
      text(
        item.slotId
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

    const amountCents =
      numberValue(
        item.amountCents
      );

    if (
      !bookingId ||
      !slotId ||
      !providerId ||
      currency.length !==
        3 ||
      amountCents ===
        null ||
      amountCents <
        0
    ) {
      continue;
    }

    result.push({
      bookingId,

      slotId,

      providerId,

      amountCents:
        Math.round(
          amountCents
        ),

      currency,
    });
  }

  return result;
}

function hashPlan(
  plan:
    CanonicalPaymentPlan
): string {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        plan
      )
    )
    .digest(
      "hex"
    );
}

async function inspect(
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
        "id, client_profile_id, status, expected_booking_count, created_booking_count"
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
    itemResult,
    priceResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from(
          "split_booking_batch_items"
        )
        .select(
          "booking_id, slot_id, provider_profile_id"
        )
        .eq(
          "batch_id",
          batch.id
        ),

      supabaseAdmin
        .from(
          "split_booking_price_confirmations"
        )
        .select(
          "id, price_hash, price_snapshot, item_count, total_amount_cents, currency"
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
    priceResult.error
  ) {
    throw new Error(
      priceResult.error.message
    );
  }

  const batchItems =
    (
      itemResult.data ??
      []
    ) as unknown as
      BatchItemRow[];

  const priceProof =
    priceResult.data as unknown as
      PriceConfirmationRow |
      null;

  if (!priceProof) {
    return {
      batch,

      ready:
        false,

      blockReason:
        "PRICE_CONFIRMATION_REQUIRED" as string,

      plan:
        null as CanonicalPaymentPlan | null,

      planHash:
        "",

      existingConfirmation:
        null as PaymentConfirmationRow | null,
    };
  }

  const priceItems =
    parsePriceItems(
      priceProof.price_snapshot
    );

  const expectedCount =
    Number(
      batch.expected_booking_count
    );

  const structureValid =
    batch.status ===
      "created" &&
    Number(
      batch.created_booking_count
    ) ===
      expectedCount &&
    batchItems.length ===
      expectedCount &&
    priceItems.length ===
      expectedCount &&
    Number(
      priceProof.item_count
    ) ===
      expectedCount;

  if (!structureValid) {
    return {
      batch,

      ready:
        false,

      blockReason:
        "MISSION_STRUCTURE_CHANGED",

      plan:
        null,

      planHash:
        "",

      existingConfirmation:
        null,
    };
  }

  const bookingIds =
    priceItems.map(
      (
        item
      ) =>
        item.bookingId
    );

  const providerIds =
    Array.from(
      new Set(
        priceItems.map(
          (
            item
          ) =>
            item.providerId
        )
      )
    );

  const [
    bookingResult,
    profileResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from(
          "bookings"
        )
        .select(
          "*"
        )
        .in(
          "id",
          bookingIds
        ),

      supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "*"
        )
        .in(
          "id",
          providerIds
        ),
    ]);

  if (
    bookingResult.error
  ) {
    throw new Error(
      bookingResult.error.message
    );
  }

  if (
    profileResult.error
  ) {
    throw new Error(
      profileResult.error.message
    );
  }

  const bookings =
    (
      bookingResult.data ??
      []
    ) as unknown as
      JsonRow[];

  const profiles =
    (
      profileResult.data ??
      []
    ) as unknown as
      JsonRow[];

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

  const profileById =
    new Map<
      string,
      JsonRow
    >();

  for (
    const providerProfile
    of profiles
  ) {
    const id =
      text(
        providerProfile.id
      );

    if (id) {
      profileById.set(
        id,
        providerProfile
      );
    }
  }

  let liveMismatch =
    bookings.length !==
    expectedCount;

  for (
    const item
    of priceItems
  ) {
    const booking =
      bookingById.get(
        item.bookingId
      );

    if (!booking) {
      liveMismatch =
        true;

      continue;
    }

    if (
      bookingAmountCents(
        booking
      ) !==
        item.amountCents ||
      bookingCurrency(
        booking
      ) !==
        item.currency ||
      !bookingAccepted(
        booking
      )
    ) {
      liveMismatch =
        true;
    }
  }

  if (
    liveMismatch
  ) {
    return {
      batch,

      ready:
        false,

      blockReason:
        "LIVE_PAYMENT_PLAN_CHANGED",

      plan:
        null,

      planHash:
        "",

      existingConfirmation:
        null,
    };
  }

  const stripeSecret =
    process.env
      .STRIPE_SECRET_KEY;

  if (!stripeSecret) {
    return {
      batch,

      ready:
        false,

      blockReason:
        "STRIPE_SERVER_CONFIGURATION_REQUIRED",

      plan:
        null,

      planHash:
        "",

      existingConfirmation:
        null,
    };
  }

  const stripe =
    new Stripe(
      stripeSecret
    );

  const accountByProvider =
    new Map<
      string,
      string
    >();

  for (
    const providerId
    of providerIds
  ) {
    const accountId =
      stripeAccountId(
        profileById.get(
          providerId
        )
      );

    if (!accountId) {
      return {
        batch,

        ready:
          false,

        blockReason:
          "PROVIDER_STRIPE_NOT_READY",

        plan:
          null,

        planHash:
          "",

        existingConfirmation:
          null,
      };
    }

    try {
      const account =
        await stripe.accounts.retrieve(
          accountId
        );

      // KLYX_STRIPE_DELETED_ACCOUNT_SAFE_13_26
      const deleted =
        (
          account as unknown as {
            deleted?:
              boolean;
          }
        ).deleted ===
        true;

      if (deleted) {
        return {
          batch,

          ready:
            false,

          blockReason:
            "PROVIDER_STRIPE_NOT_READY",

          plan:
            null,

          planHash:
            "",

          existingConfirmation:
            null,
        };
      }

      const requirementsDue =
        account.requirements
          ?.currently_due
          ?.length ??
        0;

      const ready =
        account.charges_enabled ===
          true &&
        account.payouts_enabled ===
          true &&
        account.details_submitted ===
          true &&
        requirementsDue ===
          0;

      if (!ready) {
        return {
          batch,

          ready:
            false,

          blockReason:
            "PROVIDER_STRIPE_NOT_READY",

          plan:
            null,

          planHash:
            "",

          existingConfirmation:
            null,
        };
      }

      accountByProvider.set(
        providerId,
        accountId
      );
    }
    catch {
      return {
        batch,

        ready:
          false,

        blockReason:
          "PROVIDER_STRIPE_LOOKUP_FAILED",

        plan:
          null,

        planHash:
          "",

        existingConfirmation:
          null,
      };
    }
  }

  const allocationMap =
    new Map<
      string,
      PaymentUnit
    >();

  for (
    const item
    of priceItems
  ) {
    const accountId =
      accountByProvider.get(
        item.providerId
      );

    if (!accountId) {
      continue;
    }

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

        stripeAccountId:
          accountId,
      }
    );
  }

  const units =
    Array.from(
      allocationMap.values()
    )
      .map(
        (
          unit
        ) => ({
          ...unit,

          bookingIds:
            [
              ...unit.bookingIds,
            ].sort(),

          slotIds:
            [
              ...unit.slotIds,
            ].sort(),
        })
      )
      .sort(
        (
          first,
          second
        ) =>
          first.providerId.localeCompare(
            second.providerId
          )
      );

  const currency =
    text(
      priceProof.currency
    )
      .toUpperCase();

  const allocationTotal =
    units.reduce(
      (
        total,
        unit
      ) =>
        total +
        unit.amountCents,
      0
    );

  const priceTotal =
    Number(
      priceProof.total_amount_cents
    );

  if (
    units.length <
      2 ||
    units.some(
      (
        unit
      ) =>
        unit.currency !==
        currency
    ) ||
    allocationTotal !==
      priceTotal
  ) {
    return {
      batch,

      ready:
        false,

      blockReason:
        "PAYMENT_ALLOCATION_MISMATCH",

      plan:
        null,

      planHash:
        "",

      existingConfirmation:
        null,
    };
  }

  const plan:
    CanonicalPaymentPlan = {
    batchId:
      batch.id,

    priceConfirmationId:
      priceProof.id,

    providerCount:
      units.length,

    paymentUnitCount:
      units.length,

    totalAmountCents:
      priceTotal,

    currency,

    units,
  };

  const planHash =
    hashPlan(
      plan
    );

  const {
    data:
      confirmationData,

    error:
      confirmationError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_confirmations"
      )
      .select(
        "id, payment_plan_hash, confirmed_at, consumed_at"
      )
      .eq(
        "batch_id",
        batch.id
      )
      .is(
        "invalidated_at",
        null
      )
      .is(
        "consumed_at",
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

  let existingConfirmation =
    confirmationData as unknown as
      PaymentConfirmationRow |
      null;

  if (
    existingConfirmation &&
    existingConfirmation.payment_plan_hash !==
      planHash
  ) {
    const {
      error:
        invalidateError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_payment_confirmations"
        )
        .update({
          invalidated_at:
            new Date()
              .toISOString(),

          invalidation_reason:
            "live_payment_plan_changed",

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existingConfirmation.id
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

    existingConfirmation =
      null;
  }

  return {
    batch,

    priceProof,

    ready:
      true,

    blockReason:
      null,

    plan,

    planHash,

    existingConfirmation,
  };
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

    const state =
      await inspect(
        batchId,
        profile.id
      );

    if (!state) {
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

    const confirmed =
      Boolean(
        state.ready &&
        state.existingConfirmation
      );

    return NextResponse.json({
      batchId:
        state.batch.id,

      paymentConfirmationReady:
        state.ready,

      blockReason:
        state.blockReason,

      confirmed,

      confirmationId:
        state.existingConfirmation
          ?.id ??
        null,

      confirmedAt:
        state.existingConfirmation
          ?.confirmed_at ??
        null,

      paymentPlanHash:
        state.planHash ||
        null,

      paymentPlan:
        state.plan,

      explicitPaymentConfirmationRequired:
        true,

      separateProviderPaymentsAcknowledgementRequired:
        true,

      finalAmountAcknowledgementRequired:
        true,

      proofConsumed:
        false,

      automaticPayment:
        false,

      paymentIntentCreated:
        false,

      checkoutCreated:
        false,

      transferCreated:
        false,

      moneyMoved:
        false,
    });
  }
  catch (
    error
  ) {
    return secureApiErrorResponse({
      error,
      event:
        "split_payment_confirmation_read_failed",
      route:
        "/api/bookings/split-missions/[id]/payment-confirmation",
      method: "GET",
      status: 500,
      code:
        "split_payment_confirmation_read_failed",
      startedAt,
      details: {
        confirmed:
          false,
        explicitPaymentConfirmationRequired:
          true,
        automaticPayment:
          false,
        paymentIntentCreated:
          false,
        checkoutCreated:
          false,
        transferCreated:
          false,
        moneyMoved:
          false,
      },
    });
  }
}

export async function POST(
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

    const rawBody =
      await request.json();

    const body =
      asRecord(
        rawBody
      );

    if (
      !body ||
      body.paymentConfirmed !==
        true ||
      body.finalAmountAcknowledged !==
        true ||
      body.separateProviderPaymentsAcknowledged !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Confirmation finale explicite incomplète.",

          code:
            "SPLIT_PAYMENT_EXPLICIT_CONFIRMATION_REQUIRED",

          confirmed:
            false,

          automaticPayment:
            false,

          moneyMoved:
            false,
        },
        {
          status:
            400,
        }
      );
    }

    const state =
      await inspect(
        batchId,
        profile.id
      );

    if (!state) {
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

    if (
      !state.ready ||
      !state.plan ||
      !state.planHash ||
      !state.priceProof
    ) {
      return NextResponse.json(
        {
          error:
            "Le paiement n'est plus prêt à être confirmé.",

          code:
            state.blockReason ||
            "SPLIT_PAYMENT_NOT_READY",

          confirmed:
            false,

          automaticPayment:
            false,

          moneyMoved:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      state.existingConfirmation
    ) {
      return NextResponse.json({
        confirmed:
          true,

        existing:
          true,

        confirmationId:
          state.existingConfirmation.id,

        paymentPlanHash:
          state.planHash,

        paymentPlan:
          state.plan,

        automaticPayment:
          false,

        paymentIntentCreated:
          false,

        checkoutCreated:
          false,

        transferCreated:
          false,

        moneyMoved:
          false,
      });
    }

    const {
      data:
        rpcData,

      error:
        rpcError,
    } =
      await supabaseAdmin.rpc(
        "klyx_confirm_split_payment_plan_13_26",
        {
          p_batch_id:
            state.batch.id,

          p_client_profile_id:
            profile.id,

          p_price_confirmation_id:
            state.priceProof.id,

          p_payment_plan_hash:
            state.planHash,

          p_payment_plan_snapshot:
            state.plan,

          p_provider_count:
            state.plan.providerCount,

          p_payment_unit_count:
            state.plan.paymentUnitCount,

          p_total_amount_cents:
            state.plan.totalAmountCents,

          p_currency:
            state.plan.currency,
        }
      );

    if (
      rpcError
    ) {
      throw new Error(
        rpcError.message
      );
    }

    return NextResponse.json({
      confirmed:
        true,

      existing:
        false,

      confirmationId:
        typeof rpcData ===
          "string"
          ? rpcData
          : String(
              rpcData
            ),

      paymentPlanHash:
        state.planHash,

      paymentPlan:
        state.plan,

      explicitPaymentConfirmation:
        true,

      automaticPayment:
        false,

      paymentIntentCreated:
        false,

      checkoutCreated:
        false,

      transferCreated:
        false,

      moneyMoved:
        false,
    });
  }
  catch (
    error
  ) {
    return secureApiErrorResponse({
      error,
      event:
        "split_payment_confirmation_write_failed",
      route:
        "/api/bookings/split-missions/[id]/payment-confirmation",
      method: "POST",
      status: 500,
      code:
        "split_payment_confirmation_write_failed",
      startedAt,
      details: {
        confirmed:
          false,
        automaticPayment:
          false,
        paymentIntentCreated:
          false,
        checkoutCreated:
          false,
        transferCreated:
          false,
        moneyMoved:
          false,
      },
    });
  }
}
