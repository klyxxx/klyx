import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe checkout expiry recovery contract", () => {
  it("releases expired single and group checkout sessions without touching paid states", () => {
    const webhook = readFileSync(
      join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8"
    );

    expect(webhook).toContain('case "checkout.session.expired"');
    expect(webhook).toContain('"klyx_release_expired_booking_checkout"');
    expect(webhook).toContain('.eq("stripe_checkout_session_id", session.id)');
    expect(webhook).toContain('.neq("payment_status", "paid")');
    expect(webhook).toContain('.neq("payment_status", "refunded")');
    expect(webhook).toContain('payment_failure_code: "checkout_expired"');
  });

  it("keeps retry creation idempotent after an expired checkout", () => {
    const singleCheckout = readFileSync(
      join(process.cwd(), "app/api/stripe/create-checkout-session/route.ts"),
      "utf8"
    );
    const groupCheckout = readFileSync(
      join(process.cwd(), "app/api/stripe/create-group-checkout-session/route.ts"),
      "utf8"
    );

    expect(singleCheckout).toContain("klyx_release_expired_booking_checkout");
    expect(singleCheckout).toContain("idempotencyKey: `klyx-booking-${booking.id}-attempt-${claim.attempt_number}`");
    expect(groupCheckout).toContain('existing.status !== "expired"');
    expect(groupCheckout).toContain('"klyx-booking-group-" +');
  });
});
