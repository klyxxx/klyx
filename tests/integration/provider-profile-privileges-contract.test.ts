import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819232000_klyx_provider_profile_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const publicProviderPagePath = "app/providers/[id]/page.tsx";
const studioCorePath = "app/api/provider/studio/studio-route-core.ts";
const profileManagePath = "app/api/profiles/manage/route.ts";

describe("provider profile privilege contract", () => {
  it("exposes only commercial provider-profile columns to browser roles", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("KLYX_PROVIDER_PROFILE_PRIVILEGES_12B_13C");
    expect(source).toContain(
      "revoke all privileges on table public.provider_profiles\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "profile_id,\n  business_name,\n  headline,\n  bio,\n  years_experience,\n  is_published,\n  verification_status"
    );
    expect(source).toContain(
      ") on table public.provider_profiles\n  to anon, authenticated;"
    );
    expect(source).not.toContain("created_at,\n  updated_at");
    expect(source).toContain(
      "grant all privileges on table public.provider_profiles\n  to service_role;"
    );
  });

  it("removes obsolete browser mutation policies but preserves SELECT RLS", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const policy of [
      "klyx_provider_profiles_delete",
      "klyx_provider_profiles_insert",
      "klyx_provider_profiles_update",
    ]) {
      expect(baseline).toContain(`CREATE POLICY \"${policy}\"`);
      expect(source).toContain(`drop policy if exists \"${policy}\"`);
    }

    expect(baseline).toContain('CREATE POLICY "klyx_provider_profiles_select"');
    expect(source).not.toContain(
      'drop policy if exists "klyx_provider_profiles_select"'
    );
  });

  it("keeps the public provider detail query inside the minimized column grant", () => {
    const page = readFileSync(
      join(process.cwd(), publicProviderPagePath),
      "utf8"
    );

    expect(page).toContain('.from("provider_profiles")');
    expect(page).toContain(
      '"business_name, headline, bio, years_experience, is_published, verification_status"'
    );
    expect(page).toContain('.eq("profile_id", providerId)');
    expect(page).not.toContain("created_at");
    expect(page).not.toContain("updated_at");
  });

  it("keeps provider-profile mutation behind server-owned paths", () => {
    const studio = readFileSync(join(process.cwd(), studioCorePath), "utf8");
    const profileManage = readFileSync(
      join(process.cwd(), profileManagePath),
      "utf8"
    );

    expect(studio).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(studio).toContain('.from("provider_profiles")');
    expect(studio).toContain(".upsert(");

    expect(profileManage).toContain('supabase.rpc(\n      "klyx_create_profile"');
    expect(profileManage).not.toContain('.from("provider_profiles").insert');
    expect(profileManage).not.toContain('.from("provider_profiles").update');
  });
});
