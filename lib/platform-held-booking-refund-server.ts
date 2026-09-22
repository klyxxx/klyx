import "server-only";

import Stripe from "stripe";

import type { AuthenticatedAccount } from "@/lib/api-auth";
import { reconcilePlatformHeldBookingSettlement } from "@/lib/booking-settlement-reconciliation-server";

import {
  appendFinancialLedgerEvent,
  openFinancialReconciliationCase,
} from "@/lib/financial-ledger-server";
import {
  requireKlyxFinancialStripeObservationRuntime,
  requireKlyxFinancialStripeRuntimeForBooking,
} from "@/lib/klyx-financial-stripe-runtime";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enforceRefundTransactionRisk } from "@/lib/transaction-risk-server";

const PAYMENT_MODE = "platform_held" as const;

export type SinglePlatformHeldRefundRequest =
  | {
      kind: "partial";
      requestKey: string;
      amountCents: number;
    }
  | {
      kind: "total";
      requestKey: string;
    };

export type SinglePlatformHeldRefundResult =
  | {
      status: "refunded";
      refundId: string;
      stripeRefundId: string;
      reconciled: boolean;
    }
  | {
      status: "pending_reversal" | "pending_refund";
      refundId: string;
    }
  | {
      status: "review_required";
      refundId: string;
    };

type BookingRow = {
  id: string;
  parent_id: string;
  payment_status: string | null;
  payment_mode: string | null;
  booking_group_id: string | null;
  currency: string | null;
  amount_total: number | null;
  refund_status: string | null;
  refunded_amount_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type SettlementRow = {
  booking_id: string;
  stripe_account_id: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  refunded_amount_cents: number;
  refunded_platform_fee_cents: number;
  refunded_provider_amount_cents: number;
  released_provider_amount_cents: number;
  reversed_provider_amount_cents: number;
  state: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
};

type RefundRow = {
  id: string;
  booking_id: string;
  request_key: string;
  currency: string;
  amount_cents: number;
  platform_fee_refund_cents: number;
  provider_refund_cents: number;
  settlement_state_before: string;
  state:
    | "reversing"
    | "ready"
    | "refunding"
    | "succeeded"
    | "failed"
    | "review_required";
  stripe_refund_id: string | null;
};

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

function normalizeRequestKey(value: string): string {
  const key = value.trim();
  if (
    key.length < 3 ||
    key.length > 128 ||
    !/^[A-Za-z0-9:_-]+$/.test(key)
  ) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_REQUEST_KEY_INVALID");
  }
  return key;
}

async function loadBookingAndSettlement(bookingId: string): Promise<{
  booking: BookingRow;
  settlement: SettlementRow;
}> {
  const [bookingResult, settlementResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, payment_status, payment_mode, booking_group_id, currency, amount_total, refund_status, refunded_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id"
      )
      .eq("id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("booking_settlements")
      .select(
        "booking_id, stripe_account_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refunded_amount_cents, refunded_platform_fee_cents, refunded_provider_amount_cents, released_provider_amount_cents, reversed_provider_amount_cents, state, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id"
      )
      .eq("booking_id", bookingId)
      .maybeSingle(),
  ]);

  if (bookingResult.error) throw new Error(bookingResult.error.message);
  if (settlementResult.error) throw new Error(settlementResult.error.message);
  if (!bookingResult.data) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_BOOKING_NOT_FOUND");
  }
  if (!settlementResult.data) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_SETTLEMENT_NOT_FOUND");
  }

  return {
    booking: bookingResult.data as BookingRow,
    settlement: settlementResult.data as SettlementRow,
  };
}

async function loadRefund(refundId: string): Promise<RefundRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_booking_refunds")
    .select(
      "id, booking_id, request_key, currency, amount_cents, platform_fee_refund_cents, provider_refund_cents, settlement_state_before, state, stripe_refund_id"
    )
    .eq("id", refundId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_SINGLE_HELD_REFUND_NOT_FOUND");
  return data as RefundRow;
}

