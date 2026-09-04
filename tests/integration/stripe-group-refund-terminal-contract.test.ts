import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe group refund terminal contract", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/stripe-group-refunds.ts"),
    "utf8"
  );

  it("ignores refunds tied to an older PaymentIntent", () => {
    expect(source).toContain("group.stripe_payment_intent_id !==\n      incomingIntentId");
    expect(source).toContain("return true;");
  });

  it("routes unexpected successful partial refunds to manual review", () => {
    expect(source).toContain("const partialSucceededRefund");
    expect(source).toContain('state = "review_required"');
    expect(source).not.toContain("KLYX refuse un remboursement partiel");
  });

  it("keeps review_required monotone against later non-terminal events", () => {
    expect(source).toContain('group.refund_status === "review_required"');
    expect(source).toContain('state !== "refunded"');
  });

  it("marks child bookings refunded only after a full group refund", () => {
    expect(source).toContain('payment_status:\n            "refunded"');
    expect(source).toContain('refund_status:\n            "succeeded"');
  });
});
