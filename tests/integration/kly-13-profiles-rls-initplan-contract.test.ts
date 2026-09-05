import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260906001500_klyx_profiles_rls_initplan_optimization.sql";

function readMigration() {
  return fs.readFileSync(path.join(process.cwd(), migrationPath), "utf8");
}

function policyBlock(source: string, policyName: string) {
  const match = source.match(
    new RegExp(`alter policy ${policyName}\\s+on public\\.profiles([\\s\\S]*?);`, "i")
  );
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
}

describe("KLY-13 profiles RLS initplan contract", () => {
  it("alters only the four existing profiles policies instead of recreating them", () => {
    const source = readMigration();
    const alterPolicies = source.match(/\balter policy\b/gi) ?? [];

    expect(alterPolicies).toHaveLength(4);
    expect(source).not.toMatch(/\bdrop policy\b/i);
    expect(source).not.toMatch(/\bcreate policy\b/i);

    for (const policyName of [
      "klyx_profiles_insert",
      "klyx_profiles_update",
      "klyx_profiles_delete",
      "klyx_profiles_authenticated_select",
    ]) {
      expect(source).toContain(`alter policy ${policyName}`);
    }
  });

  it("wraps every auth.uid call in the altered policy predicates with a scalar SELECT", () => {
    const source = readMigration();
    const policySql = source.split("-- Fail closed")[0].replace(/--.*$/gm, "");
    const wrapped = policySql.match(/\(select auth\.uid\(\)\)/gi) ?? [];

    expect(wrapped).toHaveLength(5);
    expect(policySql.replace(/\(select auth\.uid\(\)\)/gi, "")).not.toMatch(
      /auth\.uid\(\)/i
    );
  });

  it("preserves owner-only insert, update and delete semantics", () => {
    const source = readMigration();

    expect(policyBlock(source, "klyx_profiles_insert")).toMatch(
      /with check\s*\(owner_user_id = \(select auth\.uid\(\)\)\)/i
    );

    const update = policyBlock(source, "klyx_profiles_update");
    expect(update).toMatch(
      /using\s*\(owner_user_id = \(select auth\.uid\(\)\)\)/i
    );
    expect(update).toMatch(
      /with check\s*\(owner_user_id = \(select auth\.uid\(\)\)\)/i
    );

    expect(policyBlock(source, "klyx_profiles_delete")).toMatch(
      /using\s*\(owner_user_id = \(select auth\.uid\(\)\)\)/i
    );
  });

  it("preserves authenticated profile visibility for owner, shared booking and published provider", () => {
    const selectPolicy = policyBlock(
      readMigration(),
      "klyx_profiles_authenticated_select"
    );

    expect(selectPolicy).toContain("owner_user_id = (select auth.uid())");
    expect(selectPolicy).toContain("klyx_shares_booking_with_profile(id)");
    expect(selectPolicy).toContain("account_type = 'provider'");
    expect(selectPolicy).toContain("from public.provider_profiles provider_profile");
    expect(selectPolicy).toContain("provider_profile.profile_id = profiles.id");
    expect(selectPolicy).toContain("provider_profile.is_published = true");
  });

  it("keeps metadata fail-closed and stays outside neighboring mission boundaries", () => {
    const source = readMigration();

    expect(source).toContain("policy.permissive <> 'PERMISSIVE'");
    expect(source).toContain("policy.roles <> array['authenticated']::name[]");
    expect(source).toContain("KLYX_KLY_13_PROFILE_POLICY_METADATA_DRIFT");
    expect(source).toContain("KLYX_KLY_13_PROFILE_SELECT_SEMANTICS_DRIFT");

    expect(source).not.toMatch(/handle_new_user/i);
    expect(source).not.toMatch(/stripe/i);
    expect(source).not.toMatch(/payment/i);
    expect(source).not.toMatch(/brain/i);
    expect(source).not.toMatch(/activity/i);
  });
});
