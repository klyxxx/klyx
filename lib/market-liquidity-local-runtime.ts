import {
  assessKlyxMarketLiquidity,
  type KlyxLiquidityAssessment,
  type KlyxLiquidityEvent,
} from "@/lib/market-liquidity-engine";
import {
  resolveKlyxLiquidityPolicy,
  resolveKlyxTechnicalSupport,
  toKlyxLiquidityPolicy,
  type KlyxLiquidityPolicyRow,
  type KlyxSupportPolicyRow,
} from "@/lib/market-liquidity-policy";

export type KlyxLiquidityTimeWindow = {
  startAt: string;
  endAt: string;
};

export type KlyxMarketSegment = {
  market: string;
  country: string;
  region: string;
  service: string;
  timeWindow: KlyxLiquidityTimeWindow;
  priceBand: string;
  currency: string;
};

export type KlyxLocalService = {
  id: string;
  key: string;
  name: string | null;
};

export type KlyxLocalSupplyCandidate = {
  providerId: string;
  serviceId: string;
  market: string;
  country: string;
  region: string;
  priceBand: string;
  currency: string;
  availability: KlyxLiquidityTimeWindow[];
  matchingScoreBps: number;
  capacityUnits: number | null;
  utilizedUnits: number | null;
  enabled: boolean;
};

export type KlyxSegmentedLiquidityEvent = KlyxLiquidityEvent & {
  serviceId: string;
  market: string;
  country: string;
  region: string;
  priceBand: string;
  currency: string;
};

export type KlyxLocalMarketLiquidityDataset = {
  services: KlyxLocalService[];
  supportRules: KlyxSupportPolicyRow[];
  liquidityPolicies: KlyxLiquidityPolicyRow[];
  supply: KlyxLocalSupplyCandidate[];
  events: KlyxSegmentedLiquidityEvent[];
};

export type KlyxDiscoveredSupply = {
  providerId: string;
  matchingScoreBps: number;
  capacityUnits: number | null;
  utilizedUnits: number | null;
};

export type KlyxLocalMarketLiquidityResult = {
  asOf: string;
  segment: KlyxMarketSegment;
  service: KlyxLocalService;
  technicalSupport: {
    status: KlyxLiquidityAssessment["technicalSupport"];
    sourceId: string | null;
  };
  liquidityPolicy: {
    sourceId: string | null;
  };
  supplyDiscovery: {
    candidateCount: number;
    candidates: KlyxDiscoveredSupply[];
  };
  liquidity: KlyxLiquidityAssessment;
  chain: {
    demand: number;
    supplyDiscovery: number;
    liquidityMeasurement: KlyxLiquidityAssessment["liquidityState"];
    matchingQualityBps: number | null;
    quoteProbabilityBps: number | null;
    availabilityProbabilityBps: number | null;
    fulfillmentProbabilityBps: number | null;
  };
};

function key(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`KLYX_LIQUIDITY_${label}_REQUIRED`);
  return normalized;
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`KLYX_LIQUIDITY_${label}_INVALID`);
  }
  return parsed;
}

function normalizedWindow(window: KlyxLiquidityTimeWindow): {
  startAt: string;
  endAt: string;
  startMs: number;
  endMs: number;
} {
  const startMs = timestamp(window.startAt, "WINDOW_START");
  const endMs = timestamp(window.endAt, "WINDOW_END");
  if (endMs <= startMs) throw new Error("KLYX_LIQUIDITY_WINDOW_INVALID");

  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    startMs,
    endMs,
  };
}

function dimensionMatches(configured: string, requested: string): boolean {
  return configured === "*" || configured === requested;
}

function overlaps(
  first: KlyxLiquidityTimeWindow,
  second: { startMs: number; endMs: number }
): boolean {
  const firstStart = Date.parse(first.startAt);
  const firstEnd = Date.parse(first.endAt);
  if (!Number.isFinite(firstStart) || !Number.isFinite(firstEnd)) return false;
  return firstStart < second.endMs && firstEnd > second.startMs;
}

