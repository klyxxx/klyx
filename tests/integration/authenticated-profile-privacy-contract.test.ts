import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260819171500_klyx_authenticated_profile_privacy.sql"
);

const migration = readFileSync(migrationPath, "utf8");

describe("authenticated profile privacy contract", () => {
  it("removes all residual table-wide profile privileges first", () => {
    expect(migration).toContain(
      "KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.profiles from anon;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.profiles from authenticated;"
    );
  });

  it("restores only the six public provider columns to anon", () => {
    const anonSelectGrant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.profiles to anon;/
    )?.[1];

    expect(anonSelectGrant).toBeTruthy();
    expect(anonSelectGrant).toContain("id");
    expect(anonSelectGrant).toContain("first_name");
    expect(anonSelectGrant).toContain("last_name");
    expect(anonSelectGrant).toContain("city");
    expect(anonSelectGrant).toContain("avatar_url");
    expect(anonSelectGrant).toContain("account_type");
    expect(anonSelectGrant).not.toContain("phone_number");
    expect(anonSelectGrant).not.toContain("stripe_account_id");
    expect(anonSelectGrant).not.toContain("owner_user_id");
  });

  it("keeps phone and Stripe columns outside authenticated direct SELECT", () => {
    const selectGrant = migration.match(
      /grant select \(([\s\S]*?)\) on table public\.profiles to authenticated;/
    )?.[1];

    expect(selectGrant).toBeTruthy();
    expect(selectGrant).toContain("id");
    expect(selectGrant).toContain("first_name");
    expect(selectGrant).toContain("account_type");
    expect(selectGrant).not.toContain("phone_number");
    expect(selectGrant).not.toContain("phone_verified_at");
    expect(selectGrant).not.toContain("phone_visibility");
    expect(selectGrant).not.toContain("stripe_account_id");
    expect(selectGrant).not.toContain("stripe_onboarding_complete");
    expect(selectGrant).not.toContain("stripe_charges_enabled");
    expect(selectGrant).not.toContain("stripe_payouts_enabled");
  });

  it("prevents direct mutation of ownership, role, phone and Stripe state", () => {
    const updateGrant = migration.match(
      /grant update \(([\s\S]*?)\) on table public\.profiles to authenticated;/
    )?.[1];

    expect(updateGrant).toBeTruthy();
    expect(updateGrant).toContain("first_name");
    expect(updateGrant).toContain("city");
    expect(updateGrant).not.toContain("owner_user_id");
    expect(updateGrant).not.toContain("account_type");
    expect(updateGrant).not.toContain("current_mode");
    expect(updateGrant).not.toContain("phone_number");
    expect(updateGrant).not.toContain("phone_verified_at");
    expect(updateGrant).not.toContain("phone_visibility");
    expect(updateGrant).not.toContain("stripe_account_id");
    expect(updateGrant).not.toContain("stripe_onboarding_complete");
    expect(updateGrant).not.toContain("stripe_charges_enabled");
    expect(updateGrant).not.toContain("stripe_payouts_enabled");
  });
});
