import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/bookings/split-missions/[id]/checkout/route.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX split checkout live market gates", () => {
  it("uses the shared market policy for the client and every provider", () => {
    const source = readRoute();

    expect(source).toContain("assessKlyxStripeMarketAccess");
    expect(source).toContain("profile.countryCode");
    expect(source).toContain("provider.country_code");
    expect(source).toContain('participant:\n            "client"');
    expect(source).toContain('participant:\n              "provider"');
    expect(source.match(/SPLIT_CHECKOUT_MARKET_NOT_READY/g)?.length).toBe(2);
  });

  it("checks the client market before payment preparation", () => {
    const source = readRoute();
    const clientGate = source.indexOf("clientMarketAccess.allowed");
    const paymentLookup = source.indexOf("split_booking_payment_confirmations");

    expect(clientGate).toBeGreaterThan(-1);
    expect(paymentLookup).toBeGreaterThan(-1);
    expect(clientGate).toBeLessThan(paymentLookup);
  });

  it("checks each provider market before live Stripe account lookup", () => {
    const source = readRoute();
    const providerGate = source.indexOf("providerMarketAccess.allowed");
    const accountRetrieve = source.indexOf("stripe.accounts.retrieve");
    const checkoutCreate = source.indexOf("stripe.checkout.sessions.create");

    expect(providerGate).toBeGreaterThan(-1);
    expect(accountRetrieve).toBeGreaterThan(-1);
    expect(checkoutCreate).toBeGreaterThan(-1);
    expect(providerGate).toBeLessThan(accountRetrieve);
    expect(providerGate).toBeLessThan(checkoutCreate);
  });
});
