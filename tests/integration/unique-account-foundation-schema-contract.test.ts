import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912190000_klyx_unique_account_foundation.sql"
  ),
  "utf8"
);

const legacyActiveProfileMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations_legacy_20260812-161308/20260805_active_profile_phase_2.sql"
  ),
  "utf8"
);

function executableSql() {
  return migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("KLYX unique account foundation schema contract", () => {
  it("creates exactly one canonical KLYX account identity per Supabase Auth user", () => {
    expect(migration).toContain("create table if not exists public.accounts");
    expect(migration).toMatch(
      /auth_user_id uuid not null\s+references auth\.users\(id\) on delete cascade/
    );
    expect(migration).toContain(
      "constraint accounts_auth_user_id_key unique (auth_user_id)"
    );
    expect(migration).toContain(
      "insert into public.accounts (auth_user_id)"
    );
    expect(migration).toContain("from auth.users as auth_user");
    expect(migration).toContain("on conflict (auth_user_id) do nothing");
  });

  it("adds a non-destructive compatibility link from every owned legacy profile", () => {
    expect(migration).toMatch(
      /alter table public\.profiles\s+add column if not exists account_id uuid;/
    );
    expect(migration).toMatch(
      /foreign key \(account_id\)\s+references public\.accounts\(id\)\s+on delete set null;/
    );
    expect(migration).toContain("profile.owner_user_id = account.auth_user_id");
    expect(migration).toContain(
      "profile.account_id is distinct from account.id"
    );
    expect(migration).toContain("profiles_account_id_idx");
  });

  it("keeps new and updated profiles bound to the account for their Auth owner", () => {
    expect(migration).toContain(
      "public.klyx_bind_profile_to_canonical_account()"
    );
    expect(migration).toContain("new.owner_user_id");
    expect(migration).toContain("new.account_id := canonical_account_id");
    expect(migration).toContain("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
    expect(migration).toMatch(
      /before insert or update of owner_user_id, account_id\s+on public\.profiles/
    );
  });

  it("preserves legacy profile preparation before canonical account binding", () => {
    const legacyTrigger = "klyx_prepare_profile_before_insert";
    const accountTrigger = "klyx_profiles_bind_canonical_account";

    expect(legacyActiveProfileMigration).toContain(
      `create trigger ${legacyTrigger}`
    );
    expect(legacyActiveProfileMigration).toContain(
      "new.owner_user_id := coalesce(new.owner_user_id, new.id)"
    );

    // PostgreSQL fires same-kind triggers in name order. The historical trigger
    // must prepare owner_user_id before the new account-binding trigger reads it.
    expect(legacyTrigger.localeCompare(accountTrigger)).toBeLessThan(0);
  });

  it("creates the canonical account automatically for future Auth users", () => {
    expect(migration).toContain(
      "public.klyx_create_canonical_account_for_auth_user()"
    );
    expect(migration).toMatch(
      /create trigger klyx_auth_user_create_canonical_account\s+after insert\s+on auth\.users/
    );
    expect(migration).toContain("values (new.id)");
  });

  it("keeps the new identity table server-only during the compatibility phase", () => {
    expect(migration).toContain(
      "alter table public.accounts enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.accounts\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant all privileges on table public\.accounts\s+to service_role;/
    );
    expect(migration).toMatch(
      /revoke all on function public\.klyx_bind_profile_to_canonical_account\(\)\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /revoke all on function public\.klyx_create_canonical_account_for_auth_user\(\)\s+from public, anon, authenticated;/
    );
  });

  it("does not prematurely rewrite historical roles, permissions or transactions", () => {
    const sql = executableSql();

    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/alter\s+column\s+account_type/i);
    expect(sql).not.toMatch(/alter\s+column\s+current_mode/i);
    expect(sql).not.toMatch(/\bbookings?\b/i);
    expect(sql).not.toMatch(/\bservice_quotes?\b/i);
    expect(sql).not.toMatch(/\bmarket_service_requests?\b/i);
    expect(sql).not.toMatch(/\bstripe\b/i);
    expect(sql).not.toMatch(/\bprovider_capabilities\b/i);
    expect(sql).not.toMatch(/\buser_services\b/i);
  });
});
