import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceSettlementReleaseTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";

const PAYMENT_MODE = "platform_held" as const;
const TEST_KEY_REQUIRED = "KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED";
const LIVE_FORBIDDEN = "KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY";

export type GroupSettlementReleaseResult =
  | { status: "not_applicable" }
  | { status: "not_ready" | "busy" | "review_required" }
  | { status: "released"; transferId: string; reconciled: boolean };

export type GroupSettlementRefundPreparationResult =
  | { status: "not_applicable" | "refund_ready" | "refunded" }
  | { status: "busy" | "not_ready" }
  | { status: "reversed"; reversalId: string; reconciled: boolean };

type GroupSettlementRow = {
  booking_group_id: string;
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
};

type ClaimRow = {
  action: "create" | "released" | "busy" | "not_ready";
  attempt_number: number;
  provider_profile_id: string | null;
  stripe_account_id: string | null;
  provider_amount_cents: number | null;
  currency: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  transfer_group: string | null;
};

type RefundPreparationRow = {
  action:
    | "not_applicable"
    | "refunded"
    | "busy"
    | "not_ready"
    | "reverse_transfer"
    | "refund_ready";
  stripe_transfer_id: string | null;
  provider_amount_cents: number | null;
  stripe_transfer_reversal_id: string | null;
};

function testStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) throw new Error(LIVE_FORBIDDEN);
  if (!key.startsWith("sk_test_")) throw new Error(TEST_KEY_REQUIRED);
  return new Stripe(key);
}

function stripeObjectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function findSettlement(groupId: string): Promise<GroupSettlementRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_group_settlements")
    .select(
      "booking_group_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state"
    )
    .eq("booking_group_id", groupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as GroupSettlementRow) : null;
}

async function attachStripeTruth(input: {
  groupId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  chargeId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_attach_booking_group_settlement_stripe_truth",
    {
      p_group_id: input.groupId,
      p_checkout_session_id: input.checkoutSessionId,
      p_payment_intent_id: input.paymentIntentId,
      p_charge_id: input.chargeId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_SETTLEMENT_STRIPE_TRUTH_NOT_WRITABLE");
}

async function markReviewRequired(groupId: string, reasonCodes: readonly string[]) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_mark_booking_group_settlement_review_required",
    {
      p_group_id: groupId,
      p_reason_codes: Array.from(new Set(reasonCodes)),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_SETTLEMENT_REVIEW_NOT_WRITABLE");
}

async function failClaim(input: {
  groupId: string;
  claimToken: string;
  code: string;
  message: string;
}) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_fail_booking_group_settlement_release",
    {
      p_group_id: input.groupId,
      p_claim_token: input.claimToken,
      p_error_code: input.code,
      p_error_message: input.message,
    }
  );
  if (error) throw new Error(error.message);
}

