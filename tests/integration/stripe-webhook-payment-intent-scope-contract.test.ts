import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("stripe payment intent webhook scope contract", () => {
  it("ignores unrelated payment intents before KLYX booking reconciliation", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8"
    );

    expect(source).toContain("function isKlyxPaymentIntent(");
    expect(source).toContain("intent.metadata?.booking_id");
    expect(source).toContain("intent.metadata?.booking_group_id");

    const succeededCase = source.indexOf('case "payment_intent.succeeded"');
    const failedCase = source.indexOf('case "payment_intent.payment_failed"');

    expect(succeededCase).toBeGreaterThan(-1);
    expect(failedCase).toBeGreaterThan(-1);

    const succeededGuard = source.indexOf(
      "if (!isKlyxPaymentIntent(intent))",
      succeededCase
    );
    const succeededList = source.indexOf(
      "stripe.checkout.sessions.list({",
      succeededCase
    );

    const failedGuard = source.indexOf(
      "if (!isKlyxPaymentIntent(intent))",
      failedCase
    );
    const failedList = source.indexOf(
      "stripe.checkout.sessions.list({",
      failedCase
    );

    expect(succeededGuard).toBeGreaterThan(succeededCase);
    expect(succeededList).toBeGreaterThan(succeededGuard);
    expect(failedGuard).toBeGreaterThan(failedCase);
    expect(failedList).toBeGreaterThan(failedGuard);
  });
});
