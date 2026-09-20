import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import {
  recordCanonicalReversal,
  recordCanonicalTransfer,
} from "@/lib/canonical-financial-ledger";
import { canReceiveSettlementForBooking } from "@/lib/economic-settlement-eligibility-server";
import {
  getProviderStripeDestination,
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import { readStripeSettlementRecipientTruth } from "@/lib/stripe-settlement-recipient-truth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceSettlementReleaseTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";

const PAYMENT_MODE = "platform_held" as const;
const TEST_KEY_REQUIRED = "KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED";
const LIVE_FORBIDDEN = "KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY";

export type SettlementReleaseResult =
  | { status: "not_applicable" }
  | { status: "not_ready" | "busy" | "review_required" }
  | { status: "released"; transferId: string; reconciled: boolean };

export type SettlementRefundPreparationResult =
  | { status: "not_applicable" | "refund_ready" | "refunded" }
  | { status: "busy" | "not_ready" }
  | { status: "reversed"; reversalId: string; reconciled: boolean };

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
};

type ReleaseClaimRow = {
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

export class SettlementRefundPreparationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 409) {
    super(code);
    this.name = "SettlementRefundPreparationError";
    this.code = code;
    this.status = status;
  }
}

export function isSettlementRefundPreparationError(
  error: unknown
): error is SettlementRefundPreparationError {
  return error instanceof SettlementRefundPreparationError;
}

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

async function findSettlement(bookingId: string): Promise<SettlementRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state"
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as SettlementRow) : null;
}

function stripeObjectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function attachStripeTruth(input: {
  bookingId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  chargeId: string;
}) {
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
  if (data !== true) throw new Error("KLYX_SETTLEMENT_STRIPE_TRUTH_NOT_WRITABLE");
}

async function markReviewRequired(bookingId: string, reasonCodes: readonly string[]) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_mark_booking_settlement_review_required",
    {
      p_booking_id: bookingId,
      p_reason_codes: Array.from(new Set(reasonCodes)),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_SETTLEMENT_REVIEW_STATE_NOT_WRITABLE");
}

async function failClaim(input: {
  bookingId: string;
  claimToken: string;
  code: string;
  message: string;
}) {
  const { error } = await supabaseAdmin.rpc(
    "klyx_fail_booking_settlement_release",
    {
      p_booking_id: input.bookingId,
      p_claim_token: input.claimToken,
      p_error_code: input.code,
      p_error_message: input.message,
    }
  );

  if (error) throw new Error(error.message);
}

