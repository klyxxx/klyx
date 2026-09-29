import "server-only";

import Stripe from "stripe";

import type { AuthenticatedAccount } from "@/lib/api-auth";
import { reconcileStripeRefund } from "@/lib/stripe-refunds";
import {
  requireKlyxFinancialStripeObservationRuntime,
  requireKlyxFinancialStripeRuntime,
} from "@/lib/klyx-financial-stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enforceRefundTransactionRisk } from "@/lib/transaction-risk-server";

const PAYMENT_MODE = "platform_held" as const;

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_group_id: string | null;
  payment_status: string | null;
  payment_mode: string | null;
};

type SettlementRow = {
  booking_id: string;
  provider_profile_id: string;
  stripe_account_id: string;
  payment_mode: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  transfer_group: string;
  state: string;
};

type RefundRow = {
  id: string;
  booking_id: string;
  request_key: string;
  currency: string;
  gross_refund_cents: number;
  platform_fee_refund_cents: number;
  provider_refund_cents: number;
  state:
    | "ready"
    | "reversal_required"
    | "refunding"
    | "succeeded"
    | "failed"
    | "review_required";
  stripe_refund_id: string | null;
  failure_code: string | null;
};

export type SinglePlatformHeldRefundRequest =
  | { kind: "total"; requestKey: string }
  | { kind: "partial"; requestKey: string; amountCents: number };

export type SinglePlatformHeldRefundResult =
  | {
      status: "refunded";
      refundId: string;
      stripeRefundId: string;
      reconciled: boolean;
    }
  | { status: "pending_reversal" | "pending_refund"; refundId: string }
  | { status: "review_required"; refundId: string };

function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function safeCents(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(code);
  }

  return value;
}

function validRequestKey(value: string): string {
  const normalized = value.trim();

  if (
    normalized.length < 3 ||
    normalized.length > 128 ||
    !/^[A-Za-z0-9:_-]+$/.test(normalized)
  ) {
    throw new Error("KLYX_SINGLE_REFUND_REQUEST_KEY_INVALID");
  }

  return normalized;
}

async function loadBooking(bookingId: string): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, booking_group_id, payment_status, payment_mode"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_SINGLE_REFUND_BOOKING_NOT_FOUND");

  return data as BookingRow;
}

async function loadSettlement(bookingId: string): Promise<SettlementRow> {
  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, transfer_group, state"
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_SINGLE_REFUND_SETTLEMENT_NOT_FOUND");

  return data as SettlementRow;
}

async function loadRefund(refundId: string): Promise<RefundRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_booking_refunds")
    .select(
      "id, booking_id, request_key, currency, gross_refund_cents, platform_fee_refund_cents, provider_refund_cents, state, stripe_refund_id, failure_code"
    )
    .eq("id", refundId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_SINGLE_REFUND_PLAN_NOT_FOUND");

  return data as RefundRow;
}

async function loadExistingRefundByRequestKey(
  bookingId: string,
  requestKey: string
): Promise<RefundRow | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_booking_refunds")
    .select(
      "id, booking_id, request_key, currency, gross_refund_cents, platform_fee_refund_cents, provider_refund_cents, state, stripe_refund_id, failure_code"
    )
    .eq("booking_id", bookingId)
    .eq("request_key", requestKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as RefundRow) : null;
}

async function remainingRefundAmount(
  settlement: SettlementRow
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_booking_refunds")
    .select("gross_refund_cents, state")
    .eq("booking_id", settlement.booking_id)
    .in("state", [
      "ready",
      "reversal_required",
      "refunding",
      "succeeded",
      "review_required",
    ]);

  if (error) throw new Error(error.message);

  const reservedOrSucceeded = (data ?? []).reduce(
    (sum, row) => sum + Math.max(Number(row.gross_refund_cents ?? 0), 0),
    0
  );
  const remaining =
    Number(settlement.gross_amount_cents) - reservedOrSucceeded;

  if (!Number.isSafeInteger(remaining) || remaining <= 0) {
    throw new Error("KLYX_SINGLE_REFUND_NOTHING_LEFT");
  }

  return remaining;
}

