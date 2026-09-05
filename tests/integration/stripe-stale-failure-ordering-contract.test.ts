import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe stale failure ordering contract", () => {
  it("never records a PaymentIntent failure without its originating Checkout Session", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8"
    );

    expect(route).toContain('case "payment_intent.payment_failed"');
    expect(route).toContain("const checkoutSessionId = sessions.data[0]?.id ?? null;");
    expect(route).toContain("if (!checkoutSessionId)");
    expect(route).toContain(
      "Never let an old PaymentIntent poison a newer KLYX payment attempt."
    );
    expect(route).toContain(
      "recordBookingPaymentFailure(\n            intent,\n            checkoutSessionId"
    );
    expect(route).toContain(
      "recordBookingGroupPaymentFailure(\n            intent,\n            checkoutSessionId"
    );
  });

  it("keeps terminal paid/refunded guards in both simple and group payment failure handlers", () => {
    const simple = readFileSync(
      join(process.cwd(), "lib/stripe-payments.ts"),
      "utf8"
    );
    const group = readFileSync(
      join(process.cwd(), "lib/stripe-group-payments.ts"),
      "utf8"
    );

    expect(simple).toContain('.neq(\n      "payment_status",\n      "paid"');
    expect(simple).toContain('.neq(\n      "payment_status",\n      "refunded"');
    expect(group).toContain('group.payment_status ===\n      "paid"');
    expect(group).toContain('group.payment_status ===\n      "refunded"');
  });
});
