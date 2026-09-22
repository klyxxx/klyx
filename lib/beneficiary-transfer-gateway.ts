import "server-only";

import type Stripe from "stripe";

import {
  canReceiveSettlementForBooking,
  type EconomicSettlementEligibilityDecision,
} from "@/lib/economic-settlement-eligibility-server";
import { readStripeSettlementRecipientTruth } from "@/lib/stripe-settlement-recipient-truth";

export type BeneficiaryTransferAuthorizationFailureKind =
  | "economic"
  | "stripe";

export class BeneficiaryTransferAuthorizationError extends Error {
  readonly kind: BeneficiaryTransferAuthorizationFailureKind;
  readonly decision: Exclude<EconomicSettlementEligibilityDecision, "allowed">;
  readonly reasonCodes: string[];

  constructor(input: {
    kind: BeneficiaryTransferAuthorizationFailureKind;
    decision: Exclude<EconomicSettlementEligibilityDecision, "allowed">;
    reasonCodes: readonly string[];
    message: string;
  }) {
    super(input.message);
    this.name = "BeneficiaryTransferAuthorizationError";
    this.kind = input.kind;
    this.decision = input.decision;
    this.reasonCodes = Array.from(new Set(input.reasonCodes));
  }
}

export function isBeneficiaryTransferAuthorizationError(
  error: unknown
): error is BeneficiaryTransferAuthorizationError {
  return error instanceof BeneficiaryTransferAuthorizationError;
}

export async function createEconomicallyAuthorizedBeneficiaryTransfer(input: {
  stripe: Stripe;
  accountId: string;
  bookingIds: readonly string[];
  expectedProviderProfileId: string;
  expectedStripeAccountId: string;
  expectedLive: boolean;
  amount: number;
  currency: string;
  sourceTransaction: string;
  transferGroup: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
  onStripeWriteAttempt?: () => void;
}): Promise<Stripe.Transfer> {
  const bookingIds = Array.from(
    new Set(input.bookingIds.map((bookingId) => bookingId.trim()).filter(Boolean))
  );

  if (bookingIds.length === 0) {
    throw new BeneficiaryTransferAuthorizationError({
      kind: "economic",
      decision: "human_review",
      reasonCodes: ["economic_settlement_context_missing_after_claim"],
      message: "No booking context is available for beneficiary Transfer authorization.",
    });
  }

  const decisions = await Promise.all(
    bookingIds.map((bookingId) =>
      canReceiveSettlementForBooking({
        accountId: input.accountId,
        bookingId,
        expectedProviderProfileId: input.expectedProviderProfileId,
        expectedStripeAccountId: input.expectedStripeAccountId,
      })
    )
  );

  const reasonCodes: string[] = [];
  let decision: "blocked" | "human_review" = "blocked";

  for (const result of decisions) {
    if (!result) {
      decision = "human_review";
      reasonCodes.push("economic_settlement_context_missing_after_claim");
      continue;
    }

    if (result.decision === "human_review") {
      decision = "human_review";
    }

    if (result.decision !== "allowed") {
      reasonCodes.push(...result.reasonCodes);
    }
  }

  if (reasonCodes.length > 0) {
    throw new BeneficiaryTransferAuthorizationError({
      kind: "economic",
      decision,
      reasonCodes,
      message: "Economic settlement eligibility changed after the atomic claim.",
    });
  }

  const stripeTruth = await readStripeSettlementRecipientTruth(
    input.stripe,
    input.expectedStripeAccountId
  );

  if (
    stripeTruth.stripeAccountId !== input.expectedStripeAccountId ||
    stripeTruth.livemode !== input.expectedLive ||
    !stripeTruth.transferCapabilityActive
  ) {
    throw new BeneficiaryTransferAuthorizationError({
      kind: "stripe",
      decision: "human_review",
      reasonCodes: ["stripe_recipient_not_ready_after_claim"],
      message:
        "Remote Stripe recipient truth does not permit the expected Transfer mode.",
    });
  }

  input.onStripeWriteAttempt?.();

  return input.stripe.transfers.create(
    {
      amount: input.amount,
      currency: input.currency,
      destination: input.expectedStripeAccountId,
      source_transaction: input.sourceTransaction,
      transfer_group: input.transferGroup,
      metadata: input.metadata,
    },
    {
      idempotencyKey: input.idempotencyKey,
    }
  );
}
