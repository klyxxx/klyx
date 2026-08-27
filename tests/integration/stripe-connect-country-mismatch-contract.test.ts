import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";

const root = process.cwd();

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const statusRoute = read("app/api/stripe/connect/status/route.ts");
const checkoutRoute = read(
  "app/api/stripe/create-checkout-session/route.ts"
);
const groupCheckoutRoute = read(
  "app/api/stripe/create-group-checkout-session/route.ts"
);

describe("Stripe Connect country invariant", () => {
  it("accepts the same normalized country", () => {
    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "be",
        stripeCountryCode: "BE",
      })
    ).toMatchObject({
      matches: true,
      blocker: null,
      klyxCountryCode: "BE",
      stripeCountryCode: "BE",
    });
  });

  it("fails closed when KLYX and Stripe countries differ", () => {
    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "BE",
        stripeCountryCode: "FR",
      })
    ).toMatchObject({
      matches: false,
      blocker: STRIPE_ACCOUNT_COUNTRY_MISMATCH,
    });
  });

  it("fails closed for missing or invalid country data", () => {
    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "",
        stripeCountryCode: "BE",
      }).matches
    ).toBe(false);

    expect(
      assessStripeConnectCountry({
        klyxCountryCode: "BE",
        stripeCountryCode: null,
      }).matches
    ).toBe(false);
  });

  it("forces provider status readiness closed on mismatch", () => {
    expect(statusRoute).toContain("stripeAccountCountryMismatch");
    expect(statusRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(statusRoute).toContain(
      "countryMismatch ? false : readiness.livePaymentsOperational"
    );
  });

  it("revalidates Stripe account country before simple checkout", () => {
    expect(checkoutRoute).toContain("stripe.accounts.retrieve");
    expect(checkoutRoute).toContain("assessStripeConnectCountry");
    expect(checkoutRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(checkoutRoute).toContain("providerStripeAccount?.details_submitted");
    expect(checkoutRoute).toContain("providerStripeAccount.charges_enabled");
    expect(checkoutRoute).toContain("providerStripeAccount.payouts_enabled");
  });

  it("revalidates Stripe account country before group checkout", () => {
    expect(groupCheckoutRoute).toContain("stripe.accounts.retrieve");
    expect(groupCheckoutRoute).toContain("assessStripeConnectCountry");
    expect(groupCheckoutRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(groupCheckoutRoute).toContain(
      "providerStripeAccount?.details_submitted"
    );
    expect(groupCheckoutRoute).toContain("providerStripeAccount.charges_enabled");
    expect(groupCheckoutRoute).toContain("providerStripeAccount.payouts_enabled");
  });
});
