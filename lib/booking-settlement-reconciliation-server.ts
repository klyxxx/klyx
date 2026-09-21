import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import {
  preparePlatformHeldBookingRefund,
  releasePlatformHeldBookingSettlement,
} from "@/lib/booking-settlement-server";
import {
  assertStripeConnectIdentityUsable,
  getProfileAccountStripeConnectIdentity,
  getProfileAccountStripeConnectIdentityStrict,
  STRIPE_CONNECT_IDENTITY_CONFLICT,
  STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
} from "@/lib/stripe-connect-account-identity";
import { getFinancialStripeRuntime } from "@/lib/financial-stripe-runtime";
import { markBookingPaidFromSession } from "@/lib/stripe-payments";
import { reconcileStripeRefund } from "@/lib/stripe-refunds";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PAYMENT_MODE = "platform_held" as const;
const CLAIM_TTL_MS = 10 * 60 * 1000;

export type SettlementReconciliationSource =
  | "release"
  | "refund"
  | "webhook"
  | "scheduled"
  | "manual";

export type SettlementReconciliationResult =
  | { status: "not_applicable" }
  | {
      status:
        | "no_action"
        | "held"
        | "pending_release"
        | "refund_pending"
        | "human_review"
        | "failed";
      reasonCode?: string;
    }
  | {
      status: "released";
      transferId: string;
      reconciled: boolean;
    }
  | {
      status: "reversed";
      reversalId: string;
      reconciled: boolean;
    }
  | {
      status: "refunded";
      refundId: string | null;
    };

export type SettlementOperationalMetrics = {
  held: number;
  pendingRelease: number;
  failed: number;
  review: number;
  released: number;
  reversed: number;
  settlementAvgSeconds: number | null;
  settlementP50Seconds: number | null;
  settlementP95Seconds: number | null;
};

type SettlementRow = {
  booking_id: string;
  provider_profile_id: string;
  stripe_account_id: string;
  payment_mode: string;
  currency: string;
  gross_amount_cents: number;
  provider_amount_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  transfer_group: string;
  state: string;
  release_claimed_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
};

type BookingRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  refund_status: string | null;
  stripe_refund_id: string | null;
  booking_group_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_total: number | null;
  currency: string | null;
};

type RecoveryContext = {
  settlement: SettlementRow;
  booking: BookingRow;
};

type AuditOutcome =
  | "observed"
  | "recovered"
  | "released"
  | "reversed"
  | "human_review"
  | "no_action"
  | "failed";

class SettlementTruthMismatchError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "SettlementTruthMismatchError";
    this.code = code;
  }
}


function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function toUpperCurrency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function mismatch(condition: boolean, code: string): void {
  if (condition) {
    throw new SettlementTruthMismatchError(code);
  }
}

async function loadContext(bookingId: string): Promise<RecoveryContext | null> {
  const [{ data: settlementData, error: settlementError }, { data: bookingData, error: bookingError }] =
    await Promise.all([
      supabaseAdmin
        .from("booking_settlements")
        .select(
          "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state, release_claimed_at, released_at, refunded_at"
        )
        .eq("booking_id", bookingId)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select(
          "id, status, payment_status, payment_mode, refund_status, stripe_refund_id, booking_group_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_total, currency"
        )
        .eq("id", bookingId)
        .maybeSingle(),
    ]);

  if (settlementError) throw new Error(settlementError.message);
  if (bookingError) throw new Error(bookingError.message);

  if (!settlementData) return null;
  if (!bookingData) {
    throw new SettlementTruthMismatchError("settlement_booking_missing");
  }

  return {
    settlement: settlementData as SettlementRow,
    booking: bookingData as BookingRow,
  };
}

