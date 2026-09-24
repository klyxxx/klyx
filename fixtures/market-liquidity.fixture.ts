import type {
  KlyxLocalMarketLiquidityDataset,
  KlyxSegmentedLiquidityEvent,
} from "@/lib/market-liquidity-local-runtime";

const segment = {
  market: "fixture-market",
  country: "fixture-country",
  region: "fixture-region",
  priceBand: "fixture-price-band",
  currency: "fixture-currency",
};

function event(
  eventType: KlyxSegmentedLiquidityEvent["eventType"],
  requestId: string | null,
  occurredAt: string,
  overrides: Partial<KlyxSegmentedLiquidityEvent> = {}
): KlyxSegmentedLiquidityEvent {
  return {
    eventType,
    requestId,
    clientProfileId: requestId ? `client:${requestId}` : null,
    providerProfileId: null,
    occurredAt,
    scoreBps: null,
    capacityUnits: null,
    utilizedUnits: null,
    requestStatus: null,
    fulfillmentKey:
      requestId && eventType.startsWith("booking_")
        ? `booking:${requestId}`
        : null,
    serviceId: "fixture-service-id",
    ...segment,
    ...overrides,
  };
}

export const marketLiquidityLocalFixture: KlyxLocalMarketLiquidityDataset = {
  services: [
    {
      id: "fixture-service-id",
      key: "fixture-service",
      name: "Fixture Service",
    },
  ],
  supportRules: [
    {
      id: "fixture-support",
      market_key: "*",
      country_code: "*",
      region_key: "*",
      service_id: "fixture-service-id",
      currency_code: "*",
      technical_status: "supported",
      priority: 1,
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_until: null,
    },
  ],
  liquidityPolicies: [
    {
      id: "fixture-policy",
      market_key: "*",
      country_code: "*",
      region_key: "*",
      service_id: null,
      currency_code: "*",
      price_band_key: "*",
      priority: 1,
      minimum_demand_sample: 1,
      demand_maturity_seconds: 0,
      max_time_to_first_match_seconds: 300,
      max_time_to_quote_seconds: 600,
      min_matching_quality_bps: 6000,
      min_availability_probability_bps: 5000,
      min_quote_probability_bps: 5000,
      min_quote_acceptance_bps: 5000,
      min_booking_conversion_bps: 5000,
      min_fill_rate_bps: 5000,
      min_completion_rate_bps: 5000,
      max_cancellation_rate_bps: 5000,
      min_replacement_success_bps: null,
      min_repeat_usage_bps: null,
      min_fulfillment_probability_bps: 5000,
      min_provider_utilization_bps: null,
      max_provider_utilization_bps: null,
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_until: null,
    },
  ],
  supply: [
    {
      providerId: "fixture-provider",
      serviceId: "fixture-service-id",
      ...segment,
      availability: [
        {
          startAt: "2026-09-01T00:00:00.000Z",
          endAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      matchingScoreBps: 8500,
      capacityUnits: 10,
      utilizedUnits: 6,
      enabled: true,
    },
  ],
  events: [
    event("demand_created", "request-1", "2026-09-20T10:00:00.000Z"),
    event("match_found", "request-1", "2026-09-20T10:01:00.000Z", {
      scoreBps: 8500,
    }),
    event(
      "availability_confirmed",
      "request-1",
      "2026-09-20T10:01:30.000Z"
    ),
    event("quote_created", "request-1", "2026-09-20T10:02:00.000Z"),
    event("quote_accepted", "request-1", "2026-09-20T10:03:00.000Z"),
    event("booking_created", "request-1", "2026-09-20T10:04:00.000Z"),
    event("booking_completed", "request-1", "2026-09-20T12:00:00.000Z"),
  ],
};
