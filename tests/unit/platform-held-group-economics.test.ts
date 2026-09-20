import { describe, expect, it } from "vitest";

import {
  assertPlatformHeldGroupAccounting,
  buildPlatformHeldGroupEconomics,
  providerReversalTargetForMemberRefund,
} from "@/lib/platform-held-group-economics";

describe("platform-held multi-executor group economics", () => {
  it("freezes exact parent/member accounting with deterministic cent rounding", () => {
    const economics = buildPlatformHeldGroupEconomics({
      commissionPercent: 15,
      members: [
        { providerProfileId: "provider-b", grossAmountCents: 3333 },
        { providerProfileId: "provider-a", grossAmountCents: 6667 },
      ],
    });

    expect(economics.grossAmountCents).toBe(10000);
    expect(economics.platformFeeCents).toBe(1500);
    expect(economics.providerAmountCents).toBe(8500);
    expect(
      economics.members.reduce((sum, member) => sum + member.grossAmountCents, 0)
    ).toBe(economics.grossAmountCents);
    expect(
      economics.members.reduce((sum, member) => sum + member.platformFeeCents, 0)
    ).toBe(economics.platformFeeCents);
    expect(
      economics.members.reduce((sum, member) => sum + member.providerAmountCents, 0)
    ).toBe(economics.providerAmountCents);
  });

  it("is deterministic regardless of member input order", () => {
    const first = buildPlatformHeldGroupEconomics({
      commissionPercent: 17.5,
      members: [
        { providerProfileId: "b", grossAmountCents: 1001 },
        { providerProfileId: "a", grossAmountCents: 1000 },
        { providerProfileId: "c", grossAmountCents: 1002 },
      ],
    });
    const second = buildPlatformHeldGroupEconomics({
      commissionPercent: 17.5,
      members: [
        { providerProfileId: "c", grossAmountCents: 1002 },
        { providerProfileId: "b", grossAmountCents: 1001 },
        { providerProfileId: "a", grossAmountCents: 1000 },
      ],
    });

    expect(second).toEqual(first);
  });

  it("rejects duplicate executors and invalid values", () => {
    expect(() =>
      buildPlatformHeldGroupEconomics({
        commissionPercent: 15,
        members: [
          { providerProfileId: "same", grossAmountCents: 1000 },
          { providerProfileId: "same", grossAmountCents: 1000 },
        ],
      })
    ).toThrow("KLYX_GROUP_EXECUTOR_ID_INVALID");

    expect(() =>
      buildPlatformHeldGroupEconomics({
        commissionPercent: 101,
        members: [
          { providerProfileId: "a", grossAmountCents: 1000 },
          { providerProfileId: "b", grossAmountCents: 1000 },
        ],
      })
    ).toThrow("KLYX_GROUP_COMMISSION_PERCENT_INVALID");
  });

  it("computes cumulative partial-refund reversal targets without rounding drift", () => {
    const gross = 1000;
    const provider = 850;

    expect(
      providerReversalTargetForMemberRefund({
        memberGrossAmountCents: gross,
        memberProviderAmountCents: provider,
        cumulativeRefundGrossCents: 333,
      })
    ).toBe(283);

    expect(
      providerReversalTargetForMemberRefund({
        memberGrossAmountCents: gross,
        memberProviderAmountCents: provider,
        cumulativeRefundGrossCents: 666,
      })
    ).toBe(566);

    expect(
      providerReversalTargetForMemberRefund({
        memberGrossAmountCents: gross,
        memberProviderAmountCents: provider,
        cumulativeRefundGrossCents: 1000,
      })
    ).toBe(850);
  });

  it("rejects accounting states that could over-transfer or over-reverse", () => {
    expect(() =>
      assertPlatformHeldGroupAccounting({
        grossAmountCents: 10000,
        platformFeeCents: 1500,
        providerAmountCents: 8500,
        releasedAmountCents: 8000,
        claimedAmountCents: 501,
        reversedAmountCents: 0,
        refundAllocatedGrossCents: 0,
      })
    ).toThrow("KLYX_GROUP_ACCOUNTING_INVARIANT_FAILED");

    expect(() =>
      assertPlatformHeldGroupAccounting({
        grossAmountCents: 10000,
        platformFeeCents: 1500,
        providerAmountCents: 8500,
        releasedAmountCents: 1000,
        claimedAmountCents: 0,
        reversedAmountCents: 1001,
        refundAllocatedGrossCents: 0,
      })
    ).toThrow("KLYX_GROUP_ACCOUNTING_INVARIANT_FAILED");
  });
});
