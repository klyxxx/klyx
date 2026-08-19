import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260819175000_klyx_profile_server_boundary.sql"
  ),
  "utf8"
);

const activeProfile = readFileSync(
  join(process.cwd(), "lib/active-profile.ts"),
  "utf8"
);

describe("profile server boundary contract", () => {
  it("removes all direct authenticated profile writes", () => {
    expect(migration).toContain(
      "KLYX_PROFILE_SERVER_BOUNDARY_12B_12G"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.profiles from authenticated;"
    );
    expect(migration).not.toContain(
      "grant update ("
    );
    expect(migration).not.toContain(
      "grant insert"
    );
    expect(migration).not.toContain(
      "grant delete"
    );
  });

  it("restores only a non-sensitive authenticated read surface", () => {
    const selectGrant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.profiles to authenticated;/
    )?.[1];

    expect(selectGrant).toBeTruthy();
    expect(selectGrant).toContain("id");
    expect(selectGrant).toContain("first_name");
    expect(selectGrant).toContain("country_code");
    expect(selectGrant).toContain("currency_code");

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
      "age",
      "created_at",
      "updated_at",
    ]) {
      expect(selectGrant).not.toContain(forbiddenColumn);
    }
  });

  it("moves rich owned-profile loading behind the server boundary", () => {
    expect(activeProfile).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(activeProfile).toContain(
      "KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E"
    );
    expect(activeProfile).toContain(
      "await supabaseAdmin"
    );
    expect(activeProfile).toContain(
      '"owner_user_id",\n        user.id'
    );
    expect(activeProfile).not.toContain(
      "KLYX_ACTIVE_PROFILE_RLS_PHASE_7C"
    );
  });
});
