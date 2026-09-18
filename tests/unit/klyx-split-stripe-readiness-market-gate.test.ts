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
  it("uses the shared market policy for the client and every canonical provider destination", () => {
    const source = readRoute();

    expect(source).toContain("assessKlyxStripeMarketAccess");
    expect(source).toContain("getStripeRuntimeMode");
    expect(source).toContain("profile.countryCode");
    expect(source).toContain("getProfileAccountStripeConnectIdentity(providerId)");
    expect(source).toContain("providerProfile.country_code");
    expect(source).toContain('blockReason = "CLIENT_MARKET_NOT_READY"');
    expect(source).toContain('blockReason = "PROVIDER_MARKET_NOT_READY"');
  });

  it("checks provider market access before any Stripe network account lookup", () => {
    const source = readRoute();
    const providerDestination = source.indexOf(
      "getProfileAccountStripeConnectIdentity(providerId)"
    );
    const providerGate = source.indexOf("!providerMarketAccess.allowed");
    const accountRetrieve = source.indexOf("stripe.accounts.retrieve");

    expect(providerDestination).toBeGreaterThan(-1);
    expect(providerGate).toBeGreaterThan(providerDestination);
    expect(accountRetrieve).toBeGreaterThan(providerGate);
  });

  it("fails closed on canonical identity review while exposing combined checkout readiness", () => {
    const source = readRoute();

    expect(source).toContain('identity.state === "conflict"');
    expect(source).toContain('"identity_review_required"');
    expect(source).toContain("STRIPE_CONNECT_IDENTITY_CONFLICT");
    expect(source).toContain("STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED");
    expect(source).toContain("allProvidersStripeReady");
    expect(source).toContain(
      "const checkoutReady = clientMarketAccess.allowed && allProvidersStripeReady"
    );
    expect(source).toContain("paymentInfrastructureReady: checkoutReady");
    expect(source).toContain("clientMarketReady: clientMarketAccess.allowed");
  });

  it("does not turn this informative endpoint into the full Stripe runtime barrier", () => {
    const source = readRoute();

    expect(source).not.toContain("assertStripeRuntimeReady");
    expect(source).toContain("process.env.STRIPE_SECRET_KEY");
    expect(source).toContain("explicitPaymentConfirmationRequired: true");
    expect(source).toContain("automaticPayment: false");
  });
});
