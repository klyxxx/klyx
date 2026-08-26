import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_GROUP_PAYMENT_READINESS_CONTRACT_15_03

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/booking-groups/[id]/page.tsx"),
  "utf8"
);

const readinessRouteSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/booking-groups/[id]/stripe-readiness/route.ts"
  ),
  "utf8"
);

const checkoutSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/stripe/create-group-checkout-session/route.ts"
  ),
  "utf8"
);

describe("KLYX grouped booking payment readiness contract", () => {
  it("gates the payment CTA on business and Stripe readiness", () => {
    expect(pageSource).toContain("KLYX_GROUP_PAYMENT_READINESS_UI_15_03");
    expect(pageSource).toContain("groupData.paymentActionAvailable");
    expect(pageSource).toContain("stripeReadiness?.checkoutReady");
    expect(pageSource).toContain(
      '"/stripe-readiness"'
    );
    expect(pageSource).toContain("Paiement indisponible pour le moment");
  });

  it("keeps readiness fail-closed on market and provider Stripe state", () => {
    expect(readinessRouteSource).toContain(
      "KLYX_GROUP_STRIPE_READINESS_API_15_03"
    );
    expect(readinessRouteSource).toContain("clientMarketAccess.allowed");
    expect(readinessRouteSource).toContain("providerMarketAccess.allowed");
    expect(readinessRouteSource).toContain("providerStripeReady");
    expect(readinessRouteSource).toContain("platformOnlyTestPaymentAllowed");
  });

  it("keeps checkout as the independent final server authority", () => {
    expect(checkoutSource).toContain("assertStripeRuntimeReady()");
    expect(checkoutSource).toContain("clientMarketAccess.allowed");
    expect(checkoutSource).toContain("providerMarketAccess.allowed");
    expect(checkoutSource).toContain("providerReady");
    expect(checkoutSource).toContain("klyx_claim_booking_group_payment");
  });
});
