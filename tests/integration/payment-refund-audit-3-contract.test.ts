import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const migration = read(
  "supabase/migrations/20260910183000_klyx_refund_terminal_atomicity.sql"
);
const statusRoute = read("app/api/bookings/status/route.ts");
const stripeRefunds = read("lib/stripe-refunds.ts");
const stripePayments = read("lib/stripe-payments.ts");
const webhook = read("app/api/stripe/webhook/route.ts");
const webhookEvents = read("lib/stripe-webhook-events.ts");
const groupRefunds = read("lib/stripe-group-refunds.ts");
const groupCancellation = read(
  "app/api/booking-groups/[id]/cancellation/route.ts"
);
const groupLifecycle = read("lib/booking-group-lifecycle.ts");
const splitPayments = read("lib/split-stripe-payments.ts");
const refundMonotonicity = read(
  "supabase/migrations/20260826193000_klyx_refund_reconciliation_monotonicity.sql"
);

describe("AUDIT METIER 3 — payment to refund", () => {
  it("keeps individual refund authority server-owned and idempotent", () => {
    expect(statusRoute).toContain('.eq("payment_status", "paid")');
    expect(statusRoute).toContain("amount: booking.amount_total");
    expect(statusRoute).toContain(
      "idempotencyKey: `klyx-booking-refund-${booking.id}`"
    );
    expect(statusRoute).toContain("booking.parent_id === profile.id");
    expect(statusRoute).toContain("providerId === profile.id");
    expect(statusRoute).toContain("await getAuthenticatedProfile(request)");
  });

  it("keeps signed Stripe refund reconciliation aggregate-bounded", () => {
    expect(webhook).toContain("stripe.webhooks.constructEvent");
    expect(webhook).toContain('case "refund.created"');
    expect(webhook).toContain('case "refund.updated"');
    expect(webhook).toContain('case "refund.failed"');
    expect(webhook).toContain('case "charge.refunded"');
    expect(webhook).toContain("await reconcileStripeRefund(refund)");

    expect(stripeRefunds).toContain(
      "booking.stripe_payment_intent_id !== incomingIntentId"
    );
    expect(stripeRefunds).toContain(
      "booking:${booking.id}:refund:${refund.id}"
    );
    expect(stripeRefunds).toContain(
      "Math.min(aggregate.succeededAmount, grossAmount)"
    );
    expect(stripeRefunds).toContain('.neq("refund_status", "succeeded")');
  });

  it("makes an already refunded booking proof terminal against stale route writes", () => {
    expect(migration).toContain("KLYX_REFUND_TERMINAL_ATOMICITY_17_02");
    expect(migration).toContain("if old.payment_status = 'refunded' then");
    expect(migration).toContain("new.refund_status := old.refund_status");
    expect(migration).toContain("new.stripe_refund_id := old.stripe_refund_id");
    expect(migration).toContain(
      "new.refunded_amount_cents := old.refunded_amount_cents"
    );
    expect(migration).toContain("new.refunded_at := old.refunded_at");
    expect(migration).toContain("KLYX_BOOKING_ALREADY_REFUNDED");
  });

  it("keeps late payment success/failure from overriding refunded success", () => {
    expect(stripePayments).toContain(
      'if (booking.payment_status === "refunded")'
    );
    expect(stripePayments).toContain('.neq("payment_status", "refunded")');
    expect(stripePayments).toContain('.neq("payment_status", "paid")');
    expect(refundMonotonicity).toContain(
      "klyx_preserve_succeeded_financial_ledger_16_11"
    );
    expect(refundMonotonicity).toContain("old.status = 'succeeded'");
    expect(refundMonotonicity).toContain("return old;");
  });

  it("keeps webhook retries reclaimable after a crash", () => {
    expect(webhookEvents).toContain('stored.status === "processed"');
    expect(webhookEvents).toContain('stored.status === "processing"');
    expect(webhookEvents).toContain("STALE_PROCESSING_MS");
    expect(webhookEvents).toContain('stored.status === "failed"');
    expect(webhookEvents).toContain("retry_claim_lost");
  });

  it("serializes paid group refund claim against child mission progress", () => {
    expect(migration).toContain("KLYX_GROUP_REFUND_REQUIRES_PAID");
    expect(migration).toContain("KLYX_GROUP_REFUND_CHILD_ALREADY_STARTED");
    expect(migration).toContain("KLYX_GROUP_REFUND_CHILD_PROGRESS_CONFLICT");
    expect(migration).toContain("from public.booking_groups parent");
    expect(migration).toContain("for update;");
    expect(migration).toContain("child.provider_finished_at is not null");
    expect(migration).toContain("'in_progress'");
    expect(groupLifecycle).toContain('status:\n        "completed"');
    expect(groupLifecycle).toContain('.eq(\n      "status",\n      "accepted"');
  });

  it("makes grouped terminal refund state atomic with children and audit", () => {
    expect(groupRefunds).toContain(
      'if (group.refund_status === "refunded") return true;'
    );
    expect(migration).toContain("klyx_finalize_group_refund_17_02");
    expect(migration).toContain("after update of refund_status");
    expect(migration).toContain("new.refund_status = 'refunded'");
    expect(migration).toContain("update public.bookings child");
    expect(migration).toContain("payment_status = 'refunded'");
    expect(migration).toContain("refund_status = 'succeeded'");
    expect(migration).toContain("booking_group_cancellation_events");
    expect(migration).toContain("'refund_succeeded'");
    expect(migration).toContain(
      "on conflict (booking_group_id, action, stripe_refund_id)"
    );
  });

  it("prevents stale group failure writes from erasing Stripe success", () => {
    expect(groupCancellation).toContain('refund_status:\n            "failed"');
    expect(migration).toContain("if old.refund_status = 'refunded' then");
    expect(migration).toContain("if old.refund_status = 'review_required'");
    expect(migration).toContain("KLYX_GROUP_ALREADY_REFUNDED");
    expect(migration).toContain("KLYX_GROUP_REFUND_TERMINAL_PROOF_INVALID");
  });

  it("keeps split payment snapshots terminal once refund activity starts", () => {
    expect(splitPayments).toContain("KLYX_SPLIT_REFUND_TERMINAL_GUARD_16_12");
    expect(splitPayments).toContain('data.refund_status !== "none"');
    expect(refundMonotonicity).toContain(
      "klyx_preserve_succeeded_split_refund_16_11"
    );
  });
});
