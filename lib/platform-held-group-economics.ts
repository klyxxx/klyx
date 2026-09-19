import { calculateKlyxEconomics } from "@/lib/klyx-economics";

export type PlatformHeldGroupEconomicsMemberInput = {
  providerProfileId: string;
  accountId: string;
  stripeAccountId: string;
  grossAmountCents: number;
  currency: string;
  bookingIds: readonly string[];
};

export type PlatformHeldGroupEconomicsMember = {
  providerProfileId: string;
  accountId: string;
  stripeAccountId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  currency: string;
  bookingIds: string[];
};

export type PlatformHeldGroupEconomics = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  currency: string;
  memberCount: number;
  members: PlatformHeldGroupEconomicsMember[];
};

function normalizedText(value: string): string {
  return value.trim();
}

export function buildPlatformHeldGroupEconomics(input: {
  members: readonly PlatformHeldGroupEconomicsMemberInput[];
  commissionPercent: number;
}): PlatformHeldGroupEconomics {
  if (
    !Number.isFinite(input.commissionPercent) ||
    input.commissionPercent < 0 ||
    input.commissionPercent > 100 ||
    input.members.length < 2
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_ECONOMICS_INVALID");
  }

  const providerIds = new Set<string>();
  const accountIds = new Set<string>();
  const allBookingIds = new Set<string>();
  let currency = "";

  const members = input.members.map((raw) => {
    const providerProfileId = normalizedText(raw.providerProfileId);
    const accountId = normalizedText(raw.accountId);
    const stripeAccountId = normalizedText(raw.stripeAccountId);
    const memberCurrency = normalizedText(raw.currency).toUpperCase();
    const bookingIds = Array.from(
      new Set(raw.bookingIds.map(normalizedText).filter(Boolean))
    ).sort();

    if (
      !providerProfileId ||
      !accountId ||
      !stripeAccountId.startsWith("acct_") ||
      !Number.isSafeInteger(raw.grossAmountCents) ||
      raw.grossAmountCents <= 0 ||
      memberCurrency.length !== 3 ||
      bookingIds.length === 0
    ) {
      throw new Error("KLYX_GROUP_SETTLEMENT_MEMBER_INVALID");
    }

    if (providerIds.has(providerProfileId) || accountIds.has(accountId)) {
      throw new Error("KLYX_GROUP_SETTLEMENT_EXECUTOR_DUPLICATE");
    }

    for (const bookingId of bookingIds) {
      if (allBookingIds.has(bookingId)) {
        throw new Error("KLYX_GROUP_SETTLEMENT_BOOKING_DUPLICATE");
      }
      allBookingIds.add(bookingId);
    }

    if (!currency) currency = memberCurrency;
    if (currency !== memberCurrency) {
      throw new Error("KLYX_GROUP_SETTLEMENT_CURRENCY_MISMATCH");
    }

    providerIds.add(providerProfileId);
    accountIds.add(accountId);

    const economics = calculateKlyxEconomics(
      raw.grossAmountCents,
      input.commissionPercent
    );

    return {
      providerProfileId,
      accountId,
      stripeAccountId,
      grossAmountCents: economics.grossAmountCents,
      platformFeeCents: economics.platformFeeCents,
      providerAmountCents: economics.providerAmountCents,
      currency: memberCurrency,
      bookingIds,
    };
  });

  const totals = members.reduce(
    (sum, member) => ({
      grossAmountCents: sum.grossAmountCents + member.grossAmountCents,
      platformFeeCents: sum.platformFeeCents + member.platformFeeCents,
      providerAmountCents: sum.providerAmountCents + member.providerAmountCents,
    }),
    {
      grossAmountCents: 0,
      platformFeeCents: 0,
      providerAmountCents: 0,
    }
  );

  if (
    totals.platformFeeCents + totals.providerAmountCents !==
    totals.grossAmountCents
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_TOTAL_INVARIANT_BROKEN");
  }

  return {
    ...totals,
    currency,
    memberCount: members.length,
    members,
  };
}

export function providerRefundTargetCents(input: {
  grossAmountCents: number;
  providerAmountCents: number;
  refundedGrossAmountCents: number;
}): number {
  const {
    grossAmountCents,
    providerAmountCents,
    refundedGrossAmountCents,
  } = input;

  if (
    !Number.isSafeInteger(grossAmountCents) ||
    grossAmountCents <= 0 ||
    !Number.isSafeInteger(providerAmountCents) ||
    providerAmountCents < 0 ||
    providerAmountCents > grossAmountCents ||
    !Number.isSafeInteger(refundedGrossAmountCents) ||
    refundedGrossAmountCents < 0 ||
    refundedGrossAmountCents > grossAmountCents
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_REFUND_ECONOMICS_INVALID");
  }

  if (refundedGrossAmountCents === grossAmountCents) {
    return providerAmountCents;
  }

  return Math.floor(
    (providerAmountCents * refundedGrossAmountCents) / grossAmountCents
  );
}

export function providerReleaseEntitlementCents(input: {
  providerAmountCents: number;
  providerRefundCents: number;
}): number {
  if (
    !Number.isSafeInteger(input.providerAmountCents) ||
    !Number.isSafeInteger(input.providerRefundCents) ||
    input.providerAmountCents < 0 ||
    input.providerRefundCents < 0 ||
    input.providerRefundCents > input.providerAmountCents
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_RELEASE_ENTITLEMENT_INVALID");
  }

  return input.providerAmountCents - input.providerRefundCents;
}
