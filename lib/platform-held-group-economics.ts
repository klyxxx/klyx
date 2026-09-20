export type PlatformHeldGroupMemberInput = {
  providerProfileId: string;
  grossAmountCents: number;
};

export type PlatformHeldGroupMemberEconomics = {
  providerProfileId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
};

export type PlatformHeldGroupEconomics = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  commissionPercent: number;
  members: PlatformHeldGroupMemberEconomics[];
};

function safeCents(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function normalizeCommissionPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("KLYX_GROUP_COMMISSION_PERCENT_INVALID");
  }
  return value;
}

/**
 * Freeze group economics with one exact accounting identity:
 *
 *   gross = KLYX commission + provider funds
 *
 * Member commission cents are allocated with a deterministic largest-remainder
 * method, so integer rounding never makes member totals diverge from the parent.
 */
export function buildPlatformHeldGroupEconomics(input: {
  members: readonly PlatformHeldGroupMemberInput[];
  commissionPercent: number;
}): PlatformHeldGroupEconomics {
  const commissionPercent = normalizeCommissionPercent(input.commissionPercent);

  if (input.members.length < 2) {
    throw new Error("KLYX_GROUP_EXECUTOR_COUNT_INVALID");
  }

  const seen = new Set<string>();
  const members = input.members.map((member) => {
    const providerProfileId = member.providerProfileId.trim();
    if (!providerProfileId || seen.has(providerProfileId)) {
      throw new Error("KLYX_GROUP_EXECUTOR_ID_INVALID");
    }
    seen.add(providerProfileId);

    const grossAmountCents = safeCents(
      member.grossAmountCents,
      "KLYX_GROUP_MEMBER_GROSS_INVALID"
    );
    if (grossAmountCents <= 0) {
      throw new Error("KLYX_GROUP_MEMBER_GROSS_INVALID");
    }

    return { providerProfileId, grossAmountCents };
  });

  const grossAmountCents = members.reduce(
    (sum, member) => sum + member.grossAmountCents,
    0
  );
  safeCents(grossAmountCents, "KLYX_GROUP_GROSS_INVALID");

  const exactFee = grossAmountCents * (commissionPercent / 100);
  const platformFeeCents = Math.round(exactFee);
  const providerAmountCents = grossAmountCents - platformFeeCents;

  const raw = members.map((member) => {
    const numerator = platformFeeCents * member.grossAmountCents;
    const floorFee = Math.floor(numerator / grossAmountCents);
    const remainder = numerator % grossAmountCents;

    return {
      ...member,
      floorFee,
      remainder,
    };
  });

  let centsRemaining =
    platformFeeCents - raw.reduce((sum, member) => sum + member.floorFee, 0);

  const bonusOrder = [...raw].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      a.providerProfileId.localeCompare(b.providerProfileId)
  );

  const bonusByProvider = new Map<string, number>();
  for (const member of bonusOrder) {
    if (centsRemaining <= 0) break;
    if (member.floorFee < member.grossAmountCents) {
      bonusByProvider.set(member.providerProfileId, 1);
      centsRemaining -= 1;
    }
  }

  if (centsRemaining !== 0) {
    throw new Error("KLYX_GROUP_COMMISSION_ALLOCATION_FAILED");
  }

  const frozenMembers = raw
    .map((member) => {
      const platformFee =
        member.floorFee + (bonusByProvider.get(member.providerProfileId) ?? 0);
      const providerAmount = member.grossAmountCents - platformFee;

      if (
        platformFee < 0 ||
        providerAmount < 0 ||
        platformFee + providerAmount !== member.grossAmountCents
      ) {
        throw new Error("KLYX_GROUP_MEMBER_ACCOUNTING_INVARIANT_FAILED");
      }

      return {
        providerProfileId: member.providerProfileId,
        grossAmountCents: member.grossAmountCents,
        platformFeeCents: platformFee,
        providerAmountCents: providerAmount,
      };
    })
    .sort((a, b) =>
      a.providerProfileId.localeCompare(b.providerProfileId)
    );

  const frozenGross = frozenMembers.reduce(
    (sum, member) => sum + member.grossAmountCents,
    0
  );
  const frozenFee = frozenMembers.reduce(
    (sum, member) => sum + member.platformFeeCents,
    0
  );
  const frozenProvider = frozenMembers.reduce(
    (sum, member) => sum + member.providerAmountCents,
    0
  );

  if (
    frozenGross !== grossAmountCents ||
    frozenFee !== platformFeeCents ||
    frozenProvider !== providerAmountCents ||
    frozenFee + frozenProvider !== frozenGross
  ) {
    throw new Error("KLYX_GROUP_ACCOUNTING_INVARIANT_FAILED");
  }

  return {
    grossAmountCents,
    platformFeeCents,
    providerAmountCents,
    commissionPercent,
    members: frozenMembers,
  };
}

/**
 * Cumulative provider reversal target for a member refund.
 *
 * Using the cumulative refunded gross (not the latest delta) makes a sequence
 * of partial refunds converge exactly to the full provider amount without
 * accumulating rounding drift.
 */
export function providerReversalTargetForMemberRefund(input: {
  memberGrossAmountCents: number;
  memberProviderAmountCents: number;
  cumulativeRefundGrossCents: number;
}): number {
  const gross = safeCents(
    input.memberGrossAmountCents,
    "KLYX_GROUP_MEMBER_GROSS_INVALID"
  );
  const provider = safeCents(
    input.memberProviderAmountCents,
    "KLYX_GROUP_MEMBER_PROVIDER_AMOUNT_INVALID"
  );
  const refunded = safeCents(
    input.cumulativeRefundGrossCents,
    "KLYX_GROUP_MEMBER_REFUND_INVALID"
  );

  if (
    gross <= 0 ||
    provider > gross ||
    refunded > gross
  ) {
    throw new Error("KLYX_GROUP_MEMBER_REFUND_INVARIANT_FAILED");
  }

  if (refunded === gross) return provider;

  return Math.floor((refunded * provider) / gross);
}

export function assertPlatformHeldGroupAccounting(input: {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
  releasedAmountCents: number;
  claimedAmountCents: number;
  reversedAmountCents: number;
  refundAllocatedGrossCents: number;
}): void {
  const gross = safeCents(input.grossAmountCents, "KLYX_GROUP_GROSS_INVALID");
  const fee = safeCents(
    input.platformFeeCents,
    "KLYX_GROUP_PLATFORM_FEE_INVALID"
  );
  const provider = safeCents(
    input.providerAmountCents,
    "KLYX_GROUP_PROVIDER_AMOUNT_INVALID"
  );
  const released = safeCents(
    input.releasedAmountCents,
    "KLYX_GROUP_RELEASED_AMOUNT_INVALID"
  );
  const claimed = safeCents(
    input.claimedAmountCents,
    "KLYX_GROUP_CLAIMED_AMOUNT_INVALID"
  );
  const reversed = safeCents(
    input.reversedAmountCents,
    "KLYX_GROUP_REVERSED_AMOUNT_INVALID"
  );
  const refunded = safeCents(
    input.refundAllocatedGrossCents,
    "KLYX_GROUP_REFUND_ALLOCATED_INVALID"
  );

  if (
    fee + provider !== gross ||
    released + claimed > provider ||
    reversed > released ||
    refunded > gross
  ) {
    throw new Error("KLYX_GROUP_ACCOUNTING_INVARIANT_FAILED");
  }
}
