import { calculateKlyxEconomics } from "@/lib/klyx-economics";

export type MultiExecutorPlanUnit = {
  providerProfileId: string;
  providerAccountId: string;
  stripeAccountId: string;
  grossAmountCents: number;
  currency: string;
  bookingIds: string[];
};

export type MultiExecutorSettlementMemberPlan = MultiExecutorPlanUnit & {
  platformFeeCents: number;
  providerAmountCents: number;
};

export type MultiExecutorSettlementPlan = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  currency: string;
  members: MultiExecutorSettlementMemberPlan[];
};

export function buildMultiExecutorSettlementPlan(input: {
  units: readonly MultiExecutorPlanUnit[];
  commissionPercent: number;
}): MultiExecutorSettlementPlan {
  if (input.units.length < 2) {
    throw new Error("KLYX_GROUP_SETTLEMENT_REQUIRES_MULTIPLE_EXECUTORS");
  }

  const providerIds = new Set<string>();
  const accountIds = new Set<string>();
  let currency = "";
  let grossAmountCents = 0;
  let platformFeeCents = 0;
  let providerAmountCents = 0;

  const members = input.units.map((unit) => {
    const providerProfileId = unit.providerProfileId.trim();
    const providerAccountId = unit.providerAccountId.trim();
    const stripeAccountId = unit.stripeAccountId.trim();
    const unitCurrency = unit.currency.trim().toUpperCase();

    if (
      !providerProfileId ||
      !providerAccountId ||
      !stripeAccountId.startsWith("acct_") ||
      !Number.isSafeInteger(unit.grossAmountCents) ||
      unit.grossAmountCents <= 0 ||
      !/^[A-Z]{3}$/.test(unitCurrency) ||
      unit.bookingIds.length === 0
    ) {
      throw new Error("KLYX_GROUP_SETTLEMENT_MEMBER_PLAN_INVALID");
    }

    if (providerIds.has(providerProfileId)) {
      throw new Error("KLYX_GROUP_SETTLEMENT_DUPLICATE_EXECUTOR");
    }
    providerIds.add(providerProfileId);

    // One canonical KLYX account cannot appear twice as two artificial
    // executor identities inside one financial settlement.
    if (accountIds.has(providerAccountId)) {
      throw new Error("KLYX_GROUP_SETTLEMENT_DUPLICATE_ACCOUNT");
    }
    accountIds.add(providerAccountId);

    if (!currency) currency = unitCurrency;
    if (currency !== unitCurrency) {
      throw new Error("KLYX_GROUP_SETTLEMENT_CURRENCY_MISMATCH");
    }

    const economics = calculateKlyxEconomics(
      unit.grossAmountCents,
      input.commissionPercent
    );

    grossAmountCents += economics.grossAmountCents;
    platformFeeCents += economics.platformFeeCents;
    providerAmountCents += economics.providerAmountCents;

    return {
      ...unit,
      providerProfileId,
      providerAccountId,
      stripeAccountId,
      currency: unitCurrency,
      bookingIds: [...new Set(unit.bookingIds)].sort(),
      platformFeeCents: economics.platformFeeCents,
      providerAmountCents: economics.providerAmountCents,
    };
  });

  if (
    platformFeeCents + providerAmountCents !== grossAmountCents ||
    members.reduce((sum, member) => sum + member.grossAmountCents, 0) !==
      grossAmountCents ||
    members.reduce((sum, member) => sum + member.platformFeeCents, 0) !==
      platformFeeCents ||
    members.reduce((sum, member) => sum + member.providerAmountCents, 0) !==
      providerAmountCents
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_ACCOUNTING_INVARIANT_FAILED");
  }

  return {
    grossAmountCents,
    platformFeeCents,
    providerAmountCents,
    currency,
    members,
  };
}

export type MemberRefundAllocation = {
  grossRefundCents: number;
  platformFeeRefundCents: number;
  providerRefundCents: number;
};

export function allocateMemberPartialRefund(input: {
  requestedGrossRefundCents: number;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  alreadyRefundedGrossCents: number;
  alreadyRefundedPlatformFeeCents: number;
  alreadyRefundedProviderCents: number;
}): MemberRefundAllocation {
  const values = [
    input.requestedGrossRefundCents,
    input.grossAmountCents,
    input.platformFeeCents,
    input.providerAmountCents,
    input.alreadyRefundedGrossCents,
    input.alreadyRefundedPlatformFeeCents,
    input.alreadyRefundedProviderCents,
  ];

  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("KLYX_GROUP_REFUND_ALLOCATION_INVALID");
  }

  if (input.platformFeeCents + input.providerAmountCents !== input.grossAmountCents) {
    throw new Error("KLYX_GROUP_REFUND_MEMBER_ECONOMICS_INVALID");
  }

  if (
    input.alreadyRefundedPlatformFeeCents +
      input.alreadyRefundedProviderCents !==
      input.alreadyRefundedGrossCents ||
    input.alreadyRefundedGrossCents > input.grossAmountCents ||
    input.alreadyRefundedPlatformFeeCents > input.platformFeeCents ||
    input.alreadyRefundedProviderCents > input.providerAmountCents
  ) {
    throw new Error("KLYX_GROUP_REFUND_HISTORY_INVALID");
  }

  const remainingGross =
    input.grossAmountCents - input.alreadyRefundedGrossCents;
  const remainingFee =
    input.platformFeeCents - input.alreadyRefundedPlatformFeeCents;
  const remainingProvider =
    input.providerAmountCents - input.alreadyRefundedProviderCents;

  if (
    input.requestedGrossRefundCents <= 0 ||
    input.requestedGrossRefundCents > remainingGross
  ) {
    throw new Error("KLYX_GROUP_REFUND_EXCEEDS_MEMBER_REMAINING_GROSS");
  }

  const platformFeeRefundCents =
    input.requestedGrossRefundCents === remainingGross
      ? remainingFee
      : Math.floor(
          (input.requestedGrossRefundCents * remainingFee) / remainingGross
        );

  const providerRefundCents =
    input.requestedGrossRefundCents - platformFeeRefundCents;

  if (
    platformFeeRefundCents > remainingFee ||
    providerRefundCents > remainingProvider ||
    platformFeeRefundCents + providerRefundCents !==
      input.requestedGrossRefundCents
  ) {
    throw new Error("KLYX_GROUP_REFUND_ALLOCATION_INVARIANT_FAILED");
  }

  return {
    grossRefundCents: input.requestedGrossRefundCents,
    platformFeeRefundCents,
    providerRefundCents,
  };
}
