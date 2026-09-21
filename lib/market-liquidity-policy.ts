import type {
  KlyxLiquidityPolicy,
  KlyxTechnicalSupportStatus,
} from "@/lib/market-liquidity-engine";

export type KlyxLiquidityScope = {
  marketKey?: string | null;
  countryCode?: string | null;
  regionKey?: string | null;
  serviceId: string;
  currencyCode?: string | null;
  priceBandKey?: string | null;
};

export type KlyxSupportPolicyRow = {
  id: string;
  market_key: string;
  country_code: string;
  region_key: string;
  service_id: string;
  currency_code: string;
  technical_status: KlyxTechnicalSupportStatus;
  priority: number;
  valid_from: string;
  valid_until: string | null;
};

export type KlyxLiquidityPolicyRow = {
  id: string;
  market_key: string;
  country_code: string;
  region_key: string;
  service_id: string | null;
  currency_code: string;
  price_band_key: string;
  priority: number;
  minimum_demand_sample: number;
  demand_maturity_seconds: number;
  max_time_to_first_match_seconds: number | null;
  max_time_to_quote_seconds: number | null;
  min_matching_quality_bps: number | null;
  min_availability_probability_bps: number | null;
  min_quote_probability_bps: number | null;
  min_quote_acceptance_bps: number | null;
  min_booking_conversion_bps: number | null;
  min_fill_rate_bps: number | null;
  min_completion_rate_bps: number | null;
  max_cancellation_rate_bps: number | null;
  min_replacement_success_bps: number | null;
  min_repeat_usage_bps: number | null;
  min_fulfillment_probability_bps: number | null;
  min_provider_utilization_bps: number | null;
  max_provider_utilization_bps: number | null;
  valid_from: string;
  valid_until: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function activeAt(
  validFrom: string,
  validUntil: string | null,
  nowMs: number
): boolean {
  const from = Date.parse(validFrom);
  const until = validUntil ? Date.parse(validUntil) : null;

  return (
    Number.isFinite(from) &&
    from <= nowMs &&
    (until === null || (Number.isFinite(until) && until > nowMs))
  );
}

function dimensionMatches(
  configured: string,
  requested: string | null | undefined
): boolean {
  if (configured === "*") return true;
  const expected = normalize(requested);
  return Boolean(expected) && configured === expected;
}

function exactDimension(
  configured: string,
  requested: string | null | undefined
): number {
  return configured !== "*" && dimensionMatches(configured, requested) ? 1 : 0;
}

function supportSpecificity(
  row: KlyxSupportPolicyRow,
  scope: KlyxLiquidityScope
): number {
  return (
    exactDimension(row.market_key, scope.marketKey) +
    exactDimension(row.country_code, scope.countryCode) +
    exactDimension(row.region_key, scope.regionKey) +
    exactDimension(row.currency_code, scope.currencyCode)
  );
}

function policySpecificity(
  row: KlyxLiquidityPolicyRow,
  scope: KlyxLiquidityScope
): number {
  return (
    exactDimension(row.market_key, scope.marketKey) +
    exactDimension(row.country_code, scope.countryCode) +
    exactDimension(row.region_key, scope.regionKey) +
    Number(row.service_id === scope.serviceId) +
    exactDimension(row.currency_code, scope.currencyCode) +
    exactDimension(row.price_band_key, scope.priceBandKey)
  );
}

function newerFirst(first: string, second: string): number {
  return Date.parse(second) - Date.parse(first);
}

export function resolveKlyxTechnicalSupport(params: {
  rows: KlyxSupportPolicyRow[];
  scope: KlyxLiquidityScope;
  now?: Date;
}): KlyxSupportPolicyRow | null {
  const nowMs = (params.now ?? new Date()).getTime();

  const matches = params.rows.filter(
    (row) =>
      row.service_id === params.scope.serviceId &&
      activeAt(row.valid_from, row.valid_until, nowMs) &&
      dimensionMatches(row.market_key, params.scope.marketKey) &&
      dimensionMatches(row.country_code, params.scope.countryCode) &&
      dimensionMatches(row.region_key, params.scope.regionKey) &&
      dimensionMatches(row.currency_code, params.scope.currencyCode)
  );

  matches.sort((first, second) => {
    if (first.priority !== second.priority) {
      return second.priority - first.priority;
    }

    const specificity =
      supportSpecificity(second, params.scope) -
      supportSpecificity(first, params.scope);

    if (specificity !== 0) return specificity;
    return newerFirst(first.valid_from, second.valid_from);
  });

  return matches[0] ?? null;
}

export function resolveKlyxLiquidityPolicy(params: {
  rows: KlyxLiquidityPolicyRow[];
  scope: KlyxLiquidityScope;
  now?: Date;
}): KlyxLiquidityPolicyRow | null {
  const nowMs = (params.now ?? new Date()).getTime();

  const matches = params.rows.filter(
    (row) =>
      (row.service_id === null || row.service_id === params.scope.serviceId) &&
      activeAt(row.valid_from, row.valid_until, nowMs) &&
      dimensionMatches(row.market_key, params.scope.marketKey) &&
      dimensionMatches(row.country_code, params.scope.countryCode) &&
      dimensionMatches(row.region_key, params.scope.regionKey) &&
      dimensionMatches(row.currency_code, params.scope.currencyCode) &&
      dimensionMatches(row.price_band_key, params.scope.priceBandKey)
  );

  matches.sort((first, second) => {
    if (first.priority !== second.priority) {
      return second.priority - first.priority;
    }

    const specificity =
      policySpecificity(second, params.scope) -
      policySpecificity(first, params.scope);

    if (specificity !== 0) return specificity;
    return newerFirst(first.valid_from, second.valid_from);
  });

  return matches[0] ?? null;
}

export function toKlyxLiquidityPolicy(
  row: KlyxLiquidityPolicyRow
): KlyxLiquidityPolicy {
  return {
    id: row.id,
    minimumDemandSample: row.minimum_demand_sample,
    demandMaturitySeconds: row.demand_maturity_seconds,
    maxTimeToFirstMatchSeconds: row.max_time_to_first_match_seconds,
    maxTimeToQuoteSeconds: row.max_time_to_quote_seconds,
    minMatchingQualityBps: row.min_matching_quality_bps,
    minAvailabilityProbabilityBps: row.min_availability_probability_bps,
    minQuoteProbabilityBps: row.min_quote_probability_bps,
    minQuoteAcceptanceBps: row.min_quote_acceptance_bps,
    minBookingConversionBps: row.min_booking_conversion_bps,
    minFillRateBps: row.min_fill_rate_bps,
    minCompletionRateBps: row.min_completion_rate_bps,
    maxCancellationRateBps: row.max_cancellation_rate_bps,
    minReplacementSuccessBps: row.min_replacement_success_bps,
    minRepeatUsageBps: row.min_repeat_usage_bps,
    minFulfillmentProbabilityBps: row.min_fulfillment_probability_bps,
    minProviderUtilizationBps: row.min_provider_utilization_bps,
    maxProviderUtilizationBps: row.max_provider_utilization_bps,
  };
}
