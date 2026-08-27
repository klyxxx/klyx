import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/stripe/connect/status/route.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX Stripe Connect status market readiness", () => {
  it("uses the shared Stripe market access policy with the provider country", () => {
    const source = readRoute();

    expect(source).toContain("assessKlyxStripeMarketAccess");
    expect(source).toContain("activeProfile.countryCode");
    expect(source).toContain("stripeRuntime.mode");
  });

  it("preserves technical Stripe fields while exposing market readiness separately", () => {
    const source = readRoute();

    expect(source).toContain("connected");
    expect(source).toContain("onboardingComplete");
    expect(source).toContain("chargesEnabled");
    expect(source).toContain("payoutsEnabled");
    expect(source).toContain("marketCountryCode: marketAccess.countryCode");
    expect(source).toContain("marketReady: marketAccess.allowed");
    expect(source).toContain("marketReason: marketAccess.reason");
    expect(source).toContain("marketBlockers: marketAccess.blockers");
    expect(source).toContain("commerciallyReady");
  });

  it("never reports commercial readiness from Stripe technical state alone", () => {
    const source = readRoute();

    expect(source).toContain(
      "marketAccess.allowed &&\n      onboardingComplete &&\n      chargesEnabled &&\n      payoutsEnabled"
    );
    expect(source).toContain("commerciallyReady: false");
  });

  it("keeps the status endpoint read-only with respect to market access", () => {
    const source = readRoute();

    expect(source).toContain("stripe.accounts.retrieve");
    expect(source).not.toContain("KLYX_MARKET_NOT_COMMERCIALLY_READY");
    expect(source).not.toContain("KLYX_CHECKOUT_MARKET_NOT_READY");
  });
});
