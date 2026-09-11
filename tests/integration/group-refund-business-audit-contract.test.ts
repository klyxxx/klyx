import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX grouped refund business invariants", () => {
  it("serializes cancellation approval against child mission progress", () => {
    const migration = source(
      "supabase/migrations/20260911151000_klyx_group_refund_transaction_guard.sql"
    );

    expect(migration).toContain("public.klyx_guard_group_refund_claim_2026");
    expect(migration).toMatch(/from public\.bookings[\s\S]*for update;/);
    expect(migration).toContain("KLYX_GROUP_CANCEL_ALREADY_STARTED");
    expect(migration).toContain("KLYX_GROUP_REFUND_TRACKING_CONFLICT");
    expect(migration).toContain(
      "before update of status,\n                 service_status,\n                 provider_finished_at,\n                 client_confirmed_at"
    );
  });

  it("keeps a terminal grouped refund monotone and crash-safe at the DB boundary", () => {
    const migration = source(
      "supabase/migrations/20260911151000_klyx_group_refund_transaction_guard.sql"
    );

    expect(migration).toContain("old.refund_status = 'refunded'");
    expect(migration).toContain("new.refund_status := 'refunded'");
    expect(migration).toContain("KLYX_GROUP_REFUND_TERMINAL_PROOF_INVALID");
    expect(migration).toContain("refund_status = 'succeeded'");
    expect(migration).toContain("'refund_succeeded'");
    expect(migration).toContain(
      "on conflict (booking_group_id, action, stripe_refund_id)"
    );
  });

  it("keeps every new financial trigger function server-only", () => {
    const migration = source(
      "supabase/migrations/20260911151000_klyx_group_refund_transaction_guard.sql"
    );

    for (const name of [
      "klyx_guard_group_refund_claim_2026",
      "klyx_guard_group_refund_booking_transition_2026",
      "klyx_finalize_group_refund_terminal_2026",
    ]) {
      expect(migration).toContain(`revoke all on function public.${name}()`);
      expect(migration).toContain("from public, anon, authenticated;");
      expect(migration).toContain(`grant execute on function public.${name}()`);
    }
  });
});
