import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819191000_klyx_brain_conversation_table_privileges.sql";

const privateBrainTables = [
  "brain_conversations",
  "brain_messages",
] as const;

describe("brain conversation table privilege hardening contract", () => {
  it("keeps raw brain conversations and messages service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_BRAIN_CONVERSATION_TABLE_PRIVILEGES_12B_12L"
    );

    for (const table of privateBrainTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });
});
