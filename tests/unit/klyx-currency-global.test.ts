import { describe, expect, it } from "vitest";

import {
  calculateKlyxBasisPointsAmount,
  decimalToKlyxMinorUnits,
  fromKlyxStripeChargeAmount,
  getKlyxMinorUnitPolicy,
  klyxMinorUnitsToDecimalString,
  toKlyxStripeChargeAmount,
} from "../../lib/klyx-currency";

describe("KLYX global currency primitives", () => {
  it("supports zero-decimal currencies", () => {
    expect(decimalToKlyxMinorUnits("123", "JPY")).toBe(123);
    expect(klyxMinorUnitsToDecimalString(123, "JPY")).toBe("123");
    expect(getKlyxMinorUnitPolicy("JPY").zeroDecimal).toBe(true);
  });

  it("supports three-decimal currencies", () => {
    expect(decimalToKlyxMinorUnits("12.345", "KWD")).toBe(12345);
    expect(klyxMinorUnitsToDecimalString(12345, "KWD")).toBe("12.345");
  });

  it("uses canonical half-up rounding", () => {
    expect(decimalToKlyxMinorUnits("10.005", "USD")).toBe(1001);
    expect(calculateKlyxBasisPointsAmount(999, 1500)).toBe(150);
  });

  it("bridges ISK accounting units to Stripe special charge units", () => {
    const policy = getKlyxMinorUnitPolicy("ISK");
    expect(policy.accountingExponent).toBe(0);
    expect(policy.stripeChargeExponent).toBe(2);
    expect(policy.stripeChargeIncrement).toBe(100);

    expect(toKlyxStripeChargeAmount(123, "ISK")).toBe(12300);
    expect(fromKlyxStripeChargeAmount(12300, "ISK")).toBe(123);
  });

  it("bridges UGX accounting units to Stripe special charge units", () => {
    expect(toKlyxStripeChargeAmount(2500, "UGX")).toBe(250000);
    expect(fromKlyxStripeChargeAmount(250000, "UGX")).toBe(2500);
  });
});
