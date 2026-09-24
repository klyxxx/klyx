import { describe, expect, it } from "vitest";

import { marketLiquidityLocalFixture } from "@/fixtures/market-liquidity.fixture";
import {
  runKlyxLocalMarketLiquidity,
  type KlyxLocalMarketLiquidityDataset,
} from "@/lib/market-liquidity-local-runtime";

const baseSegment = {
  market: "fixture-market",
  country: "fixture-country",
  region: "fixture-region",
  service: "fixture-service",
  timeWindow: {
    startAt: "2026-09-01T00:00:00.000Z",
    endAt: "2026-09-30T23:59:59.999Z",
  },
  priceBand: "fixture-price-band",
  currency: "fixture-currency",
};

function cloneFixture(): KlyxLocalMarketLiquidityDataset {
  return structuredClone(marketLiquidityLocalFixture);
}

describe("KLYX local Market & Liquidity runtime", () => {
  it("runs the complete chain with local fixtures only", () => {
    const result = runKlyxLocalMarketLiquidity({
      dataset: cloneFixture(),
      segment: baseSegment,
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.technicalSupport.status).toBe("supported");
    expect(result.supplyDiscovery.candidateCount).toBe(1);
    expect(result.chain.demand).toBe(1);
    expect(result.chain.supplyDiscovery).toBe(1);
    expect(result.chain.matchingQualityBps).toBe(8500);
    expect(result.chain.quoteProbabilityBps).toBe(10000);
    expect(result.chain.availabilityProbabilityBps).toBe(10000);
    expect(result.chain.fulfillmentProbabilityBps).toBe(10000);
    expect(result.liquidity.actuallyLiquid).toBe(true);
  });

  it("keeps technical support distinct from actual liquidity", () => {
    const dataset = cloneFixture();
    dataset.supply = [];

    const result = runKlyxLocalMarketLiquidity({
      dataset,
      segment: baseSegment,
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.technicalSupport.status).toBe("supported");
    expect(result.liquidity.actuallyLiquid).toBe(false);
    expect(result.liquidity.liquidityState).toBe("dry");
    expect(result.liquidity.reasons).toContain("no_current_supply");
  });

  it("isolates measurements by every requested segment dimension", () => {
    const dataset = cloneFixture();
    dataset.events.push(
      ...dataset.events.map((event) => ({
        ...event,
        requestId: event.requestId ? `other:${event.requestId}` : null,
        country: "other-country",
      }))
    );

    const result = runKlyxLocalMarketLiquidity({
      dataset,
      segment: baseSegment,
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.liquidity.metrics.demandCount).toBe(1);
    expect(result.liquidity.metrics.completedDemandCount).toBe(1);
  });

  it("does not hardcode a permanent country or service universe", () => {
    const dataset = cloneFixture();
    dataset.services = [
      {
        id: "arbitrary-service-id",
        key: "arbitrary-service-key",
        name: null,
      },
    ];
    dataset.supportRules = dataset.supportRules.map((rule) => ({
      ...rule,
      service_id: "arbitrary-service-id",
    }));
    dataset.supply = dataset.supply.map((candidate) => ({
      ...candidate,
      serviceId: "arbitrary-service-id",
      country: "country-added-at-runtime",
      region: "region-added-at-runtime",
      currency: "currency-added-at-runtime",
      priceBand: "price-band-added-at-runtime",
      market: "market-added-at-runtime",
    }));
    dataset.events = dataset.events.map((event) => ({
      ...event,
      serviceId: "arbitrary-service-id",
      country: "country-added-at-runtime",
      region: "region-added-at-runtime",
      currency: "currency-added-at-runtime",
      priceBand: "price-band-added-at-runtime",
      market: "market-added-at-runtime",
    }));

    const result = runKlyxLocalMarketLiquidity({
      dataset,
      segment: {
        market: "market-added-at-runtime",
        country: "country-added-at-runtime",
        region: "region-added-at-runtime",
        service: "arbitrary-service-key",
        timeWindow: baseSegment.timeWindow,
        priceBand: "price-band-added-at-runtime",
        currency: "currency-added-at-runtime",
      },
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.service.id).toBe("arbitrary-service-id");
    expect(result.segment.country).toBe("country-added-at-runtime");
    expect(result.liquidity.actuallyLiquid).toBe(true);
  });

  it("filters supply by availability window", () => {
    const dataset = cloneFixture();
    dataset.supply[0].availability = [
      {
        startAt: "2026-10-01T00:00:00.000Z",
        endAt: "2026-11-01T00:00:00.000Z",
      },
    ];

    const result = runKlyxLocalMarketLiquidity({
      dataset,
      segment: baseSegment,
      now: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(result.supplyDiscovery.candidateCount).toBe(0);
    expect(result.liquidity.actuallyLiquid).toBe(false);
  });
});
