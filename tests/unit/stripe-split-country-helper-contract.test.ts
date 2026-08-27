import { describe, expect, it } from "vitest";

import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";

describe("split Stripe Connect country helper", () => {
  it("accepts the same normalized ISO country", () => {
    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "be",
        stripeCountryCode: "BE",
      })
    ).toEqual({
      klyxCountryCode: "BE",
      stripeCountryCode: "BE",
      matches: true,
      blocker: null,
    });
  });

  it("fails closed on mismatch or incomplete country", () => {
    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "BE",
        stripeCountryCode: "FR",
      }).blocker
    ).toBe(STRIPE_ACCOUNT_COUNTRY_MISMATCH);

    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "BE",
        stripeCountryCode: null,
      }).matches
    ).toBe(false);
  });
});