async function finalizeRelease(input: {
  groupId: string;
  claimToken: string;
  transferId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_booking_group_settlement_release",
    {
      p_group_id: input.groupId,
      p_claim_token: input.claimToken,
      p_stripe_transfer_id: input.transferId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_SETTLEMENT_RELEASE_FINALIZE_LOST");
}

function verifyPaymentIntentTruth(
  settlement: GroupSettlementRow,
  intent: Stripe.PaymentIntent,
  chargeId: string
) {
  if (intent.livemode) throw new Error(LIVE_FORBIDDEN);
  if (intent.status !== "succeeded") {
    throw new Error("KLYX_GROUP_SETTLEMENT_PAYMENT_INTENT_NOT_SUCCEEDED");
  }
  if (intent.metadata.booking_group_id !== settlement.booking_group_id) {
    throw new Error("KLYX_GROUP_SETTLEMENT_PAYMENT_GROUP_MISMATCH");
  }
  if (intent.metadata.payment_mode !== PAYMENT_MODE) {
    throw new Error("KLYX_GROUP_SETTLEMENT_PAYMENT_MODE_MISMATCH");
  }
  if (intent.transfer_group !== settlement.transfer_group) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_GROUP_MISMATCH");
  }
  if (intent.amount !== settlement.gross_amount_cents) {
    throw new Error("KLYX_GROUP_SETTLEMENT_PAYMENT_AMOUNT_MISMATCH");
  }
  if (intent.currency.toUpperCase() !== settlement.currency) {
    throw new Error("KLYX_GROUP_SETTLEMENT_PAYMENT_CURRENCY_MISMATCH");
  }
  if (!chargeId.startsWith("ch_")) {
    throw new Error("KLYX_GROUP_SETTLEMENT_CHARGE_REQUIRED");
  }
}

function verifyTransferTruth(input: {
  transfer: Stripe.Transfer;
  settlement: GroupSettlementRow;
  chargeId: string;
}) {
  const destination = stripeObjectId(input.transfer.destination);

  if (input.transfer.livemode) throw new Error(LIVE_FORBIDDEN);
  if (input.transfer.amount !== input.settlement.provider_amount_cents) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_AMOUNT_MISMATCH");
  }
  if (input.transfer.currency.toUpperCase() !== input.settlement.currency) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_CURRENCY_MISMATCH");
  }
  if (destination !== input.settlement.stripe_account_id) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_DESTINATION_MISMATCH");
  }
  if (stripeObjectId(input.transfer.source_transaction) !== input.chargeId) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_SOURCE_MISMATCH");
  }
  if (input.transfer.transfer_group !== input.settlement.transfer_group) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TRANSFER_GROUP_MISMATCH");
  }
}

async function currentRecipientTransferReady(
  stripe: Stripe,
  settlement: GroupSettlementRow
): Promise<boolean> {
  try {
    const account = await stripe.v2.core.accounts.retrieve(
      settlement.stripe_account_id,
      { include: ["configuration.recipient", "identity", "requirements"] }
    );

    return Boolean(
      account.livemode === false &&
        account.applied_configurations?.includes("recipient") === true &&
        account.configuration?.recipient?.applied === true &&
        account.configuration?.recipient?.capabilities?.stripe_balance
          ?.stripe_transfers?.status === "active"
    );
  } catch {
    return false;
  }
}

async function reconcileExistingTransfer(input: {
  stripe: Stripe;
  settlement: GroupSettlementRow;
  chargeId: string;
}): Promise<Stripe.Transfer | null> {
  const listed = await input.stripe.transfers.list({
    transfer_group: input.settlement.transfer_group,
    destination: input.settlement.stripe_account_id,
    limit: 10,
  });

  const matching = listed.data.filter(
    (transfer) =>
      transfer.metadata.booking_group_id === input.settlement.booking_group_id &&
      transfer.metadata.payment_mode === PAYMENT_MODE
  );

  if (matching.length > 1) {
    throw new Error("KLYX_GROUP_SETTLEMENT_MULTIPLE_TRANSFERS_RECONCILIATION_REQUIRED");
  }

  const existing = matching[0] ?? null;
  if (!existing) return null;

  verifyTransferTruth({
    transfer: existing,
    settlement: input.settlement,
    chargeId: input.chargeId,
  });
  return existing;
}

