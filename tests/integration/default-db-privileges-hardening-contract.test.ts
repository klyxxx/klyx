import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260819173500_klyx_default_db_privileges_hardening.sql"
  ),
  "utf8"
);

describe("default database privilege hardening contract", () => {
  it("makes future tables fail closed for application roles", () => {
    expect(migration).toContain(
      "KLYX_DEFAULT_DB_PRIVILEGES_HARDENING_12B_12F"
    );
    expect(migration).toContain(
      "revoke all on tables from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant all on tables to service_role;"
    );
  });

  it("makes future sequences fail closed for application roles", () => {
    expect(migration).toContain(
      "revoke all on sequences from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant all on sequences to service_role;"
    );
  });

  it("does not reintroduce public application-role defaults", () => {
    expect(migration).not.toContain("grant all on tables to anon");
    expect(migration).not.toContain("grant all on tables to authenticated");
    expect(migration).not.toContain("grant all on sequences to anon");
    expect(migration).not.toContain("grant all on sequences to authenticated");
  });
});
