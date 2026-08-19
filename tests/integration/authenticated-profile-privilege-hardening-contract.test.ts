import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819171000_klyx_authenticated_profile_privileges.sql";

const privateProfileColumns = [
  "phone_number",
  "phone_verified_at",
  "phone_visibility",
  "stripe_account_id",
  "stripe_onboarding_complete",
  "stripe_charges_enabled",
  "stripe_payouts_enabled",
] as const;

function grantColumns(source: string, privilege: "select" | "update") {
  const match = source.match(
    new RegExp(
      `grant ${privilege} \\(([\\s\\S]*?)\\) on table public\\.profiles to authenticated;`,
      "i"
    )
  );

  expect(match).not.toBeNull();
  return match?.[1] ?? "";
}

describe("authenticated profile privilege hardening contract", () => {
  it("removes broad profile privileges and never grants private phone or Stripe columns", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_AUTHENTICATED_PROFILE_PRIVILEGES_12B_12E"
    );
    expect(source).toContain(
      "revoke all on table public.profiles from anon, authenticated;"
    );

    const selectColumns = grantColumns(source, "select");
    const updateColumns = grantColumns(source, "update");

    expect(selectColumns).toContain("owner_user_id");
    expect(selectColumns).toContain("country_code");
    expect(selectColumns).toContain("currency_code");

    expect(updateColumns).toContain("first_name");
    expect(updateColumns).toContain("country_code");
    expect(updateColumns).toContain("currency_code");

    for (const column of privateProfileColumns) {
      expect(selectColumns).not.toContain(column);
      expect(updateColumns).not.toContain(column);
    }

    expect(updateColumns).not.toContain("owner_user_id");
    expect(updateColumns).not.toContain("account_type");
    expect(updateColumns).not.toContain("current_mode");
  });

  it("keeps anonymous profile projection at the six approved public columns", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    const match = source.match(
      /grant select \(([\s\S]*?)\) on table public\.profiles to anon;/i
    );

    expect(match).not.toBeNull();

    const publicColumns = (match?.[1] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    expect(publicColumns).toEqual([
      "id",
      "first_name",
      "last_name",
      "city",
      "avatar_url",
      "account_type",
    ]);
  });
});
