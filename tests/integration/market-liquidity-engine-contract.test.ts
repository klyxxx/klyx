import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260921173000_klyx_market_liquidity_engine.sql"
);
const server = read("lib/market-liquidity-server.ts");
const metrics = read("lib/market-liquidity.ts");
const route = read("app/api/market/requests/route.ts");
const founderRoute = read("app/api/founder/market-liquidity/route.ts");
const doc = read("docs/KLYX_MARKET_LIQUIDITY_ENGINE.md");

describe("Mission 19 Market & Liquidity Engine contract", () => {
  it("separates technical support from observed liquidity", () => {
    expect(migration).toContain(
      "create table if not exists public.klyx_market_service_capabilities"
    );
    expect(migration).toContain(
      "create table if not exists public.klyx_market_liquidity_policies"
    );
    expect(doc).toContain("service technically supported");
    expect(doc).toContain("service actually liquid in this market");
    expect(server).toContain("technicalSupport:");
    expect(server).toContain("liquidity,");
  });

  it("keeps countries, markets, regions and services data-driven", () => {
    expect(migration).toContain("market_id text not null default '*'");
    expect(migration).toContain("country_code text not null default '*'");
    expect(migration).toContain("region_id text not null default '*'");
    expect(migration).toContain(
      "service_id uuid references public.services(id) on delete restrict"
    );
    expect(migration).not.toContain("country_code in (");
    expect(migration).not.toContain("service_slug in (");
    expect(server).not.toContain("KLYX_SUPPORTED_MARKETS");
  });

  it("stores structured market and region keys on canonical demand without forcing a taxonomy", () => {
    expect(migration).toContain(
      "alter table public.market_service_requests"
    );
    expect(migration).toContain("add column if not exists market_id text");
    expect(migration).toContain("add column if not exists region_id text");
    expect(route).not.toContain("marketId?: unknown");
    expect(route).not.toContain("regionId?: unknown");
    expect(route).not.toContain("market_id: marketId");
    expect(route).not.toContain("region_id: regionId");
    expect(doc).toContain("not accepted from the public market-request POST body");
  });

  it("supports versioned data-driven price bands in accounting minor units", () => {
    expect(migration).toContain(
      "create table if not exists public.klyx_market_liquidity_price_bands"
    );
    expect(migration).toContain("min_amount_minor bigint");
    expect(migration).toContain("max_amount_minor bigint");
    expect(metrics).toContain("decimalToKlyxMinorUnits");
    expect(doc).toContain("zero-decimal currencies");
  });

  it("derives the requested market funnel from canonical domain truth", () => {
    for (const table of [
      "market_service_requests",
      "market_request_provider_candidates",
      "market_service_offers",
      "service_quotes",
      "bookings",
      "booking_groups",
      "split_booking_batches",
      "split_booking_batch_items",
      "booking_incidents",
      "booking_incident_events",
    ]) {
      expect(server).toContain(`.from("${table}")`);
    }

    for (const measure of [
      "timeToFirstMatchSeconds",
      "timeToQuoteSeconds",
      "quoteAcceptanceRate",
      "bookingConversionRate",
      "fillRate",
      "completionRate",
      "cancellationRate",
      "replacementSuccessRate",
      "repeatUsageRate",
      "providerUtilizationRate",
      "availabilityRate",
      "matchingQuality",
      "matchingQualitySampleSize",
      "quoteProbability",
      "fulfillmentProbability",
    ]) {
      expect(metrics).toContain(measure);
    }
  });

  it("covers single, group and split booking paths", () => {
    expect(server).toContain('.from("booking_groups")');
    expect(server).toContain('.from("split_booking_batches")');
    expect(server).toContain('.from("split_booking_batch_items")');
    expect(metrics).toContain("requestIdByGroupId");
    expect(metrics).toContain("requestIdBySplitBookingId");
    expect(metrics).toContain('group.status === "completed"');
    expect(metrics).toContain('batch.status === "created"');
  });

  it("fails closed instead of declaring liquidity without policy or sample", () => {
    expect(metrics).toContain('state: "unknown"');
    expect(metrics).toContain('"liquidity_policy_missing"');
    expect(metrics).toContain('"sample_size_insufficient"');
    expect(metrics).toContain('unavailable.push(`${key}_unavailable`)');
    expect(metrics).toContain('state: failures.length === 0 ? "liquid" : "illiquid"');
  });

  it("keeps the market engine analytical and away from financial/domain mutations", () => {
    const mission = [migration, server, metrics, doc].join("\n");
    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      '.from("bookings").update(',
      '.from("service_quotes").update(',
      '.from("market_service_requests").update(',
      "releasePlatformHeldBookingSettlement(",
    ]) {
      expect(mission).not.toContain(forbidden);
    }
    expect(doc).toContain("Mission 19 is analytical.");
  });

  it("exposes liquidity analysis only through the founder boundary", () => {
    expect(founderRoute).toContain("await requireKlyxFounder()");
    expect(founderRoute).toContain("getKlyxMarketLiquidityMetrics");
    expect(founderRoute).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(founderRoute).not.toContain("POST");
    expect(founderRoute).not.toContain("PATCH");
  });

  it("keeps policy tables server-only", () => {
    for (const table of [
      "klyx_market_service_capabilities",
      "klyx_market_liquidity_price_bands",
      "klyx_market_liquidity_policies",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
      expect(migration).toContain(
        `grant select on table public.${table} to service_role`
      );
    }
    expect(server).toContain('import "server-only"');
  });
});
