import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819235000_klyx_provider_service_write_boundary.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const publicBoundaryPath =
  "supabase/migrations/20260819233500_klyx_public_provider_service_boundary.sql";
const studioCorePath = "app/api/provider/studio/studio-route-core.ts";
const profileManagePath = "app/api/profiles/manage/route.ts";
const accountSwitcherPath = "lib/account-switcher.ts";

describe("provider service write boundary contract", () => {
  it("makes user_services and service_profiles browser read-only", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROVIDER_SERVICE_WRITE_BOUNDARY_12B_13E");

    for (const table of ["user_services", "service_profiles"]) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant select on table public.${table}\n  to anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });

  it("removes obsolete mutation policies while preserving 12B.13D SELECT RLS", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");
    const publicBoundary = readFileSync(
      join(process.cwd(), publicBoundaryPath),
      "utf8"
    );

    for (const policy of [
      "klyx_user_services_delete",
      "klyx_user_services_insert",
      "klyx_user_services_update",
      "klyx_service_profiles_delete",
      "klyx_service_profiles_insert",
      "klyx_service_profiles_update",
    ]) {
      expect(baseline).toContain(`CREATE POLICY \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }

    for (const policy of [
      "klyx_user_services_authenticated_select",
      "klyx_user_services_public_select",
      "klyx_service_profiles_authenticated_select",
      "klyx_service_profiles_public_select",
    ]) {
      expect(publicBoundary).toContain(`create policy \"${policy}\"`);
      expect(source).not.toContain(`drop policy if exists \"${policy}\"`);
    }
  });

  it("keeps Provider Studio mutations on supabaseAdmin", () => {
    const studio = readFileSync(join(process.cwd(), studioCorePath), "utf8");

    expect(studio).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(studio).toContain('.from("user_services")');
    expect(studio).toContain('.from("service_profiles")');
    expect(studio).toContain(".insert({");
    expect(studio).toContain(".update({ active: false, provider_enabled: false })");
    expect(studio).toContain(".update(serviceProfilePayload)");
  });

  it("keeps first-provider creation in the SECURITY DEFINER profile RPC", () => {
    const profileManage = readFileSync(
      join(process.cwd(), profileManagePath),
      "utf8"
    );
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");
    const accountSwitcher = readFileSync(
      join(process.cwd(), accountSwitcherPath),
      "utf8"
    );
    const compactAccountSwitcher = accountSwitcher.replace(/\s+/g, " ");

    expect(profileManage).toContain('supabase.rpc(\n      "klyx_create_profile"');
    expect(baseline).toContain(
      'CREATE OR REPLACE FUNCTION \"public\".\"klyx_create_profile\"'
    );
    expect(baseline).toContain("insert into public.user_services");
    expect(baseline).toContain("insert into public.service_profiles");

    expect(compactAccountSwitcher).toMatch(
      /fetch\("\/api\/profiles\/manage", \{ method: "POST"/
    );
    expect(accountSwitcher).not.toContain('.from("user_services")');
    expect(accountSwitcher).not.toContain('.from("service_profiles")');
  });
});
