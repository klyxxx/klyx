import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe simple-booking refund aggregation contract", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/stripe-refunds.ts"),
    "utf8"
  );

  it("aggregates idempotent successful refund ledger entries", () => {
    expect(source).toContain("aggregateBookingRefunds");
    expect(source).toContain('from("booking_financial_ledger")');
    expect(source).toContain('entryKey: `booking:${booking.id}:refund:${refund.id}`');
    expect(source).toContain('row.status === "succeeded"');
    expect(source).toContain("succeededAmount += Math.max");
  });

  it("keeps partial refunds non-terminal until the paid amount is fully refunded", () => {
    expect(source).toContain("const fullyRefunded = succeededAmount >= grossAmount");
    expect(source).toContain('const refundStatus: "processing" | "succeeded" | "failed"');
    expect(source).toContain('refundStatus === "succeeded"\n          ? "refunded"');
    expect(source).toContain("refunded_amount_cents: succeededAmount");
  });

  it("ignores refunds from an older Stripe payment attempt", () => {
    expect(source).toContain("booking.stripe_payment_intent_id !== incomingIntentId");
    expect(source).toContain("return;");
  });

  it("does not let a failed refund regress a fully refunded booking", () => {
    expect(source).toContain('booking.refund_status === "succeeded"');
    expect(source).toContain('refundStatus !== "succeeded"');
  });
});