async function finalizeRelease(input: {
  bookingId: string;
  claimToken: string;
  transferId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_booking_settlement_release",
    {
      p_booking_id: input.bookingId,
      p_claim_token: input.claimToken,
      p_stripe_transfer_id: input.transferId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_SETTLEMENT_RELEASE_FINALIZE_LOST");
}

async function reconcileReleaseFromStripeTruth(input: {
  bookingId: string;
  transferId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reconcile_booking_settlement_release",
    {
      p_booking_id: input.bookingId,
      p_stripe_transfer_id: input.transferId,
    }
  );

  if (error) throw new Error(error.message);
  return data === true;
}

function verifyPaymentIntentTruth(
  settlement: SettlementRow,
  intent: Stripe.PaymentIntent,
  chargeId: string
) {
  if (intent.livemode) throw new Error(LIVE_FORBIDDEN);
  if (intent.status !== "succeeded") {
    throw new Error("KLYX_SETTLEMENT_PAYMENT_INTENT_NOT_SUCCEEDED");
  }
  if (intent.metadata.booking_id !== settlement.booking_id) {
    throw new Error("KLYX_SETTLEMENT_PAYMENT_BOOKING_MISMATCH");
  }
  if (intent.metadata.payment_mode !== PAYMENT_MODE) {
    throw new Error("KLYX_SETTLEMENT_PAYMENT_MODE_MISMATCH");
  }
  if (intent.transfer_group !== settlement.transfer_group) {
    throw new Error("KLYX_SETTLEMENT_TRANSFER_GROUP_MISMATCH");
  }
  if (intent.amount !== settlement.gross_amount_cents) {
    throw new Error("KLYX_SETTLEMENT_PAYMENT_AMOUNT_MISMATCH");
  }
  if (intent.currency.toUpperCase() !== settlement.currency) {
    throw new Error("KLYX_SETTLEMENT_PAYMENT_CURRENCY_MISMATCH");
  }
  if (!chargeId.startsWith("ch_")) {
    throw new Error("KLYX_SETTLEMENT_CHARGE_REQUIRED");
  }
}

function transferSourceTransactionId(transfer: Stripe.Transfer): string | null {
  return stripeObjectId(transfer.source_transaction);
}

function verifyTransferTruth(input: {
  transfer: Stripe.Transfer;
  settlement: SettlementRow;
  chargeId: string;
}) {
  const { transfer, settlement, chargeId } = input;
  const destinationId = stripeObjectId(transfer.destination);

  if (transfer.livemode) throw new Error(LIVE_FORBIDDEN);
  if (transfer.amount !== settlement.provider_amount_cents) {
    throw new Error("KLYX_SETTLEMENT_EXISTING_TRANSFER_AMOUNT_MISMATCH");
  }
  if (transfer.currency.toUpperCase() !== settlement.currency) {
    throw new Error("KLYX_SETTLEMENT_EXISTING_TRANSFER_CURRENCY_MISMATCH");
  }
  if (destinationId !== settlement.stripe_account_id) {
    throw new Error("KLYX_SETTLEMENT_EXISTING_TRANSFER_DESTINATION_MISMATCH");
  }
  if (transferSourceTransactionId(transfer) !== chargeId) {
    throw new Error("KLYX_SETTLEMENT_EXISTING_TRANSFER_SOURCE_MISMATCH");
  }
  if (transfer.transfer_group !== settlement.transfer_group) {
    throw new Error("KLYX_SETTLEMENT_EXISTING_TRANSFER_GROUP_MISMATCH");
  }
}

async function reconcileExistingTransfer(input: {
  stripe: Stripe;
  settlement: SettlementRow;
  chargeId: string;
}): Promise<Stripe.Transfer | null> {
  const listed = await input.stripe.transfers.list({
    transfer_group: input.settlement.transfer_group,
    destination: input.settlement.stripe_account_id,
    limit: 10,
  });

  const matching = listed.data.filter(
    (transfer) =>
      transfer.metadata.booking_id === input.settlement.booking_id &&
      transfer.metadata.payment_mode === PAYMENT_MODE
  );

  if (matching.length > 1) {
    throw new Error("KLYX_SETTLEMENT_MULTIPLE_TRANSFERS_RECONCILIATION_REQUIRED");
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

export async function releasePlatformHeldBookingSettlement(
  bookingId: string
): Promise<SettlementReleaseResult> {
  const settlement = await findSettlement(bookingId);

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

  if (!paymentIntentId || !checkoutSessionId) {
    return { status: "not_ready" };
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(intent.latest_charge);

  if (!chargeId) {
    throw new Error("KLYX_SETTLEMENT_CHARGE_REQUIRED");
  }

  verifyPaymentIntentTruth(settlement, intent, chargeId);
  await attachStripeTruth({
    bookingId,
    checkoutSessionId,
    paymentIntentId,
    chargeId,
  });

  // Reconciliation is deliberately before fresh eligibility. If Stripe already
  // moved money during a previous attempt, KLYX must reconcile external truth
  // rather than pretending the movement did not happen.
  try {
    const existingTransfer = await reconcileExistingTransfer({
      stripe,
      settlement,
      chargeId,
    });

    if (existingTransfer) {
      await recordCanonicalTransfer({
        bookingId,
        transferId: existingTransfer.id,
        amountCents: existingTransfer.amount,
        currency: existingTransfer.currency,
        providerProfileId: settlement.provider_profile_id,
        stripeChargeId: chargeId,
        stripePaymentIntentId: paymentIntentId,
        reconciled: true,
      });

      const reconciled = await reconcileReleaseFromStripeTruth({
        bookingId,
        transferId: existingTransfer.id,
      });

      if (!reconciled) {
        const refreshed = await findSettlement(bookingId);
        if (
          refreshed?.state !== "released" ||
          refreshed.stripe_transfer_id !== existingTransfer.id
        ) {
          await markReviewRequired(bookingId, [
            "settlement_existing_transfer_local_reconciliation_required",
          ]);
          return { status: "review_required" };
        }
      }

      return {
        status: "released",
        transferId: existingTransfer.id,
        reconciled: true,
      };
    }
  } catch (error) {
    await markReviewRequired(bookingId, [
      "settlement_existing_transfer_truth_divergence",
      error instanceof Error ? error.message : "existing_transfer_truth_error",
    ]);
    return { status: "review_required" };
  }

  let recipientAccountId: string;

  try {
    const destination = await getProviderStripeDestination(
      settlement.provider_profile_id
    );

    if (
      destination.connect.state !== "linked" ||
      destination.connect.stripeAccountId !== settlement.stripe_account_id
    ) {
      await markReviewRequired(bookingId, [
        "canonical_stripe_identity_changed",
      ]);
      return { status: "review_required" };
    }

    recipientAccountId = destination.accountId;
  } catch (error) {
    if (!isStripeConnectIdentityReviewRequired(error)) throw error;

    await markReviewRequired(bookingId, [
      "canonical_stripe_identity_review_required",
      error.message,
    ]);
    return { status: "review_required" };
  }

  const economicEligibility = await canReceiveSettlementForBooking({
    accountId: recipientAccountId,
    bookingId,
    expectedProviderProfileId: settlement.provider_profile_id,
    expectedStripeAccountId: settlement.stripe_account_id,
  });

  if (!economicEligibility || economicEligibility.decision !== "allowed") {
    await markReviewRequired(bookingId, [
      economicEligibility?.decision ?? "human_review",
      ...(economicEligibility?.reasonCodes ?? [
        "economic_settlement_context_missing",
      ]),
    ]);
    return { status: "review_required" };
  }

  try {
    await enforceSettlementReleaseTransactionRisk({
      recipientProfileId: settlement.provider_profile_id,
      subjectId: bookingId,
    });
  } catch (error) {
    if (!isTransactionRiskGateError(error)) throw error;

    await markReviewRequired(bookingId, [
      error.decision,
      ...error.reasonCodes,
    ]);

    return { status: "review_required" };
  }

  const claimToken = randomUUID();
  const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
    "klyx_claim_booking_settlement_release",
    {
      p_booking_id: bookingId,
      p_claim_token: claimToken,
    }
  );

  if (claimError) throw new Error(claimError.message);

  const claim = ((claimData ?? []) as ReleaseClaimRow[])[0];
  if (!claim) throw new Error("KLYX_SETTLEMENT_RELEASE_CLAIM_MISSING");

  if (claim.action === "released") {
    const refreshed = await findSettlement(bookingId);
    if (!refreshed?.stripe_transfer_id) {
      throw new Error("KLYX_SETTLEMENT_RELEASED_WITHOUT_TRANSFER");
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
      bookingId,
      claimToken,
      code: "settlement_claim_incomplete",
      message: "Settlement release claim is missing frozen Stripe truth.",
    });
    throw new Error("KLYX_SETTLEMENT_RELEASE_CLAIM_INCOMPLETE");
  }

  let stripeAcceptedTransfer = false;

  try {
    let transfer: Stripe.Transfer | null;

    try {
      transfer = await reconcileExistingTransfer({
        stripe,
        settlement: {
          ...settlement,
          stripe_charge_id: claim.stripe_charge_id,
        },
        chargeId: claim.stripe_charge_id,
      });
    } catch (error) {
      await failClaim({
        bookingId,
        claimToken,
        code: "settlement_transfer_reconciliation_required",
        message:
          error instanceof Error ? error.message : "Transfer reconciliation failed.",
      });
      await markReviewRequired(bookingId, [
        "settlement_transfer_reconciliation_required",
      ]);
      return { status: "review_required" };
    }

    const reconciled = Boolean(transfer);

    if (!transfer) {
      const revalidatedEligibility = await canReceiveSettlementForBooking({
        accountId: recipientAccountId,
        bookingId,
        expectedProviderProfileId: settlement.provider_profile_id,
        expectedStripeAccountId: claim.stripe_account_id,
      });

      if (
        !revalidatedEligibility ||
        revalidatedEligibility.decision !== "allowed"
      ) {
        await failClaim({
          bookingId,
          claimToken,
          code: "economic_settlement_eligibility_changed",
          message:
            "Economic settlement eligibility changed after the atomic claim.",
        });
        await markReviewRequired(bookingId, [
          revalidatedEligibility?.decision ?? "human_review",
          ...(revalidatedEligibility?.reasonCodes ?? [
            "economic_settlement_context_missing_after_claim",
          ]),
        ]);
        return { status: "review_required" };
      }

      const stripeTruth = await readStripeSettlementRecipientTruth(
        stripe,
        claim.stripe_account_id
      );

      if (
        stripeTruth.stripeAccountId !== claim.stripe_account_id ||
        stripeTruth.livemode ||
        !stripeTruth.transferCapabilityActive
      ) {
        await failClaim({
          bookingId,
          claimToken,
          code: "stripe_recipient_not_ready",
          message:
            "Remote Stripe recipient truth does not permit a new TEST Transfer.",
        });
        await markReviewRequired(bookingId, [
          "stripe_recipient_not_ready",
        ]);
        return { status: "review_required" };
      }

      transfer = await stripe.transfers.create(
        {
          amount: claim.provider_amount_cents,
          currency: claim.currency.toLowerCase(),
          destination: claim.stripe_account_id,
          source_transaction: claim.stripe_charge_id,
          transfer_group: claim.transfer_group,
          metadata: {
            booking_id: bookingId,
            payment_mode: PAYMENT_MODE,
            settlement_attempt: String(claim.attempt_number),
          },
        },
        {
          idempotencyKey: `klyx-booking-settlement-${bookingId}`,
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

    await recordCanonicalTransfer({
      bookingId,
      transferId: transfer.id,
      amountCents: transfer.amount,
      currency: transfer.currency,
      providerProfileId: settlement.provider_profile_id,
      stripeChargeId: claim.stripe_charge_id,
      stripePaymentIntentId: settlement.stripe_payment_intent_id,
      reconciled,
    });

    await finalizeRelease({
      bookingId,
      claimToken,
      transferId: transfer.id,
    });

    return {
      status: "released",
      transferId: transfer.id,
      reconciled,
    };
  } catch (error) {
    // If Stripe has already accepted a Transfer, leave the claim in place. A
    // later retry reconciles by transfer_group before creating anything. Never
    // reopen the claim immediately after an accepted money movement.
    if (!stripeAcceptedTransfer) {
      await failClaim({
        bookingId,
        claimToken,
        code: "settlement_release_failed",
        message:
          error instanceof Error ? error.message : "Stripe Transfer failed.",
      });
    }

    throw error;
  }
}

async function finalizeReversal(input: {
  bookingId: string;
  transferId: string;
  reversalId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_finalize_booking_settlement_reversal",
    {
      p_booking_id: input.bookingId,
      p_stripe_transfer_id: input.transferId,
      p_stripe_transfer_reversal_id: input.reversalId,
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_SETTLEMENT_REVERSAL_FINALIZE_LOST");
}

export async function preparePlatformHeldBookingRefund(
  bookingId: string
): Promise<SettlementRefundPreparationResult> {
  const settlement = await findSettlement(bookingId);

  if (!settlement || settlement.payment_mode !== PAYMENT_MODE) {
    return { status: "not_applicable" };
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_prepare_booking_settlement_refund",
    { p_booking_id: bookingId }
  );

  if (error) throw new Error(error.message);
  const prepared = ((data ?? []) as RefundPreparationRow[])[0];

  if (!prepared) {
    throw new Error("KLYX_SETTLEMENT_REFUND_PREPARATION_MISSING");
  }

  if (prepared.action === "busy" || prepared.action === "not_ready") {
    return { status: prepared.action };
  }

  if (prepared.action === "not_applicable") {
    return { status: "not_applicable" };
  }

  if (prepared.action === "refunded") {
    return { status: "refunded" };
  }

  if (prepared.action === "refund_ready") {
    return { status: "refund_ready" };
  }

  const transferId = prepared.stripe_transfer_id;
  const providerAmount = prepared.provider_amount_cents;

  if (!transferId || providerAmount == null || providerAmount <= 0) {
    throw new SettlementRefundPreparationError(
      "KLYX_SETTLEMENT_REFUND_TRANSFER_TRUTH_MISSING"
    );
  }

  const chargeId = settlement.stripe_charge_id;
  if (!chargeId) {
    throw new SettlementRefundPreparationError(
      "KLYX_SETTLEMENT_REFUND_CHARGE_TRUTH_MISSING"
    );
  }

  const stripe = testStripeClient();
  const parentTransfer = await stripe.transfers.retrieve(transferId);

  // Transfer is the authoritative object for livemode and immutable release
  // truth. Stripe's TransferReversal type intentionally does not expose
  // `livemode`, so verify the parent before any reversal reconciliation/write.
  verifyTransferTruth({
    transfer: parentTransfer,
    settlement,
    chargeId,
  });

  const reversals = await stripe.transfers.listReversals(transferId, {
    limit: 100,
  });
  const matching = reversals.data.filter((reversal) => {
    const metadata = reversal.metadata ?? {};
    return (
      metadata.booking_id === bookingId &&
      metadata.payment_mode === PAYMENT_MODE
    );
  });

  if (matching.length > 1) {
    throw new SettlementRefundPreparationError(
      "KLYX_SETTLEMENT_MULTIPLE_REVERSALS_RECONCILIATION_REQUIRED"
    );
  }

  let reversal = matching[0] ?? null;
  const reconciled = Boolean(reversal);

  if (reversal && reversal.amount !== providerAmount) {
    throw new SettlementRefundPreparationError(
      "KLYX_SETTLEMENT_REVERSAL_AMOUNT_MISMATCH"
    );
  }

  if (!reversal) {
    reversal = await stripe.transfers.createReversal(
      transferId,
      {
        amount: providerAmount,
        metadata: {
          booking_id: bookingId,
          payment_mode: PAYMENT_MODE,
        },
      },
      {
        idempotencyKey: `klyx-booking-settlement-reversal-${bookingId}`,
      }
    );
  }

  await recordCanonicalReversal({
    bookingId,
    transferId,
    reversalId: reversal.id,
    amountCents: reversal.amount,
    currency: settlement.currency,
    providerProfileId: settlement.provider_profile_id,
    reconciled,
  });

  await finalizeReversal({
    bookingId,
    transferId,
    reversalId: reversal.id,
  });

  return {
    status: "reversed",
    reversalId: reversal.id,
    reconciled,
  };
}
