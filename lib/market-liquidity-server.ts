import "server-only";

import {
  assessKlyxMarketLiquidity,
  type KlyxLiquidityAssessment,
  type KlyxLiquidityEvent,
  type KlyxLiquidityEventType,
} from "@/lib/market-liquidity-engine";
import {
  resolveKlyxLiquidityPolicy,
  resolveKlyxTechnicalSupport,
  toKlyxLiquidityPolicy,
  type KlyxLiquidityPolicyRow,
  type KlyxLiquidityScope,
  type KlyxSupportPolicyRow,
} from "@/lib/market-liquidity-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EVENT_PAGE_SIZE = 1000;
const MAX_EVENT_PAGES = 100;

function isLiquiditySchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const row = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  const code = typeof row.code === "string" ? row.code : "";
  const text = [row.message, row.details]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /klyx_market_(service_support|liquidity_policies|liquidity_events)/i.test(text) &&
      /(does not exist|schema cache|could not find)/i.test(text)
  );
}

const EVENT_TYPES = new Set<KlyxLiquidityEventType>([
  "demand_created",
  "request_terminal",
  "match_found",
  "availability_confirmed",
  "quote_created",
  "quote_accepted",
  "booking_created",
  "booking_completed",
  "booking_cancelled",
  "replacement_requested",
  "replacement_succeeded",
  "supply_capacity_observed",
]);

type LiquidityEventDbRow = {
  event_type: string;
  request_id: string | null;
  client_profile_id: string | null;
  provider_profile_id: string | null;
  booking_id: string | null;
  occurred_at: string;
  score_bps: number | null;
  capacity_units: number | null;
  utilized_units: number | null;
  metadata: Record<string, unknown> | null;
};

export type KlyxMarketLiquidityQuery = {
  serviceSlug: string;
  windowDays?: number;
  marketKey?: string | null;
  countryCode?: string | null;
  regionKey?: string | null;
  currencyCode?: string | null;
  priceBandKey?: string | null;
  now?: Date;
};

export type KlyxMarketLiquidityResult = {
  asOf: string;
  windowDays: number;
  service: {
    id: string;
    slug: string;
    name: string | null;
  };
  segment: {
    market: string | null;
    country: string | null;
    region: string | null;
    currency: string | null;
    priceBand: string | null;
  };
  technicalSupport: {
    status: KlyxLiquidityAssessment["technicalSupport"];
    sourceId: string | null;
  };
  liquidityPolicy: {
    sourceId: string | null;
  };
  liquidity: KlyxLiquidityAssessment;
};

function normalizedCode(
  value: string | null | undefined,
  length: 2 | 3
): string | null {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return new RegExp(`^[A-Z]{${length}}$`).test(normalized)
    ? normalized
    : null;
}

function normalizedKey(
  value: string | null | undefined,
  max = 160
): string | null {
  const normalized = (value ?? "").trim().slice(0, max);
  return normalized || null;
}

function normalizedDays(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1 || (value ?? 0) > 365) {
    return 30;
  }
  return value as number;
}

function mapEvent(row: LiquidityEventDbRow): KlyxLiquidityEvent | null {
  if (!EVENT_TYPES.has(row.event_type as KlyxLiquidityEventType)) {
    return null;
  }

  return {
    eventType: row.event_type as KlyxLiquidityEventType,
    requestId: row.request_id,
    clientProfileId: row.client_profile_id,
    providerProfileId: row.provider_profile_id,
    occurredAt: row.occurred_at,
    scoreBps: row.score_bps,
    capacityUnits: row.capacity_units,
    utilizedUnits: row.utilized_units,
    requestStatus:
      typeof row.metadata?.status === "string"
        ? row.metadata.status
        : null,
    fulfillmentKey:
      row.booking_id
        ? `booking:${row.booking_id}`
        : typeof row.metadata?.booking_group_id === "string"
          ? `booking-group:${row.metadata.booking_group_id}`
          : null,
  };
}

async function loadEvents(params: {
  serviceId: string;
  startIso: string;
  marketKey: string | null;
  countryCode: string | null;
  regionKey: string | null;
  currencyCode: string | null;
  priceBandKey: string | null;
}): Promise<KlyxLiquidityEvent[]> {
  const rows: LiquidityEventDbRow[] = [];

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const from = page * EVENT_PAGE_SIZE;
    const to = from + EVENT_PAGE_SIZE - 1;

    let query = supabaseAdmin
      .from("klyx_market_liquidity_events")
      .select(
        "event_type, request_id, client_profile_id, provider_profile_id, booking_id, occurred_at, score_bps, capacity_units, utilized_units, metadata"
      )
      .eq("service_id", params.serviceId)
      .gte("occurred_at", params.startIso)
      .order("occurred_at", { ascending: true })
      .range(from, to);

    if (params.marketKey) query = query.eq("market_key", params.marketKey);
    if (params.countryCode) query = query.eq("country_code", params.countryCode);
    if (params.regionKey) query = query.eq("region_key", params.regionKey);
    if (params.currencyCode) query = query.eq("currency_code", params.currencyCode);
    if (params.priceBandKey) {
      query = query.eq("price_band_key", params.priceBandKey);
    }

    const { data, error } = await query;
    if (error) {
      if (isLiquiditySchemaUnavailable(error)) return [];
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as LiquidityEventDbRow[];
    rows.push(...pageRows);

    if (pageRows.length < EVENT_PAGE_SIZE) {
      return rows
        .map(mapEvent)
        .filter((row): row is KlyxLiquidityEvent => row !== null);
    }
  }

  throw new Error("KLYX_LIQUIDITY_EVENT_WINDOW_TOO_LARGE");
}

