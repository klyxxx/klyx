import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260911160000_klyx_individual_refund_route_webhook_guard.sql"
);
const refundRoute = source("app/api/bookings/status/route.ts");
const refundReconciliation = source("lib/stripe-refunds.ts");

describe("KLYX individual refund route ↔ webhook race", () => {
  it("preserves terminal webhook refund proof against the stale route writer", () => {
    expect(refundRoute).toContain("await stripe.refunds.create(");
    expect(refundRoute).toContain('refund.status === "succeeded" ? "succeeded" : "processing"');
    expect(refundReconciliation).toContain('payment_status:\n        refundStatus === "succeeded"\n          ? "refunded"');

    expect(migration).toContain(
      "create or replace function public.klyx_protect_paid_booking()"
    );
    expect(migration).toContain("if old.payment_status = 'refunded' then");
    expect(migration).toContain("new.refund_status := old.refund_status");
    expect(migration).toContain("new.stripe_refund_id := old.stripe_refund_id");
    expect(migration).toContain(
      "new.refunded_amount_cents := old.refunded_amount_cents"
    );
    expect(migration).toContain("new.refunded_at := old.refunded_at");
  });

  it("repairs only terminal individual booking snapshots and does not add group logic", () => {
    expect(migration).toContain("where payment_status = 'refunded'");
    expect(migration).toContain("refund_status is distinct from 'succeeded'");
    expect(migration).not.toContain("booking_groups");
    expect(migration).not.toContain("booking_group_id");
    expect(migration).not.toContain("GROUP_REFUND");
  });

  it("keeps the canonical financial guard server-only", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_protect_paid_booking()"
    );
    expect(migration).toContain("from public, anon, authenticated;");
    expect(migration).toContain(
      "grant execute on function public.klyx_protect_paid_booking()"
    );
    expect(migration).toContain("to service_role;");
  });
});
