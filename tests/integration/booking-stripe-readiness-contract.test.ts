import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_BOOKING_STRIPE_READINESS_CONTRACT_15_05

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/[id]/page.tsx"),
  "utf8"
);

const readinessSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/[id]/stripe-readiness/route.ts"
  ),
  "utf8"
);

const checkoutSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/stripe/create-checkout-session/route.ts"
  ),
  "utf8"
);

describe("KLYX single-booking Stripe readiness contract", () => {
  it("gates the booking payment CTA on Stripe readiness", () => {
    expect(pageSource).toContain("KLYX_BOOKING_STRIPE_READINESS_UI_15_05");
    expect(pageSource).toContain("/stripe-readiness");
    expect(pageSource).toContain("stripeReadiness?.checkoutReady");
    expect(pageSource).toContain("paymentEligible && !canPay");
    expect(pageSource).toContain("if (!stripeReadiness?.checkoutReady)");
  });

  it("keeps the readiness endpoint fail-closed for markets and provider Stripe", () => {
    expect(readinessSource).toContain("KLYX_BOOKING_STRIPE_READINESS_API_15_05");
    expect(readinessSource).toContain("clientMarketAccess.allowed");
    expect(readinessSource).toContain("providerMarketAccess.allowed");
    expect(readinessSource).toContain("providerStripeReady");
    expect(readinessSource).toContain("platformOnlyTestPaymentAllowed");
    expect(readinessSource).toContain("split_booking_batch_items");
  });

  it("keeps the POST checkout as the independent final authority", () => {
    expect(checkoutSource).toContain("assertStripeRuntimeReady()");
    expect(checkoutSource).toContain("clientMarketAccess.allowed");
    expect(checkoutSource).toContain("providerMarketAccess.allowed");
    expect(checkoutSource).toContain("providerReady");
    expect(checkoutSource).toContain("klyx_claim_booking_payment");
  });
});