async function audit(input: {
  runId: string;
  bookingId: string;
  source: SettlementReconciliationSource;
  action: string;
  outcome: AuditOutcome;
  reasonCode?: string | null;
  beforeState?: string | null;
  afterState?: string | null;
  transferId?: string | null;
  reversalId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const deduplicationKey = [
    input.runId,
    input.action,
    input.outcome,
    input.reasonCode ?? "none",
  ].join(":");

  const { error } = await supabaseAdmin
    .from("booking_settlement_reconciliation_events")
    .insert({
      booking_id: input.bookingId,
      run_id: input.runId,
      source: input.source,
      action: input.action,
      outcome: input.outcome,
      reason_code: input.reasonCode ?? null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      stripe_transfer_id: input.transferId ?? null,
      stripe_transfer_reversal_id: input.reversalId ?? null,
      details: input.details ?? {},
      deduplication_key: deduplicationKey,
    });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

async function markHumanReview(input: {
  runId: string;
  bookingId: string;
  source: SettlementReconciliationSource;
  beforeState: string;
  reasonCodes: readonly string[];
  error?: unknown;
}): Promise<SettlementReconciliationResult> {
  const reasonCodes = Array.from(
    new Set(input.reasonCodes.map((value) => value.trim()).filter(Boolean))
  );
  const primaryReason = reasonCodes[0] ?? "settlement_truth_ambiguous";
  const message =
    input.error instanceof Error
      ? input.error.message
      : "Settlement truth is ambiguous and requires human review.";

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_mark_booking_settlement_human_review",
    {
      p_booking_id: input.bookingId,
      p_reason_codes: reasonCodes,
      p_error_code: primaryReason,
      p_error_message: message,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SETTLEMENT_HUMAN_REVIEW_NOT_WRITABLE");
  }

  await audit({
    runId: input.runId,
    bookingId: input.bookingId,
    source: input.source,
    action: "mark_human_review",
    outcome: "human_review",
    reasonCode: primaryReason,
    beforeState: input.beforeState,
    afterState: "human_review",
    details: { reasonCodes },
  });

  return { status: "human_review", reasonCode: primaryReason };
}

async function attachStripeTruth(input: {
  bookingId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  chargeId: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_attach_booking_settlement_stripe_truth",
    {
      p_booking_id: input.bookingId,
      p_checkout_session_id: input.checkoutSessionId,
      p_payment_intent_id: input.paymentIntentId,
      p_charge_id: input.chargeId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new SettlementTruthMismatchError(
      "settlement_stripe_truth_not_writable"
    );
  }
}

async function recordTransferTruth(
  bookingId: string,
  transferId: string
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_record_booking_settlement_transfer_truth",
    {
      p_booking_id: bookingId,
      p_stripe_transfer_id: transferId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new SettlementTruthMismatchError(
      "settlement_transfer_truth_conflict"
    );
  }
}

async function reconcileReleasedState(
  bookingId: string,
  transferId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reconcile_booking_settlement_released",
    {
      p_booking_id: bookingId,
      p_stripe_transfer_id: transferId,
    }
  );

  if (error) throw new Error(error.message);
  return data === true;
}

async function forceRefundPending(bookingId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_force_booking_settlement_refund_pending",
    { p_booking_id: bookingId }
  );

  if (error) throw new Error(error.message);
  return data === true;
}

async function reconcileRefundTerminal(bookingId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reconcile_booking_settlement_refund_terminal",
    { p_booking_id: bookingId }
  );

  if (error) throw new Error(error.message);
  return data === true;
}

async function assertCanonicalProviderIdentity(
  settlement: SettlementRow
): Promise<void> {
  let canonicalStripeAccountId: string | null;

  try {
    const runtime = getFinancialStripeRuntime();
    const identity =
      runtime.mode === "live"
        ? await getProfileAccountStripeConnectIdentityStrict(
            settlement.provider_profile_id
          )
        : await getProfileAccountStripeConnectIdentity(
            settlement.provider_profile_id
          );
    canonicalStripeAccountId = assertStripeConnectIdentityUsable(identity);
  } catch (error) {
    if (
      error instanceof Error &&
      [
        STRIPE_CONNECT_IDENTITY_CONFLICT,
        STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
      ].includes(error.message)
    ) {
      throw new SettlementTruthMismatchError(
        "provider_stripe_identity_conflict"
      );
    }
    throw error;
  }

  mismatch(
    !canonicalStripeAccountId,
    "provider_stripe_identity_unlinked"
  );
  mismatch(
    canonicalStripeAccountId !== settlement.stripe_account_id,
    "provider_stripe_identity_destination_mismatch"
  );
}

