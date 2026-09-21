import { describe, expect, it } from "vitest";

import {
  buildKlyxMarketLiquidityMetrics,
  evaluateKlyxMarketLiquidity,
} from "@/lib/market-liquidity";

describe("KLYX Market & Liquidity metrics", () => {
  it("measures the demand-to-fulfillment funnel without making it domain truth", () => {
    const metrics = buildKlyxMarketLiquidityMetrics({
      requests: [
        {
          id: "r1",
          client_profile_id: "c1",
          service_id: "s1",
          market_id: "m1",
          region_id: "reg1",
          country_code: "XX",
          currency: "EUR",
          budget_max: 100,
          created_at: "2026-01-01T10:00:00.000Z",
        },
        {
          id: "r2",
          client_profile_id: "c1",
          service_id: "s1",
          market_id: "m1",
          region_id: "reg1",
          country_code: "XX",
          currency: "EUR",
          budget_max: 120,
          created_at: "2026-01-02T10:00:00.000Z",
        },
      ],
      candidates: [
        {
          market_request_id: "r1",
          provider_profile_id: "p1",
          coverage_count: 1,
          slot_count: 1,
          full_coverage: true,
          created_at: "2026-01-01T10:01:00.000Z",
        },
        {
          market_request_id: "r2",
          provider_profile_id: "p1",
          coverage_count: 1,
          slot_count: 1,
          full_coverage: true,
          created_at: "2026-01-02T10:02:00.000Z",
        },
      ],
      offers: [],
      quotes: [
        {
          id: "q1",
          market_request_id: "r1",
          provider_profile_id: "p1",
          status: "accepted",
          created_at: "2026-01-01T10:03:00.000Z",
          accepted_at: "2026-01-01T10:04:00.000Z",
        },
        {
          id: "q2",
          market_request_id: "r2",
          provider_profile_id: "p1",
          status: "accepted",
          created_at: "2026-01-02T10:04:00.000Z",
          accepted_at: "2026-01-02T10:05:00.000Z",
        },
      ],
      bookings: [
        {
          id: "b1",
          quote_id: "q1",
          provider_id: "p1",
          babysitter_id: null,
          status: "completed",
          created_at: "2026-01-01T10:06:00.000Z",
        },
        {
          id: "b2",
          quote_id: "q2",
          provider_id: "p1",
          babysitter_id: null,
          status: "completed",
          created_at: "2026-01-02T10:06:00.000Z",
        },
      ],
      incidents: [{ id: "i1", booking_id: "b1" }],
      incidentEvents: [
        {
          incident_id: "i1",
          event_type: "replacement_search_started",
          created_at: "2026-01-01T10:07:00.000Z",
        },
        {
          incident_id: "i1",
          event_type: "replacement_selected",
          created_at: "2026-01-01T10:08:00.000Z",
        },
      ],
    });

    expect(metrics.sampleSize).toBe(2);
    expect(metrics.timeToFirstMatchSeconds.p50).toBe(60);
    expect(metrics.timeToFirstMatchSeconds.p90).toBe(120);
    expect(metrics.timeToQuoteSeconds.p50).toBe(180);
    expect(metrics.timeToQuoteSeconds.p90).toBe(240);
    expect(metrics.quoteProbability).toBe(1);
    expect(metrics.quoteAcceptanceRate).toBe(1);
    expect(metrics.bookingConversionRate).toBe(1);
    expect(metrics.fillRate).toBe(1);
    expect(metrics.completionRate).toBe(1);
    expect(metrics.cancellationRate).toBe(0);
    expect(metrics.replacementSuccessRate).toBe(1);
    expect(metrics.repeatUsageRate).toBe(1);
    expect(metrics.providerUtilizationRate).toBe(1);
    expect(metrics.availabilityRate).toBe(1);
    expect(metrics.matchingQuality).toBe(1);
    expect(metrics.matchingQualitySampleSize).toBe(2);
    expect(metrics.fulfillmentProbability).toBe(1);
  });

  it("never labels a cohort liquid without policy and sufficient sample", () => {
    const metrics = {
      sampleSize: 2,
      matchedDemands: 2,
      quotedDemands: 2,
      acceptedQuoteDemands: 2,
      bookedDemands: 2,
      completedDemands: 2,
      cancelledBookedDemands: 0,
      timeToFirstMatchSeconds: { p50: 60, p90: 120 },
      timeToQuoteSeconds: { p50: 180, p90: 240 },
      matchingQuality: 1,
      matchingQualitySampleSize: 2,
      quoteProbability: 1,
      fulfillmentProbability: 1,
      quoteAcceptanceRate: 1,
      bookingConversionRate: 1,
      fillRate: 1,
      completionRate: 1,
      cancellationRate: 0,
      replacementSuccessRate: 1,
      repeatUsageRate: 1,
      providerUtilizationRate: 1,
      availabilityRate: 1,
    };

    expect(evaluateKlyxMarketLiquidity(metrics, null).state).toBe("unknown");

    expect(
      evaluateKlyxMarketLiquidity(metrics, {
        id: "policy",
        minSampleSize: 3,
        maxTimeToFirstMatchSeconds: 300,
        maxTimeToQuoteSeconds: null,
        minQuoteAcceptanceBps: null,
        minBookingConversionBps: null,
        minFillRateBps: 5000,
        minCompletionRateBps: null,
        maxCancellationRateBps: null,
        minReplacementSuccessBps: null,
        minRepeatUsageBps: null,
        minProviderUtilizationBps: null,
        minAvailabilityBps: null,
        minMatchingQualityBps: null,
      }).state
    ).toBe("unknown");

    expect(
      evaluateKlyxMarketLiquidity(metrics, {
        id: "policy",
        minSampleSize: 2,
        maxTimeToFirstMatchSeconds: 300,
        maxTimeToQuoteSeconds: 300,
        minQuoteAcceptanceBps: 5000,
        minBookingConversionBps: 5000,
        minFillRateBps: 5000,
        minCompletionRateBps: 5000,
        maxCancellationRateBps: 3000,
        minReplacementSuccessBps: null,
        minRepeatUsageBps: null,
        minProviderUtilizationBps: null,
        minAvailabilityBps: 5000,
        minMatchingQualityBps: 5000,
      }).state
    ).toBe("liquid");
  });

  it("does not fabricate matching quality from an offer-only historical signal", () => {
    const metrics = buildKlyxMarketLiquidityMetrics({
      requests: [
        {
          id: "r1",
          client_profile_id: "c1",
          service_id: "s1",
          market_id: null,
          region_id: null,
          country_code: "XX",
          currency: "EUR",
          budget_max: 100,
          created_at: "2026-01-01T10:00:00.000Z",
        },
      ],
      candidates: [],
      offers: [
        {
          request_id: "r1",
          provider_profile_id: "p1",
          status: "sent",
          created_at: "2026-01-01T10:02:00.000Z",
        },
      ],
      quotes: [],
      bookings: [],
      incidents: [],
      incidentEvents: [],
    });

    expect(metrics.matchedDemands).toBe(1);
    expect(metrics.timeToFirstMatchSeconds.p50).toBe(120);
    expect(metrics.matchingQuality).toBeNull();
    expect(metrics.matchingQualitySampleSize).toBe(0);
  });

  it("returns unknown when a configured threshold has no measurable evidence", () => {
    const metrics = {
      sampleSize: 20,
      matchedDemands: 20,
      quotedDemands: 20,
      acceptedQuoteDemands: 10,
      bookedDemands: 10,
      completedDemands: 9,
      cancelledBookedDemands: 1,
      timeToFirstMatchSeconds: { p50: 60, p90: 120 },
      timeToQuoteSeconds: { p50: 180, p90: 240 },
      matchingQuality: 0.8,
      matchingQualitySampleSize: 20,
      quoteProbability: 1,
      fulfillmentProbability: 0.45,
      quoteAcceptanceRate: 0.5,
      bookingConversionRate: 1,
      fillRate: 0.5,
      completionRate: 0.9,
      cancellationRate: 0.1,
      replacementSuccessRate: null,
      repeatUsageRate: 0.2,
      providerUtilizationRate: 0.5,
      availabilityRate: 0.8,
    };

    const result = evaluateKlyxMarketLiquidity(metrics, {
      id: "policy",
      minSampleSize: 20,
      maxTimeToFirstMatchSeconds: null,
      maxTimeToQuoteSeconds: null,
      minQuoteAcceptanceBps: null,
      minBookingConversionBps: null,
      minFillRateBps: null,
      minCompletionRateBps: null,
      maxCancellationRateBps: null,
      minReplacementSuccessBps: 5000,
      minRepeatUsageBps: null,
      minProviderUtilizationBps: null,
      minAvailabilityBps: null,
      minMatchingQualityBps: null,
    });

    expect(result.state).toBe("unknown");
    expect(result.reasons).toContain("replacement_success_unavailable");
  });
});
