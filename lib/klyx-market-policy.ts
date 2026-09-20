import {
  calculateKlyxBasisPointsAmount,
  normalizeKlyxCountryCode,
  normalizeKlyxCurrencyCode,
  roundKlyxRationalToSafeInteger,
} from "@/lib/klyx-currency";

export type KlyxMarketAvailabilityStatus = "closed" | "pilot" | "open";
export type KlyxTaxMode = "none" | "fixed_rate" | "stripe_tax" | "external";
export type KlyxTaxLiability = "provider" | "platform" | "stripe";

export type KlyxMarketPaymentRule = {
  id: string;
  payerCountryCode: string;
  executionCountryCode: string;
  serviceSlug: string;
  presentmentCurrency: string;
  availabilityStatus: KlyxMarketAvailabilityStatus;
  paymentsEnabled: boolean;
  crossBorderAllowed: boolean;
  commissionBps: number;
  taxMode: KlyxTaxMode;
  taxRateBps: number;
  taxInclusive: boolean;
  taxLiability: KlyxTaxLiability;
  stripeTaxCode: string | null;
  validFrom: string;
  validUntil: string | null;
  evidenceRef: string | null;
};

export type KlyxPaymentCurrencyCapability = {
  provider: "stripe";
  countryCode: string;
  currencyCode: string;
  chargeEnabled: boolean;
  payoutEnabled: boolean;
  settlementEnabled: boolean;
  accountingExponent: number;
  stripeChargeExponent: number;
  stripeChargeIncrement: number;
  stripePayoutIncrement: number;
  minimumChargeAmount: number | null;
  maximumChargeAmount: number | null;
  zeroDecimal: boolean;
  sourceRef: string | null;
  sourceCheckedAt: string | null;
};

export type KlyxMarketPaymentAssessment = {
  allowed: boolean;
  blockers: string[];
};

export function assessKlyxMarketPaymentPolicy(params: {
  rule: KlyxMarketPaymentRule | null;
  currencyCapability: KlyxPaymentCurrencyCapability | null;
  payerCountryCode: string;
  executionCountryCode: string;
  currencyCode: string;
}): KlyxMarketPaymentAssessment {
  const blockers: string[] = [];
  const payer = normalizeKlyxCountryCode(params.payerCountryCode);
  const execution = normalizeKlyxCountryCode(params.executionCountryCode);
  const currency = normalizeKlyxCurrencyCode(params.currencyCode);
  const rule = params.rule;
  const capability = params.currencyCapability;

  if (!rule) {
    blockers.push("market_rule");
  } else {
    if (rule.availabilityStatus === "closed") blockers.push("market_closed");
    if (!rule.paymentsEnabled) blockers.push("payments_disabled");

    const rulePayer = rule.payerCountryCode === "*" ? "*" : normalizeKlyxCountryCode(rule.payerCountryCode);
    if (rulePayer !== "*" && rulePayer !== payer) blockers.push("payer_country");

    if (normalizeKlyxCountryCode(rule.executionCountryCode) !== execution) {
      blockers.push("execution_country");
    }

    if (normalizeKlyxCurrencyCode(rule.presentmentCurrency) !== currency) {
      blockers.push("presentment_currency");
    }

    if (payer !== execution && !rule.crossBorderAllowed) {
      blockers.push("cross_border");
    }
  }

  if (!capability) {
    blockers.push("stripe_currency_capability");
  } else {
    if (normalizeKlyxCountryCode(capability.countryCode) !== execution) {
      blockers.push("stripe_capability_country");
    }
    if (normalizeKlyxCurrencyCode(capability.currencyCode) !== currency) {
      blockers.push("stripe_currency_mismatch");
    }
    if (!capability.chargeEnabled) blockers.push("stripe_charge_currency");
    if (!capability.settlementEnabled) blockers.push("stripe_settlement_currency");
    if (!capability.payoutEnabled) blockers.push("stripe_payout_currency");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function calculateKlyxTax(params: {
  subtotalMinor: number;
  mode: KlyxTaxMode;
  rateBps: number;
  inclusive: boolean;
}): { taxMinor: number; totalMinor: number } {
  if (!Number.isSafeInteger(params.subtotalMinor) || params.subtotalMinor < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  if (params.mode === "none") {
    return { taxMinor: 0, totalMinor: params.subtotalMinor };
  }

  if (params.mode !== "fixed_rate") {
    throw new Error("KLYX_TAX_COLLECTOR_REQUIRED");
  }

  if (!Number.isInteger(params.rateBps) || params.rateBps < 0 || params.rateBps > 10_000) {
    throw new Error("KLYX_TAX_RATE_INVALID");
  }

  if (params.inclusive) {
    const taxMinor =
      params.rateBps === 0
        ? 0
        : roundKlyxRationalToSafeInteger(
            BigInt(params.subtotalMinor) * BigInt(params.rateBps),
            BigInt(10_000 + params.rateBps)
          );

    return {
      taxMinor,
      totalMinor: params.subtotalMinor,
    };
  }

  const taxMinor = calculateKlyxBasisPointsAmount(
    params.subtotalMinor,
    params.rateBps
  );

  return {
    taxMinor,
    totalMinor: params.subtotalMinor + taxMinor,
  };
}

export function calculateKlyxMarketEconomics(params: {
  subtotalMinor: number;
  commissionBps: number;
  taxMode: KlyxTaxMode;
  taxRateBps: number;
  taxInclusive: boolean;
  taxLiability: KlyxTaxLiability;
}): {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionMinor: number;
  platformFeeMinor: number;
  providerAmountMinor: number;
} {
  const tax = calculateKlyxTax({
    subtotalMinor: params.subtotalMinor,
    mode: params.taxMode,
    rateBps: params.taxRateBps,
    inclusive: params.taxInclusive,
  });

  if (params.taxMode !== "none" && params.taxLiability === "stripe") {
    throw new Error("KLYX_TAX_LIABILITY_STRIPE_REQUIRES_STRIPE_TAX");
  }

  const commissionMinor = calculateKlyxBasisPointsAmount(
    params.subtotalMinor,
    params.commissionBps
  );
  const platformTaxMinor =
    params.taxLiability === "platform" ? tax.taxMinor : 0;
  const platformFeeMinor = commissionMinor + platformTaxMinor;

  if (platformFeeMinor > tax.totalMinor) {
    throw new Error("KLYX_MARKET_ECONOMICS_INVALID");
  }

  return {
    subtotalMinor: params.subtotalMinor,
    taxMinor: tax.taxMinor,
    totalMinor: tax.totalMinor,
    commissionMinor,
    platformFeeMinor,
    providerAmountMinor: tax.totalMinor - platformFeeMinor,
  };
}
