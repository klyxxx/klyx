import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Stripe refund financial safety contract", () => {
  it("keeps grouped refund creation idempotent and traceable", () => {
    const route = read(
      "app/api/booking-groups/[id]/cancellation/route.ts"
    );

    expect(route).toContain("stripe.refunds.create");
    expect(route).toContain("idempotencyKey:");
    expect(route).toContain('"klyx-group-refund-"');
    expect(route).toContain("group.id");
    expect(route).toContain("booking_group_id:");
    expect(route).toContain("cancellation_resolution:");
    expect(route).toContain('"approved"');
  });

  it("keeps Stripe refund webhook reconciliation coverage", () => {
    const webhook = read("app/api/stripe/webhook/route.ts");

    expect(webhook).toContain('case "refund.created"');
    expect(webhook).toContain('case "refund.updated"');
    expect(webhook).toContain('case "refund.failed"');
    expect(webhook).toContain('case "charge.refunded"');
    expect(webhook).toContain("await reconcileStripeRefund(refund)");
  });

  it("prevents stale refund attempts from mutating the current payment", () => {
    const singleRefunds = read("lib/stripe-refunds.ts");
    const groupRefunds = read("lib/stripe-group-refunds.ts");

    expect(singleRefunds).toContain(
      "booking.stripe_payment_intent_id !== incomingIntentId"
    );
    expect(singleRefunds).toContain(
      "booking:${booking.id}:refund:${refund.id}"
    );

    expect(groupRefunds).toContain(
      "group.stripe_payment_intent_id !== incomingIntentId"
    );
    expect(groupRefunds).toContain(
      "KLYX_GROUP_REFUND_AGGREGATE_EXCEEDS_TOTAL"
    );
    expect(groupRefunds).toContain(
      "booking:${child.id}:group-refund:${params.refund.id}"
    );
  });

  it("keeps succeeded ledger and split refund facts terminal in PostgreSQL", () => {
    const migration = read(
      "supabase/migrations/20260826193000_klyx_refund_reconciliation_monotonicity.sql"
    );

    expect(migration).toContain(
      "klyx_preserve_succeeded_financial_ledger_16_11"
    );
    expect(migration).toContain("old.status = 'succeeded'");
    expect(migration).toContain(
      "new.status is distinct from 'succeeded'"
    );
    expect(migration).toContain("return old;");
    expect(migration).toContain(
      "klyx_preserve_succeeded_split_refund_16_11"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.booking_financial_ledger"
    );
    expect(migration).toContain("from public, anon, authenticated;");
  });
});
