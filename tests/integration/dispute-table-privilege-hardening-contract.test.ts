import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819192500_klyx_dispute_table_privileges.sql";

const privateDisputeTables = [
  "disputes",
  "dispute_events",
] as const;

describe("dispute table privilege hardening contract", () => {
  it("keeps raw dispute records service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_DISPUTE_TABLE_PRIVILEGES_12B_12M"
    );

    for (const table of privateDisputeTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });
});