function verifyCheckoutSession(
  settlement: SettlementRow,
  session: Stripe.Checkout.Session
): void {
  mismatch(
    session.livemode !== getFinancialStripeRuntime().livemode,
    "stripe_mode_mismatch"
  );
  mismatch(
    session.id !== settlement.stripe_checkout_session_id,
    "checkout_session_id_mismatch"
  );
  mismatch(
    session.metadata?.booking_id !== settlement.booking_id,
    "checkout_session_booking_mismatch"
  );
  mismatch(
    session.metadata?.payment_mode !== PAYMENT_MODE,
    "checkout_session_payment_mode_mismatch"
  );
  mismatch(
    session.metadata?.settlement_transfer_group !== settlement.transfer_group,
    "checkout_session_transfer_group_mismatch"
  );

  if (session.amount_total != null) {
    mismatch(
      session.amount_total !== settlement.gross_amount_cents,
      "checkout_session_amount_mismatch"
    );
  }

  if (session.currency) {
    mismatch(
      session.currency.toUpperCase() !== settlement.currency,
      "checkout_session_currency_mismatch"
    );
  }
}

function verifyPaymentIntent(
  settlement: SettlementRow,
  intent: Stripe.PaymentIntent,
  chargeId: string
): void {
  mismatch(
    intent.livemode !== getFinancialStripeRuntime().livemode,
    "stripe_mode_mismatch"
  );
  mismatch(
    intent.status !== "succeeded",
    "payment_intent_not_succeeded"
  );
  mismatch(
    intent.metadata?.booking_id !== settlement.booking_id,
    "payment_intent_booking_mismatch"
  );
  mismatch(
    intent.metadata?.payment_mode !== PAYMENT_MODE,
    "payment_intent_payment_mode_mismatch"
  );
  mismatch(
    intent.transfer_group !== settlement.transfer_group,
    "payment_intent_transfer_group_mismatch"
  );
  mismatch(
    intent.amount !== settlement.gross_amount_cents,
    "payment_intent_amount_mismatch"
  );
  mismatch(
    intent.currency.toUpperCase() !== settlement.currency,
    "payment_intent_currency_mismatch"
  );
  mismatch(!chargeId.startsWith("ch_"), "payment_intent_charge_missing");

  if (settlement.stripe_charge_id) {
    mismatch(
      settlement.stripe_charge_id !== chargeId,
      "payment_intent_charge_mismatch"
    );
  }
}

function verifyTransfer(
  settlement: SettlementRow,
  transfer: Stripe.Transfer,
  chargeId: string
): void {
  mismatch(
    transfer.livemode !== getFinancialStripeRuntime().livemode,
    "stripe_mode_mismatch"
  );
  mismatch(
    transfer.metadata?.booking_id !== settlement.booking_id,
    "transfer_booking_mismatch"
  );
  mismatch(
    transfer.metadata?.payment_mode !== PAYMENT_MODE,
    "transfer_payment_mode_mismatch"
  );
  mismatch(
    transfer.amount !== settlement.provider_amount_cents,
    "transfer_amount_mismatch"
  );
  mismatch(
    transfer.currency.toUpperCase() !== settlement.currency,
    "transfer_currency_mismatch"
  );
  mismatch(
    stripeObjectId(transfer.destination) !== settlement.stripe_account_id,
    "transfer_destination_mismatch"
  );
  mismatch(
    stripeObjectId(transfer.source_transaction) !== chargeId,
    "transfer_charge_mismatch"
  );
  mismatch(
    transfer.transfer_group !== settlement.transfer_group,
    "transfer_group_mismatch"
  );

  if (settlement.stripe_transfer_id) {
    mismatch(
      settlement.stripe_transfer_id !== transfer.id,
      "transfer_id_mismatch"
    );
  }
}

function verifyReversal(
  settlement: SettlementRow,
  reversal: Stripe.TransferReversal
): void {
  mismatch(
    reversal.metadata?.booking_id !== settlement.booking_id,
    "reversal_booking_mismatch"
  );
  mismatch(
    reversal.metadata?.payment_mode !== PAYMENT_MODE,
    "reversal_payment_mode_mismatch"
  );
  mismatch(
    reversal.amount !== settlement.provider_amount_cents,
    "reversal_amount_mismatch"
  );

  if (settlement.stripe_transfer_reversal_id) {
    mismatch(
      settlement.stripe_transfer_reversal_id !== reversal.id,
      "reversal_id_mismatch"
    );
  }
}

