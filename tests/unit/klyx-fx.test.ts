import { describe, expect, it } from "vitest";

import { convertKlyxMinorUnitsWithQuote } from "../../lib/klyx-fx";

describe("KLYX FX", () => {
  const quote = {
    id: "fx_test",
    provider: "test-provider",
    providerQuoteId: "provider-quote",
    sourceCurrency: "USD",
    targetCurrency: "EUR",
    sourceAmountMinor: 10_000,
    targetAmountMinor: 9_250,
    expiresAt: "2030-01-01T00:00:00.000Z",
    status: "usable" as const,
  };

  it("never converts cross-currency without an explicit quote", () => {
    expect(() =>
      convertKlyxMinorUnitsWithQuote({
        amountMinor: 1000,
        sourceCurrency: "USD",
        targetCurrency: "EUR",
      })
    ).toThrow("KLYX_FX_QUOTE_REQUIRED");
  });

  it("converts from a locked quote using integer arithmetic", () => {
    expect(
      convertKlyxMinorUnitsWithQuote({
        amountMinor: 2500,
        sourceCurrency: "USD",
        targetCurrency: "EUR",
        quote,
        at: new Date("2029-01-01T00:00:00.000Z"),
      })
    ).toBe(2313);
  });

  it("rejects expired quotes", () => {
    expect(() =>
      convertKlyxMinorUnitsWithQuote({
        amountMinor: 2500,
        sourceCurrency: "USD",
        targetCurrency: "EUR",
        quote,
        at: new Date("2031-01-01T00:00:00.000Z"),
      })
    ).toThrow("KLYX_FX_QUOTE_EXPIRED");
  });

  it("returns same-currency amounts without FX", () => {
    expect(
      convertKlyxMinorUnitsWithQuote({
        amountMinor: 1234,
        sourceCurrency: "EUR",
        targetCurrency: "EUR",
      })
    ).toBe(1234);
  });
});
