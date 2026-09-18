export type GroupSettlementChildShare = {
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number;
};

export function distributeGroupSettlementEconomics(input: {
  childGrossAmountsCents: readonly number[];
  grossAmountCents: number;
  platformFeeCents: number;
}): GroupSettlementChildShare[] {
  const { childGrossAmountsCents, grossAmountCents, platformFeeCents } = input;

  if (
    !Number.isSafeInteger(grossAmountCents) ||
    grossAmountCents <= 0 ||
    !Number.isSafeInteger(platformFeeCents) ||
    platformFeeCents < 0 ||
    platformFeeCents > grossAmountCents ||
    childGrossAmountsCents.length === 0 ||
    childGrossAmountsCents.some(
      (amount) => !Number.isSafeInteger(amount) || amount < 0
    )
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_ECONOMICS_INVALID");
  }

  const childGrossTotal = childGrossAmountsCents.reduce(
    (sum, amount) => sum + amount,
    0
  );

  if (childGrossTotal !== grossAmountCents) {
    throw new Error("KLYX_GROUP_SETTLEMENT_CHILD_TOTAL_MISMATCH");
  }

  let distributedFee = 0;

  const shares = childGrossAmountsCents.map((grossAmount, index) => {
    const platformFee =
      index === childGrossAmountsCents.length - 1
        ? platformFeeCents - distributedFee
        : Math.floor((platformFeeCents * grossAmount) / grossAmountCents);

    if (platformFee < 0 || platformFee > grossAmount) {
      throw new Error("KLYX_GROUP_SETTLEMENT_ROUNDING_INVALID");
    }

    distributedFee += platformFee;

    return {
      grossAmountCents: grossAmount,
      platformFeeCents: platformFee,
      providerAmountCents: grossAmount - platformFee,
    };
  });

  const released = shares.reduce(
    (sum, share) => sum + share.providerAmountCents,
    0
  );

  if (
    distributedFee !== platformFeeCents ||
    released + distributedFee !== grossAmountCents
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_CONSERVATION_FAILED");
  }

  return shares;
}
