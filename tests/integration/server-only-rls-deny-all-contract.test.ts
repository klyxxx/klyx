import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260825234500_klyx_server_only_rls_deny_all.sql"
  ),
  "utf8"
);

const tables = [
  "notifications",
  "provider_service_zones",
  "reviews",
] as const;

describe("KLYX server-only RLS deny-all backstops", () => {
  it("keeps every affected table RLS-enabled and inaccessible to browser roles", () => {
    for (const table of tables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(migration).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });

  it("adds an explicit deny-all policy to every server-only table", () => {
    const policyMatches = migration.match(
      /create policy "klyx_server_only_deny_all"/g
    );

    expect(policyMatches).toHaveLength(tables.length);
    expect(migration.match(/using \(false\)/g)).toHaveLength(tables.length);
    expect(migration.match(/with check \(false\)/g)).toHaveLength(
      tables.length
    );
  });

  it("never restores direct browser grants", () => {
    expect(migration).not.toMatch(
      /grant\s+(select|insert|update|delete|all privileges)[\s\S]*?to\s+(anon|authenticated)/i
    );
  });
});
