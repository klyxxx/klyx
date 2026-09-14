import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260914121500_klyx_account_actor_capabilities.sql"
  ),
  "utf8"
);

const rollback = readFileSync(
  join(
    process.cwd(),
    "docs/migrations/account-actor-capabilities-rollback.md"
  ),
  "utf8"
);

function executableSql() {
  return migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("KLYX canonical account actor capabilities", () => {
  it("attaches capability authority to accounts.id, never profiles.id", () => {
    expect(migration).toContain(
      "create table if not exists public.account_actor_capabilities"
    );
    expect(migration).toMatch(
      /account_id uuid not null references public\.accounts\(id\) on delete cascade/
    );
    expect(migration).toContain("primary key (account_id, capability)");

    const tableDefinition = migration.slice(
      migration.indexOf("create table if not exists public.account_actor_capabilities"),
      migration.indexOf("comment on table public.account_actor_capabilities")
    );
    expect(tableDefinition).not.toContain("profile_id");
  });

  it("makes request and offer independent and gives migrated providers both", () => {
    expect(migration).toContain("'request_services'");
    expect(migration).toContain("'offer_services'");
    expect(migration).toMatch(
      /select\s+account\.id,\s+'request_services',\s+true,\s+'legacy_backfill'/s
    );
    expect(migration).toMatch(
      /'offer_services',\s+exists \(\s+select 1\s+from public\.profiles/s
    );
  });

  it("keeps capability and qualification keys extensible", () => {
    expect(migration).not.toMatch(
      /check\s*\(\s*capability\s+in\s*\(/i
    );
    expect(migration).toContain(
      "create table if not exists public.account_capability_qualifications"
    );
    expect(migration).toContain("qualification_key text not null");
    expect(migration).toContain("scope_type text not null default 'global'");
    expect(migration).toContain("scope_key text not null default 'global'");
    expect(migration).not.toContain("category_id uuid not null");
    expect(migration).not.toContain("city_id uuid not null");
  });

  it("uses strict owner-read and server-write RLS", () => {
    expect(migration).toContain(
      "alter table public.account_actor_capabilities enable row level security"
    );
    expect(migration).toContain(
      "alter table public.account_capability_qualifications enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.account_actor_capabilities\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.account_capability_qualifications\s+from public, anon, authenticated;/
    );
    expect(migration).toContain("public.klyx_owns_account(account_id)");
    expect(migration).toMatch(
      /grant all privileges on table public\.account_actor_capabilities\s+to service_role;/
    );
  });

  it("fails closed at account authority and keeps profile only as a compatibility adapter", () => {
    expect(migration).toContain("public.klyx_account_has_capability(");
    expect(migration).toContain("public.klyx_profile_account_has_capability(");
    expect(migration).toContain("profile.account_id");
    expect(migration).toContain(
      "public.klyx_account_has_capability(\n        profile.account_id,"
    );
    expect(migration).toMatch(
      /where capability\.account_id = p_account_id\s+and capability\.capability = p_capability/s
    );
  });

  it("makes public provider discovery depend on account offer capability", () => {
    expect(migration).toContain("public.klyx_public_provider_profile(");
    expect(migration).toContain("public.klyx_public_provider_service(");
    expect(migration).toMatch(
      /public\.klyx_account_has_capability\(\s*profile\.account_id,\s*'offer_services'\s*\)/s
    );
    expect(migration).toContain("provider_profile.is_published = true");
    expect(migration).toContain("verification.status = 'approved'");
  });

  it("seeds future canonical accounts without requiring a legacy profile", () => {
    expect(migration).toContain(
      "public.klyx_seed_account_actor_capabilities()"
    );
    expect(migration).toMatch(
      /create trigger klyx_accounts_seed_actor_capabilities\s+after insert on public\.accounts/s
    );
    expect(migration).toContain(
      "(new.id, 'request_services', true, 'system')"
    );
    expect(migration).toContain(
      "(new.id, 'offer_services', false, 'system')"
    );
  });

  it("is additive and leaves transaction/payment history untouched", () => {
    const sql = executableSql();

    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/update\s+public\.bookings/i);
    expect(sql).not.toMatch(/update\s+public\.service_quotes/i);
    expect(sql).not.toMatch(/update\s+public\.market_service_requests/i);
    expect(sql).not.toMatch(/update\s+public\.profiles\s+set\s+account_type/i);
    expect(sql).not.toMatch(/update\s+public\.profiles\s+set\s+role/i);
    expect(sql).not.toMatch(/stripe_account_id\s*=/i);
  });

  it("documents a non-destructive rollback", () => {
    expect(rollback).toContain("code/policy rollback, not data deletion");
    expect(rollback).toContain("Do not drop or rewrite");
    expect(rollback).toContain("account_actor_capabilities");
    expect(rollback).toContain("account_capability_qualifications");
    expect(rollback).toContain("Stripe");
    expect(rollback).toContain("Preferred recovery is forward");
  });
});
