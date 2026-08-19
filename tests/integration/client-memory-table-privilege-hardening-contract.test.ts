import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819185500_klyx_client_memory_table_privileges.sql";

const privateMemoryTables = [
  "user_preferences",
  "client_memory_profiles",
  "user_memory_events",
  "client_agent_plans",
] as const;

describe("client memory table privilege hardening contract", () => {
  it("keeps personal memory and agent-plan tables service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_CLIENT_MEMORY_TABLE_PRIVILEGES_12B_12K"
    );

    for (const table of privateMemoryTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });
});