async function markReview(
  refundId: string,
  code: string,
  message: string
) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_booking_refund_review",
    {
      p_refund_id: refundId,
      p_error_code: code,
      p_error_message: message,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SINGLE_REFUND_REVIEW_STATE_NOT_WRITABLE");
  }
}

function verifyTransferTruth(input: {
  transfer: Stripe.Transfer;
  settlement: SettlementRow;
  expectedLive: boolean;
}) {
  const { transfer, settlement, expectedLive } = input;
  const destination = stripeObjectId(transfer.destination);
  const sourceTransaction = stripeObjectId(transfer.source_transaction);
  const expectedAmount = Number(settlement.provider_amount_cents);

  if (transfer.livemode !== expectedLive) {
    throw new Error("KLYX_SINGLE_REFUND_TRANSFER_LIVEMODE_MISMATCH");
  }
  if (transfer.amount !== expectedAmount) {
    throw new Error("KLYX_SINGLE_REFUND_TRANSFER_AMOUNT_MISMATCH");
  }
  if (transfer.currency.toUpperCase() !== settlement.currency) {
    throw new Error("KLYX_SINGLE_REFUND_TRANSFER_CURRENCY_MISMATCH");
  }
  if (destination !== settlement.stripe_account_id) {
    throw new Error("KLYX_SINGLE_REFUND_TRANSFER_DESTINATION_MISMATCH");
  }
  if (
    !settlement.stripe_charge_id ||
    sourceTransaction !== settlement.stripe_charge_id
  ) {
    throw new Error("KLYX_SINGLE_REFUND_TRANSFER_SOURCE_MISMATCH");
  }
}

async function processRequiredReversal(input: {
  stripe: Stripe;
  settlement: SettlementRow;
  refund: RefundRow;
  expectedLive: boolean;
}): Promise<"ready" | "pending" | "review_required"> {
  if (input.refund.state !== "reversal_required") {
    return "ready";
  }

  const transferId = input.settlement.stripe_transfer_id;
  if (!transferId || input.refund.provider_refund_cents <= 0) {
    await markReview(
      input.refund.id,
      "single_refund_transfer_truth_missing",
      "A reversal-required Single refund has no frozen provider Transfer."
    );
    return "review_required";
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await input.stripe.transfers.retrieve(transferId);
    verifyTransferTruth({
      transfer,
      settlement: input.settlement,
      expectedLive: input.expectedLive,
    });
  } catch (error) {
    await markReview(
      input.refund.id,
      "single_refund_transfer_truth_divergence",
      error instanceof Error
        ? error.message
        : "Provider Transfer truth diverged."
    );
    return "review_required";
  }

  const reversals = await input.stripe.transfers.listReversals(transferId, {
    limit: 100,
  });
  const matching = reversals.data.filter(
    (candidate) =>
      candidate.metadata?.single_refund_id === input.refund.id
  );

  if (matching.length > 1) {
    await markReview(
      input.refund.id,
      "multiple_single_refund_reversals",
      "Multiple Stripe reversals exist for one Single refund plan."
    );
    return "review_required";
  }

  let reversal = matching[0] ?? null;

  if (
    reversal &&
    reversal.amount !== Number(input.refund.provider_refund_cents)
  ) {
    await markReview(
      input.refund.id,
      "single_refund_reversal_amount_mismatch",
      "Existing Stripe reversal amount differs from frozen KLYX refund economics."
    );
    return "review_required";
  }

  if (!reversal) {
    try {
      reversal = await input.stripe.transfers.createReversal(
        transferId,
        {
          amount: Number(input.refund.provider_refund_cents),
          metadata: {
            booking_id: input.refund.booking_id,
            payment_mode: PAYMENT_MODE,
            single_refund_id: input.refund.id,
            request_key: input.refund.request_key,
          },
        },
        {
          idempotencyKey: `klyx-platform-held-booking-reversal-${input.refund.id}`,
        }
      );
    } catch {
      // Unknown Stripe result: keep reversal_required. Retry searches Stripe
      // truth before reusing the exact same idempotency key.
      return "pending";
    }
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_platform_held_booking_reversal",
    {
      p_refund_id: input.refund.id,
      p_stripe_transfer_id: transferId,
      p_stripe_transfer_reversal_id: reversal.id,
      p_amount_cents: Number(input.refund.provider_refund_cents),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    await markReview(
      input.refund.id,
      "single_refund_reversal_finalize_lost",
      "Stripe reversal exists but KLYX Settlement could not finalize it."
    );
    return "review_required";
  }

  return "ready";
}

async function listExistingRefundTruth(
  stripe: Stripe,
  settlement: SettlementRow,
  refund: RefundRow
) {
  const chargeId = settlement.stripe_charge_id;

  if (!chargeId) {
    throw new Error("KLYX_SINGLE_REFUND_SOURCE_CHARGE_REQUIRED");
  }

  const listed = await stripe.refunds.list({
    charge: chargeId,
    limit: 100,
  });

  const matching = listed.data.filter(
    (candidate) =>
      candidate.metadata?.single_refund_id === refund.id
  );

  if (matching.length > 1) {
    throw new Error("KLYX_SINGLE_REFUND_REMOTE_DUPLICATE");
  }

  for (const candidate of listed.data) {
    const metadata = candidate.metadata ?? {};
    const knownSingleRefund =
      metadata.booking_id === settlement.booking_id &&
      (
        !metadata.payment_mode ||
        metadata.payment_mode === PAYMENT_MODE
      );

    if (!knownSingleRefund) {
      throw new Error("KLYX_SINGLE_REFUND_UNKNOWN_REFUND_ON_CHARGE");
    }
  }

  const remoteTotal = listed.data
    .filter((candidate) => candidate.status !== "failed")
    .reduce((sum, candidate) => sum + candidate.amount, 0);

  if (remoteTotal > Number(settlement.gross_amount_cents)) {
    throw new Error("KLYX_SINGLE_REFUND_REMOTE_TOTAL_EXCEEDS_GROSS");
  }

  return {
    existing: matching[0] ?? null,
    remoteTotal,
  };
}

async function finalizeRefund(
  refund: RefundRow,
  stripeRefund: Stripe.Refund
) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_platform_held_booking_refund",
    {
      p_refund_id: refund.id,
      p_stripe_refund_id: stripeRefund.id,
      p_amount_cents: stripeRefund.amount,
      p_currency: stripeRefund.currency.toUpperCase(),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SINGLE_REFUND_FINALIZE_LOST");
  }
}