export async function releasePlatformHeldBookingGroupSettlement(
  groupId: string
): Promise<GroupSettlementReleaseResult> {
  const settlement = await findSettlement(groupId);

  if (!settlement || settlement.payment_mode !== PAYMENT_MODE) {
    return { status: "not_applicable" };
  }
  if (settlement.state === "released" && settlement.stripe_transfer_id) {
    return {
      status: "released",
      transferId: settlement.stripe_transfer_id,
      reconciled: true,
    };
  }
  if (["refund_pending", "refunded"].includes(settlement.state)) {
    return { status: "not_ready" };
  }

  const stripe = testStripeClient();
  const paymentIntentId = settlement.stripe_payment_intent_id;
  const checkoutSessionId = settlement.stripe_checkout_session_id;
  if (!paymentIntentId || !checkoutSessionId) return { status: "not_ready" };

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(intent.latest_charge);
  if (!chargeId) throw new Error("KLYX_GROUP_SETTLEMENT_CHARGE_REQUIRED");

  verifyPaymentIntentTruth(settlement, intent, chargeId);
  await attachStripeTruth({
    groupId,
    checkoutSessionId,
    paymentIntentId,
    chargeId,
  });

  const recipientReady = await currentRecipientTransferReady(stripe, settlement);
  if (!recipientReady) {
    await markReviewRequired(groupId, ["stripe_recipient_transfer_not_active"]);
    return { status: "review_required" };
  }

  try {
    await enforceSettlementReleaseTransactionRisk({
      recipientProfileId: settlement.provider_profile_id,
      subjectType: "booking_group",
      subjectId: groupId,
    });
  } catch (error) {
    if (!isTransactionRiskGateError(error)) throw error;
    await markReviewRequired(groupId, [error.decision, ...error.reasonCodes]);
    return { status: "review_required" };
  }

  const claimToken = randomUUID();
  const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
    "klyx_claim_booking_group_settlement_release",
    { p_group_id: groupId, p_claim_token: claimToken }
  );
  if (claimError) throw new Error(claimError.message);

  const claim = ((claimData ?? []) as ClaimRow[])[0];
  if (!claim) throw new Error("KLYX_GROUP_SETTLEMENT_RELEASE_CLAIM_MISSING");

  if (claim.action === "released") {
    const refreshed = await findSettlement(groupId);
    if (!refreshed?.stripe_transfer_id) {
      throw new Error("KLYX_GROUP_SETTLEMENT_RELEASED_WITHOUT_TRANSFER");
    }
    return {
      status: "released",
      transferId: refreshed.stripe_transfer_id,
      reconciled: true,
    };
  }

  if (claim.action === "busy" || claim.action === "not_ready") {
    return { status: claim.action };
  }

  if (
    !claim.stripe_account_id ||
    claim.provider_amount_cents == null ||
    !claim.currency ||
    !claim.stripe_charge_id ||
    !claim.transfer_group
  ) {
    await failClaim({
      groupId,
      claimToken,
      code: "group_settlement_claim_incomplete",
      message: "Group settlement release claim is missing frozen Stripe truth.",
    });
    throw new Error("KLYX_GROUP_SETTLEMENT_RELEASE_CLAIM_INCOMPLETE");
  }

  if (claim.provider_amount_cents > settlement.gross_amount_cents) {
    await failClaim({
      groupId,
      claimToken,
      code: "group_settlement_release_exceeds_capture",
      message: "Provider release exceeds captured group funds.",
    });
    throw new Error("KLYX_GROUP_SETTLEMENT_RELEASE_EXCEEDS_CAPTURE");
  }

  let stripeAcceptedTransfer = false;

  try {
    let transfer: Stripe.Transfer | null;

    try {
      transfer = await reconcileExistingTransfer({
        stripe,
        settlement: { ...settlement, stripe_charge_id: claim.stripe_charge_id },
        chargeId: claim.stripe_charge_id,
      });
    } catch (error) {
      await failClaim({
        groupId,
        claimToken,
        code: "group_settlement_transfer_reconciliation_required",
        message:
          error instanceof Error ? error.message : "Group Transfer reconciliation failed.",
      });
      await markReviewRequired(groupId, [
        "group_settlement_transfer_reconciliation_required",
      ]);
      return { status: "review_required" };
    }

    const reconciled = Boolean(transfer);

    if (!transfer) {
      transfer = await stripe.transfers.create(
        {
          amount: claim.provider_amount_cents,
          currency: claim.currency.toLowerCase(),
          destination: claim.stripe_account_id,
          source_transaction: claim.stripe_charge_id,
          transfer_group: claim.transfer_group,
          metadata: {
            booking_group_id: groupId,
            payment_mode: PAYMENT_MODE,
            settlement_attempt: String(claim.attempt_number),
          },
        },
        {
          idempotencyKey: "klyx-booking-group-settlement-" + groupId,
        }
      );
      stripeAcceptedTransfer = true;
      verifyTransferTruth({
        transfer,
        settlement,
        chargeId: claim.stripe_charge_id,
      });
    } else {
      stripeAcceptedTransfer = true;
    }

    await finalizeRelease({
      groupId,
      claimToken,
      transferId: transfer.id,
    });

    return {
      status: "released",
      transferId: transfer.id,
      reconciled,
    };
  } catch (error) {
    if (!stripeAcceptedTransfer) {
      await failClaim({
        groupId,
        claimToken,
        code: "group_settlement_release_failed",
        message: error instanceof Error ? error.message : "Stripe group Transfer failed.",
      });
    }
    throw error;
  }
}

