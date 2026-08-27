import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";

const root = process.cwd();
const statusRoute = fs
  .readFileSync(
    path.join(root, "app/api/stripe/connect/status/route.ts"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

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

  it("forces provider status readiness closed on mismatch", () => {
    expect(statusRoute).toContain("stripeAccountCountryMismatch");
    expect(statusRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(statusRoute).toContain("countryMismatch ? false : readiness.livePaymentsOperational");
  });
});
