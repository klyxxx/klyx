import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/stripe/connect/create-account/route.ts"
);

function readRoute() {
  expect(fs.existsSync(routePath)).toBe(true);
  return fs.readFileSync(routePath, "utf8");
}

describe("KLYX live Stripe Connect country capability gate", () => {
  it("uses runtime configuration and Stripe Country Specs for preparatory onboarding", () => {
    const source = readRoute();

    expect(source).toContain(
      "const stripeRuntime = assertStripeConnectRuntimeConfigured()"
    );
    expect(source).toContain('stripeRuntime.mode === "live"');
    expect(source).toContain("stripe.countrySpecs.retrieve(accountCountry)");
    expect(source).toContain("KLYX_STRIPE_COUNTRY_UNSUPPORTED");
    expect(source).toContain("accountCurrency");
    expect(source).toContain("KLYX_STRIPE_CURRENCY_REQUIRED");
    expect(source).not.toContain("KLYX_SUPPORTED_MARKETS");
    expect(source).not.toContain("getKlyxMarketReadiness");
  });

  it("checks Stripe country capability before creating a live Connect account", () => {
    const source = readRoute();
    const countrySpecIndex = source.indexOf(
      "stripe.countrySpecs.retrieve(accountCountry)"
    );
    const accountCreationIndex = source.indexOf("stripe.accounts.create");

    expect(countrySpecIndex).toBeGreaterThan(-1);
    expect(accountCreationIndex).toBeGreaterThan(-1);
    expect(countrySpecIndex).toBeLessThan(accountCreationIndex);
  });

  it("does not hardcode EUR for TEST connected-account defaults", () => {
    const source = readRoute();

    expect(source).toContain("currency: input.currencyCode.toLowerCase()");
    expect(source).not.toContain('currency: "eur"');
  });
});
