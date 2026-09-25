import { describe, expect, it } from "vitest";

import { comparePureFinanceRecognitionShadow } from "../../lib/pure-finance/shadow-reconciliation";

const base = {
  transactionId: "booking:11111111-1111-4111-8111-111111111111:recognition",
  bookingId: "11111111-1111-4111-8111-111111111111",
  currency: "USD",
  grossMinor: 10_000,
  commissionMinor: 1_500,
  providerLiabilityMinor: 8_500,
  observed: {
    charge: { amountMinor: 10_000, currency: "USD" },
    commission: { amountMinor: 1_500, currency: "USD" },
    providerLiability: { amountMinor: 8_500, currency: "USD" },
  },
};

describe("pure finance recognition shadow", () => {
  it("is deterministic for coherent truth", () => {
    const first = comparePureFinanceRecognitionShadow(base);
    const second = comparePureFinanceRecognitionShadow(base);
    expect(first).toEqual(second);
    expect(first.status).toBe("coherent");
    expect(first.divergences).toEqual([]);
  });

  it("supports zero-decimal currency minor units", () => {
    const result = comparePureFinanceRecognitionShadow({
      ...base,
      currency: "JPY",
      commissionMinor: 1_000,
      providerLiabilityMinor: 9_000,
      observed: {
        charge: { amountMinor: 10_000, currency: "jpy" },
        commission: { amountMinor: 1_000, currency: "JPY" },
        providerLiability: { amountMinor: 9_000, currency: "JPY" },
      },
    });
    expect(result.status).toBe("coherent");
  });

  it("detects a liability source mismatch", () => {
    const result = comparePureFinanceRecognitionShadow({
      ...base,
      providerLiabilityMinor: 8_400,
      observed: {
        ...base.observed,
        providerLiability: { amountMinor: 8_400, currency: "USD" },
      },
    });
    expect(result.status).toBe("divergent");
    expect(result.divergences.map((row) => row.reasonCode)).toEqual(
      expect.arrayContaining([
        "PURE_FINANCE_PROVIDER_LIABILITY_SOURCE_MISMATCH",
        "PURE_FINANCE_PROVIDER_LIABILITY_MISMATCH",
      ])
    );
  });

  it("fails closed when canonical recognition is missing", () => {
    const result = comparePureFinanceRecognitionShadow({
      ...base,
      observed: { ...base.observed, commission: null },
    });
    expect(result.status).toBe("divergent");
    expect(result.divergences.map((row) => row.reasonCode)).toContain(
      "PURE_FINANCE_COMMISSION_MISSING"
    );
  });
});
