import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("server-only RPC execution sentinel contract", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260905233000_klyx_server_only_rpc_execution_sentinel.sql"
    ),
    "utf8"
  );

  it("fails closed when browser roles can execute sensitive server RPCs", () => {
    expect(migration).toContain("foreach role_name in array array['anon', 'authenticated']");
    expect(migration).toContain("has_function_privilege(");
    expect(migration).toContain("KLYX_SECURITY_SENTINEL_RPC_EXECUTE_LEAK");
  });

  it("requires service_role execution for the protected RPC set", () => {
    expect(migration).toContain("'service_role'");
    expect(migration).toContain("KLYX_SECURITY_SENTINEL_SERVICE_ROLE_EXECUTE_MISSING");
  });

  it("covers split payment, grouped cancellation and the security audit RPC", () => {
    expect(migration).toContain(
      "public.klyx_claim_split_payment_unit_13_27(uuid,uuid,text)"
    );
    expect(migration).toContain(
      "public.klyx_release_split_checkout_13_27(uuid,text)"
    );
    expect(migration).toContain(
      "public.klyx_resolve_group_cancellation(uuid,uuid,text)"
    );
    expect(migration).toContain("public.klyx_security_audit()");
  });
});
