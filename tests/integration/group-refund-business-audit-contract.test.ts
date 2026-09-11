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

    expect(migration).toContain("public.klyx_resolve_group_cancellation");
    expect(migration).toMatch(/from public\.bookings[\s\S]*for update;/);
    expect(migration).toContain("KLYX_GROUP_CANCEL_ALREADY_STARTED");
    expect(migration).toContain("KLYX_GROUP_REFUND_TRACKING_CONFLICT");
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
});
