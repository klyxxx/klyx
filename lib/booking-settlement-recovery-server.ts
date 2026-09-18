import "server-only";

import { createHash } from "node:crypto";
import Stripe from "stripe";

import {
  classifySettlementRecoveryObservation,
  type SettlementRecoveryAction,
} from "@/lib/booking-settlement-recovery";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PAYMENT_MODE = "platform_held" as const;
const LIVE_FORBIDDEN = "KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY";
const TEST_KEY_REQUIRED = "KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED";

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
  stripe_transfer_reversal_id: string | null;
  transfer_group: string;
  state: string;
  release_claimed_at: string | null;
  updated_at: string;
};

type BookingRow = {
  id: string;
  payment_mode: string | null;
  booking_group_id: string | null;
  payment_status: string | null;
  refund_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type ApplyRow = {
  result: string;
  state_before: string | null;
  state_after: string | null;
};

export type SettlementRecoveryResult = {
  bookingId: string;
  status:
    | "not_applicable"
    | "healthy"
    | "pending"
    | "reconciled"
    | "review_required"
    | "observation_failed";
  action?: SettlementRecoveryAction;
  stateBefore?: string | null;
  stateAfter?: string | null;
  transferId?: string | null;
  reversalId?: string | null;
  reasonCodes?: string[];
};

function testStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (key.startsWith("sk_live_")) {
    throw new Error(LIVE_FORBIDDEN);
  }

  if (!key.startsWith("sk_test_")) {
    throw new Error(TEST_KEY_REQUIRED);
  }

  return new Stripe(key);
}

function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function transferSourceTransactionId(transfer: Stripe.Transfer): string | null {
  return stripeObjectId(transfer.source_transaction);
}

function observationKey(input: {
  bookingId: string;
  action: SettlementRecoveryAction;
  state: string;
  transferId?: string | null;
  reversalId?: string | null;
  remoteRefunded?: number;
  reasonCodes: readonly string[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        bookingId: input.bookingId,
        action: input.action,
        state: input.state,
        transferId: input.transferId ?? null,
        reversalId: input.reversalId ?? null,
        remoteRefunded: input.remoteRefunded ?? 0,
        reasonCodes: [...input.reasonCodes].sort(),
      })
    )
    .digest("hex");
}

async function loadSettlementAndBooking(bookingId: string): Promise<{
  settlement: SettlementRow | null;
  booking: BookingRow | null;
}> {
  const [{ data: settlement, error: settlementError }, { data: booking, error: bookingError }] =
    await Promise.all([
      supabaseAdmin
        .from("booking_settlements")
        .select(
          "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state, release_claimed_at, updated_at"
        )
        .eq("booking_id", bookingId)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select(
          "id, payment_mode, booking_group_id, payment_status, refund_status, stripe_checkout_session_id, stripe_payment_intent_id"
        )
        .eq("id", bookingId)
        .maybeSingle(),
    ]);

  if (settlementError) throw new Error(settlementError.message);
  if (bookingError) throw new Error(bookingError.message);

  return {
    settlement: settlement ? (settlement as SettlementRow) : null,
    booking: booking ? (booking as BookingRow) : null,
  };
}

async function canonicalStripeConflict(
  settlement: SettlementRow
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("account_id, owner_user_id")
    .eq("id", settlement.provider_profile_id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) return "PROVIDER_PROFILE_MISSING";

  let accountId =
    typeof profile.account_id === "string" ? profile.account_id : null;

  if (!accountId && typeof profile.owner_user_id === "string") {
    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("auth_user_id", profile.owner_user_id)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);
    accountId =
      account && typeof account.id === "string" ? account.id : null;
  }

  if (!accountId) return "CANONICAL_ACCOUNT_MISSING";

  const { data: identity, error: identityError } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select("stripe_account_id, identity_state")
    .eq("account_id", accountId)
    .maybeSingle();

  if (identityError) throw new Error(identityError.message);
  if (!identity) return "CANONICAL_STRIPE_IDENTITY_MISSING";
  if (identity.identity_state !== "linked") {
    return "CANONICAL_STRIPE_IDENTITY_NOT_LINKED";
  }
  if (identity.stripe_account_id !== settlement.stripe_account_id) {
    return "CANONICAL_STRIPE_DESTINATION_CONFLICT";
  }

  return null;
}

