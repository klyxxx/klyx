import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildKlyxMarketLiquidityMetrics,
  evaluateKlyxMarketLiquidity,
  type KlyxLiquidityBookingRow,
  type KlyxLiquidityCandidateRow,
  type KlyxLiquidityIncidentEventRow,
  type KlyxLiquidityIncidentRow,
  type KlyxLiquidityOfferRow,
  type KlyxLiquidityPriceBand,
  type KlyxLiquidityQuoteRow,
  type KlyxLiquidityRequestRow,
  type KlyxMarketLiquidityPolicy,
} from "@/lib/market-liquidity";

type CapabilityRow = {
  id: string;
  market_id: string;
  country_code: string;
  region_id: string;
  service_id: string | null;
  capability_status: "unsupported" | "pilot" | "supported";
  valid_from: string;
  valid_until: string | null;
};

type PriceBandRow = {
  id: string;
  band_key: string;
  market_id: string;
  country_code: string;
  region_id: string;
  service_id: string | null;
  currency_code: string;
  min_amount_minor: number;
  max_amount_minor: number | null;
  valid_from: string;
  valid_until: string | null;
};

type PolicyRow = {
  id: string;
  market_id: string;
  country_code: string;
  region_id: string;
  service_id: string | null;
  currency_code: string;
  price_band_key: string;
  min_sample_size: number;
  max_time_to_first_match_seconds: number | null;
  max_time_to_quote_seconds: number | null;
  min_quote_acceptance_bps: number | null;
  min_booking_conversion_bps: number | null;
  min_fill_rate_bps: number | null;
  min_completion_rate_bps: number | null;
  max_cancellation_rate_bps: number | null;
  min_replacement_success_bps: number | null;
  min_repeat_usage_bps: number | null;
  min_provider_utilization_bps: number | null;
  min_availability_bps: number | null;
  min_matching_quality_bps: number | null;
  valid_from: string;
  valid_until: string | null;
};

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export type KlyxMarketLiquidityQuery = {
  from: Date | string;
  to: Date | string;
  marketId?: string | null;
  countryCode?: string | null;
  regionId?: string | null;
  serviceId?: string | null;
  currencyCode?: string | null;
  priceBandKey?: string | null;
};

const PAGE_SIZE = 1000;
const ID_CHUNK = 150;

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = clean(value)?.toUpperCase() ?? null;
  if (normalized && !/^[A-Z]{2}$/.test(normalized)) {
    throw new Error("KLYX_MARKET_LIQUIDITY_COUNTRY_INVALID");
  }
  return normalized;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const normalized = clean(value)?.toUpperCase() ?? null;
  if (normalized && !/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("KLYX_MARKET_LIQUIDITY_CURRENCY_INVALID");
  }
  return normalized;
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = clean(value);
  if (
    normalized &&
    (normalized.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(normalized))
  ) {
    throw new Error("KLYX_MARKET_LIQUIDITY_SCOPE_KEY_INVALID");
  }
  return normalized;
}

function dateValue(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("KLYX_MARKET_LIQUIDITY_TIME_WINDOW_INVALID");
  }
  return date;
}

function isCurrent(
  row: { valid_from: string; valid_until: string | null },
  at: number
): boolean {
  const starts = Date.parse(row.valid_from);
  const ends = row.valid_until ? Date.parse(row.valid_until) : null;
  return (
    Number.isFinite(starts) &&
    starts <= at &&
    (ends == null || (Number.isFinite(ends) && ends > at))
  );
}

function wildcardMatch(configured: string, actual: string | null): boolean {
  return configured === "*" || (actual != null && configured === actual);
}

function serviceMatch(configured: string | null, actual: string | null): boolean {
  return configured == null || (actual != null && configured === actual);
}

function scopeSpecificity(row: {
  market_id: string;
  country_code: string;
  region_id: string;
  service_id: string | null;
}, scope: {
  marketId: string | null;
  countryCode: string | null;
  regionId: string | null;
  serviceId: string | null;
}): number {
  return (
    (row.market_id !== "*" && row.market_id === scope.marketId ? 8 : 0) +
    (row.country_code !== "*" && row.country_code === scope.countryCode ? 4 : 0) +
    (row.region_id !== "*" && row.region_id === scope.regionId ? 2 : 0) +
    (row.service_id != null && row.service_id === scope.serviceId ? 1 : 0)
  );
}

