import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/bookings/split-missions/[id]/stripe-readiness/route.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX split Stripe readiness live market alignment", () => {
  it("uses the shared market policy for the client and every provider", () => {
    const source = readRoute();

    expect(source).toContain("assessKlyxStripeMarketAccess");
    expect(source).toContain("getStripeRuntimeMode");
    expect(source).toContain("profile.countryCode");
    expect(source).toContain("providerProfile.country_code");
    expect(source).toContain('blockReason = "CLIENT_MARKET_NOT_READY"');
    expect(source).toContain('blockReason = "PROVIDER_MARKET_NOT_READY"');
  });

  it("checks provider market access before any Stripe account lookup", () => {
    const source = readRoute();
    const providerGate = source.indexOf("!providerMarketAccess.allowed");
    const accountIdLookup = source.indexOf("stripeAccountId(providerProfile)");
    const accountRetrieve = source.indexOf("stripe.accounts.retrieve");

    expect(providerGate).toBeGreaterThan(-1);
    expect(accountIdLookup).toBeGreaterThan(-1);
    expect(accountRetrieve).toBeGreaterThan(-1);
    expect(providerGate).toBeLessThan(accountIdLookup);
    expect(providerGate).toBeLessThan(accountRetrieve);
  });

  it("keeps provider Stripe readiness separate while exposing combined checkout readiness", () => {
    const source = readRoute();

    expect(source).toContain("allProvidersStripeReady");
    expect(source).toContain(
      "const checkoutReady = clientMarketAccess.allowed && allProvidersStripeReady"
    );
    expect(source).toContain("paymentInfrastructureReady: checkoutReady");
    expect(source).toContain("clientMarketReady: clientMarketAccess.allowed");
    expect(source).toContain('state: "market_not_ready"');
  });

  it("does not turn this informative endpoint into the full Stripe runtime barrier", () => {
    const source = readRoute();

    expect(source).not.toContain("assertStripeRuntimeReady");
    expect(source).toContain("process.env.STRIPE_SECRET_KEY");
    expect(source).toContain("explicitPaymentConfirmationRequired: true");
    expect(source).toContain("automaticPayment: false");
  });
});
