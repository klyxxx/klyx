import { describe, expect, it } from "vitest";

import {
  assessKlyxMarketLiquidity,
  computeKlyxLiquidityMetrics,
  type KlyxLiquidityEvent,
  type KlyxLiquidityPolicy,
} from "@/lib/market-liquidity-engine";

const basePolicy: KlyxLiquidityPolicy = {
  id: "policy-1",
  minimumDemandSample: 1,
  demandMaturitySeconds: 0,
  maxTimeToFirstMatchSeconds: null,
  maxTimeToQuoteSeconds: null,
  minMatchingQualityBps: null,
  minAvailabilityProbabilityBps: null,
  minQuoteProbabilityBps: null,
  minQuoteAcceptanceBps: null,
  minBookingConversionBps: null,
  minFillRateBps: null,
  minCompletionRateBps: null,
  maxCancellationRateBps: null,
  minReplacementSuccessBps: null,
  minRepeatUsageBps: null,
  minFulfillmentProbabilityBps: null,
  minProviderUtilizationBps: null,
  maxProviderUtilizationBps: null,
};

function event(
  eventType: KlyxLiquidityEvent["eventType"],
  requestId: string | null,
  occurredAt: string,
  overrides: Partial<KlyxLiquidityEvent> = {}
): KlyxLiquidityEvent {
  return {
    eventType,
    requestId,
    clientProfileId: "client-1",
    providerProfileId: null,
    occurredAt,
    scoreBps: null,
    capacityUnits: null,
    utilizedUnits: null,
    requestStatus: null,
    fulfillmentKey:
      eventType.startsWith("booking_") && requestId
        ? `booking:${requestId}`
        : null,
    ...overrides,
  };
}

