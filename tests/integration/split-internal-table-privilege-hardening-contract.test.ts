import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819182500_klyx_split_internal_table_privileges.sql";

const splitInternalTables = [
  "market_split_plan_confirmations",
  "split_booking_batch_items",
  "split_booking_batches",
  "split_booking_price_confirmations",
  "split_booking_payment_confirmations",
  "split_booking_payment_runs",
  "split_booking_payment_units",
  "split_booking_payment_refunds",
  "split_booking_proof_consumptions",
] as const;

describe("split internal table privilege hardening contract", () => {
  it("keeps all split orchestration tables service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_SPLIT_INTERNAL_TABLE_PRIVILEGES_12B_12I"
    );

    for (const table of splitInternalTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
      expect(source).not.toContain(
        `to anon;\n\n-- ${table}`
      );
    }
  });
});
