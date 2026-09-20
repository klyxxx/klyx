import { describe, expect, it } from "vitest";

import {
  assertKlyxSameCurrency,
  formatKlyxMoney,
  fromKlyxMinorUnits,
  getKlyxMinorUnitExponent,
  getKlyxStripeCurrency,
  resolveKlyxMoneyContext,
  resolveKlyxProfileMoney,
  toKlyxMinorUnits,
} from "../../lib/klyx-money";

// KLYX_MONEY_CONTRACT_TESTS_14_22
describe("KLYX global money contract", () => {
  it("uses an explicit currency without binding it to a country catalogue", () => {
    const result = resolveKlyxMoneyContext("CA", "USD");

    expect(result.countryCode).toBe("CA");
    expect(result.currencyCode).toBe("USD");
    expect(result.stripeCurrency).toBe("usd");
  });

  it("allows valid countries that are absent from the historical catalogue", () => {
    const result = resolveKlyxMoneyContext("JP", "JPY");

    expect(result.countryCode).toBe("JP");
    expect(result.currencyCode).toBe("JPY");
    expect(result.minorUnitExponent).toBe(0);
  });

  it("keeps legacy catalogue currency only as a compatibility default", () => {
    const result = resolveKlyxMoneyContext("CA");

    expect(result.currencyCode).toBe("CAD");
  });

  it("requires explicit currency when no compatibility default exists", () => {
    expect(() => resolveKlyxMoneyContext("JP")).toThrow(
      "KLYX_CURRENCY_REQUIRED"
    );
  });

  it("requires country and currency on transactional profiles", () => {
    expect(() =>
      resolveKlyxProfileMoney({
        countryCode: null,
        currencyCode: null,
      })
    ).toThrow("KLYX_PROFILE_MARKET_REQUIRED");
  });

  it("converts two-decimal currencies to minor units", () => {
    expect(toKlyxMinorUnits(12.34, "BE", "EUR")).toBe(1234);
  });

  it("uses zero decimal minor units", () => {
    expect(toKlyxMinorUnits(123, "JP", "JPY")).toBe(123);
    expect(getKlyxMinorUnitExponent("JPY")).toBe(0);
  });

  it("uses three decimal minor units", () => {
    expect(toKlyxMinorUnits(12.345, "KW", "KWD")).toBe(12345);
    expect(getKlyxMinorUnitExponent("KWD")).toBe(3);
  });

  it("uses canonical half-up rounding instead of binary Math.round tricks", () => {
    expect(toKlyxMinorUnits(10.005, "US", "USD")).toBe(1001);
  });

  it("converts minor units back to major units", () => {
    expect(fromKlyxMinorUnits(12345, "KW", "KWD")).toBe(12.345);
  });

  it("returns lowercase Stripe currency", () => {
    expect(getKlyxStripeCurrency("JP", "JPY")).toBe("jpy");
  });

  it("rejects cross-currency transactions unless an explicit FX path is used", () => {
    expect(() => assertKlyxSameCurrency("EUR", "USD")).toThrow(
      "KLYX_TRANSACTION_CURRENCY_MISMATCH"
    );
  });

  it("accepts identical transaction currencies", () => {
    expect(assertKlyxSameCurrency("eur", "EUR")).toBe("EUR");
  });

  it("formats using the declared currency and caller locale", () => {
    const formatted = formatKlyxMoney(25, "BE", "EUR", "fr-BE");

    expect(formatted).toContain("25");
    expect(formatted).toContain("€");
  });

  it("rejects invalid country codes instead of using a product country list", () => {
    expect(() => resolveKlyxMoneyContext("ZZZ", "USD")).toThrow(
      "KLYX_COUNTRY_CODE_INVALID"
    );
  });

  it("rejects negative payment amounts", () => {
    expect(() => toKlyxMinorUnits(-1, "BE", "EUR")).toThrow(
      "KLYX_MONEY_AMOUNT_INVALID"
    );
  });
});
