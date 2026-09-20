import { describe, expect, it } from "vitest";

import {
  assessKlyxMarketPaymentPolicy,
  calculateKlyxMarketEconomics,
  type KlyxMarketPaymentRule,
  type KlyxPaymentCurrencyCapability,
} from "../../lib/klyx-market-policy";

const rule: KlyxMarketPaymentRule = {
  id: "rule",
  payerCountryCode: "*",
  executionCountryCode: "KE",
  serviceSlug: "*",
  presentmentCurrency: "USD",
  availabilityStatus: "open",
  paymentsEnabled: true,
  crossBorderAllowed: true,
  commissionBps: 1250,
  taxMode: "fixed_rate",
  taxRateBps: 1600,
  taxInclusive: false,
  taxLiability: "provider",
  stripeTaxCode: null,
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: null,
  evidenceRef: "policy:test",
};

const capability: KlyxPaymentCurrencyCapability = {
  provider: "stripe",
  currencyCode: "USD",
  chargeEnabled: true,
  payoutEnabled: true,
  settlementEnabled: true,
  accountingExponent: 2,
  stripeChargeExponent: 2,
  stripeChargeIncrement: 1,
  stripePayoutIncrement: 1,
  zeroDecimal: false,
  sourceRef: "stripe:test",
  sourceCheckedAt: "2026-09-20T00:00:00.000Z",
};

describe("KLYX market payment policy", () => {
  it("allows payer country != execution country only when configured", () => {
    expect(
      assessKlyxMarketPaymentPolicy({
        rule,
        currencyCapability: capability,
        payerCountryCode: "BE",
        executionCountryCode: "KE",
        currencyCode: "USD",
      })
    ).toEqual({ allowed: true, blockers: [] });
  });

  it("fails closed without a market rule", () => {
    const result = assessKlyxMarketPaymentPolicy({
      rule: null,
      currencyCapability: capability,
      payerCountryCode: "BE",
      executionCountryCode: "KE",
      currencyCode: "USD",
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("market_rule");
  });

  it("fails closed when Stripe charge support is not reviewed/enabled", () => {
    const result = assessKlyxMarketPaymentPolicy({
      rule,
      currencyCapability: { ...capability, chargeEnabled: false },
      payerCountryCode: "BE",
      executionCountryCode: "KE",
      currencyCode: "USD",
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("stripe_charge_currency");
  });

  it("computes market commission and tax in minor units", () => {
    const economics = calculateKlyxMarketEconomics({
      subtotalMinor: 10_000,
      commissionBps: 1250,
      taxMode: "fixed_rate",
      taxRateBps: 1600,
      taxInclusive: false,
      taxLiability: "provider",
    });

    expect(economics.commissionMinor).toBe(1250);
    expect(economics.taxMinor).toBe(1600);
    expect(economics.totalMinor).toBe(11_600);
    expect(economics.platformFeeMinor).toBe(1250);
    expect(economics.providerAmountMinor).toBe(10_350);
  });
});
