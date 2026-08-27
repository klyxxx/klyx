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

describe("KLYX live Stripe Connect market gate", () => {
  it("uses the dedicated runtime configuration for preparatory Connect onboarding", () => {
    const source = readRoute();

    expect(source).toContain(
      "const stripeRuntime = assertStripeConnectRuntimeConfigured()"
    );
    expect(source).toContain('stripeRuntime.mode === "live"');
    expect(source).toContain("getKlyxMarketReadiness(accountCountry)");
    expect(source).toContain(
      'marketReadiness.monetarySupport !== "supported"'
    );
    expect(source).toContain("KLYX_STRIPE_COUNTRY_UNSUPPORTED");
    expect(source).not.toContain("assessKlyxMarketReadiness(marketReadiness)");
  });

  it("fails closed on an unsupported monetary country before creating a live Connect account", () => {
    const source = readRoute();
    const guardIndex = source.indexOf("KLYX_STRIPE_COUNTRY_UNSUPPORTED");
    const accountCreationIndex = source.indexOf("stripe.accounts.create");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(accountCreationIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(accountCreationIndex);
  });
});