function matchesScope(row: {
  market_id: string;
  country_code: string;
  region_id: string;
  service_id: string | null;
}, scope: {
  marketId: string | null;
  countryCode: string | null;
  regionId: string | null;
  serviceId: string | null;
}): boolean {
  return (
    wildcardMatch(row.market_id, scope.marketId) &&
    wildcardMatch(row.country_code, scope.countryCode) &&
    wildcardMatch(row.region_id, scope.regionId) &&
    serviceMatch(row.service_id, scope.serviceId)
  );
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchPaged<T>(
  build: (from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchRelated<T>(
  ids: string[],
  build: (requestIds: string[], from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const rows: T[] = [];
  for (const requestIds of chunks(ids, ID_CHUNK)) {
    rows.push(
      ...(await fetchPaged((from, to) => build(requestIds, from, to)))
    );
  }
  return rows;
}

function resolveCapability(
  rows: CapabilityRow[],
  scope: {
    marketId: string | null;
    countryCode: string | null;
    regionId: string | null;
    serviceId: string | null;
  },
  at: number
): CapabilityRow | null {
  return (
    rows
      .filter((row) => isCurrent(row, at) && matchesScope(row, scope))
      .sort(
        (left, right) =>
          scopeSpecificity(right, scope) - scopeSpecificity(left, scope)
      )[0] ?? null
  );
}

function resolvePriceBand(
  rows: PriceBandRow[],
  scope: {
    marketId: string | null;
    countryCode: string | null;
    regionId: string | null;
    serviceId: string | null;
    currencyCode: string | null;
    priceBandKey: string | null;
  },
  at: number
): PriceBandRow | null {
  if (!scope.priceBandKey) return null;
  if (!scope.currencyCode) {
    throw new Error("KLYX_MARKET_LIQUIDITY_PRICE_BAND_CURRENCY_REQUIRED");
  }

  return (
    rows
      .filter(
        (row) =>
          isCurrent(row, at) &&
          row.band_key === scope.priceBandKey &&
          row.currency_code === scope.currencyCode &&
          matchesScope(row, scope)
      )
      .sort(
        (left, right) =>
          scopeSpecificity(right, scope) - scopeSpecificity(left, scope)
      )[0] ?? null
  );
}

function resolvePolicy(
  rows: PolicyRow[],
  scope: {
    marketId: string | null;
    countryCode: string | null;
    regionId: string | null;
    serviceId: string | null;
    currencyCode: string | null;
    priceBandKey: string | null;
  },
  at: number
): PolicyRow | null {
  const candidates = rows.filter(
    (row) =>
      isCurrent(row, at) &&
      matchesScope(row, scope) &&
      wildcardMatch(row.currency_code, scope.currencyCode) &&
      wildcardMatch(row.price_band_key, scope.priceBandKey)
  );

  return (
    candidates.sort((left, right) => {
      const rightSpecificity =
        scopeSpecificity(right, scope) +
        (right.currency_code !== "*" && right.currency_code === scope.currencyCode
          ? 2
          : 0) +
        (right.price_band_key !== "*" &&
        right.price_band_key === scope.priceBandKey
          ? 1
          : 0);
      const leftSpecificity =
        scopeSpecificity(left, scope) +
        (left.currency_code !== "*" && left.currency_code === scope.currencyCode
          ? 2
          : 0) +
        (left.price_band_key !== "*" &&
        left.price_band_key === scope.priceBandKey
          ? 1
          : 0);
      return rightSpecificity - leftSpecificity;
    })[0] ?? null
  );
}

function mapPolicy(row: PolicyRow | null): KlyxMarketLiquidityPolicy | null {
  if (!row) return null;
  return {
    id: row.id,
    minSampleSize: Number(row.min_sample_size),
    maxTimeToFirstMatchSeconds: row.max_time_to_first_match_seconds,
    maxTimeToQuoteSeconds: row.max_time_to_quote_seconds,
    minQuoteAcceptanceBps: row.min_quote_acceptance_bps,
    minBookingConversionBps: row.min_booking_conversion_bps,
    minFillRateBps: row.min_fill_rate_bps,
    minCompletionRateBps: row.min_completion_rate_bps,
    maxCancellationRateBps: row.max_cancellation_rate_bps,
    minReplacementSuccessBps: row.min_replacement_success_bps,
    minRepeatUsageBps: row.min_repeat_usage_bps,
    minProviderUtilizationBps: row.min_provider_utilization_bps,
    minAvailabilityBps: row.min_availability_bps,
    minMatchingQualityBps: row.min_matching_quality_bps,
  };
}

export async function getKlyxMarketLiquidityMetrics(
  input: KlyxMarketLiquidityQuery
) {
  const from = dateValue(input.from);
  const to = dateValue(input.to);
  if (to.getTime() <= from.getTime()) {
    throw new Error("KLYX_MARKET_LIQUIDITY_TIME_WINDOW_INVALID");
  }

  const scope = {
    marketId: normalizeKey(input.marketId),
    countryCode: normalizeCountry(input.countryCode),
    regionId: normalizeKey(input.regionId),
    serviceId: clean(input.serviceId),
    currencyCode: normalizeCurrency(input.currencyCode),
    priceBandKey: normalizeKey(input.priceBandKey),
  };

  const now = Date.now();

  const [capabilityResult, bandResult, policyResult] = await Promise.all([
    supabaseAdmin
      .from("klyx_market_service_capabilities")
      .select(
        "id,market_id,country_code,region_id,service_id,capability_status,valid_from,valid_until"
      ),
    supabaseAdmin
      .from("klyx_market_liquidity_price_bands")
      .select(
        "id,band_key,market_id,country_code,region_id,service_id,currency_code,min_amount_minor,max_amount_minor,valid_from,valid_until"
      ),
    supabaseAdmin
      .from("klyx_market_liquidity_policies")
      .select(
        "id,market_id,country_code,region_id,service_id,currency_code,price_band_key,min_sample_size,max_time_to_first_match_seconds,max_time_to_quote_seconds,min_quote_acceptance_bps,min_booking_conversion_bps,min_fill_rate_bps,min_completion_rate_bps,max_cancellation_rate_bps,min_replacement_success_bps,min_repeat_usage_bps,min_provider_utilization_bps,min_availability_bps,min_matching_quality_bps,valid_from,valid_until"
      ),
  ]);

  if (capabilityResult.error) throw new Error(capabilityResult.error.message);
  if (bandResult.error) throw new Error(bandResult.error.message);
  if (policyResult.error) throw new Error(policyResult.error.message);

  const capability = resolveCapability(
    (capabilityResult.data ?? []) as CapabilityRow[],
    scope,
    now
  );
  const priceBandRow = resolvePriceBand(
    (bandResult.data ?? []) as PriceBandRow[],
    scope,
    now
  );
  if (scope.priceBandKey && !priceBandRow) {
    throw new Error("KLYX_MARKET_LIQUIDITY_PRICE_BAND_NOT_FOUND");
  }
  const policyRow = resolvePolicy(
    (policyResult.data ?? []) as PolicyRow[],
    scope,
    now
  );

  const requests = await fetchPaged<KlyxLiquidityRequestRow>((rangeFrom, rangeTo) => {
    let query = supabaseAdmin
      .from("market_service_requests")
      .select(
        "id,client_profile_id,service_id,market_id,region_id,country_code,currency,budget_max,created_at"
      )
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .order("created_at", { ascending: true })
      .range(rangeFrom, rangeTo);

    if (scope.marketId) query = query.eq("market_id", scope.marketId);
    if (scope.countryCode) query = query.eq("country_code", scope.countryCode);
    if (scope.regionId) query = query.eq("region_id", scope.regionId);
    if (scope.serviceId) query = query.eq("service_id", scope.serviceId);
    if (scope.currencyCode) query = query.eq("currency", scope.currencyCode);

    return query as unknown as PageResult<KlyxLiquidityRequestRow>;
  });

  const requestIds = requests.map((request) => request.id);
  const empty = {
    candidates: [] as KlyxLiquidityCandidateRow[],
    offers: [] as KlyxLiquidityOfferRow[],
    quotes: [] as KlyxLiquidityQuoteRow[],
  };

  const related =
    requestIds.length === 0
      ? empty
      : {
          candidates: await fetchRelated<KlyxLiquidityCandidateRow>(
            requestIds,
            (ids, rangeFrom, rangeTo) =>
              supabaseAdmin
                .from("market_request_provider_candidates")
                .select(
                  "market_request_id,provider_profile_id,coverage_count,slot_count,full_coverage,created_at"
                )
                .in("market_request_id", ids)
                .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityCandidateRow>
          ),
          offers: await fetchRelated<KlyxLiquidityOfferRow>(
            requestIds,
            (ids, rangeFrom, rangeTo) =>
              supabaseAdmin
                .from("market_service_offers")
                .select("request_id,provider_profile_id,status,created_at")
                .in("request_id", ids)
                .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityOfferRow>
          ),
          quotes: await fetchRelated<KlyxLiquidityQuoteRow>(
            requestIds,
            (ids, rangeFrom, rangeTo) =>
              supabaseAdmin
                .from("service_quotes")
                .select(
                  "id,market_request_id,provider_profile_id,status,created_at,accepted_at"
                )
                .in("market_request_id", ids)
                .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityQuoteRow>
          ),
        };

  const quoteIds = related.quotes.map((quote) => quote.id);
  const bookings =
    quoteIds.length === 0
      ? []
      : await fetchRelated<KlyxLiquidityBookingRow>(
          quoteIds,
          (ids, rangeFrom, rangeTo) =>
            supabaseAdmin
              .from("bookings")
              .select(
                "id,quote_id,provider_id,babysitter_id,status,created_at"
              )
              .in("quote_id", ids)
              .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityBookingRow>
        );

  const bookingIds = bookings.map((booking) => booking.id);
  const incidents =
    bookingIds.length === 0
      ? []
      : await fetchRelated<KlyxLiquidityIncidentRow>(
          bookingIds,
          (ids, rangeFrom, rangeTo) =>
            supabaseAdmin
              .from("booking_incidents")
              .select("id,booking_id")
              .in("booking_id", ids)
              .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityIncidentRow>
        );

  const incidentIds = incidents.map((incident) => incident.id);
  const incidentEvents =
    incidentIds.length === 0
      ? []
      : await fetchRelated<KlyxLiquidityIncidentEventRow>(
          incidentIds,
          (ids, rangeFrom, rangeTo) =>
            supabaseAdmin
              .from("booking_incident_events")
              .select("incident_id,event_type,created_at")
              .in("incident_id", ids)
              .range(rangeFrom, rangeTo) as unknown as PageResult<KlyxLiquidityIncidentEventRow>
        );

  const priceBand: KlyxLiquidityPriceBand | null = priceBandRow
    ? {
        key: priceBandRow.band_key,
        currencyCode: priceBandRow.currency_code,
        minAmountMinor: Number(priceBandRow.min_amount_minor),
        maxAmountMinor:
          priceBandRow.max_amount_minor == null
            ? null
            : Number(priceBandRow.max_amount_minor),
      }
    : null;

  const metrics = buildKlyxMarketLiquidityMetrics({
    requests,
    candidates: related.candidates,
    offers: related.offers,
    quotes: related.quotes,
    bookings,
    incidents,
    incidentEvents,
    priceBand,
  });

  const policy = mapPolicy(policyRow);
  const liquidity = evaluateKlyxMarketLiquidity(metrics, policy);

  return {
    segment: {
      from: from.toISOString(),
      to: to.toISOString(),
      marketId: scope.marketId,
      countryCode: scope.countryCode,
      regionId: scope.regionId,
      serviceId: scope.serviceId,
      currencyCode: scope.currencyCode,
      priceBandKey: priceBand?.key ?? null,
    },
    technicalSupport: {
      status: capability?.capability_status ?? "unknown",
      capabilityId: capability?.id ?? null,
      technicallySupported:
        capability == null
          ? null
          : capability.capability_status === "supported" ||
            capability.capability_status === "pilot",
    },
    liquidity,
    metrics,
    definitions: {
      quoteProbability: "quoted_demands / matched_demands",
      fulfillmentProbability: "completed_demands / total_demands",
      bookingConversion: "booked_demands / accepted_quote_demands",
      fillRate: "booked_demands / total_demands",
      providerUtilization:
        "distinct_discovered_providers_booked / distinct_discovered_providers",
      availability:
        "demands_with_full_coverage_candidate_or_offer / total_demands",
      matchingQuality:
        "mean_best_candidate_coverage_ratio_per_matched_demand",
    },
  };
}
