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
  it("uses the reviewed market readiness matrix only for live Stripe mode", () => {
    const source = readRoute();

    expect(source).toContain("const stripeRuntime = assertStripeRuntimeReady()");
    expect(source).toContain('stripeRuntime.mode === "live"');
    expect(source).toContain("getKlyxMarketReadiness(accountCountry)");
    expect(source).toContain("assessKlyxMarketReadiness(marketReadiness)");
    expect(source).toContain("KLYX_MARKET_NOT_COMMERCIALLY_READY");
  });

  it("fails closed before creating a live Connect account", () => {
    const source = readRoute();
    const guardIndex = source.indexOf("KLYX_MARKET_NOT_COMMERCIALLY_READY");
    const accountCreationIndex = source.indexOf("stripe.accounts.create");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(accountCreationIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(accountCreationIndex);
  });
});
