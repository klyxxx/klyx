import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260906083000_klyx_public_availability_rpc_hardening.sql"
  ),
  "utf8"
);

describe("KLYX public availability RPC hardening", () => {
  it("moves the privileged publication predicate behind an internal schema", () => {
    expect(migration).toContain("create schema if not exists klyx_private");
    expect(migration).toContain(
      "create or replace function klyx_private.klyx_public_provider_service("
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("preserves every public provider-service publication gate", () => {
    expect(migration).toContain("user_service.active = true");
    expect(migration).toContain("user_service.provider_enabled = true");
    expect(migration).toContain("service_profile.available = true");
    expect(migration).toContain("provider_profile.is_published = true");
    expect(migration).toContain("verification.status = 'approved'");
  });

  it("keeps browser reads behind RLS without calling exposed public RPCs", () => {
    expect(migration).toContain('create policy "klyx_availability_select"');
    expect(migration).toContain(
      "klyx_private.klyx_public_provider_service(user_service_id)"
    );
    expect(migration).toContain(
      "klyx_private.klyx_public_provider_service(id)"
    );
    expect(migration).not.toContain(
      "using (\n    public.klyx_public_availability_service(user_service_id)"
    );
  });

  it("makes both legacy public wrappers service-role only", () => {
    for (const signature of [
      "public.klyx_public_provider_service(uuid)",
      "public.klyx_public_availability_service(uuid)",
    ]) {
      expect(migration).toContain(
        `revoke all privileges on function ${signature}\n  from public, anon, authenticated, service_role;`
      );
      expect(migration).toContain(
        `grant execute on function ${signature}\n  to service_role;`
      );
    }

    expect(migration).not.toContain(
      "grant execute on function public.klyx_public_provider_service(uuid)\n  to anon"
    );
    expect(migration).not.toContain(
      "grant execute on function public.klyx_public_availability_service(uuid)\n  to anon"
    );
  });

  it("fails closed on future browser EXECUTE leaks or RLS regression", () => {
    expect(migration).toContain(
      "KLYX_AVAILABILITY_RPC_SENTINEL_BROWSER_EXECUTE_LEAK"
    );
    expect(migration).toContain(
      "KLYX_AVAILABILITY_RPC_SENTINEL_PUBLIC_POLICY_DEPENDENCY"
    );
    expect(migration).toContain("array['anon', 'authenticated']");
  });
});
