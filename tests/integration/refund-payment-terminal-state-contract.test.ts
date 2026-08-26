import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260821163000_klyx_refund_payment_terminal_state.sql"
);
const statusRoute = read("app/api/bookings/status/route.ts");
const refundReconciliation = read("lib/stripe-refunds.ts");
const groupRefunds = read("lib/stripe-group-refunds.ts");
const paymentWebhooks = read("lib/stripe-payments.ts");

describe("KLYX refunded payment terminal state", () => {
  it("extends the canonical paid-booking guard instead of racing a second trigger", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_protect_paid_booking()"
    );
    expect(migration).toContain("drop trigger if exists klyx_booking_refund_payment_terminal_state");
    expect(migration).not.toContain(
      "create trigger klyx_booking_refund_payment_terminal_state"
    );
  });

  it("promotes only full successful refunds to payment_status refunded", () => {
    expect(migration).toContain("new.refund_status = 'succeeded'");
    expect(migration).toContain(
      "coalesce(new.refunded_amount_cents, 0) >= old.amount_total"
    );
    expect(migration).toContain("new.payment_status := 'refunded'");
  });

  it("preserves paid identity immutability while allowing the proven refund transition", () => {
    expect(migration).toContain("KLYX_PAID_BOOKING_IMMUTABLE");
    expect(migration).toContain("KLYX_BOOKING_ALREADY_PAID");
    expect(migration).toContain("new.payment_status = 'refunded'");
    expect(migration).toContain("and full_refund_proven");
  });

  it("blocks late Stripe payment mutations after a refund", () => {
    expect(migration).toContain("old.payment_status = 'refunded'");
    expect(migration).toContain("new.payment_status is distinct from 'refunded'");
    expect(migration).toContain("KLYX_BOOKING_ALREADY_REFUNDED");
  });

  it("backfills historical fully-refunded bookings idempotently", () => {
    expect(migration).toContain("update public.bookings");
    expect(migration).toContain("refund_status = 'succeeded'");
    expect(migration).toContain("payment_status is distinct from 'refunded'");
  });

  it("covers every existing single/group refund writer through the canonical guard", () => {
    expect(statusRoute).toContain("refund.status === \"succeeded\"");
    expect(statusRoute).toContain("refunded_amount_cents: refund.amount");
    expect(refundReconciliation).toContain("refund_status: refundStatus");
    expect(refundReconciliation).toContain("refunded_amount_cents: refund.amount");
    expect(groupRefunds).toContain("refund_status:");
    expect(groupRefunds).toContain('"succeeded"');
    expect(groupRefunds).toContain("refunded_amount_cents:");
  });

  it("makes refunded a no-op in late payment success and failure handlers", () => {
    expect(paymentWebhooks).toMatch(
      /booking\.payment_status\s*===\s*"refunded"/
    );
    expect(paymentWebhooks).toContain('.neq("payment_status", "refunded")');
    expect(paymentWebhooks).toContain("if (!updatedBooking) {");
    expect(paymentWebhooks).toContain('payment_status: "paid"');
    expect(paymentWebhooks).toContain('payment_status: "failed"');
  });
});
