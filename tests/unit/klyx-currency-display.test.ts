import {
  describe,
  expect,
  it,
} from "vitest";

import { formatKlyxCurrencyAmount } from "../../lib/klyx-currency-display";

// KLYX_TRANSACTION_CURRENCY_DISPLAY_UNIT_15_04

describe("KLYX transaction currency display", () => {
  it("uses the supplied ISO currency instead of hardcoding EUR", () => {
    expect(formatKlyxCurrencyAmount(1250, "USD")).toBe("12.50 USD");
    expect(formatKlyxCurrencyAmount(1250, "GBP")).toBe("12.50 GBP");
  });

  it("normalizes ISO currency codes", () => {
    expect(formatKlyxCurrencyAmount(1250, " eur ")).toBe("12.50 EUR");
  });

  it("fails safely when the currency code is missing or invalid", () => {
    expect(formatKlyxCurrencyAmount(1250, null)).toBe("12.50");
    expect(formatKlyxCurrencyAmount(1250, "EURO")).toBe("12.50");
  });
});