async function failRefund(
  refund: RefundRow,
  stripeRefund: Stripe.Refund
) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_fail_platform_held_booking_refund",
    {
      p_refund_id: refund.id,
      p_error_code: "stripe_refund_failed",
      p_error_message:
        stripeRefund.failure_reason ?? "Stripe Single refund failed.",
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SINGLE_REFUND_FAILURE_STATE_NOT_WRITABLE");
  }
}

async function applySucceededRefund(
  refund: RefundRow,
  stripeRefund: Stripe.Refund
) {
  await finalizeRefund(refund, stripeRefund);

  // Preserve the existing booking/refund compatibility projection. The central
  // immutable ledger already mirrors this projection by Stripe refund id.
  await reconcileStripeRefund(stripeRefund);
}

export async function refundPlatformHeldBooking(input: {
  bookingId: string;
  requesterAccount: AuthenticatedAccount;
  requesterProfileId: string;
  request: SinglePlatformHeldRefundRequest;
}): Promise<SinglePlatformHeldRefundResult> {
  const booking = await loadBooking(input.bookingId);
  let settlement = await loadSettlement(input.bookingId);

  if (
    booking.payment_mode !== PAYMENT_MODE ||
    settlement.payment_mode !== PAYMENT_MODE ||
    booking.booking_group_id !== null
  ) {
    throw new Error("KLYX_SINGLE_REFUND_NOT_APPLICABLE");
  }

  const providerProfileId =
    booking.provider_id ?? booking.babysitter_id ?? null;
  if (
    input.requesterProfileId !== booking.parent_id &&
    input.requesterProfileId !== providerProfileId
  ) {
    throw new Error("KLYX_SINGLE_REFUND_FORBIDDEN");
  }

  const requestKey = validRequestKey(input.request.requestKey);
  let refund = await loadExistingRefundByRequestKey(booking.id, requestKey);

  if (
    refund &&
    input.request.kind === "partial" &&
    Number(refund.gross_refund_cents) !== input.request.amountCents
  ) {
    throw new Error("KLYX_SINGLE_REFUND_REQUEST_KEY_CONFLICT");
  }

  // A frozen request key is immutable financial truth. Pure retries of a
  // terminal result do not need fresh Risk/Operations authorization because
  // they cannot create a new Stripe side effect.
  if (refund?.state === "succeeded" && refund.stripe_refund_id) {
    return {
      status: "refunded",
      refundId: refund.id,
      stripeRefundId: refund.stripe_refund_id,
      reconciled: true,
    };
  }

  if (refund?.state === "review_required") {
    return { status: "review_required", refundId: refund.id };
  }

  if (refund?.state === "failed") {
    throw new Error(
      refund.failure_code ?? "KLYX_SINGLE_REFUND_PREVIOUSLY_FAILED"
    );
  }

  if (
    booking.payment_status !== "paid" ||
    !settlement.stripe_charge_id ||
    !settlement.stripe_transfer_id ||
    settlement.state !== "released"
  ) {
    throw new Error("KLYX_SINGLE_REFUND_NOT_READY");
  }

  await enforceRefundTransactionRisk({
    requesterAccount: input.requesterAccount,
    refundRecipientProfileId: booking.parent_id,
    subjectType: "booking",
    subjectId: booking.id,
  });

  const financialRuntime = await requireKlyxFinancialStripeRuntime({
    clientProfileId: booking.parent_id,
    capability: "refunds",
  });
  const stripe = new Stripe(financialRuntime.key);
  const expectedLive = financialRuntime.mode !== "test";

  if (!refund) {
    const amountCents =
      input.request.kind === "total"
        ? await remainingRefundAmount(settlement)
        : safeCents(
            input.request.amountCents,
            "KLYX_SINGLE_PARTIAL_REFUND_AMOUNT_INVALID"
          );

    const { data: refundId, error } = await supabaseAdmin.rpc(
      "klyx_create_platform_held_booking_refund_plan",
      {
        p_booking_id: booking.id,
        p_request_key: requestKey,
        p_amount_cents: amountCents,
        p_currency: settlement.currency,
      }
    );

    if (error) throw new Error(error.message);
    if (typeof refundId !== "string" || !refundId) {
      throw new Error("KLYX_SINGLE_REFUND_PLAN_NOT_CREATED");
    }

    refund = await loadRefund(refundId);
  }

  const reversalState = await processRequiredReversal({
    stripe,
    settlement,
    refund,
    expectedLive,
  });

  if (reversalState === "pending") {
    return { status: "pending_reversal", refundId: refund.id };
  }

  if (reversalState === "review_required") {
    return { status: "review_required", refundId: refund.id };
  }

  refund = await loadRefund(refund.id);
  settlement = await loadSettlement(booking.id);

  const chargeId = settlement.stripe_charge_id;
  if (!chargeId) {
    await markReview(
      refund.id,
      "single_refund_source_charge_missing",
      "Frozen Single refund Settlement lost its Stripe source charge."
    );
    return { status: "review_required", refundId: refund.id };
  }

  let remote;
  try {
    remote = await listExistingRefundTruth(stripe, settlement, refund);
  } catch (error) {
    await markReview(
      refund.id,
      "single_refund_truth_divergence",
      error instanceof Error
        ? error.message
        : "Single refund Stripe truth diverged."
    );
    return { status: "review_required", refundId: refund.id };
  }

  let stripeRefund = remote.existing;
  const reconciled = Boolean(stripeRefund);

  if (stripeRefund) {
    if (
      stripeRefund.amount !== Number(refund.gross_refund_cents) ||
      stripeRefund.currency.toUpperCase() !== refund.currency
    ) {
      await markReview(
        refund.id,
        "single_refund_amount_currency_mismatch",
        "Existing Stripe refund differs from frozen KLYX Single refund truth."
      );
      return { status: "review_required", refundId: refund.id };
    }

    if (stripeRefund.status === "succeeded") {
      await applySucceededRefund(refund, stripeRefund);
      return {
        status: "refunded",
        refundId: refund.id,
        stripeRefundId: stripeRefund.id,
        reconciled: true,
      };
    }

    if (stripeRefund.status === "pending") {
      return { status: "pending_refund", refundId: refund.id };
    }

    if (stripeRefund.status === "failed") {
      await failRefund(refund, stripeRefund);
      throw new Error("KLYX_SINGLE_STRIPE_REFUND_FAILED");
    }
  }

  if (
    remote.remoteTotal + Number(refund.gross_refund_cents) >
    Number(settlement.gross_amount_cents)
  ) {
    await markReview(
      refund.id,
      "single_refund_aggregate_exceeds_gross",
      "Remote refund total plus requested refund exceeds frozen booking gross."
    );
    return { status: "review_required", refundId: refund.id };
  }

  const { data: inflight, error: inflightError } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_booking_refund_inflight",
    { p_refund_id: refund.id }
  );

  if (inflightError) throw new Error(inflightError.message);
  if (inflight !== true) {
    return { status: "pending_reversal", refundId: refund.id };
  }

  try {
    stripeRefund = await stripe.refunds.create(
      {
        charge: chargeId,
        amount: Number(refund.gross_refund_cents),
        reason: "requested_by_customer",
        metadata: {
          booking_id: booking.id,
          payment_mode: PAYMENT_MODE,
          single_refund_id: refund.id,
          request_key: refund.request_key,
        },
      },
      {
        idempotencyKey: `klyx-platform-held-booking-refund-${refund.id}`,
      }
    );
  } catch {
    // Unknown result remains refunding. Retry always searches Stripe by frozen
    // refund id before reusing this idempotency key.
    return { status: "pending_refund", refundId: refund.id };
  }

  if (stripeRefund.status === "succeeded") {
    await applySucceededRefund(refund, stripeRefund);
    return {
      status: "refunded",
      refundId: refund.id,
      stripeRefundId: stripeRefund.id,
      reconciled,
    };
  }

  if (stripeRefund.status === "pending") {
    return { status: "pending_refund", refundId: refund.id };
  }

  await failRefund(refund, stripeRefund);
  throw new Error("KLYX_SINGLE_STRIPE_REFUND_FAILED");
}