function verifyRefund(
  settlement: SettlementRow,
  refund: Stripe.Refund
): void {
  mismatch(
    refund.metadata?.booking_id !== settlement.booking_id,
    "refund_booking_mismatch"
  );
  mismatch(
    refund.amount !== settlement.gross_amount_cents,
    "refund_amount_mismatch"
  );
  mismatch(
    refund.currency.toUpperCase() !== settlement.currency,
    "refund_currency_mismatch"
  );

  if (settlement.stripe_payment_intent_id) {
    mismatch(
      stripeObjectId(refund.payment_intent) !==
        settlement.stripe_payment_intent_id,
      "refund_payment_intent_mismatch"
    );
  }

  if (settlement.stripe_charge_id) {
    mismatch(
      stripeObjectId(refund.charge) !== settlement.stripe_charge_id,
      "refund_charge_mismatch"
    );
  }
}

async function findTransfer(
  stripe: Stripe,
  settlement: SettlementRow,
  chargeId: string
): Promise<Stripe.Transfer | null> {
  const listed = await stripe.transfers.list({
    transfer_group: settlement.transfer_group,
    destination: settlement.stripe_account_id,
    limit: 100,
  });

  const matching = listed.data.filter(
    (transfer) =>
      transfer.metadata?.booking_id === settlement.booking_id &&
      transfer.metadata?.payment_mode === PAYMENT_MODE
  );

  if (matching.length > 1) {
    throw new SettlementTruthMismatchError(
      "multiple_matching_transfers"
    );
  }

  let transfer = matching[0] ?? null;

  if (settlement.stripe_transfer_id) {
    const storedTransfer = await stripe.transfers.retrieve(
      settlement.stripe_transfer_id
    );
    verifyTransfer(settlement, storedTransfer, chargeId);

    if (transfer && transfer.id !== storedTransfer.id) {
      throw new SettlementTruthMismatchError(
        "stored_transfer_differs_from_discovered_transfer"
      );
    }

    transfer = storedTransfer;
  }

  if (transfer) {
    verifyTransfer(settlement, transfer, chargeId);
  }

  return transfer;
}

async function findReversal(
  stripe: Stripe,
  settlement: SettlementRow,
  transfer: Stripe.Transfer
): Promise<Stripe.TransferReversal | null> {
  const listed = await stripe.transfers.listReversals(transfer.id, {
    limit: 100,
  });

  const matching = listed.data.filter(
    (reversal) =>
      reversal.metadata?.booking_id === settlement.booking_id &&
      reversal.metadata?.payment_mode === PAYMENT_MODE
  );

  if (matching.length > 1) {
    throw new SettlementTruthMismatchError(
      "multiple_matching_reversals"
    );
  }

  const reversal = matching[0] ?? null;

  if (
    settlement.stripe_transfer_reversal_id &&
    reversal?.id !== settlement.stripe_transfer_reversal_id
  ) {
    throw new SettlementTruthMismatchError(
      "stored_reversal_missing_or_mismatched"
    );
  }

  if (reversal) {
    verifyReversal(settlement, reversal);
  }

  return reversal;
}

async function findRefund(
  stripe: Stripe,
  settlement: SettlementRow,
  booking: BookingRow
): Promise<Stripe.Refund | null> {
  if (!settlement.stripe_payment_intent_id) return null;

  let storedRefund: Stripe.Refund | null = null;

  if (booking.stripe_refund_id) {
    storedRefund = await stripe.refunds.retrieve(booking.stripe_refund_id);
    verifyRefund(settlement, storedRefund);
  }

  const listed = await stripe.refunds.list({
    payment_intent: settlement.stripe_payment_intent_id,
    limit: 100,
  });

  const matching = listed.data.filter(
    (refund) => refund.metadata?.booking_id === settlement.booking_id
  );

  if (matching.length > 1) {
    throw new SettlementTruthMismatchError(
      "multiple_matching_refunds"
    );
  }

  const discovered = matching[0] ?? null;

  if (storedRefund && discovered && storedRefund.id !== discovered.id) {
    throw new SettlementTruthMismatchError(
      "stored_refund_differs_from_discovered_refund"
    );
  }

  const refund = storedRefund ?? discovered;
  if (refund) verifyRefund(settlement, refund);

  return refund;
}

function activeRefund(
  settlement: SettlementRow,
  booking: BookingRow,
  refund: Stripe.Refund | null
): boolean {
  if (["refund_pending", "refunded"].includes(settlement.state)) return true;
  if (["processing", "succeeded"].includes(booking.refund_status ?? "")) {
    return true;
  }
  return refund ? !["failed", "canceled"].includes(refund.status ?? "") : false;
}

