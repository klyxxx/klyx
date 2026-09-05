import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260905000500_klyx_split_payment_rpc_execution_hardening.sql"
);

const migration = readFileSync(migrationPath, "utf8");

describe("split payment RPC execution hardening", () => {
  it("removes anonymous execution from server-only split checkout RPCs", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) from anon;"
    );
    expect(migration).toContain(
      "revoke all on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) from anon;"
    );
    expect(migration).toContain(
      "revoke all on function public.klyx_release_split_checkout_13_27(uuid, text) from anon;"
    );
  });

  it("keeps the critical split checkout RPCs server-only", () => {
    expect(migration).toContain(
      "grant execute on function public.klyx_claim_split_payment_unit_13_27(uuid, uuid, text) to service_role;"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_attach_split_checkout_13_27(uuid, text, text, text) to service_role;"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_release_split_checkout_13_27(uuid, text) to service_role;"
    );

    expect(migration).not.toMatch(
      /grant\s+(?:all|execute)\s+on\s+function\s+public\.klyx_(?:claim_split_payment_unit_13_27|attach_split_checkout_13_27|release_split_checkout_13_27)[\s\S]*?\s+to\s+anon;/i
    );
  });
});
