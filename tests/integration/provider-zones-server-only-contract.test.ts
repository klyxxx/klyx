import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820000500_klyx_provider_zones_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const zonesPagePath = "app/provider/zones/page.tsx";
const zonesCorePath = "app/api/provider/zones/zones-route-core.ts";
const readinessPath = "app/components/ProviderReadinessStatus.tsx";

describe("provider zones server-only contract", () => {
  it("removes browser table privileges and keeps service_role access", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROVIDER_ZONES_SERVER_ONLY_12B_13F");
    expect(source).toContain(
      "revoke all privileges on table public.provider_service_zones\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.provider_service_zones\n  to service_role;"
    );
    expect(source).not.toContain(
      "grant select on table public.provider_service_zones"
    );
  });

  it("drops the obsolete direct authenticated SELECT policy", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'CREATE POLICY "Providers read own service zones"'
    );
    expect(source).toContain(
      'drop policy if exists "Providers read own service zones"'
    );
  });

  it("keeps the provider UI on the authenticated zones API", () => {
    const page = readFileSync(join(process.cwd(), zonesPagePath), "utf8");
    const readiness = readFileSync(join(process.cwd(), readinessPath), "utf8");

    expect(page).toContain('fetch("/api/provider/zones"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('method: "DELETE"');
    expect(page).not.toContain('.from("provider_service_zones")');

    expect(readiness).toContain('fetch("/api/provider/zones"');
    expect(readiness).not.toContain('.from("provider_service_zones")');
  });

  it("keeps every zone table operation behind supabaseAdmin", () => {
    const core = readFileSync(join(process.cwd(), zonesCorePath), "utf8");

    expect(core).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(core).toContain('.from("provider_service_zones")');
    expect(core).toContain(".upsert(");
    expect(core).toContain(".update({");
    expect(core).toContain(".delete()");
    expect(core).toContain("getAuthenticatedProfile(request)");
    expect(core).toContain('requireAccountType(profile, "provider")');
  });
});