export async function getKlyxMarketLiquidity(
  input: KlyxMarketLiquidityQuery
): Promise<KlyxMarketLiquidityResult> {
  const serviceSlug = normalizedKey(input.serviceSlug, 120);
  if (!serviceSlug) throw new Error("KLYX_LIQUIDITY_SERVICE_REQUIRED");

  const marketKey = normalizedKey(input.marketKey, 120);
  const countryCode = normalizedCode(input.countryCode, 2);
  const regionKey = normalizedKey(input.regionKey, 160);
  const currencyCode = normalizedCode(input.currencyCode, 3);
  const priceBandKey = normalizedKey(input.priceBandKey, 120);
  const windowDays = normalizedDays(input.windowDays);
  const now = input.now ?? new Date();

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, slug, name")
    .eq("slug", serviceSlug)
    .maybeSingle();

  if (serviceError) throw new Error(serviceError.message);
  if (!service) throw new Error("KLYX_LIQUIDITY_SERVICE_NOT_FOUND");

  const [supportResult, policyResult] = await Promise.all([
    supabaseAdmin
      .from("klyx_market_service_support")
      .select(
        "id, market_key, country_code, region_key, service_id, currency_code, technical_status, priority, valid_from, valid_until"
      )
      .eq("service_id", service.id),
    supabaseAdmin
      .from("klyx_market_liquidity_policies")
      .select(
        "id, market_key, country_code, region_key, service_id, currency_code, price_band_key, priority, minimum_demand_sample, demand_maturity_seconds, max_time_to_first_match_seconds, max_time_to_quote_seconds, min_matching_quality_bps, min_availability_probability_bps, min_quote_probability_bps, min_quote_acceptance_bps, min_booking_conversion_bps, min_fill_rate_bps, min_completion_rate_bps, max_cancellation_rate_bps, min_replacement_success_bps, min_repeat_usage_bps, min_fulfillment_probability_bps, min_provider_utilization_bps, max_provider_utilization_bps, valid_from, valid_until"
      )
      .or(`service_id.is.null,service_id.eq.${service.id}`),
  ]);

  const firstError = supportResult.error ?? policyResult.error;
  if (firstError && !isLiquiditySchemaUnavailable(firstError)) {
    throw new Error(firstError.message);
  }

  const supportRows =
    supportResult.error && isLiquiditySchemaUnavailable(supportResult.error)
      ? []
      : ((supportResult.data ?? []) as KlyxSupportPolicyRow[]);

  const policyRows =
    policyResult.error && isLiquiditySchemaUnavailable(policyResult.error)
      ? []
      : ((policyResult.data ?? []) as KlyxLiquidityPolicyRow[]);

  const scope: KlyxLiquidityScope = {
    marketKey,
    countryCode,
    regionKey,
    serviceId: service.id,
    currencyCode,
    priceBandKey,
  };

  const support = resolveKlyxTechnicalSupport({
    rows: supportRows,
    scope,
    now,
  });

  const policyRow = resolveKlyxLiquidityPolicy({
    rows: policyRows,
    scope,
    now,
  });

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - windowDays);

  const events = await loadEvents({
    serviceId: service.id,
    startIso: start.toISOString(),
    marketKey,
    countryCode,
    regionKey,
    currencyCode,
    priceBandKey,
  });

  const liquidity = assessKlyxMarketLiquidity({
    technicalSupport: support?.technical_status ?? "unknown",
    events,
    policy: policyRow ? toKlyxLiquidityPolicy(policyRow) : null,
    now,
  });

  return {
    asOf: now.toISOString(),
    windowDays,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name,
    },
    segment: {
      market: marketKey,
      country: countryCode,
      region: regionKey,
      currency: currencyCode,
      priceBand: priceBandKey,
    },
    technicalSupport: {
      status: support?.technical_status ?? "unknown",
      sourceId: support?.id ?? null,
    },
    liquidityPolicy: {
      sourceId: policyRow?.id ?? null,
    },
    liquidity,
  };
}
