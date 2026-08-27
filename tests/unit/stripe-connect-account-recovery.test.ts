import { describe, expect, it } from "vitest";

import { isMissingStripeConnectAccount } from "../../lib/stripe-connect-account-recovery";

describe("Stripe Connect stale account recovery", () => {
  it("accepts Stripe resource_missing for the connected account", () => {
    expect(
      isMissingStripeConnectAccount({
        code: "resource_missing",
        param: "account",
      })
    ).toBe(true);

    expect(
      isMissingStripeConnectAccount({
        raw: { code: "resource_missing" },
      })
    ).toBe(true);
  });

  it("does not recover unrelated missing resources or transient errors", () => {
    expect(
      isMissingStripeConnectAccount({
        code: "resource_missing",
        param: "person",
      })
    ).toBe(false);
    expect(
      isMissingStripeConnectAccount({ code: "api_error" })
    ).toBe(false);
    expect(isMissingStripeConnectAccount(new Error("timeout"))).toBe(false);
  });
});