async function applyObservation(input: {
  settlement: SettlementRow;
  action: SettlementRecoveryAction;
  transferId?: string | null;
  reversalId?: string | null;
  reasonCodes: string[];
  details?: Record<string, unknown>;
  remoteRefunded?: number;
}): Promise<ApplyRow | null> {
  const key = observationKey({
    bookingId: input.settlement.booking_id,
    action: input.action,
    state: input.settlement.state,
    transferId: input.transferId,
    reversalId: input.reversalId,
    remoteRefunded: input.remoteRefunded,
    reasonCodes: input.reasonCodes,
  });

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_apply_booking_settlement_recovery",
    {
      p_booking_id: input.settlement.booking_id,
      p_action: input.action,
      p_observation_key: key,
      p_stripe_transfer_id: input.transferId ?? null,
      p_stripe_transfer_reversal_id: input.reversalId ?? null,
      p_reason_codes: input.reasonCodes,
      p_details: input.details ?? {},
    }
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as ApplyRow[])[0] ?? null;
}

async function attachVerifiedChargeTruth(input: {
  settlement: SettlementRow;
  booking: BookingRow;
  paymentIntentId: string;
  chargeId: string;
}) {
  if (input.settlement.stripe_charge_id) return;

  const checkoutSessionId =
    input.settlement.stripe_checkout_session_id ??
    input.booking.stripe_checkout_session_id;

  if (!checkoutSessionId) {
    throw new Error("KLYX_SETTLEMENT_RECOVERY_CHECKOUT_SESSION_MISSING");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_attach_booking_settlement_stripe_truth",
    {
      p_booking_id: input.settlement.booking_id,
      p_checkout_session_id: checkoutSessionId,
      p_payment_intent_id: input.paymentIntentId,
      p_charge_id: input.chargeId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_SETTLEMENT_RECOVERY_CHARGE_TRUTH_NOT_WRITABLE");
  }

  input.settlement.stripe_charge_id = input.chargeId;
}

function resultStatus(
  action: SettlementRecoveryAction,
  stateAfter: string | null | undefined
): SettlementRecoveryResult["status"] {
  if (action === "review_required" || stateAfter === "review_required") {
    return "review_required";
  }
  if (action === "observe_failed") return "observation_failed";
  if (action === "observe_pending") return "pending";
  if (action === "observe_healthy") return "healthy";
  return "reconciled";
}

export async function reconcilePlatformHeldBookingSettlement(
  bookingId: string
): Promise<SettlementRecoveryResult> {
  const { settlement, booking } = await loadSettlementAndBooking(bookingId);

  if (
    !settlement ||
    !booking ||
    settlement.payment_mode !== PAYMENT_MODE ||
    booking.payment_mode !== PAYMENT_MODE ||
    booking.booking_group_id !== null
  ) {
    return { bookingId, status: "not_applicable" };
  }

  const stripe = testStripeClient();
  const conflicts: string[] = [];

  const canonicalConflict = await canonicalStripeConflict(settlement);
  if (canonicalConflict) conflicts.push(canonicalConflict);

  const paymentIntentId =
    settlement.stripe_payment_intent_id ?? booking.stripe_payment_intent_id;

  if (!paymentIntentId) {
    conflicts.push("PAYMENT_INTENT_MISSING");
    const classification = classifySettlementRecoveryObservation({
      settlementState: settlement.state,
      claimExpired: false,
      refundActive: false,
      refundTerminal: false,
      transferCount: 0,
      reversalCount: 0,
      transferValid: false,
      reversalValid: false,
      dbTransferPresent: Boolean(settlement.stripe_transfer_id),
      dbReversalPresent: Boolean(settlement.stripe_transfer_reversal_id),
      conflicts,
    });
    const applied = await applyObservation({
      settlement,
      action: classification.action,
      reasonCodes: classification.reasonCodes,
      details: { summary: "PaymentIntent truth is missing from KLYX." },
    });
    return {
      bookingId,
      status: resultStatus(classification.action, applied?.state_after),
      action: classification.action,
      stateBefore: applied?.state_before,
      stateAfter: applied?.state_after,
      reasonCodes: classification.reasonCodes,
    };
  }

  let intent: Stripe.PaymentIntent;
  let charge: Stripe.Charge;

  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    if (intent.livemode) throw new Error(LIVE_FORBIDDEN);

    const latestCharge = intent.latest_charge;
    if (!latestCharge) {
      throw new Error("KLYX_SETTLEMENT_RECOVERY_CHARGE_MISSING");
    }

    charge =
      typeof latestCharge === "string"
        ? await stripe.charges.retrieve(latestCharge)
        : latestCharge;

    if (charge.livemode) throw new Error(LIVE_FORBIDDEN);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === LIVE_FORBIDDEN || error.message === TEST_KEY_REQUIRED)
    ) {
      throw error;
    }

    const reasonCodes = ["STRIPE_TRUTH_OBSERVATION_FAILED"];
    const applied = await applyObservation({
      settlement,
      action: "observe_failed",
      reasonCodes,
      details: {
        summary: "Stripe truth could not be established; no settlement state transition was applied.",
      },
    });

    return {
      bookingId,
      status: "observation_failed",
      action: "observe_failed",
      stateBefore: applied?.state_before,
      stateAfter: applied?.state_after,
      reasonCodes,
    };
  }

  const chargeId = charge.id;

  if (intent.status !== "succeeded") conflicts.push("PAYMENT_INTENT_NOT_SUCCEEDED");
  if (intent.metadata.booking_id !== bookingId) {
    conflicts.push("PAYMENT_INTENT_BOOKING_MISMATCH");
  }
  if (intent.metadata.payment_mode !== PAYMENT_MODE) {
    conflicts.push("PAYMENT_INTENT_MODE_MISMATCH");
  }
  if (intent.amount !== settlement.gross_amount_cents) {
    conflicts.push("PAYMENT_INTENT_AMOUNT_MISMATCH");
  }
  if (intent.currency.toUpperCase() !== settlement.currency) {
    conflicts.push("PAYMENT_INTENT_CURRENCY_MISMATCH");
  }
  if (intent.transfer_group !== settlement.transfer_group) {
    conflicts.push("PAYMENT_INTENT_TRANSFER_GROUP_MISMATCH");
  }
  if (!charge.paid) conflicts.push("CHARGE_NOT_PAID");
  if (charge.amount !== settlement.gross_amount_cents) {
    conflicts.push("CHARGE_AMOUNT_MISMATCH");
  }
  if (charge.currency.toUpperCase() !== settlement.currency) {
    conflicts.push("CHARGE_CURRENCY_MISMATCH");
  }
  if (
    settlement.stripe_charge_id &&
    settlement.stripe_charge_id !== chargeId
  ) {
    conflicts.push("CHARGE_ID_MISMATCH");
  }

  if (conflicts.length === 0) {
    await attachVerifiedChargeTruth({
      settlement,
      booking,
      paymentIntentId: intent.id,
      chargeId,
    });
  }

  let transfers: Stripe.Transfer[] = [];
  let reversalCandidates: Stripe.TransferReversal[] = [];

  try {
    const listed = await stripe.transfers.list({
      transfer_group: settlement.transfer_group,
      limit: 100,
    });
    transfers = listed.data;

    if (transfers.length === 1) {
      const reversals = await stripe.transfers.listReversals(transfers[0].id, {
        limit: 100,
      });
      reversalCandidates = reversals.data;
    }
  } catch (error) {
    const reasonCodes = ["STRIPE_SETTLEMENT_OBSERVATION_FAILED"];
    const applied = await applyObservation({
      settlement,
      action: "observe_failed",
      reasonCodes,
      details: {
        summary: "Stripe Transfer/Reversal truth could not be established; no financial retry was attempted.",
      },
    });

    return {
      bookingId,
      status: "observation_failed",
      action: "observe_failed",
      stateBefore: applied?.state_before,
      stateAfter: applied?.state_after,
      reasonCodes,
    };
  }

  let transferValid = transfers.length === 1;
  let reversalValid = reversalCandidates.length === 1;
  const transfer = transfers[0] ?? null;
  const reversal = reversalCandidates[0] ?? null;

  if (transfer) {
    if (transfer.livemode) throw new Error(LIVE_FORBIDDEN);
    if (transfer.metadata.booking_id !== bookingId) {
      transferValid = false;
      conflicts.push("TRANSFER_BOOKING_MISMATCH");
    }
    if (transfer.metadata.payment_mode !== PAYMENT_MODE) {
      transferValid = false;
      conflicts.push("TRANSFER_MODE_MISMATCH");
    }
    if (transfer.amount !== settlement.provider_amount_cents) {
      transferValid = false;
      conflicts.push("TRANSFER_AMOUNT_MISMATCH");
    }
    if (transfer.currency.toUpperCase() !== settlement.currency) {
      transferValid = false;
      conflicts.push("TRANSFER_CURRENCY_MISMATCH");
    }
    if (stripeObjectId(transfer.destination) !== settlement.stripe_account_id) {
      transferValid = false;
      conflicts.push("TRANSFER_DESTINATION_MISMATCH");
    }
    if (transferSourceTransactionId(transfer) !== chargeId) {
      transferValid = false;
      conflicts.push("TRANSFER_SOURCE_TRANSACTION_MISMATCH");
    }
    if (transfer.transfer_group !== settlement.transfer_group) {
      transferValid = false;
      conflicts.push("TRANSFER_GROUP_MISMATCH");
    }
    if (
      settlement.stripe_transfer_id &&
      settlement.stripe_transfer_id !== transfer.id
    ) {
      transferValid = false;
      conflicts.push("DB_TRANSFER_ID_MISMATCH");
    }
  }

  if (reversal) {
    if (reversal.amount !== settlement.provider_amount_cents) {
      reversalValid = false;
      conflicts.push("REVERSAL_AMOUNT_MISMATCH");
    }
    if (reversal.metadata?.booking_id !== bookingId) {
      reversalValid = false;
      conflicts.push("REVERSAL_BOOKING_MISMATCH");
    }
    if (reversal.metadata?.payment_mode !== PAYMENT_MODE) {
      reversalValid = false;
      conflicts.push("REVERSAL_MODE_MISMATCH");
    }
    if (
      settlement.stripe_transfer_reversal_id &&
      settlement.stripe_transfer_reversal_id !== reversal.id
    ) {
      reversalValid = false;
      conflicts.push("DB_REVERSAL_ID_MISMATCH");
    }
  }

  const dbRefundActive =
    ["processing", "succeeded"].includes(booking.refund_status ?? "") ||
    booking.payment_status === "refunded" ||
    ["refund_pending", "refunded"].includes(settlement.state);
  const dbRefundTerminal =
    booking.refund_status === "succeeded" ||
    booking.payment_status === "refunded";
  const remoteRefunded = charge.amount_refunded ?? 0;

  if (
    remoteRefunded > 0 &&
    remoteRefunded < settlement.gross_amount_cents
  ) {
    conflicts.push("PARTIAL_STRIPE_REFUND_REQUIRES_HUMAN_REVIEW");
  }

  if (remoteRefunded > settlement.gross_amount_cents) {
    conflicts.push("STRIPE_REFUND_AMOUNT_EXCEEDS_GROSS");
  }

  if (
    remoteRefunded === settlement.gross_amount_cents &&
    !dbRefundTerminal
  ) {
    conflicts.push("STRIPE_REFUND_TERMINAL_NOT_PERSISTED");
  }

  const claimedAt = settlement.release_claimed_at
    ? Date.parse(settlement.release_claimed_at)
    : Number.NaN;
  const claimExpired =
    settlement.state === "release_claimed" &&
    Number.isFinite(claimedAt) &&
    claimedAt <= Date.now() - 10 * 60 * 1000;

  const classification = classifySettlementRecoveryObservation({
    settlementState: settlement.state,
    claimExpired,
    refundActive: dbRefundActive || remoteRefunded > 0,
    refundTerminal: dbRefundTerminal,
    transferCount: transfers.length,
    reversalCount: reversalCandidates.length,
    transferValid,
    reversalValid,
    dbTransferPresent: Boolean(settlement.stripe_transfer_id),
    dbReversalPresent: Boolean(settlement.stripe_transfer_reversal_id),
    conflicts,
  });

  const applied = await applyObservation({
    settlement,
    action: classification.action,
    transferId: transfer?.id ?? null,
    reversalId: reversal?.id ?? null,
    reasonCodes: classification.reasonCodes,
    remoteRefunded,
    details: {
      summary: "Stripe TEST truth observed before settlement recovery write.",
      paymentIntentId: intent.id,
      chargeId,
      transferCount: transfers.length,
      reversalCount: reversalCandidates.length,
      remoteRefunded,
      dbRefundActive,
      dbRefundTerminal,
    },
  });

  return {
    bookingId,
    status: resultStatus(classification.action, applied?.state_after),
    action: classification.action,
    stateBefore: applied?.state_before,
    stateAfter: applied?.state_after,
    transferId: transfer?.id ?? null,
    reversalId: reversal?.id ?? null,
    reasonCodes: classification.reasonCodes,
  };
}

export async function reconcilePlatformHeldSettlementBacklog(input?: {
  limit?: number;
}): Promise<SettlementRecoveryResult[]> {
  const limit = Math.max(1, Math.min(50, input?.limit ?? 25));

  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select("booking_id")
    .eq("payment_mode", PAYMENT_MODE)
    .in("state", [
      "held",
      "release_claimed",
      "release_failed",
      "review_required",
      "released",
      "refund_pending",
    ])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: SettlementRecoveryResult[] = [];
  for (const row of data ?? []) {
    results.push(
      await reconcilePlatformHeldBookingSettlement(String(row.booking_id))
    );
  }
  return results;
}

export async function getPlatformHeldSettlementRecoveryMetrics() {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_booking_settlement_recovery_metrics"
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
}
