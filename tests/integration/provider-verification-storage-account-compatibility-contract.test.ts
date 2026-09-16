import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260915134000_klyx_provider_verification_compatibility_profile_guard.sql"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("provider verification account-first compatibility folder guard", () => {
  it("keeps canonical offer_services authority while rejecting non-provider profile folders", () => {
    expect(migration).toContain(
      "public.klyx_profile_account_has_capability("
    );
    expect(migration).toContain("'offer_services'");
    expect(migration).toContain("from public.provider_profiles as provider_profile");
    expect(migration).toContain("provider_profile.profile_id = v_profile_id");
    expect(migration).toContain("from public.user_services as user_service");
    expect(migration).toContain("user_service.user_id = v_profile_id");
    expect(migration).toContain("user_service.provider_enabled = true");
    expect(migration).not.toContain("profiles.account_type");
    expect(migration).not.toContain("klyx_profile_has_type");
  });

  it("keeps the helper security-definer boundary explicit", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("owner to postgres");
    expect(migration).toContain(
      "revoke all on function public.klyx_owns_provider_verification_path(text)"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_owns_provider_verification_path(text)"
    );
    expect(migration).toContain("to authenticated, service_role");
  });
});
