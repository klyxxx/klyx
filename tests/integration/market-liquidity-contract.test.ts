import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260921193000_klyx_market_liquidity_engine.sql"
);
const engine = read("lib/market-liquidity-engine.ts");
const server = read("lib/market-liquidity-server.ts");
const policy = read("lib/market-liquidity-policy.ts");
const recommend = read("app/api/brain/recommend/route.ts");
const publish = read("app/api/brain/market-publish/route.ts");
const zoneCoverage = read("lib/provider-search-zone-coverage.ts");

describe("KLYX Market & Liquidity Engine contract", () => {
  it("keeps technical support separate from actual liquidity", () => {
    expect(engine).toContain("technicalSupport");
    expect(engine).toContain("liquidityState");
    expect(engine).toContain("actuallyLiquid");
    expect(engine).toContain("liquidity_policy_missing");
    expect(engine).toContain("insufficient_mature_demand_sample");
    expect(engine).toContain("missingMetrics");
  });

  it("covers the required market measurements", () => {
    for (const metric of [
      "timeToFirstMatchSeconds",
      "timeToQuoteSeconds",
      "matchingQualityBps",
      "quoteProbabilityBps",
      "quoteAcceptanceBps",
      "bookingConversionBps",
      "fillRateBps",
      "completionRateBps",
      "cancellationRateBps",
      "replacementSuccessBps",
      "repeatUsageBps",
      "providerUtilizationBps",
      "fulfillmentProbabilityBps",
    ]) {
      expect(engine).toContain(metric);
    }
  });

  it("segments through data, not permanent country/service lists", () => {
    expect(migration).toContain("klyx_market_service_support");
    expect(migration).toContain("klyx_market_liquidity_policies");
    expect(migration).toContain("klyx_market_geography_rules");
    expect(migration).toContain("klyx_market_price_bands");
    expect(migration).toContain("market_key");
    expect(migration).toContain("country_code");
    expect(migration).toContain("region_key");
    expect(migration).toContain("service_id");
    expect(migration).toContain("currency_code");
    expect(migration).toContain("price_band_key");

    expect(policy).not.toContain('"BE"');
    expect(policy).not.toContain('"EUR"');
    expect(server).not.toContain('"BE"');
    expect(server).not.toContain('"EUR"');
    expect(engine).not.toContain('"BE"');
    expect(engine).not.toContain('"EUR"');
  });

  it("keeps Belgium geography as an optional adapter, not the universal authority", () => {
    expect(zoneCoverage).toContain("providerZonesCoverLocation");
    expect(zoneCoverage).toContain("belgianRadiusCoverage");
    expect(zoneCoverage).toContain("never permanent market allow-lists");
    expect(zoneCoverage).toContain("exactTextCoverage");
  });

  it("derives telemetry from canonical lifecycle state with idempotent event keys", () => {
    expect(migration).toContain("klyx_market_liquidity_events");
    expect(migration).toContain("event_key text not null unique");
    expect(migration).toContain("on conflict (event_key)");
    expect(migration).toContain("market_service_requests");
    expect(migration).toContain("market_service_offers");
    expect(migration).toContain("market_request_provider_candidates");
    expect(migration).toContain("booking_groups");
    expect(migration).toContain("booking_incident_events");
  });

  it("exposes liquidity to the assistant without turning it into transaction authority", () => {
    expect(recommend).toContain("getKlyxMarketLiquidity");
    expect(recommend).toContain("marketSignal");
    expect(publish).toContain("getKlyxMarketLiquidity");
    expect(publish).toContain("KLYX_MARKET_SERVICE_TECHNICALLY_UNSUPPORTED");

    expect(engine).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(policy).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("does not label availability coverage as matching quality", () => {
    const candidateStart = migration.indexOf(
      "create or replace function public.klyx_liquidity_candidate_trigger"
    );
    const offerStart = migration.indexOf(
      "create or replace function public.klyx_liquidity_offer_trigger"
    );
    const candidateTrigger = migration.slice(candidateStart, offerStart);

    expect(candidateTrigger).toContain("'matching_quality_measured', false");
    expect(candidateTrigger).toContain("'availability_confirmed'");
  });

  it("never uses an offer/quote as a proxy for supply discovery", () => {
    const offerTriggerStart = migration.indexOf(
      "create or replace function public.klyx_liquidity_offer_trigger"
    );
    const bookingTriggerStart = migration.indexOf(
      "create or replace function public.klyx_liquidity_booking_trigger"
    );
    const offerTrigger = migration.slice(offerTriggerStart, bookingTriggerStart);

    expect(offerTrigger).toContain("'quote_created'");
    expect(offerTrigger).toContain("'quote_accepted'");
    expect(offerTrigger).not.toContain("'match_found'");
    expect(offerTrigger).not.toContain("'availability_confirmed'");
  });

  it("keeps provider utilization explicit instead of fabricating capacity", () => {
    expect(migration).toContain(
      "klyx_record_market_supply_capacity_observation"
    );
    expect(engine).toContain(
      "capacityUnits > 0 ? bps(utilizedUnits, capacityUnits) : null"
    );
  });
});
