import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819165000_klyx_split_rpc_execution_hardening.sql";

const serverOnlySplitFunctions = [
  "klyx_attach_split_checkout_13_27",
  "klyx_claim_split_payment_unit_13_27",
  "klyx_confirm_split_booking_prices_13_23",
  "klyx_confirm_split_payment_plan_13_26",
  "klyx_confirm_split_plan_13_18",
  "klyx_finalize_split_payment_run_13_27",
  "klyx_recompute_split_refund_run_13_28",
  "klyx_release_split_checkout_13_27",
] as const;

describe("split RPC execution hardening contract", () => {
  it("makes all split payment mutators service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_SPLIT_RPC_EXECUTION_HARDENING_12B_12D"
    );

    for (const functionName of serverOnlySplitFunctions) {
      expect(source).toContain(`public.${functionName}(`);
      expect(source).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated;`
        )
      );
      expect(source).toMatch(
        new RegExp(
          `grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role;`
        )
      );
    }
  });

  it("removes automatic execute grants for future public functions", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "alter default privileges for role postgres in schema public"
    );
    expect(source).toContain(
      "revoke execute on functions from public, anon, authenticated;"
    );
  });
});
