import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/stripe/create-group-checkout-session/route.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX group checkout live market gates", () => {
  it("checks the shared market policy for both participants", () => {
    const source = readRoute();

    expect(source).toContain("assessKlyxStripeMarketAccess");
    expect(source).toContain("profile.countryCode");
    expect(source).toContain("provider?.country_code");
    expect(source).toMatch(/participant:\s*"client"/);
    expect(source).toMatch(/participant:\s*"provider"/);
    expect(
      source.match(/KLYX_GROUP_CHECKOUT_MARKET_NOT_READY/g)?.length
    ).toBe(2);
  });

  it("checks both live markets before creating a Checkout session", () => {
    const source = readRoute();
    const clientGate = source.indexOf("clientMarketAccess.allowed");
    const providerGate = source.indexOf("providerMarketAccess.allowed");
    const checkoutCreate = source.indexOf("stripe.checkout.sessions.create(");

    expect(clientGate).toBeGreaterThan(-1);
    expect(providerGate).toBeGreaterThan(-1);
    expect(checkoutCreate).toBeGreaterThan(-1);
    expect(clientGate).toBeLessThan(checkoutCreate);
    expect(providerGate).toBeLessThan(checkoutCreate);
  });
});
