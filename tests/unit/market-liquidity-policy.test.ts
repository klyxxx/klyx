import { describe, expect, it } from "vitest";

import {
  resolveKlyxLiquidityPolicy,
  resolveKlyxTechnicalSupport,
  type KlyxLiquidityPolicyRow,
  type KlyxSupportPolicyRow,
} from "@/lib/market-liquidity-policy";

const now = new Date("2026-09-21T12:00:00Z");

function support(
  id: string,
  overrides: Partial<KlyxSupportPolicyRow> = {}
): KlyxSupportPolicyRow {
  return {
    id,
    market_key: "*",
    country_code: "*",
    region_key: "*",
    service_id: "service-1",
    currency_code: "*",
    technical_status: "supported",
    priority: 0,
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: null,
    ...overrides,
  };
}

function policy(
  id: string,
  overrides: Partial<KlyxLiquidityPolicyRow> = {}
): KlyxLiquidityPolicyRow {
  return {
    id,
    market_key: "*",
    country_code: "*",
    region_key: "*",
    service_id: null,
    currency_code: "*",
    price_band_key: "*",
    priority: 0,
    minimum_demand_sample: 10,
    demand_maturity_seconds: 3600,
    max_time_to_first_match_seconds: null,
    max_time_to_quote_seconds: null,
    min_matching_quality_bps: null,
    min_availability_probability_bps: null,
    min_quote_probability_bps: null,
    min_quote_acceptance_bps: null,
    min_booking_conversion_bps: null,
    min_fill_rate_bps: null,
    min_completion_rate_bps: null,
    max_cancellation_rate_bps: null,
    min_replacement_success_bps: null,
    min_repeat_usage_bps: null,
    min_fulfillment_probability_bps: null,
    min_provider_utilization_bps: null,
    max_provider_utilization_bps: null,
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: null,
    ...overrides,
  };
}

const scope = {
  marketKey: "be-brussels",
  countryCode: "BE",
  regionKey: "brussels",
  serviceId: "service-1",
  currencyCode: "EUR",
  priceBandKey: "mid",
};

describe("KLYX liquidity policy resolution", () => {
  it("prefers the most specific support row at equal priority", () => {
    const resolved = resolveKlyxTechnicalSupport({
      rows: [
        support("global"),
        support("country", {
          country_code: "BE",
          technical_status: "experimental",
        }),
        support("market", {
          market_key: "be-brussels",
          country_code: "BE",
          technical_status: "supported",
        }),
      ],
      scope,
      now,
    });

    expect(resolved?.id).toBe("market");
    expect(resolved?.technical_status).toBe("supported");
  });

  it("lets explicit priority override specificity", () => {
    const resolved = resolveKlyxTechnicalSupport({
      rows: [
        support("specific", {
          market_key: "be-brussels",
          country_code: "BE",
          priority: 1,
        }),
        support("emergency-global", {
          technical_status: "degraded",
          priority: 100,
        }),
      ],
      scope,
      now,
    });

    expect(resolved?.id).toBe("emergency-global");
    expect(resolved?.technical_status).toBe("degraded");
  });

  it("does not match a country-specific rule when the requested scope is aggregated", () => {
    const resolved = resolveKlyxTechnicalSupport({
      rows: [
        support("be-only", { country_code: "BE" }),
        support("global"),
      ],
      scope: {
        serviceId: "service-1",
      },
      now,
    });

    expect(resolved?.id).toBe("global");
  });

  it("resolves exact service/country/currency/price-band policy over wildcard policy", () => {
    const resolved = resolveKlyxLiquidityPolicy({
      rows: [
        policy("global"),
        policy("specific", {
          service_id: "service-1",
          country_code: "BE",
          currency_code: "EUR",
          price_band_key: "mid",
          min_fill_rate_bps: 8000,
        }),
      ],
      scope,
      now,
    });

    expect(resolved?.id).toBe("specific");
    expect(resolved?.min_fill_rate_bps).toBe(8000);
  });

  it("ignores expired and future policy rows", () => {
    const resolved = resolveKlyxLiquidityPolicy({
      rows: [
        policy("expired", {
          priority: 100,
          valid_until: "2026-09-20T00:00:00Z",
        }),
        policy("future", {
          priority: 100,
          valid_from: "2026-09-22T00:00:00Z",
        }),
        policy("active"),
      ],
      scope,
      now,
    });

    expect(resolved?.id).toBe("active");
  });
});