async function markReview(
  refundId: string,
  code: string,
  message: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_booking_refund_review",
    {
      p_refund_id: refundId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

async function failRefund(
  refundId: string,
  code: string,
  message: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc(
    "klyx_fail_platform_held_booking_refund",
    {
      p_refund_id: refundId,
      p_error_code: code,
      p_error_message: message,
    }
  );
  if (error) throw new Error(error.message);
}

async function appendReversalLedger(input: {
  refund: RefundRow;
  settlement: SettlementRow;
  reversal: Stripe.TransferReversal;
}) {
  await appendFinancialLedgerEvent({
    movementKey: `booking:${input.refund.booking_id}:reversal:${input.reversal.id}`,
    eventKey: `single-refund:${input.refund.id}:reversal:${input.reversal.id}`,
    movementType: "reversal",
    amountMinor: input.reversal.amount,
    currency: input.refund.currency,
    bookingId: input.refund.booking_id,
    beneficiaryKind: "platform",
    beneficiaryRef: "klyx",
    cause: "single_platform_held_refund_transfer_reversal",
    source: "settlement",
    previousState: "released",
    newState: "reversal_recorded",
    occurredAt: new Date(
      Math.max(input.reversal.created, 0) * 1000
    ).toISOString(),
    stripeAccountId: input.settlement.stripe_account_id,
    stripeCheckoutSessionId:
      input.settlement.stripe_checkout_session_id,
    stripePaymentIntentId:
      input.settlement.stripe_payment_intent_id,
    stripeChargeId: input.settlement.stripe_charge_id,
    stripeTransferId: input.settlement.stripe_transfer_id,
    stripeTransferReversalId: input.reversal.id,
    details: {
      settlement_model: "platform_held_single",
      booking_refund_id: input.refund.id,
    },
  });
}

async function persistRefundLedger(input: {
  refund: RefundRow;
  settlement: SettlementRow;
  stripeRefund: Stripe.Refund;
}) {
  await upsertFinancialLedgerEntry({
    bookingId: input.refund.booking_id,
    entryKey: `booking:${input.refund.booking_id}:refund:${input.stripeRefund.id}`,
    entryType: "refund_succeeded",
    status: "succeeded",
    currency: input.refund.currency,
    grossAmountCents: input.settlement.gross_amount_cents,
    platformFeeCents: input.settlement.platform_fee_cents,
    providerAmountCents: input.settlement.provider_amount_cents,
    refundAmountCents: input.stripeRefund.amount,
    refundAmountMinor: input.stripeRefund.amount,
    paymentMode: PAYMENT_MODE,
    stripeCheckoutSessionId:
      input.settlement.stripe_checkout_session_id,
    stripePaymentIntentId:
      input.settlement.stripe_payment_intent_id,
    stripeRefundId: input.stripeRefund.id,
  });
}

async function finalizeRefund(input: {
  refund: RefundRow;
  settlement: SettlementRow;
  stripeRefund: Stripe.Refund;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_platform_held_booking_refund",
    {
      p_refund_id: input.refund.id,
      p_stripe_refund_id: input.stripeRefund.id,
      p_amount_cents: input.stripeRefund.amount,
      p_currency: input.stripeRefund.currency.toUpperCase(),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_FINALIZE_LOST");
  }

  await persistRefundLedger(input);
}

async function verifyFrozenStripeCharge(input: {
  stripe: Stripe;
  settlement: SettlementRow;
  expectedLive: boolean;
}) {
  const chargeId = input.settlement.stripe_charge_id;
  if (!chargeId) {
    throw new Error("KLYX_SINGLE_HELD_SOURCE_CHARGE_REQUIRED");
  }

  const charge = await input.stripe.charges.retrieve(chargeId);
  const paymentIntentId = stripeObjectId(charge.payment_intent);

  if (
    charge.livemode !== input.expectedLive ||
    charge.amount !== Number(input.settlement.gross_amount_cents) ||
    charge.currency.toUpperCase() !== input.settlement.currency ||
    charge.paid !== true ||
    paymentIntentId !== input.settlement.stripe_payment_intent_id
  ) {
    throw new Error("KLYX_SINGLE_HELD_CHARGE_TRUTH_MISMATCH");
  }
}

async function verifyReleasedTransfer(input: {
  stripe: Stripe;
  settlement: SettlementRow;
  expectedLive: boolean;
}) {
  const transferId = input.settlement.stripe_transfer_id;
  if (!transferId) return;

  const transfer = await input.stripe.transfers.retrieve(transferId);
  const destination = stripeObjectId(transfer.destination);
  const sourceTransaction = stripeObjectId(transfer.source_transaction);

  if (
    transfer.livemode !== input.expectedLive ||
    transfer.amount !== Number(input.settlement.released_provider_amount_cents) ||
    transfer.currency.toUpperCase() !== input.settlement.currency ||
    destination !== input.settlement.stripe_account_id ||
    sourceTransaction !== input.settlement.stripe_charge_id
  ) {
    throw new Error("KLYX_SINGLE_HELD_TRANSFER_TRUTH_MISMATCH");
  }
}

async function processRequiredReversal(input: {
  stripe: Stripe;
  refund: RefundRow;
  settlement: SettlementRow;
  expectedLive: boolean;
}): Promise<boolean> {
  if (input.refund.state === "refunding") {
    return false;
  }

  if (
    !input.settlement.stripe_transfer_id ||
    input.refund.provider_refund_cents <= 0
  ) {
    return false;
  }

  await verifyReleasedTransfer({
    stripe: input.stripe,
    settlement: input.settlement,
    expectedLive: input.expectedLive,
  });

  const listed = await input.stripe.transfers.listReversals(
    input.settlement.stripe_transfer_id,
    { limit: 100 }
  );

  const matching = listed.data.filter(
    (candidate) =>
      candidate.metadata?.platform_held_booking_refund_id === input.refund.id
  );

  if (matching.length > 1) {
    await markReview(
      input.refund.id,
      "single_refund_multiple_reversals",
      "More than one Stripe reversal exists for the immutable refund plan."
    );
    return true;
  }

  let reversal = matching[0] ?? null;

  if (reversal) {
    if (reversal.amount !== Number(input.refund.provider_refund_cents)) {
      await markReview(
        input.refund.id,
        "single_refund_reversal_amount_mismatch",
        "Existing Stripe reversal differs from frozen KLYX refund economics."
      );
      return true;
    }
  } else {
    try {
      reversal = await input.stripe.transfers.createReversal(
        input.settlement.stripe_transfer_id,
        {
          amount: Number(input.refund.provider_refund_cents),
          metadata: {
            payment_mode: PAYMENT_MODE,
            booking_id: input.refund.booking_id,
            platform_held_booking_refund_id: input.refund.id,
            request_key: input.refund.request_key,
          },
        },
        {
          idempotencyKey:
            `klyx-platform-held-booking-refund-reversal-${input.refund.id}`,
        }
      );
    } catch {
      return true;
    }
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_platform_held_booking_refund_reversal",
    {
      p_refund_id: input.refund.id,
      p_stripe_transfer_id: input.settlement.stripe_transfer_id,
      p_stripe_transfer_reversal_id: reversal.id,
      p_amount_cents: reversal.amount,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SINGLE_HELD_REVERSAL_FINALIZE_LOST");
  }

  await appendReversalLedger({
    refund: input.refund,
    settlement: input.settlement,
    reversal,
  });

  return false;
}

async function listExistingRefundTruth(input: {
  stripe: Stripe;
  refund: RefundRow;
  settlement: SettlementRow;
}) {
  if (!input.settlement.stripe_charge_id) {
    throw new Error("KLYX_SINGLE_HELD_SOURCE_CHARGE_REQUIRED");
  }

  const listed = await input.stripe.refunds.list({
    charge: input.settlement.stripe_charge_id,
    limit: 100,
  });

  const matching = listed.data.filter(
    (candidate) =>
      candidate.metadata?.platform_held_booking_refund_id === input.refund.id
  );

  if (matching.length > 1) {
    throw new Error("KLYX_SINGLE_HELD_MULTIPLE_REFUNDS_FOR_REQUEST");
  }

  for (const candidate of listed.data) {
    const metadataBookingId = candidate.metadata?.booking_id;
    if (
      metadataBookingId &&
      metadataBookingId !== input.refund.booking_id
    ) {
      throw new Error("KLYX_SINGLE_HELD_UNKNOWN_REFUND_ON_CHARGE");
    }
  }

  const remoteTotal = listed.data
    .filter(
      (candidate) =>
        candidate.status !== "failed" && candidate.status !== "canceled"
    )
    .reduce((sum, candidate) => sum + candidate.amount, 0);

  if (remoteTotal > Number(input.settlement.gross_amount_cents)) {
    throw new Error("KLYX_SINGLE_HELD_REMOTE_REFUND_EXCEEDS_GROSS");
  }

  return {
    existing: matching[0] ?? null,
    remoteTotal,
  };
}

export async function refundSinglePlatformHeldBooking(input: {
  bookingId: string;
  requesterAccount: AuthenticatedAccount;
  requesterProfileId: string;
  request: SinglePlatformHeldRefundRequest;
}): Promise<SinglePlatformHeldRefundResult> {
  const requestKey = normalizeRequestKey(input.request.requestKey);
  const initial = await loadBookingAndSettlement(input.bookingId);

  if (initial.booking.parent_id !== input.requesterProfileId) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_FORBIDDEN");
  }

  if (
    initial.booking.payment_mode !== PAYMENT_MODE ||
    initial.booking.booking_group_id ||
    initial.booking.payment_status !== "paid" ||
    initial.settlement.state === "human_review" ||
    initial.settlement.state === "review_required"
  ) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_NOT_READY");
  }

  await enforceRefundTransactionRisk({
    requesterAccount: input.requesterAccount,
    refundRecipientProfileId: initial.booking.parent_id,
    subjectType: "booking",
    subjectId: input.bookingId,
  });

  const recovery = await reconcilePlatformHeldBookingSettlement({
    bookingId: input.bookingId,
    source: "refund",
  });

  if (
    recovery.status === "human_review" ||
    recovery.status === "failed" ||
    recovery.status === "pending_release" ||
    recovery.status === "refund_pending"
  ) {
    throw new Error(
      recovery.status === "human_review"
        ? "KLYX_SETTLEMENT_HUMAN_REVIEW"
        : "KLYX_SETTLEMENT_REFUND_RECONCILIATION_PENDING"
    );
  }

  const remainingGross =
    Number(initial.settlement.gross_amount_cents) -
    Number(initial.settlement.refunded_amount_cents);

  if (remainingGross <= 0) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_ALREADY_COMPLETE");
  }

  const amountCents =
    input.request.kind === "total"
      ? remainingGross
      : safeCents(
          input.request.amountCents,
          "KLYX_SINGLE_HELD_PARTIAL_REFUND_AMOUNT_INVALID"
        );

  if (amountCents > remainingGross) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_EXCEEDS_REMAINING");
  }

  const financialRuntime =
    await requireKlyxFinancialStripeRuntimeForBooking(input.bookingId, {
      capability: "refunds",
    });
  const stripe = new Stripe(financialRuntime.key);
  const expectedLive = financialRuntime.mode !== "test";

  await verifyFrozenStripeCharge({
    stripe,
    settlement: initial.settlement,
    expectedLive,
  });
  await verifyReleasedTransfer({
    stripe,
    settlement: initial.settlement,
    expectedLive,
  });

  const { data: refundId, error: planError } = await supabaseAdmin.rpc(
    "klyx_create_platform_held_booking_refund_plan",
    {
      p_booking_id: input.bookingId,
      p_request_key: requestKey,
      p_amount_cents: amountCents,
      p_currency: initial.settlement.currency,
    }
  );

  if (planError) throw new Error(planError.message);
  if (typeof refundId !== "string") {
    throw new Error("KLYX_SINGLE_HELD_REFUND_PLAN_NOT_CREATED");
  }

  let refund = await loadRefund(refundId);
  let truth = await loadBookingAndSettlement(input.bookingId);

  if (refund.state === "review_required") {
    return { status: "review_required", refundId: refund.id };
  }

  if (refund.state === "succeeded" && refund.stripe_refund_id) {
    return {
      status: "refunded",
      refundId: refund.id,
      stripeRefundId: refund.stripe_refund_id,
      reconciled: true,
    };
  }

  const reversalPending = await processRequiredReversal({
    stripe,
    refund,
    settlement: truth.settlement,
    expectedLive,
  });

  refund = await loadRefund(refund.id);
  truth = await loadBookingAndSettlement(input.bookingId);

  if (refund.state === "review_required") {
    return { status: "review_required", refundId: refund.id };
  }

  if (reversalPending || refund.state === "reversing") {
    return { status: "pending_reversal", refundId: refund.id };
  }

  let remote;
  try {
    remote = await listExistingRefundTruth({
      stripe,
      refund,
      settlement: truth.settlement,
    });
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
      stripeRefund.amount !== Number(refund.amount_cents) ||
      stripeRefund.currency.toUpperCase() !== refund.currency
    ) {
      await markReview(
        refund.id,
        "single_refund_amount_currency_mismatch",
        "Existing Stripe refund differs from frozen KLYX refund truth."
      );
      return { status: "review_required", refundId: refund.id };
    }

    if (stripeRefund.status === "succeeded") {
      await finalizeRefund({
        refund,
        settlement: truth.settlement,
        stripeRefund,
      });
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

    if (
      stripeRefund.status === "failed" ||
      stripeRefund.status === "canceled"
    ) {
      await failRefund(
        refund.id,
        "stripe_refund_failed",
        stripeRefund.failure_reason ?? "Stripe refund failed."
      );
      const failed = await loadRefund(refund.id);
      return {
        status:
          failed.state === "review_required"
            ? "review_required"
            : "pending_refund",
        refundId: refund.id,
      };
    }
  }

  if (
    remote.remoteTotal + Number(refund.amount_cents) >
    Number(truth.settlement.gross_amount_cents)
  ) {
    await markReview(
      refund.id,
      "single_refund_aggregate_exceeds_gross",
      "Remote refund total plus requested refund exceeds frozen gross."
    );
    return { status: "review_required", refundId: refund.id };
  }

  if (refund.state !== "refunding") {
    const { data: inflight, error: inflightError } =
      await supabaseAdmin.rpc(
        "klyx_mark_platform_held_booking_refund_inflight",
        { p_refund_id: refund.id }
      );

    if (inflightError) throw new Error(inflightError.message);
    if (inflight !== true) {
      refund = await loadRefund(refund.id);
      return {
        status:
          refund.state === "review_required"
            ? "review_required"
            : "pending_refund",
        refundId: refund.id,
      };
    }
  }

  if (!truth.settlement.stripe_charge_id) {
    throw new Error("KLYX_SINGLE_HELD_SOURCE_CHARGE_REQUIRED");
  }

  try {
    stripeRefund = await stripe.refunds.create(
      {
        charge: truth.settlement.stripe_charge_id,
        amount: Number(refund.amount_cents),
        reason: "requested_by_customer",
        metadata: {
          payment_mode: PAYMENT_MODE,
          booking_id: input.bookingId,
          platform_held_booking_refund_id: refund.id,
          request_key: refund.request_key,
        },
      },
      {
        idempotencyKey:
          `klyx-platform-held-booking-refund-${refund.id}`,
      }
    );
  } catch {
    return { status: "pending_refund", refundId: refund.id };
  }

  if (stripeRefund.status === "succeeded") {
    await finalizeRefund({
      refund,
      settlement: truth.settlement,
      stripeRefund,
    });

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

  await failRefund(
    refund.id,
    "stripe_refund_failed",
    stripeRefund.failure_reason ?? "Stripe refund failed."
  );
  const failed = await loadRefund(refund.id);

  return {
    status:
      failed.state === "review_required"
        ? "review_required"
        : "pending_refund",
    refundId: refund.id,
  };
}

export async function reconcileSinglePlatformHeldRefundFromStripe(
  stripeRefund: Stripe.Refund
): Promise<boolean> {
  const refundId =
    stripeRefund.metadata?.platform_held_booking_refund_id?.trim() ?? "";

  if (
    stripeRefund.metadata?.payment_mode !== PAYMENT_MODE ||
    !refundId
  ) {
    return false;
  }

  const refund = await loadRefund(refundId);
  const truth = await loadBookingAndSettlement(refund.booking_id);
  const runtime = requireKlyxFinancialStripeObservationRuntime();
  const stripe = new Stripe(runtime.key);
  const expectedLive = runtime.mode !== "test";
  const chargeId = stripeObjectId(stripeRefund.charge);

  if (
    stripeRefund.metadata?.booking_id !== refund.booking_id ||
    !chargeId ||
    chargeId !== truth.settlement.stripe_charge_id ||
    stripeRefund.amount !== Number(refund.amount_cents) ||
    stripeRefund.currency.toUpperCase() !== refund.currency
  ) {
    await markReview(
      refund.id,
      "single_refund_webhook_truth_mismatch",
      "Stripe refund webhook differs from frozen KLYX refund truth."
    );
    return true;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  if (charge.livemode !== expectedLive) {
    throw new Error("KLYX_SINGLE_HELD_REFUND_LIVEMODE_MISMATCH");
  }

  if (stripeRefund.status === "succeeded") {
    await finalizeRefund({
      refund,
      settlement: truth.settlement,
      stripeRefund,
    });
    return true;
  }

  if (
    stripeRefund.status === "failed" ||
    stripeRefund.status === "canceled"
  ) {
    await failRefund(
      refund.id,
      "stripe_refund_failed",
      stripeRefund.failure_reason ?? "Stripe refund failed."
    );
    return true;
  }

  return true;
}

export async function openSinglePlatformHeldRefundReconciliation(input: {
  bookingId: string;
  reasonCode: string;
  expected?: Record<string, unknown>;
  actual?: Record<string, unknown>;
}) {
  return openFinancialReconciliationCase({
    caseKey: `single-platform-held-refund:${input.bookingId}:${input.reasonCode}`,
    bookingId: input.bookingId,
    state: "human_review",
    dimension: "refund",
    reasonCode: input.reasonCode,
    expected: input.expected,
    actual: input.actual,
    cause: "single_platform_held_refund_truth_divergence",
  });
}