function freshClaim(settlement: SettlementRow): boolean {
  if (settlement.state !== "release_claimed" || !settlement.release_claimed_at) {
    return false;
  }

  const claimedAt = Date.parse(settlement.release_claimed_at);
  return Number.isFinite(claimedAt) && Date.now() - claimedAt < CLAIM_TTL_MS;
}

async function ensurePaymentTruth(
  stripe: Stripe,
  context: RecoveryContext,
  runId: string,
  source: SettlementReconciliationSource
): Promise<RecoveryContext> {
  let { settlement, booking } = context;
  const checkoutSessionId =
    settlement.stripe_checkout_session_id ??
    booking.stripe_checkout_session_id;

  if (!checkoutSessionId) {
    if (settlement.state === "pending_payment") return context;
    throw new SettlementTruthMismatchError(
      "settlement_checkout_session_missing"
    );
  }

  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  verifyCheckoutSession(settlement, session);

  if (
    session.payment_status === "paid" &&
    !["paid", "refunded"].includes(booking.payment_status ?? "")
  ) {
    await markBookingPaidFromSession(session);

    await audit({
      runId,
      bookingId: settlement.booking_id,
      source,
      action: "recover_missing_payment_webhook",
      outcome: "recovered",
      reasonCode: "checkout_paid_db_not_paid",
      beforeState: settlement.state,
      details: { checkoutSessionId: session.id },
    });

    const refreshed = await loadContext(settlement.booking_id);
    if (!refreshed) {
      throw new SettlementTruthMismatchError(
        "settlement_missing_after_payment_recovery"
      );
    }
    settlement = refreshed.settlement;
    booking = refreshed.booking;
  }

  // Checkout is authoritative for session identity and provenance. Once the
  // settlement has already moved beyond pending_payment, final financial truth
  // is established below from the real succeeded PaymentIntent + charge. This
  // also permits recovery when a signed webhook was persisted but the remote
  // Checkout projection is delayed or otherwise not yet converged.
  if (
    settlement.state === "pending_payment" &&
    session.payment_status !== "paid"
  ) {
    return { settlement, booking };
  }

  return { settlement, booking };
}

async function ensureRefundBookingTruth(input: {
  stripe: Stripe;
  refund: Stripe.Refund | null;
  context: RecoveryContext;
  runId: string;
  source: SettlementReconciliationSource;
}): Promise<RecoveryContext> {
  if (!input.refund) return input.context;

  const beforeRefundStatus = input.context.booking.refund_status;

  await reconcileStripeRefund(input.refund);

  if (beforeRefundStatus !== input.refund.status) {
    await audit({
      runId: input.runId,
      bookingId: input.context.settlement.booking_id,
      source: input.source,
      action: "recover_missing_refund_webhook",
      outcome: "recovered",
      reasonCode: "stripe_refund_db_reconciled",
      beforeState: input.context.settlement.state,
      transferId: input.context.settlement.stripe_transfer_id,
      reversalId: input.context.settlement.stripe_transfer_reversal_id,
      details: { refundId: input.refund.id, refundStatus: input.refund.status },
    });
  }

  const refreshed = await loadContext(input.context.settlement.booking_id);
  if (!refreshed) {
    throw new SettlementTruthMismatchError(
      "settlement_missing_after_refund_recovery"
    );
  }
  return refreshed;
}

