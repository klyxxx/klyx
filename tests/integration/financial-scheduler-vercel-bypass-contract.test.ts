import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX financial scheduler Vercel protection bypass contract", () => {
  const migration = read(
    "supabase/migrations/20260923164500_klyx_financial_scheduler_vercel_bypass.sql"
  );

  it("keeps Vercel protection bypass separate from KLYX endpoint auth", () => {
    expect(migration).toContain("klyx_financial_scheduler_token");
    expect(migration).toContain(
      "klyx_vercel_automation_bypass_secret"
    );
    expect(migration).toContain("'Authorization', 'Bearer ' || v_token");
    expect(migration).toContain("'x-vercel-protection-bypass'");
    expect(migration).not.toContain("x-vercel-set-bypass-cookie");
  });

  it("reads both raw automation secrets from Supabase Vault only", () => {
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).not.toContain(
      "alter table public.ops_financial_runtime_scheduler add column"
    );
    expect(migration).not.toMatch(
      /x-vercel-protection-bypass['\"]?\s*[:,=]\s*['\"][A-Za-z0-9_-]{16,}/
    );
    expect(migration).not.toMatch(
      /Bearer\s+[A-Za-z0-9_-]{32,}/
    );
  });

  it("does not weaken scheduler fail-closed behavior", () => {
    expect(migration).toContain("if coalesce(v_enabled, false) is not true");
    expect(migration).toContain("if coalesce(trim(v_token), '') = ''");
    expect(migration).toContain("return null;");
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "revoke all on function public.klyx_invoke_financial_runtime_tick()"
    );
    expect(migration).toContain("to service_role");
  });

  it("keeps Deployment Protection enabled by using automation bypass instead of public exposure", () => {
    expect(migration).toContain("x-vercel-protection-bypass");
    expect(migration).not.toContain("disable deployment protection");
    expect(migration).not.toContain("vercel_auth_enabled=false");
    expect(migration).not.toContain("publicly expose");
  });

  it("preserves the existing internal financial tick endpoint", () => {
    expect(migration).toContain(
      "'/api/ops/financial-runtime-tick'"
    );
    expect(migration).toContain("net.http_post");
    expect(migration).not.toContain("stripe.transfers.create");
    expect(migration).not.toContain("stripe.refunds.create");
    expect(migration).not.toContain("stripe.payouts.create");
  });
});