export async function reconcilePlatformHeldBookingRefundFromStripe(
  stripeRefund: Stripe.Refund
): Promise<boolean> {
  if (
    stripeRefund.metadata?.payment_mode !== PAYMENT_MODE ||
    !stripeRefund.metadata?.single_refund_id ||
    !stripeRefund.metadata?.booking_id
  ) {
    return false;
  }

  const refund = await loadRefund(stripeRefund.metadata.single_refund_id);
  const settlement = await loadSettlement(refund.booking_id);

  if (
    refund.id !== stripeRefund.metadata.single_refund_id ||
    refund.booking_id !== stripeRefund.metadata.booking_id ||
    settlement.booking_id !== refund.booking_id ||
    stripeRefund.amount !== Number(refund.gross_refund_cents) ||
    stripeRefund.currency.toUpperCase() !== refund.currency ||
    stripeObjectId(stripeRefund.charge) !== settlement.stripe_charge_id
  ) {
    await markReview(
      refund.id,
      "single_refund_webhook_truth_mismatch",
      "Stripe refund webhook differs from frozen KLYX Single refund truth."
    );
    return true;
  }

  const runtime = requireKlyxFinancialStripeObservationRuntime();
  const stripe = new Stripe(runtime.key);
  const expectedLive = runtime.mode !== "test";
  const chargeId = settlement.stripe_charge_id;

  if (!chargeId) {
    await markReview(
      refund.id,
      "single_refund_webhook_charge_missing",
      "Frozen KLYX Single refund has no Stripe charge."
    );
    return true;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  if (charge.livemode !== expectedLive) {
    throw new Error("KLYX_SINGLE_REFUND_WEBHOOK_LIVEMODE_MISMATCH");
  }

  if (stripeRefund.status === "succeeded") {
    await finalizeRefund(refund, stripeRefund);
    return true;
  }

  if (stripeRefund.status === "failed") {
    await failRefund(refund, stripeRefund);
    return true;
  }

  return true;
}