export async function reconcilePlatformHeldBookingSettlement(input: {
  bookingId: string;
  source: SettlementReconciliationSource;
}): Promise<SettlementReconciliationResult> {
  const runId = randomUUID();
  let context: RecoveryContext | null = null;

  try {
    context = await loadContext(input.bookingId);

    if (!context || context.settlement.payment_mode !== PAYMENT_MODE) {
      return { status: "not_applicable" };
    }

    if (
      context.booking.payment_mode !== PAYMENT_MODE ||
      context.booking.booking_group_id
    ) {
      return markHumanReview({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        beforeState: context.settlement.state,
        reasonCodes: ["platform_held_scope_mismatch"],
      });
    }

    await audit({
      runId,
      bookingId: input.bookingId,
      source: input.source,
      action: "reconciliation_started",
      outcome: "observed",
      beforeState: context.settlement.state,
      transferId: context.settlement.stripe_transfer_id,
      reversalId: context.settlement.stripe_transfer_reversal_id,
    });

    await assertCanonicalProviderIdentity(context.settlement);

    const stripe = getFinancialStripeRuntime().stripe;
    context = await ensurePaymentTruth(
      stripe,
      context,
      runId,
      input.source
    );

    let { settlement, booking } = context;

    if (settlement.state === "pending_payment") {
      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "payment_still_pending",
        outcome: "no_action",
        beforeState: settlement.state,
        afterState: settlement.state,
      });
      return { status: "no_action", reasonCode: "payment_still_pending" };
    }

    const paymentIntentId =
      settlement.stripe_payment_intent_id ??
      booking.stripe_payment_intent_id;

    if (!paymentIntentId) {
      throw new SettlementTruthMismatchError(
        "settlement_payment_intent_missing"
      );
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const chargeId = stripeObjectId(intent.latest_charge);

    if (!chargeId) {
      throw new SettlementTruthMismatchError(
        "settlement_charge_missing"
      );
    }

    verifyPaymentIntent(settlement, intent, chargeId);

    if (!settlement.stripe_charge_id) {
      const checkoutSessionId =
        settlement.stripe_checkout_session_id ??
        booking.stripe_checkout_session_id;

      if (!checkoutSessionId) {
        throw new SettlementTruthMismatchError(
          "settlement_checkout_session_missing"
        );
      }

      await attachStripeTruth({
        bookingId: input.bookingId,
        checkoutSessionId,
        paymentIntentId,
        chargeId,
      });

      const refreshed = await loadContext(input.bookingId);
      if (!refreshed) {
        throw new SettlementTruthMismatchError(
          "settlement_missing_after_stripe_truth_attach"
        );
      }
      context = refreshed;
      settlement = refreshed.settlement;
      booking = refreshed.booking;
    }

    const transfer = await findTransfer(stripe, settlement, chargeId);
    const refund = await findRefund(stripe, settlement, booking);
    const refundIsActive =
      input.source === "refund" ||
      activeRefund(settlement, booking, refund);

    await audit({
      runId,
      bookingId: input.bookingId,
      source: input.source,
      action: "stripe_truth_searched",
      outcome: "observed",
      beforeState: settlement.state,
      transferId: transfer?.id ?? null,
      details: {
        paymentIntentId,
        chargeId,
        refundId: refund?.id ?? null,
        refundStatus: refund?.status ?? null,
      },
    });

    if (refundIsActive) {
      if (
        settlement.state === "release_claimed" &&
        !transfer
      ) {
        return markHumanReview({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          beforeState: settlement.state,
          reasonCodes: ["refund_release_claim_race"],
        });
      }

      if (transfer) {
        await recordTransferTruth(input.bookingId, transfer.id);
      }

      if (!(await forceRefundPending(input.bookingId))) {
        return markHumanReview({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          beforeState: settlement.state,
          reasonCodes: ["refund_fence_not_writable"],
        });
      }

      if (transfer) {
        const reversalBefore = await findReversal(
          stripe,
          settlement,
          transfer
        );

        const prepared = await preparePlatformHeldBookingRefund(
          input.bookingId
        );

        if (
          prepared.status === "busy" ||
          prepared.status === "not_ready"
        ) {
          await audit({
            runId,
            bookingId: input.bookingId,
            source: input.source,
            action: "refund_reversal_pending",
            outcome: "no_action",
            reasonCode: prepared.status,
            beforeState: settlement.state,
            afterState: "refund_pending",
            transferId: transfer.id,
          });
          return {
            status: "refund_pending",
            reasonCode: prepared.status,
          };
        }

        if (
          prepared.status === "refund_ready" &&
          input.source === "refund" &&
          !refund
        ) {
          await audit({
            runId,
            bookingId: input.bookingId,
            source: input.source,
            action: "refund_ready_after_reversal",
            outcome: "recovered",
            reasonCode: "provider_funds_already_safe",
            beforeState: settlement.state,
            afterState: "refund_pending",
            transferId: transfer.id,
            reversalId: settlement.stripe_transfer_reversal_id,
          });

          return {
            status: "no_action",
            reasonCode: "refund_ready",
          };
        }

        if (prepared.status === "refunded") {
          return {
            status: "refunded",
            refundId: booking.stripe_refund_id,
          };
        }

        if (prepared.status === "reversed") {
          await audit({
            runId,
            bookingId: input.bookingId,
            source: input.source,
            action: "provider_transfer_reversed",
            outcome: "reversed",
            beforeState: settlement.state,
            afterState: "refund_pending",
            transferId: transfer.id,
            reversalId: prepared.reversalId,
            details: { reconciled: prepared.reconciled },
          });

          if (refund) {
            context = await ensureRefundBookingTruth({
              stripe,
              refund,
              context: (await loadContext(input.bookingId)) ?? context,
              runId,
              source: input.source,
            });
          }

          const terminal = await reconcileRefundTerminal(input.bookingId);

          if (terminal) {
            const finalContext = await loadContext(input.bookingId);
            await audit({
              runId,
              bookingId: input.bookingId,
              source: input.source,
              action: "refund_terminal_reconciled",
              outcome: "recovered",
              beforeState: "refund_pending",
              afterState: finalContext?.settlement.state ?? "refunded",
              transferId: transfer.id,
              reversalId: prepared.reversalId,
              details: { refundId: refund?.id ?? null },
            });

            if (finalContext?.settlement.state === "refunded") {
              return {
                status: "refunded",
                refundId: finalContext.booking.stripe_refund_id,
              };
            }
          }

          return {
            status: "reversed",
            reversalId: prepared.reversalId,
            reconciled:
              prepared.reconciled || Boolean(reversalBefore),
          };
        }
      }

      if (!transfer && input.source === "refund" && !refund) {
        await audit({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          action: "refund_fenced_without_transfer",
          outcome: "recovered",
          reasonCode: "refund_ready_no_provider_transfer",
          beforeState: settlement.state,
          afterState: "refund_pending",
        });

        return {
          status: "no_action",
          reasonCode: "refund_ready_no_provider_transfer",
        };
      }

      if (refund) {
        context = await ensureRefundBookingTruth({
          stripe,
          refund,
          context: (await loadContext(input.bookingId)) ?? context,
          runId,
          source: input.source,
        });
      }

      const terminal = await reconcileRefundTerminal(input.bookingId);
      const finalContext = await loadContext(input.bookingId);

      if (terminal && finalContext?.settlement.state === "refunded") {
        await audit({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          action: "refund_terminal_reconciled",
          outcome: "recovered",
          beforeState: settlement.state,
          afterState: "refunded",
          details: { refundId: finalContext.booking.stripe_refund_id },
        });

        return {
          status: "refunded",
          refundId: finalContext.booking.stripe_refund_id,
        };
      }

      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "refund_fenced",
        outcome: "no_action",
        reasonCode: "refund_pending",
        beforeState: settlement.state,
        afterState: finalContext?.settlement.state ?? "refund_pending",
        transferId: transfer?.id ?? null,
      });

      return { status: "refund_pending", reasonCode: "refund_pending" };
    }

    if (transfer) {
      await recordTransferTruth(input.bookingId, transfer.id);

      const reconciled = await reconcileReleasedState(
        input.bookingId,
        transfer.id
      );

      if (!reconciled) {
        return markHumanReview({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          beforeState: settlement.state,
          reasonCodes: ["transfer_exists_release_state_not_reconcilable"],
        });
      }

      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "transfer_db_reconciled",
        outcome: "released",
        beforeState: settlement.state,
        afterState: "released",
        transferId: transfer.id,
      });

      return {
        status: "released",
        transferId: transfer.id,
        reconciled: true,
      };
    }

    if (settlement.stripe_transfer_id) {
      return markHumanReview({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        beforeState: settlement.state,
        reasonCodes: ["db_transfer_missing_in_stripe"],
      });
    }

    if (settlement.state === "released") {
      return markHumanReview({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        beforeState: settlement.state,
        reasonCodes: ["released_without_remote_transfer"],
      });
    }

    if (["review_required", "human_review"].includes(settlement.state)) {
      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "review_fence_preserved",
        outcome: "no_action",
        reasonCode: settlement.state,
        beforeState: settlement.state,
        afterState: settlement.state,
      });
      return {
        status: "human_review",
        reasonCode: settlement.state,
      };
    }

    if (settlement.state === "release_claimed" && freshClaim(settlement)) {
      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "active_release_claim_preserved",
        outcome: "no_action",
        reasonCode: "release_claim_fresh",
        beforeState: settlement.state,
        afterState: settlement.state,
      });
      return {
        status: "pending_release",
        reasonCode: "release_claim_fresh",
      };
    }

    if (
      ["held", "release_claimed", "release_failed"].includes(
        settlement.state
      ) &&
      booking.status === "completed" &&
      booking.payment_status === "paid"
    ) {
      const released = await releasePlatformHeldBookingSettlement(
        input.bookingId
      );

      if (released.status === "released") {
        await audit({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          action: "release_after_truth_search",
          outcome: "released",
          beforeState: settlement.state,
          afterState: "released",
          transferId: released.transferId,
          details: { reconciled: released.reconciled },
        });

        return released;
      }

      if (released.status === "review_required") {
        return markHumanReview({
          runId,
          bookingId: input.bookingId,
          source: input.source,
          beforeState: settlement.state,
          reasonCodes: ["transaction_risk_review_required"],
        });
      }

      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "release_not_ready",
        outcome: "no_action",
        reasonCode: released.status,
        beforeState: settlement.state,
      });

      return {
        status:
          released.status === "busy" ? "pending_release" : "held",
        reasonCode: released.status,
      };
    }

    await audit({
      runId,
      bookingId: input.bookingId,
      source: input.source,
      action: "no_recovery_action",
      outcome: "no_action",
      reasonCode: "settlement_not_actionable",
      beforeState: settlement.state,
      afterState: settlement.state,
    });

    return {
      status: settlement.state === "held" ? "held" : "no_action",
      reasonCode: "settlement_not_actionable",
    };
  } catch (error) {
    const beforeState = context?.settlement.state ?? null;

    if (
      error instanceof SettlementTruthMismatchError ||
      (error instanceof Error &&
        [
          STRIPE_CONNECT_IDENTITY_CONFLICT,
          STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
        ].includes(error.message))
    ) {
      if (!context) throw error;

      const reasonCode =
        error instanceof SettlementTruthMismatchError
          ? error.code
          : "provider_stripe_identity_conflict";

      return markHumanReview({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        beforeState: context.settlement.state,
        reasonCodes: [reasonCode],
        error,
      });
    }

    if (context) {
      await audit({
        runId,
        bookingId: input.bookingId,
        source: input.source,
        action: "reconciliation_failed",
        outcome: "failed",
        reasonCode:
          error instanceof Error ? error.message.slice(0, 120) : "unknown_error",
        beforeState,
        transferId: context.settlement.stripe_transfer_id,
        reversalId: context.settlement.stripe_transfer_reversal_id,
      });
    }

    return {
      status: "failed",
      reasonCode:
        error instanceof Error ? error.message : "settlement_reconciliation_failed",
    };
  }
}

