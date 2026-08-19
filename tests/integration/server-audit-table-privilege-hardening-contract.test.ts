import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819181000_klyx_server_audit_table_privileges.sql";

const serverOnlyTables = [
  "booking_financial_ledger",
  "booking_group_cancellation_events",
  "stripe_webhook_events",
  "sumsub_webhook_events",
] as const;

const ownerReadableTables = [
  "profile_risk_assessments",
  "security_alerts",
] as const;

describe("server audit table privilege hardening contract", () => {
  it("keeps operational journals service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_SERVER_AUDIT_TABLE_PRIVILEGES_12B_12H"
    );

    for (const table of serverOnlyTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table} to service_role;`
      );
      expect(source).not.toContain(
        `grant select on table public.${table} to authenticated;`
      );
    }
  });

  it("preserves only owner-scoped authenticated reads for risk data", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    for (const table of ownerReadableTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant select on table public.${table} to authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table} to service_role;`
      );
      expect(source).not.toContain(
        `grant all privileges on table public.${table} to authenticated;`
      );
    }
  });
});
