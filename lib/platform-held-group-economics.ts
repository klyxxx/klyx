export type PlatformHeldGroupMemberInput = {
  providerProfileId: string;
  stripeAccountId: string;
  grossAmountCents: number;
  bookingIds: readonly string[];
};

export type PlatformHeldGroupMemberEconomics = {
  providerProfileId: string;
  stripeAccountId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  bookingIds: string[];
};

export type PlatformHeldGroupEconomics = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  members: PlatformHeldGroupMemberEconomics[];
};

function assertCents(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }
}

function feeTotal(grossAmountCents: number, commissionPercent: number): number {
  if (
    !Number.isFinite(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100
  ) {
    throw new Error("KLYX_GROUP_COMMISSION_INVALID");
  }

  const scaled = Math.round(commissionPercent * 1_000_000);
  const numerator = BigInt(grossAmountCents) * BigInt(scaled);
  const denominator = 100_000_000n;
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(rounded);

  assertCents(result, "KLYX_GROUP_COMMISSION_OVERFLOW");
  return result;
}

export function calculatePlatformHeldGroupEconomics(input: {
  members: readonly PlatformHeldGroupMemberInput[];
  commissionPercent: number;
}): PlatformHeldGroupEconomics {
  if (input.members.length < 2) {
    throw new Error("KLYX_GROUP_MULTI_EXECUTOR_REQUIRED");
  }

  const normalized = input.members
    .map((member) => ({
      providerProfileId: member.providerProfileId.trim(),
      stripeAccountId: member.stripeAccountId.trim(),
      grossAmountCents: member.grossAmountCents,
      bookingIds: Array.from(
        new Set(member.bookingIds.map((value) => value.trim()).filter(Boolean))
      ).sort(),
    }))
    .sort((a, b) => a.providerProfileId.localeCompare(b.providerProfileId));

  const providerIds = new Set<string>();
  const stripeAccountIds = new Set<string>();

  for (const member of normalized) {
    if (!member.providerProfileId) {
      throw new Error("KLYX_GROUP_PROVIDER_REQUIRED");
    }
    if (!member.stripeAccountId.startsWith("acct_")) {
      throw new Error("KLYX_GROUP_STRIPE_ACCOUNT_REQUIRED");
    }
    if (providerIds.has(member.providerProfileId)) {
      throw new Error("KLYX_GROUP_PROVIDER_DUPLICATE");
    }
    if (stripeAccountIds.has(member.stripeAccountId)) {
      throw new Error("KLYX_GROUP_STRIPE_ACCOUNT_DUPLICATE");
    }
    providerIds.add(member.providerProfileId);
    stripeAccountIds.add(member.stripeAccountId);

    assertCents(member.grossAmountCents, "KLYX_GROUP_MEMBER_GROSS_INVALID");
    if (member.grossAmountCents <= 0 || member.bookingIds.length === 0) {
      throw new Error("KLYX_GROUP_MEMBER_GROSS_INVALID");
    }
  }

  const grossAmountCents = normalized.reduce(
    (sum, member) => sum + member.grossAmountCents,
    0
  );
  assertCents(grossAmountCents, "KLYX_GROUP_GROSS_INVALID");

  const platformFeeCents = feeTotal(
    grossAmountCents,
    input.commissionPercent
  );
  if (platformFeeCents > grossAmountCents) {
    throw new Error("KLYX_GROUP_COMMISSION_EXCEEDS_GROSS");
  }

  const grossBig = BigInt(grossAmountCents);
  const feeBig = BigInt(platformFeeCents);

  const allocations = normalized.map((member) => {
    const numerator = feeBig * BigInt(member.grossAmountCents);
    const base = Number(numerator / grossBig);
    const remainder = numerator % grossBig;

    return {
      member,
      platformFeeCents: base,
      remainder,
    };
  });

  let allocated = allocations.reduce(
    (sum, item) => sum + item.platformFeeCents,
    0
  );
  let remaining = platformFeeCents - allocated;

  const remainderOrder = [...allocations].sort((a, b) => {
    if (a.remainder === b.remainder) {
      return a.member.providerProfileId.localeCompare(
        b.member.providerProfileId
      );
    }
    return a.remainder > b.remainder ? -1 : 1;
  });

  for (const item of remainderOrder) {
    if (remaining <= 0) break;
    if (item.platformFeeCents < item.member.grossAmountCents) {
      item.platformFeeCents += 1;
      allocated += 1;
      remaining -= 1;
    }
  }

  if (allocated !== platformFeeCents || remaining !== 0) {
    throw new Error("KLYX_GROUP_COMMISSION_ALLOCATION_FAILED");
  }

  const members = allocations
    .map(({ member, platformFeeCents: memberFee }) => {
      const providerAmountCents =
        member.grossAmountCents - memberFee;

      assertCents(providerAmountCents, "KLYX_GROUP_MEMBER_PROVIDER_INVALID");

      return {
        ...member,
        platformFeeCents: memberFee,
        providerAmountCents,
      };
    })
    .sort((a, b) => a.providerProfileId.localeCompare(b.providerProfileId));

  const memberGross = members.reduce(
    (sum, member) => sum + member.grossAmountCents,
    0
  );
  const memberFees = members.reduce(
    (sum, member) => sum + member.platformFeeCents,
    0
  );
  const memberProviders = members.reduce(
    (sum, member) => sum + member.providerAmountCents,
    0
  );
  const providerAmountCents = grossAmountCents - platformFeeCents;

  if (
    memberGross !== grossAmountCents ||
    memberFees !== platformFeeCents ||
    memberProviders !== providerAmountCents
  ) {
    throw new Error("KLYX_GROUP_ACCOUNTING_INVARIANT_FAILED");
  }

  return {
    grossAmountCents,
    platformFeeCents,
    providerAmountCents,
    members,
  };
}

export function targetProviderRefundCents(input: {
  memberGrossAmountCents: number;
  memberProviderAmountCents: number;
  refundedGrossAmountCents: number;
}): number {
  assertCents(input.memberGrossAmountCents, "KLYX_GROUP_REFUND_GROSS_INVALID");
  assertCents(
    input.memberProviderAmountCents,
    "KLYX_GROUP_REFUND_PROVIDER_INVALID"
  );
  assertCents(
    input.refundedGrossAmountCents,
    "KLYX_GROUP_REFUND_AMOUNT_INVALID"
  );

  if (
    input.memberGrossAmountCents <= 0 ||
    input.memberProviderAmountCents > input.memberGrossAmountCents ||
    input.refundedGrossAmountCents > input.memberGrossAmountCents
  ) {
    throw new Error("KLYX_GROUP_REFUND_ALLOCATION_INVALID");
  }

  if (input.refundedGrossAmountCents === input.memberGrossAmountCents) {
    return input.memberProviderAmountCents;
  }

  return Number(
    (BigInt(input.memberProviderAmountCents) *
      BigInt(input.refundedGrossAmountCents)) /
      BigInt(input.memberGrossAmountCents)
  );
}
