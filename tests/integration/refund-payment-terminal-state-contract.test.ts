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
  it("promotes only full successful refunds to payment_status refunded", () => {
    expect(migration).toContain("new.refund_status = 'succeeded'");
    expect(migration).toContain("coalesce(new.refunded_amount_cents, 0) >= new.amount_total");
    expect(migration).toContain("new.payment_status := 'refunded'");
  });

  it("blocks late Stripe payment mutations after a refund", () => {
    expect(migration).toContain("old.payment_status = 'refunded'");
    expect(migration).toContain("new.payment_status is distinct from 'refunded'");
    expect(migration).toContain("return null;");
  });

  it("backfills historical fully-refunded bookings idempotently", () => {
    expect(migration).toContain("update public.bookings");
    expect(migration).toContain("refund_status = 'succeeded'");
    expect(migration).toContain("payment_status is distinct from 'refunded'");
  });

  it("covers every existing single/group refund writer through the bookings trigger", () => {
    expect(statusRoute).toContain('refund_status:\n          refund.status === "succeeded" ? "succeeded" : "processing"');
    expect(refundReconciliation).toContain('refund_status: refundStatus');
    expect(groupRefunds).toContain('refund_status:\n            "succeeded"');
  });

  it("keeps payment success and failure mutations on the canonical bookings table", () => {
    expect(paymentWebhooks).toContain('.from("bookings")');
    expect(paymentWebhooks).toContain('payment_status: "paid"');
    expect(paymentWebhooks).toContain('payment_status: "failed"');
  });
});
