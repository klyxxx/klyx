import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260918213000_klyx_platform_held_group_refund_hardening.sql"
  ),
  "utf8"
);

describe("multi-executor group refund hardening migration", () => {
  it("keeps complete PL/pgSQL function bodies in one transaction", () => {
    const functionCount =
      source.match(/create or replace function public\./g)?.length ?? 0;
    const openCount = source.match(/^as \$\$$/gm)?.length ?? 0;
    const closeCount = source.match(/^\$\$;$/gm)?.length ?? 0;
    const commitCount = source.match(/^commit;$/gm)?.length ?? 0;

    expect(functionCount).toBe(2);
    expect(openCount).toBe(functionCount);
    expect(closeCount).toBe(functionCount);
    expect(commitCount).toBe(1);
  });

  it("enforces deterministic cumulative refund allocation in SQL", () => {
    const compact = source.replace(/\s+/g, " ");

    expect(compact).toContain(
      "create trigger platform_held_group_refund_allocation_policy_guard"
    );
    expect(compact).toContain(
      "before insert or update of gross_refund_cents, platform_fee_refund_cents, provider_refund_cents"
    );
    expect(compact).toContain(
      "v_target_fee := round( v_member.platform_fee_cents::numeric * v_cumulative_gross::numeric / v_member.gross_amount_cents::numeric )::bigint"
    );
    expect(compact).toContain(
      "KLYX_GROUP_HELD_REFUND_ALLOCATION_POLICY_MISMATCH"
    );
  });

  it("allows successful Stripe truth to finalize an inflight refund", () => {
    const compact = source.replace(/\s+/g, " ");

    expect(compact).toContain(
      "create or replace function public.klyx_finalize_platform_held_group_refund"
    );
    expect(compact).toContain(
      "if v_refund.state not in ('ready', 'refunding')"
    );
    expect(compact).toContain(
      "or (v_refund.stripe_refund_id is not null and v_refund.stripe_refund_id <> p_stripe_refund_id)"
    );
  });

  it("keeps both hardening functions server-only", () => {
    const compact = source.replace(/\s+/g, " ");

    expect(compact).toContain(
      "revoke all on function public.klyx_guard_platform_held_group_refund_allocation_policy() from public, anon, authenticated"
    );
    expect(compact).toContain(
      "grant execute on function public.klyx_guard_platform_held_group_refund_allocation_policy() to service_role"
    );
    expect(compact).toContain(
      "revoke all on function public.klyx_finalize_platform_held_group_refund( uuid, text, bigint, text ) from public, anon, authenticated"
    );
  });
});
