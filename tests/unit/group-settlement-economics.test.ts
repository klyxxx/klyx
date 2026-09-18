import { describe, expect, it } from "vitest";

import { distributeGroupSettlementEconomics } from "@/lib/group-settlement-economics";

describe("group settlement economics", () => {
  it("conserves gross, platform fee and provider release through cent rounding", () => {
    const shares = distributeGroupSettlementEconomics({
      childGrossAmountsCents: [3333, 3333, 3334],
      grossAmountCents: 10000,
      platformFeeCents: 1700,
    });

    expect(shares).toEqual([
      {
        grossAmountCents: 3333,
        platformFeeCents: 566,
        providerAmountCents: 2767,
      },
      {
        grossAmountCents: 3333,
        platformFeeCents: 566,
        providerAmountCents: 2767,
      },
      {
        grossAmountCents: 3334,
        platformFeeCents: 568,
        providerAmountCents: 2766,
      },
    ]);

    expect(
      shares.reduce((sum, share) => sum + share.platformFeeCents, 0)
    ).toBe(1700);
    expect(
      shares.reduce((sum, share) => sum + share.providerAmountCents, 0)
    ).toBe(8300);
  });

  it("never permits releases to exceed captured group funds", () => {
    const shares = distributeGroupSettlementEconomics({
      childGrossAmountsCents: [1, 1, 1],
      grossAmountCents: 3,
      platformFeeCents: 1,
    });

    expect(
      shares.reduce(
        (sum, share) =>
          sum + share.platformFeeCents + share.providerAmountCents,
        0
      )
    ).toBe(3);
    expect(
      shares.every(
        (share) =>
          share.providerAmountCents >= 0 &&
          share.providerAmountCents <= share.grossAmountCents
      )
    ).toBe(true);
  });

  it("fails closed when children do not reconcile to captured gross", () => {
    expect(() =>
      distributeGroupSettlementEconomics({
        childGrossAmountsCents: [4000, 5000],
        grossAmountCents: 10000,
        platformFeeCents: 1500,
      })
    ).toThrow("KLYX_GROUP_SETTLEMENT_CHILD_TOTAL_MISMATCH");
  });
});
