import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819173000_klyx_authenticated_profile_privacy.sql";

describe("authenticated profile privacy contract", () => {
  it("keeps private profile columns and writes behind the server boundary", () => {
    const migration = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );
    const activeProfile = readFileSync(
      join(process.cwd(), "lib/active-profile.ts"),
      "utf8"
    );

    expect(migration).toContain(
      "KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.profiles from authenticated;"
    );
    expect(migration).toContain(
      "on table public.profiles to authenticated;"
    );

    const grantStart = migration.indexOf("grant select (");
    const grantEnd = migration.indexOf(
      ") on table public.profiles to authenticated;"
    );
    expect(grantStart).toBeGreaterThanOrEqual(0);
    expect(grantEnd).toBeGreaterThan(grantStart);

    const grantedColumns = migration.slice(grantStart, grantEnd);
    for (const forbiddenColumn of [
      "owner_user_id",
      "phone_number",
      "phone_verified_at",
      "phone_visibility",
      "stripe_account_id",
      "stripe_onboarding_complete",
      "stripe_charges_enabled",
      "stripe_payouts_enabled",
      "current_mode",
    ]) {
      expect(grantedColumns).not.toContain(forbiddenColumn);
    }

    expect(activeProfile).toContain(
      "KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E"
    );
    expect(activeProfile).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(activeProfile).toContain("await supabaseAdmin");
    expect(activeProfile).toContain('"owner_user_id",\n        user.id');
    expect(activeProfile).not.toContain(
      "KLYX_ACTIVE_PROFILE_RLS_PHASE_7C"
    );
  });
});
