import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/stripe/create-checkout-session/route-core.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX single checkout global market gate", () => {
  it("uses payer country, execution country, currency and service policy", () => {
    const source = readRoute();

    expect(source).toContain("resolveKlyxMarketPaymentPolicy");
    expect(source).toContain("payerCountryCode");
    expect(source).toContain("executionCountryCode");
    expect(source).toContain("presentmentCurrency");
    expect(source).toContain("serviceSlug: service.slug");
    expect(source).toContain(
      "getProfileAccountStripeConnectIdentity(providerId)"
    );
    expect(source).toContain("provider?.country_code");
    expect(source).not.toContain("assessKlyxStripeMarketAccess");
  });

  it("fails closed in LIVE before creating Checkout when policy is absent or blocked", () => {
    const source = readRoute();
    const policyResolve = source.indexOf(
      "await resolveKlyxMarketPaymentPolicy"
    );
    const liveFailClosed = source.indexOf(
      'stripeRuntime.mode === "live"'
    );
    const checkoutCreate = source.indexOf(
      "stripe.checkout.sessions.create"
    );

    expect(policyResolve).toBeGreaterThan(-1);
    expect(liveFailClosed).toBeGreaterThan(-1);
    expect(checkoutCreate).toBeGreaterThan(-1);
    expect(policyResolve).toBeLessThan(checkoutCreate);
    expect(liveFailClosed).toBeLessThan(checkoutCreate);
    expect(source).toContain("KLYX_CHECKOUT_MARKET_NOT_READY");
    expect(source).toContain("stripe_currency_capability");
  });
});