export async function reconcilePendingPlatformHeldSettlements(input?: {
  limit?: number;
  source?: Extract<SettlementReconciliationSource, "scheduled" | "manual">;
}): Promise<{
  scanned: number;
  results: Array<{
    bookingId: string;
    result: SettlementReconciliationResult;
  }>;
}> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const source = input?.source ?? "scheduled";

  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select("booking_id")
    .eq("payment_mode", PAYMENT_MODE)
    .in("state", [
      "pending_payment",
      "held",
      "release_claimed",
      "release_failed",
      "refund_pending",
    ])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: Array<{
    bookingId: string;
    result: SettlementReconciliationResult;
  }> = [];

  for (const row of data ?? []) {
    const bookingId = String(row.booking_id);
    const result = await reconcilePlatformHeldBookingSettlement({
      bookingId,
      source,
    });
    results.push({ bookingId, result });
  }

  return { scanned: results.length, results };
}

export async function getPlatformHeldSettlementMetrics(): Promise<SettlementOperationalMetrics> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_booking_settlement_metrics"
  );

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  const value = (row ?? {}) as Record<string, unknown>;

  const numberOrNull = (input: unknown): number | null =>
    input == null ? null : Number(input);

  return {
    held: Number(value.held ?? 0),
    pendingRelease: Number(value.pending_release ?? 0),
    failed: Number(value.failed ?? 0),
    review: Number(value.review ?? 0),
    released: Number(value.released ?? 0),
    reversed: Number(value.reversed ?? 0),
    settlementAvgSeconds: numberOrNull(value.settlement_avg_seconds),
    settlementP50Seconds: numberOrNull(value.settlement_p50_seconds),
    settlementP95Seconds: numberOrNull(value.settlement_p95_seconds),
  };
}
