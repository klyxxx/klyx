import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  assessKlyxMarketPaymentPolicy,
  type KlyxMarketPaymentAssessment,
  type KlyxMarketPaymentRule,
  type KlyxPaymentCurrencyCapability,
} from "@/lib/klyx-market-policy";
import {
  normalizeKlyxCountryCode,
  normalizeKlyxCurrencyCode,
} from "@/lib/klyx-currency";

type MarketRuleRow = {
  id: string;
  payer_country_code: string;
  execution_country_code: string;
  service_slug: string;
  presentment_currency: string;
  availability_status: "closed" | "pilot" | "open";
  payments_enabled: boolean;
  cross_border_allowed: boolean;
  commission_bps: number;
  tax_mode: "none" | "fixed_rate" | "stripe_tax" | "external";
  tax_rate_bps: number;
  tax_inclusive: boolean;
  tax_liability: "provider" | "platform" | "stripe";
  stripe_tax_code: string | null;
  valid_from: string;
  valid_until: string | null;
  evidence_ref: string | null;
};

type CurrencyCapabilityRow = {
  provider: string;
  country_code: string;
  currency_code: string;
  charge_enabled: boolean;
  payout_enabled: boolean;
  settlement_enabled: boolean;
  accounting_exponent: number;
  stripe_charge_exponent: number;
  stripe_charge_increment: number;
  stripe_payout_increment: number;
  minimum_charge_amount: number | null;
  maximum_charge_amount: number | null;
  zero_decimal: boolean;
  source_ref: string | null;
  source_checked_at: string | null;
};

export type ResolvedKlyxMarketPaymentPolicy = {
  rule: KlyxMarketPaymentRule | null;
  currencyCapability: KlyxPaymentCurrencyCapability | null;
  assessment: KlyxMarketPaymentAssessment;
};

function mapRule(row: MarketRuleRow): KlyxMarketPaymentRule {
  return {
    id: row.id,
    payerCountryCode: row.payer_country_code,
    executionCountryCode: row.execution_country_code,
    serviceSlug: row.service_slug,
    presentmentCurrency: row.presentment_currency,
    availabilityStatus: row.availability_status,
    paymentsEnabled: row.payments_enabled,
    crossBorderAllowed: row.cross_border_allowed,
    commissionBps: row.commission_bps,
    taxMode: row.tax_mode,
    taxRateBps: row.tax_rate_bps,
    taxInclusive: row.tax_inclusive,
    taxLiability: row.tax_liability,
    stripeTaxCode: row.stripe_tax_code,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    evidenceRef: row.evidence_ref,
  };
}

function mapCapability(row: CurrencyCapabilityRow): KlyxPaymentCurrencyCapability {
  return {
    provider: row.provider,
    countryCode: row.country_code,
    currencyCode: row.currency_code,
    chargeEnabled: row.charge_enabled,
    payoutEnabled: row.payout_enabled,
    settlementEnabled: row.settlement_enabled,
    accountingExponent: row.accounting_exponent,
    stripeChargeExponent: row.stripe_charge_exponent,
    stripeChargeIncrement: row.stripe_charge_increment,
    stripePayoutIncrement: row.stripe_payout_increment,
    minimumChargeAmount:
      row.minimum_charge_amount == null ? null : Number(row.minimum_charge_amount),
    maximumChargeAmount:
      row.maximum_charge_amount == null ? null : Number(row.maximum_charge_amount),
    zeroDecimal: row.zero_decimal,
    sourceRef: row.source_ref,
    sourceCheckedAt: row.source_checked_at,
  };
}

function isRuleCurrent(rule: MarketRuleRow, now: number): boolean {
  const startsAt = new Date(rule.valid_from).getTime();
  const endsAt = rule.valid_until ? new Date(rule.valid_until).getTime() : null;

  return (
    Number.isFinite(startsAt) &&
    startsAt <= now &&
    (endsAt === null || (Number.isFinite(endsAt) && endsAt > now))
  );
}

function ruleSpecificity(
  rule: MarketRuleRow,
  payerCountryCode: string,
  serviceSlug: string
): number {
  return (
    (rule.payer_country_code === payerCountryCode ? 2 : 0) +
    (rule.service_slug === serviceSlug ? 1 : 0)
  );
}

export async function resolveKlyxMarketPaymentPolicy(params: {
  payerCountryCode: string;
  executionCountryCode: string;
  serviceSlug: string;
  currencyCode: string;
  paymentProvider?: string;
  at?: Date;
}): Promise<ResolvedKlyxMarketPaymentPolicy> {
  const payerCountryCode = normalizeKlyxCountryCode(params.payerCountryCode);
  const executionCountryCode = normalizeKlyxCountryCode(
    params.executionCountryCode
  );
  const currencyCode = normalizeKlyxCurrencyCode(params.currencyCode);
  const serviceSlug = params.serviceSlug.trim() || "*";
  const paymentProvider =
    params.paymentProvider?.trim().toLowerCase() || "stripe";
  const now = params.at ?? new Date();

  const [rulesResult, capabilityResult] = await Promise.all([
    supabaseAdmin
      .from("klyx_market_payment_rules")
      .select(
        "id,payer_country_code,execution_country_code,service_slug,presentment_currency,availability_status,payments_enabled,cross_border_allowed,commission_bps,tax_mode,tax_rate_bps,tax_inclusive,tax_liability,stripe_tax_code,valid_from,valid_until,evidence_ref"
      )
      .eq("execution_country_code", executionCountryCode)
      .eq("presentment_currency", currencyCode)
      .in("payer_country_code", [payerCountryCode, "*"])
      .in("service_slug", [serviceSlug, "*"]),
    supabaseAdmin
      .from("klyx_payment_currency_capabilities")
      .select(
        "provider,country_code,currency_code,charge_enabled,payout_enabled,settlement_enabled,accounting_exponent,stripe_charge_exponent,stripe_charge_increment,stripe_payout_increment,minimum_charge_amount,maximum_charge_amount,zero_decimal,source_ref,source_checked_at"
      )
      .eq("provider", paymentProvider)
      .eq("country_code", executionCountryCode)
      .eq("currency_code", currencyCode)
      .maybeSingle(),
  ]);

  if (rulesResult.error) {
    throw new Error(`KLYX_MARKET_POLICY_READ_FAILED:${rulesResult.error.message}`);
  }
  if (capabilityResult.error) {
    throw new Error(
      `KLYX_CURRENCY_CAPABILITY_READ_FAILED:${capabilityResult.error.message}`
    );
  }

  const currentRules = ((rulesResult.data ?? []) as MarketRuleRow[])
    .filter((rule) => isRuleCurrent(rule, now.getTime()))
    .sort(
      (left, right) =>
        ruleSpecificity(right, payerCountryCode, serviceSlug) -
        ruleSpecificity(left, payerCountryCode, serviceSlug)
    );

  const rule = currentRules[0] ? mapRule(currentRules[0]) : null;
  const currencyCapability = capabilityResult.data
    ? mapCapability(capabilityResult.data as CurrencyCapabilityRow)
    : null;

  return {
    rule,
    currencyCapability,
    assessment: assessKlyxMarketPaymentPolicy({
      rule,
      currencyCapability,
      payerCountryCode,
      executionCountryCode,
      currencyCode,
    }),
  };
}
