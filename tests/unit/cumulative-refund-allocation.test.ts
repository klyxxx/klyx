import { describe, expect, it } from "vitest";

import {
  calculateCumulativeGroupRefundDelta,
  calculateCumulativeRefundDelta,
} from "@/lib/group-multiexecutor-settlement-economics";

describe("canonical cumulative refund allocation", () => {
  it("prevents penny drift across repeated partial refunds", () => {
    const first = calculateCumulativeRefundDelta({
      grossAmountCents: 100,
      platformFeeCents: 33,
      priorGrossRefundCents: 0,
      priorPlatformFeeRefundCents: 0,
      priorProviderRefundCents: 0,
      requestedGrossRefundCents: 1,
    });

    const second = calculateCumulativeRefundDelta({
      grossAmountCents: 100,
      platformFeeCents: 33,
      priorGrossRefundCents: first.cumulativeGrossRefundCents,
      priorPlatformFeeRefundCents:
        first.cumulativePlatformFeeRefundCents,
      priorProviderRefundCents:
        first.cumulativeProviderRefundCents,
      requestedGrossRefundCents: 1,
    });

    const final = calculateCumulativeRefundDelta({
      grossAmountCents: 100,
      platformFeeCents: 33,
      priorGrossRefundCents: second.cumulativeGrossRefundCents,
      priorPlatformFeeRefundCents:
        second.cumulativePlatformFeeRefundCents,
      priorProviderRefundCents:
        second.cumulativeProviderRefundCents,
      requestedGrossRefundCents: 98,
    });

    expect(first.platformFeeRefundCents).toBe(0);
    expect(first.providerRefundCents).toBe(1);
    expect(second.platformFeeRefundCents).toBe(1);
    expect(second.providerRefundCents).toBe(0);
    expect(final.cumulativeGrossRefundCents).toBe(100);
    expect(final.cumulativePlatformFeeRefundCents).toBe(33);
    expect(final.cumulativeProviderRefundCents).toBe(67);
    expect(
      first.platformFeeRefundCents +
        second.platformFeeRefundCents +
        final.platformFeeRefundCents
    ).toBe(33);
    expect(
      first.providerRefundCents +
        second.providerRefundCents +
        final.providerRefundCents
    ).toBe(67);
  });

  it("uses one canonical rule for Group and Single", () => {
    const generic = calculateCumulativeRefundDelta({
      grossAmountCents: 999,
      platformFeeCents: 173,
      priorGrossRefundCents: 227,
      priorPlatformFeeRefundCents: 39,
      priorProviderRefundCents: 188,
      requestedGrossRefundCents: 311,
    });

    const group = calculateCumulativeGroupRefundDelta({
      memberGrossAmountCents: 999,
      memberPlatformFeeCents: 173,
      priorGrossRefundCents: 227,
      priorPlatformFeeRefundCents: 39,
      priorProviderRefundCents: 188,
      requestedGrossRefundCents: 311,
    });

    expect(group).toEqual(generic);
  });

  it("rejects over-refunds and broken prior accounting", () => {
    expect(() =>
      calculateCumulativeRefundDelta({
        grossAmountCents: 100,
        platformFeeCents: 20,
        priorGrossRefundCents: 90,
        priorPlatformFeeRefundCents: 18,
        priorProviderRefundCents: 72,
        requestedGrossRefundCents: 11,
      })
    ).toThrow("KLYX_REFUND_EXCEEDS_GROSS");

    expect(() =>
      calculateCumulativeRefundDelta({
        grossAmountCents: 100,
        platformFeeCents: 20,
        priorGrossRefundCents: 10,
        priorPlatformFeeRefundCents: 3,
        priorProviderRefundCents: 6,
        requestedGrossRefundCents: 1,
      })
    ).toThrow("KLYX_REFUND_PRIOR_ACCOUNTING_MISMATCH");
  });

  it("returns exact frozen fee/provider totals on the final cent", () => {
    let gross = 0;
    let fee = 0;
    let provider = 0;

    for (let index = 0; index < 3; index += 1) {
      const delta = calculateCumulativeRefundDelta({
        grossAmountCents: 3,
        platformFeeCents: 1,
        priorGrossRefundCents: gross,
        priorPlatformFeeRefundCents: fee,
        priorProviderRefundCents: provider,
        requestedGrossRefundCents: 1,
      });

      gross = delta.cumulativeGrossRefundCents;
      fee = delta.cumulativePlatformFeeRefundCents;
      provider = delta.cumulativeProviderRefundCents;
    }

    expect(gross).toBe(3);
    expect(fee).toBe(1);
    expect(provider).toBe(2);
  });
});
