import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe payment_intent success reconciliation contract", () => {
  it("reconciles successful KLYX PaymentIntents through their Checkout Session", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8"
    );

    expect(source).toContain('case "payment_intent.succeeded"');
    expect(source).toContain("if (!isKlyxPaymentIntent(intent))");
    expect(source).toContain("stripe.checkout.sessions.list({");
    expect(source).toContain("payment_intent: intent.id");
    expect(source).toContain("await stripe.checkout.sessions.retrieve(");
    expect(source).toContain('if (session.payment_status !== "paid")');
    expect(source).toContain("await markBookingPaidFromSession(session)");
    expect(source).toContain("await markBookingGroupPaidFromSession(session)");
  });
});