async function finalizeReversal(input: {
  groupId: string;
  transferId: string;
  reversalId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_booking_group_settlement_reversal",
    {
      p_group_id: input.groupId,
      p_stripe_transfer_id: input.transferId,
      p_stripe_transfer_reversal_id: input.reversalId,
    }
  );
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_SETTLEMENT_REVERSAL_FINALIZE_LOST");
}

export async function preparePlatformHeldBookingGroupRefund(
  groupId: string
): Promise<GroupSettlementRefundPreparationResult> {
  const settlement = await findSettlement(groupId);

  if (!settlement || settlement.payment_mode !== PAYMENT_MODE) {
    return { status: "not_applicable" };
  }

  // Even a refund-before-release remains TEST-only. Do not let a runtime key
  // switch to live and continue into the legacy group refund core.
  const stripe = testStripeClient();

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_prepare_booking_group_settlement_refund",
    { p_group_id: groupId }
  );
  if (error) throw new Error(error.message);

  const prepared = ((data ?? []) as RefundPreparationRow[])[0];
  if (!prepared) throw new Error("KLYX_GROUP_SETTLEMENT_REFUND_PREPARATION_MISSING");

  if (prepared.action === "busy" || prepared.action === "not_ready") {
    return { status: prepared.action };
  }
  if (prepared.action === "not_applicable") return { status: "not_applicable" };
  if (prepared.action === "refunded") return { status: "refunded" };
  if (prepared.action === "refund_ready") return { status: "refund_ready" };

  const transferId = prepared.stripe_transfer_id;
  const providerAmount = prepared.provider_amount_cents;
  if (!transferId || providerAmount == null || providerAmount <= 0) {
    throw new Error("KLYX_GROUP_SETTLEMENT_REFUND_TRANSFER_TRUTH_MISSING");
  }

  const chargeId = settlement.stripe_charge_id;
  if (!chargeId) throw new Error("KLYX_GROUP_SETTLEMENT_REFUND_CHARGE_TRUTH_MISSING");

  const parentTransfer = await stripe.transfers.retrieve(transferId);
  verifyTransferTruth({ transfer: parentTransfer, settlement, chargeId });

  const reversals = await stripe.transfers.listReversals(transferId, { limit: 100 });
  const matching = reversals.data.filter(
    (reversal) =>
      reversal.metadata?.booking_group_id === groupId &&
      reversal.metadata?.payment_mode === PAYMENT_MODE
  );

  if (matching.length > 1) {
    throw new Error("KLYX_GROUP_SETTLEMENT_MULTIPLE_REVERSALS_RECONCILIATION_REQUIRED");
  }

  let reversal = matching[0] ?? null;
  const reconciled = Boolean(reversal);

  if (reversal && reversal.amount !== providerAmount) {
    throw new Error("KLYX_GROUP_SETTLEMENT_REVERSAL_AMOUNT_MISMATCH");
  }

  if (!reversal) {
    reversal = await stripe.transfers.createReversal(
      transferId,
      {
        amount: providerAmount,
        metadata: {
          booking_group_id: groupId,
          payment_mode: PAYMENT_MODE,
        },
      },
      {
        idempotencyKey: "klyx-booking-group-settlement-reversal-" + groupId,
      }
    );
  }

  await finalizeReversal({
    groupId,
    transferId,
    reversalId: reversal.id,
  });

  return {
    status: "reversed",
    reversalId: reversal.id,
    reconciled,
  };
}