describe("KLYX Market & Liquidity Engine", () => {
  it("keeps technical support distinct from actual liquidity", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
      ],
      policy: null,
      now: new Date("2026-09-01T11:00:00Z"),
    });

    expect(result.technicalSupport).toBe("supported");
    expect(result.liquidityState).toBe("unknown");
    expect(result.actuallyLiquid).toBe(false);
    expect(result.reasons).toContain("liquidity_policy_missing");
  });

  it("certifies liquid only when configured evidence thresholds are met", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      policy: {
        ...basePolicy,
        minimumDemandSample: 2,
        maxTimeToFirstMatchSeconds: 120,
        maxTimeToQuoteSeconds: 180,
        minMatchingQualityBps: 7000,
        minAvailabilityProbabilityBps: 9000,
        minQuoteProbabilityBps: 9000,
        minQuoteAcceptanceBps: 5000,
        minBookingConversionBps: 5000,
        minFillRateBps: 5000,
        minCompletionRateBps: 9000,
        maxCancellationRateBps: 1000,
        minFulfillmentProbabilityBps: 5000,
      },
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("match_found", "request-1", "2026-09-01T10:00:30Z", {
          scoreBps: 8500,
        }),
        event("availability_confirmed", "request-1", "2026-09-01T10:00:35Z"),
        event("quote_created", "request-1", "2026-09-01T10:01:00Z"),
        event("quote_accepted", "request-1", "2026-09-01T10:02:00Z"),
        event("booking_created", "request-1", "2026-09-01T10:03:00Z"),
        event("booking_completed", "request-1", "2026-09-01T12:00:00Z"),

        event("demand_created", "request-2", "2026-09-01T10:10:00Z", {
          clientProfileId: "client-2",
        }),
        event("match_found", "request-2", "2026-09-01T10:10:45Z", {
          scoreBps: 8000,
          clientProfileId: "client-2",
        }),
        event("availability_confirmed", "request-2", "2026-09-01T10:10:50Z", {
          clientProfileId: "client-2",
        }),
        event("quote_created", "request-2", "2026-09-01T10:11:30Z", {
          clientProfileId: "client-2",
        }),
        event("quote_accepted", "request-2", "2026-09-01T10:12:00Z", {
          clientProfileId: "client-2",
        }),
        event("booking_created", "request-2", "2026-09-01T10:13:00Z", {
          clientProfileId: "client-2",
        }),
        event("booking_completed", "request-2", "2026-09-01T13:00:00Z", {
          clientProfileId: "client-2",
        }),
      ],
      now: new Date("2026-09-02T00:00:00Z"),
    });

    expect(result.liquidityState).toBe("liquid");
    expect(result.actuallyLiquid).toBe(true);
    expect(result.metrics.timeToFirstMatchSeconds).toBe(38);
    expect(result.metrics.timeToQuoteSeconds).toBe(75);
    expect(result.metrics.matchingQualityBps).toBe(8250);
    expect(result.metrics.fillRateBps).toBe(10000);
    expect(result.metrics.fulfillmentProbabilityBps).toBe(10000);
  });

  it("fails closed when a required metric is not instrumented", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      policy: {
        ...basePolicy,
        minProviderUtilizationBps: 3000,
      },
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("booking_created", "request-1", "2026-09-01T10:05:00Z"),
      ],
      now: new Date("2026-09-01T11:00:00Z"),
    });

    expect(result.liquidityState).toBe("unknown");
    expect(result.actuallyLiquid).toBe(false);
    expect(result.missingMetrics).toContain("provider_utilization");
  });

  it("classifies a mature market with no quote or fill as dry", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      policy: {
        ...basePolicy,
        minimumDemandSample: 2,
        minQuoteProbabilityBps: 1000,
        minFillRateBps: 1000,
      },
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("demand_created", "request-2", "2026-09-01T10:10:00Z"),
      ],
      now: new Date("2026-09-02T00:00:00Z"),
    });

    expect(result.metrics.quoteProbabilityBps).toBe(0);
    expect(result.metrics.fillRateBps).toBe(0);
    expect(result.liquidityState).toBe("dry");
    expect(result.actuallyLiquid).toBe(false);
  });

  it("classifies slow discovery as constrained", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      policy: {
        ...basePolicy,
        maxTimeToFirstMatchSeconds: 60,
      },
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("match_found", "request-1", "2026-09-01T10:02:00Z"),
      ],
      now: new Date("2026-09-01T11:00:00Z"),
    });

    expect(result.metrics.timeToFirstMatchSeconds).toBe(120);
    expect(result.liquidityState).toBe("constrained");
  });

  it("classifies poor completion/cancellation outcomes as degraded", () => {
    const result = assessKlyxMarketLiquidity({
      technicalSupport: "supported",
      policy: {
        ...basePolicy,
        minimumDemandSample: 2,
        minCompletionRateBps: 8000,
        maxCancellationRateBps: 2000,
      },
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("booking_created", "request-1", "2026-09-01T10:05:00Z"),
        event("booking_completed", "request-1", "2026-09-01T12:00:00Z"),
        event("demand_created", "request-2", "2026-09-01T10:10:00Z"),
        event("booking_created", "request-2", "2026-09-01T10:15:00Z"),
        event("booking_cancelled", "request-2", "2026-09-01T11:00:00Z"),
      ],
      now: new Date("2026-09-02T00:00:00Z"),
    });

    expect(result.metrics.completionRateBps).toBe(5000);
    expect(result.metrics.cancellationRateBps).toBe(5000);
    expect(result.liquidityState).toBe("degraded");
  });

  it("keeps cancellation/completion attempt rates correct across a recovered demand", () => {
    const metrics = computeKlyxLiquidityMetrics({
      demandMaturitySeconds: 0,
      now: new Date("2026-09-02T00:00:00Z"),
      events: [
        event("demand_created", "request-1", "2026-09-01T08:00:00Z"),
        event("booking_created", "request-1", "2026-09-01T08:05:00Z", {
          fulfillmentKey: "booking:first",
        }),
        event("booking_cancelled", "request-1", "2026-09-01T08:30:00Z", {
          fulfillmentKey: "booking:first",
        }),
        event("booking_created", "request-1", "2026-09-01T08:40:00Z", {
          fulfillmentKey: "booking:replacement",
        }),
        event("booking_completed", "request-1", "2026-09-01T10:00:00Z", {
          fulfillmentKey: "booking:replacement",
        }),
      ],
    });

    expect(metrics.bookingAttemptCount).toBe(2);
    expect(metrics.completedBookingCount).toBe(1);
    expect(metrics.cancelledBookingCount).toBe(1);
    expect(metrics.completionRateBps).toBe(5000);
    expect(metrics.cancellationRateBps).toBe(5000);
    expect(metrics.fulfillmentProbabilityBps).toBe(10000);
  });

  it("keeps booking conversion distinct from market fill rate", () => {
    const metrics = computeKlyxLiquidityMetrics({
      demandMaturitySeconds: 0,
      now: new Date("2026-09-02T00:00:00Z"),
      events: [
        event("demand_created", "request-direct", "2026-09-01T10:00:00Z"),
        event("booking_created", "request-direct", "2026-09-01T10:05:00Z"),
      ],
    });

    expect(metrics.fillRateBps).toBe(10000);
    expect(metrics.bookingConversionBps).toBeNull();
  });

  it("uses request-level quote acceptance so multiple offers cannot inflate conversion", () => {
    const metrics = computeKlyxLiquidityMetrics({
      demandMaturitySeconds: 0,
      now: new Date("2026-09-02T00:00:00Z"),
      events: [
        event("demand_created", "request-1", "2026-09-01T10:00:00Z"),
        event("quote_created", "request-1", "2026-09-01T10:01:00Z"),
        event("quote_created", "request-1", "2026-09-01T10:02:00Z"),
        event("quote_accepted", "request-1", "2026-09-01T10:03:00Z"),
      ],
    });

    expect(metrics.quotedDemandCount).toBe(1);
    expect(metrics.quoteAcceptedDemandCount).toBe(1);
    expect(metrics.quoteAcceptanceBps).toBe(10000);
  });

  it("measures repeat usage from completed demand clients", () => {
    const metrics = computeKlyxLiquidityMetrics({
      demandMaturitySeconds: 0,
      now: new Date("2026-09-02T00:00:00Z"),
      events: [
        event("demand_created", "request-1", "2026-09-01T08:00:00Z"),
        event("booking_created", "request-1", "2026-09-01T08:05:00Z"),
        event("booking_completed", "request-1", "2026-09-01T09:00:00Z"),
        event("demand_created", "request-2", "2026-09-01T10:00:00Z"),
        event("booking_created", "request-2", "2026-09-01T10:05:00Z"),
        event("booking_completed", "request-2", "2026-09-01T11:00:00Z"),
        event("demand_created", "request-3", "2026-09-01T12:00:00Z", {
          clientProfileId: "client-2",
        }),
        event("booking_created", "request-3", "2026-09-01T12:05:00Z", {
          clientProfileId: "client-2",
        }),
        event("booking_completed", "request-3", "2026-09-01T13:00:00Z", {
          clientProfileId: "client-2",
        }),
      ],
    });

    expect(metrics.repeatUsageBps).toBe(5000);
  });

  it("computes provider utilization only from explicit capacity observations", () => {
    const withoutCapacity = computeKlyxLiquidityMetrics({
      events: [],
      demandMaturitySeconds: 0,
    });

    const withCapacity = computeKlyxLiquidityMetrics({
      events: [
        event("supply_capacity_observed", null, "2026-09-01T10:00:00Z", {
          capacityUnits: 100,
          utilizedUnits: 65,
        }),
      ],
      demandMaturitySeconds: 0,
    });

    expect(withoutCapacity.providerUtilizationBps).toBeNull();
    expect(withCapacity.providerUtilizationBps).toBe(6500);
  });
});
