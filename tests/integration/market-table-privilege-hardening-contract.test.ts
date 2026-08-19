import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819215000_klyx_market_table_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const marketApiPath =
  "app/api/market/requests/route.ts";
const offerCorePath =
  "app/api/market/requests/[id]/offers/offer-route-core.ts";
const groupBookingCorePath =
  "app/api/market/requests/[id]/group-booking/group-booking-core.ts";
const requestPagePath =
  "app/requests/page.tsx";
const providerJobsPagePath =
  "app/provider/jobs/page.tsx";

describe("market table privilege hardening contract", () => {
  it("makes raw market request and offer tables service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_MARKET_TABLE_PRIVILEGES_12B_12W"
    );
    expect(source).toContain(
      "revoke all privileges on table public.market_service_requests\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "revoke all privileges on table public.market_service_offers\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.market_service_requests\n  to service_role;"
    );
    expect(source).toContain(
      "grant all privileges on table public.market_service_offers\n  to service_role;"
    );
  });

  it("removes obsolete browser marketplace SELECT policies", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    for (const policy of [
      "Clients read own market requests",
      "Providers read open market requests",
      "Clients read offers on own requests",
      "Providers read own market offers",
    ]) {
      expect(source).toContain(
        `drop policy if exists \"${policy}\"`
      );
    }
  });

  it("locks the historical broad browser exposure being replaced", () => {
    const baseline = readFileSync(
      join(process.cwd(), baselinePath),
      "utf8"
    );

    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."market_service_requests" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."market_service_requests" TO "authenticated";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."market_service_offers" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."market_service_offers" TO "authenticated";'
    );
    expect(baseline).toContain(
      'CREATE POLICY "Providers read open market requests"'
    );
  });

  it("keeps marketplace reads and writes behind authenticated admin APIs", () => {
    const marketApi = readFileSync(
      join(process.cwd(), marketApiPath),
      "utf8"
    );
    const offerCore = readFileSync(
      join(process.cwd(), offerCorePath),
      "utf8"
    );
    const groupBookingCore = readFileSync(
      join(process.cwd(), groupBookingCorePath),
      "utf8"
    );

    for (const source of [marketApi, offerCore, groupBookingCore]) {
      expect(source).toContain("getAuthenticatedProfile");
      expect(source).toContain("supabaseAdmin");
    }

    expect(marketApi).toContain('.from("market_service_requests")');
    expect(marketApi).toContain('.from("market_service_offers")');
    expect(offerCore).toContain('.from("market_service_requests")');
    expect(offerCore).toContain('.from("market_service_offers")');
    expect(groupBookingCore).toContain(
      '"market_service_requests"'
    );
    expect(groupBookingCore).toContain(
      '"market_service_offers"'
    );
  });

  it("keeps client and provider UIs off raw marketplace tables", () => {
    const requestPage = readFileSync(
      join(process.cwd(), requestPagePath),
      "utf8"
    );
    const providerJobsPage = readFileSync(
      join(process.cwd(), providerJobsPagePath),
      "utf8"
    );

    expect(requestPage).toContain('/api/market/requests');
    expect(providerJobsPage).toContain('/api/provider/jobs');
    expect(providerJobsPage).toContain('/api/market/requests/');

    for (const source of [requestPage, providerJobsPage]) {
      expect(source).not.toContain('.from("market_service_requests")');
      expect(source).not.toContain('.from("market_service_offers")');
    }
  });
});
