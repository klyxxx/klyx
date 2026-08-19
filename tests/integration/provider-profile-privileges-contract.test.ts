import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819232000_klyx_provider_profile_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const publicProviderPagePath = "app/providers/[id]/page.tsx";
const studioComponentPath = "app/components/ProviderStudio.tsx";
const studioCorePath = "app/api/provider/studio/studio-route-core.ts";

describe("provider profile privilege contract", () => {
  it("exposes only provider presentation fields to browser roles", () => {
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

  it("removes historical mutation policies while preserving provider SELECT RLS", () => {
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
    expect(source).not.toContain('drop policy if exists "klyx_provider_profiles_select"');
  });

  it("keeps the public provider page inside the minimized SELECT grant", () => {
    const page = readFileSync(
      join(process.cwd(), publicProviderPagePath),
      "utf8"
    );

    expect(page).toContain('.from("provider_profiles")');
    expect(page).toContain(
      '"business_name, headline, bio, years_experience, is_published, verification_status"'
    );
    expect(page).toContain('.eq("profile_id", providerId)');
    expect(page).not.toContain("provider_profiles.created_at");
    expect(page).not.toContain("provider_profiles.updated_at");
  });

  it("keeps provider profile mutation behind Provider Studio and supabaseAdmin", () => {
    const component = readFileSync(
      join(process.cwd(), studioComponentPath),
      "utf8"
    );
    const core = readFileSync(join(process.cwd(), studioCorePath), "utf8");

    expect(component).toContain('fetch("/api/provider/studio"');
    expect(component).toContain('method: "PUT"');
    expect(component).not.toContain('.from("provider_profiles")');

    expect(core).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(core).toContain('.from("provider_profiles")');
    expect(core).toContain(".upsert(");
    expect(core).toContain("is_published: publish");
    expect(core).toContain("verification_status: verificationStatus");
  });
});
