import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = readRepoFile(
  "supabase/migrations/20260822202000_klyx_privacy_product_analytics.sql"
);
const recorder = readRepoFile("lib/product-analytics.ts");
const searchRoute = readRepoFile("app/api/search/providers/route.ts");
const founderApi = readRepoFile("app/api/founder/analytics/route.ts");
const founderPage = readRepoFile("app/founder/analytics/page.tsx");
const founderI18n = readRepoFile("lib/klyx-founder-analytics-i18n.ts");
const founderHome = readRepoFile("app/founder/page.tsx");
const k6 = readRepoFile("performance/k6/klyx-readonly.js");

describe("KLYX privacy-safe product analytics contract", () => {
  it("stores only aggregate daily counters in a server-only table", () => {
    expect(migration).toContain("create table if not exists public.product_analytics_daily");
    expect(migration).toContain("metric_date date not null");
    expect(migration).toContain("metric_key text not null");
    expect(migration).toContain("metric_count bigint not null default 0");
    expect(migration).toContain("alter table public.product_analytics_daily force row level security");
    expect(migration).toContain("revoke all privileges on table public.product_analytics_daily");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");

    expect(migration).not.toMatch(/^\s*(user_id|profile_id|query|city|ip_address)\s+/m);
  });

  it("allows only an explicit low-cardinality metric allowlist through one service RPC", () => {
    expect(migration).toContain("public.klyx_increment_product_metric");
    expect(migration).toContain("'provider_search_with_results'");
    expect(migration).toContain("'provider_search_no_results'");
    expect(migration).toContain("KLYX_PRODUCT_ANALYTICS_INVALID_METRIC");
    expect(migration).toContain(
      "revoke all on function public.klyx_increment_product_metric(text)"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_increment_product_metric(text)"
    );

    expect(recorder).toContain('import "server-only"');
    expect(recorder).toContain("ProductMetricKey");
    expect(recorder).toContain('"klyx_increment_product_metric"');
    expect(recorder).toContain("product_analytics_increment_failed");
    expect(recorder).not.toContain("profileId");
    expect(recorder).not.toContain("userId");
    expect(recorder).not.toContain("queryText");
    expect(recorder).not.toContain("ipAddress");
  });

  it("records only successful search outcomes and never changes the search response on analytics failure", () => {
    expect(searchRoute).toContain("recordAggregateProductMetric");
    expect(searchRoute).toContain('response.status !== 200');
    expect(searchRoute).toContain('searchParams.get("analytics") === "0"');
    expect(searchRoute).toContain("response.clone().json()");
    expect(searchRoute).toContain('"provider_search_with_results"');
    expect(searchRoute).toContain('"provider_search_no_results"');
    expect(searchRoute).toContain("return response;");
  });

  it("keeps the performance search journey strictly read-only", () => {
    expect(k6).toContain('"analytics=0"');
    expect(k6).toContain('safety: "read-only"');
  });

  it("exposes aggregate business metrics only to the configured Founder", () => {
    expect(founderApi).toContain("await requireKlyxFounder()");
    expect(founderApi).toContain("const ALLOWED_WINDOWS = new Set([7, 30, 90])");
    expect(founderApi).toContain('{ count: "exact", head: true }');
    expect(founderApi).toContain('.from("product_analytics_daily")');
    expect(founderApi).toContain('.from("service_quotes")');
    expect(founderApi).toContain('.from("bookings")');
    expect(founderApi).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(founderApi).toContain("storesUserIdentifiers: false");
    expect(founderApi).toContain("storesSearchText: false");
    expect(founderApi).toContain("storesLocation: false");
    expect(founderApi).toContain("storesIpAddress: false");
    expect(founderApi).toContain("ratios de volumes");
  });

  it("labels the dashboard as aggregate analytics without a third-party browser tracker", () => {
    expect(founderHome).toContain('href="/founder/analytics"');
    expect(founderPage).toContain("KLYX_FOUNDER_ANALYTICS_I18N");
    expect(founderPage).toContain('t("privacyTitle")');
    expect(founderPage).toContain('t("ratiosTitle")');
    expect(founderPage).not.toContain("data.interpretation");
    expect(founderI18n).toContain("Analytics privées");
    expect(founderI18n).toContain("Privacy by design");
    expect(founderI18n).toContain("Lecture correcte des ratios");
    expect(founderI18n).toContain("ratios de volumes sur la période");

    const newAnalyticsCode = [
      recorder,
      searchRoute,
      founderApi,
      founderPage,
      founderI18n,
    ].join("\n");
    expect(newAnalyticsCode).not.toMatch(
      /\b(gtag|google-analytics|posthog|mixpanel|amplitude|segment\.com)\b/i
    );
  });
});
