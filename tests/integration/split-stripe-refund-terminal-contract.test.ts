import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("split Stripe refund terminal contract", () => {
  it("blocks stale split payment events once refund activity exists", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/split-stripe-payments.ts"),
      "utf8"
    );

    expect(source).toContain("KLYX_SPLIT_REFUND_TERMINAL_GUARD_16_12");
    expect(source).toContain('.select("refund_status, stripe_checkout_session_id")');
    expect(source).toContain('data.refund_status !== "none"');
    expect(source).toContain('event.type === "checkout.session.completed"');
    expect(source).toContain('event.type === "checkout.session.async_payment_succeeded"');
    expect(source).toContain('event.type === "checkout.session.async_payment_failed"');
    expect(source).toContain('event.type === "checkout.session.expired"');
    expect(source).toContain("if (!canMutatePayment)");
  });

  it("also rejects late PaymentIntent failures for refunded split units", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/split-stripe-payments.ts"),
      "utf8"
    );

    expect(source).toContain('.select("status, refund_status, stripe_checkout_session_id")');
    expect(source).toContain(
      'data.status === "paid" || data.refund_status !== "none"'
    );
  });
});