function clampBps(value: number): number {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

export function discoverKlyxLocalSupply(params: {
  supply: KlyxLocalSupplyCandidate[];
  serviceId: string;
  segment: Omit<KlyxMarketSegment, "service">;
}): KlyxDiscoveredSupply[] {
  const window = normalizedWindow(params.segment.timeWindow);

  return params.supply
    .filter(
      (candidate) =>
        candidate.enabled &&
        candidate.serviceId === params.serviceId &&
        dimensionMatches(candidate.market, params.segment.market) &&
        dimensionMatches(candidate.country, params.segment.country) &&
        dimensionMatches(candidate.region, params.segment.region) &&
        dimensionMatches(candidate.priceBand, params.segment.priceBand) &&
        dimensionMatches(candidate.currency, params.segment.currency) &&
        candidate.availability.some((slot) => overlaps(slot, window))
    )
    .map((candidate) => ({
      providerId: candidate.providerId,
      matchingScoreBps: clampBps(candidate.matchingScoreBps),
      capacityUnits: candidate.capacityUnits,
      utilizedUnits: candidate.utilizedUnits,
    }))
    .sort((first, second) => second.matchingScoreBps - first.matchingScoreBps);
}

function eventsForSegment(params: {
  events: KlyxSegmentedLiquidityEvent[];
  serviceId: string;
  segment: Omit<KlyxMarketSegment, "service">;
}): KlyxLiquidityEvent[] {
  const window = normalizedWindow(params.segment.timeWindow);

  return params.events.filter((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return (
      Number.isFinite(occurredAt) &&
      occurredAt >= window.startMs &&
      occurredAt <= window.endMs &&
      event.serviceId === params.serviceId &&
      event.market === params.segment.market &&
      event.country === params.segment.country &&
      event.region === params.segment.region &&
      event.priceBand === params.segment.priceBand &&
      event.currency === params.segment.currency
    );
  });
}

function applyCurrentSupplyGate(
  assessment: KlyxLiquidityAssessment,
  candidateCount: number
): KlyxLiquidityAssessment {
  const runnable =
    assessment.technicalSupport === "supported" ||
    assessment.technicalSupport === "experimental";

  if (!runnable || candidateCount > 0) return assessment;

  return {
    ...assessment,
    liquidityState:
      assessment.liquidityState === "unknown" ? "unknown" : "dry",
    actuallyLiquid: false,
    reasons: [...new Set([...assessment.reasons, "no_current_supply"])],
  };
}

export function runKlyxLocalMarketLiquidity(params: {
  dataset: KlyxLocalMarketLiquidityDataset;
  segment: KlyxMarketSegment;
  now?: Date;
}): KlyxLocalMarketLiquidityResult {
  const window = normalizedWindow(params.segment.timeWindow);
  const segment: KlyxMarketSegment = {
    market: key(params.segment.market, "MARKET"),
    country: key(params.segment.country, "COUNTRY"),
    region: key(params.segment.region, "REGION"),
    service: key(params.segment.service, "SERVICE"),
    timeWindow: {
      startAt: window.startAt,
      endAt: window.endAt,
    },
    priceBand: key(params.segment.priceBand, "PRICE_BAND"),
    currency: key(params.segment.currency, "CURRENCY"),
  };

  const service = params.dataset.services.find(
    (candidate) => candidate.key === segment.service
  );
  if (!service) throw new Error("KLYX_LIQUIDITY_SERVICE_NOT_FOUND");

  const now = params.now ?? new Date(window.endMs);
  const scope = {
    marketKey: segment.market,
    countryCode: segment.country,
    regionKey: segment.region,
    serviceId: service.id,
    currencyCode: segment.currency,
    priceBandKey: segment.priceBand,
  };

  const support = resolveKlyxTechnicalSupport({
    rows: params.dataset.supportRules,
    scope,
    now,
  });
  const policyRow = resolveKlyxLiquidityPolicy({
    rows: params.dataset.liquidityPolicies,
    scope,
    now,
  });
  const supply = discoverKlyxLocalSupply({
    supply: params.dataset.supply,
    serviceId: service.id,
    segment: {
      market: segment.market,
      country: segment.country,
      region: segment.region,
      timeWindow: segment.timeWindow,
      priceBand: segment.priceBand,
      currency: segment.currency,
    },
  });
  const events = eventsForSegment({
    events: params.dataset.events,
    serviceId: service.id,
    segment: {
      market: segment.market,
      country: segment.country,
      region: segment.region,
      timeWindow: segment.timeWindow,
      priceBand: segment.priceBand,
      currency: segment.currency,
    },
  });

  const rawAssessment = assessKlyxMarketLiquidity({
    technicalSupport: support?.technical_status ?? "unknown",
    events,
    policy: policyRow ? toKlyxLiquidityPolicy(policyRow) : null,
    now,
  });
  const liquidity = applyCurrentSupplyGate(rawAssessment, supply.length);

  return {
    asOf: now.toISOString(),
    segment,
    service,
    technicalSupport: {
      status: support?.technical_status ?? "unknown",
      sourceId: support?.id ?? null,
    },
    liquidityPolicy: {
      sourceId: policyRow?.id ?? null,
    },
    supplyDiscovery: {
      candidateCount: supply.length,
      candidates: supply,
    },
    liquidity,
    chain: {
      demand: liquidity.metrics.demandCount,
      supplyDiscovery: supply.length,
      liquidityMeasurement: liquidity.liquidityState,
      matchingQualityBps: liquidity.metrics.matchingQualityBps,
      quoteProbabilityBps: liquidity.metrics.quoteProbabilityBps,
      availabilityProbabilityBps: liquidity.metrics.availabilityProbabilityBps,
      fulfillmentProbabilityBps: liquidity.metrics.fulfillmentProbabilityBps,
    },
  };
}
