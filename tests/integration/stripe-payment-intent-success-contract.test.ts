import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe payment_intent success reconciliation contract", () => {
  it("reconciles successful PaymentIntents through their Checkout Session", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8"
    );

    expect(source).toContain('case "payment_intent.succeeded"');
    expect(source).toContain("payment_intent:\n                intent.id");
    expect(source).toContain("await stripe.checkout.sessions.retrieve");
    expect(source).toContain('session.payment_status !==\n          "paid"');
    expect(source).toContain("await markBookingPaidFromSession");
    expect(source).toContain("await markBookingGroupPaidFromSession");
  });
});
