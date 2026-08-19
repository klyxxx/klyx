import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819184000_klyx_provider_verification_table_privileges.sql";

const privateVerificationTables = [
  "provider_verifications",
  "provider_verification_documents",
  "provider_skill_verifications",
  "provider_skill_documents",
] as const;

describe("provider verification table privilege hardening contract", () => {
  it("keeps KYC and skill evidence metadata service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_PROVIDER_VERIFICATION_TABLE_PRIVILEGES_12B_12J"
    );

    for (const table of privateVerificationTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
      expect(source).not.toContain(
        `grant select on table public.${table} to authenticated;`
      );
    }
  });
});
