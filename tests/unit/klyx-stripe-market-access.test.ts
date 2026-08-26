import { describe, expect, it } from "vitest";

import { assessKlyxStripeMarketAccess } from "../../lib/klyx-stripe-market-access";

describe("KLYX Stripe market access", () => {
  it("keeps Stripe test mode available for certification", () => {
    const result = assessKlyxStripeMarketAccess("", "test");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("test_mode");
    expect(result.blockers).toEqual([]);
  });

  it("fails closed in live mode when the country is missing", () => {
    const result = assessKlyxStripeMarketAccess("", "live");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("country_required");
    expect(result.blockers).toEqual(["country_code"]);
  });

  it("normalizes country codes before live readiness assessment", () => {
    const result = assessKlyxStripeMarketAccess(" be ", "live");

    expect(result.countryCode).toBe("BE");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("market_not_ready");
    expect(result.blockers).toContain("launch_decision");
  });

  it("does not treat an unknown live country as commercially ready", () => {
    const result = assessKlyxStripeMarketAccess("ZZ", "live");

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("monetary_support");
  });
});
