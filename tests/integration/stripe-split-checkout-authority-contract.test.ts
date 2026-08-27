import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/checkout/route.ts"
  ),
  "utf8"
);

describe("split checkout authority invariants", () => {
  it("keeps proof, live booking, provider and idempotency guards", () => {
    for (const marker of [
      "SPLIT_PAYMENT_PLAN_HASH_MISMATCH",
      "SPLIT_LIVE_BOOKING_CHANGED",
      "SPLIT_PROVIDER_STRIPE_CHANGED",
      "SPLIT_CHILD_ALREADY_HAS_PAYMENT",
      "klyx_claim_split_payment_unit_13_27",
      "klyx_release_split_checkout_13_27",
      "klyx_attach_split_checkout_13_27",
      "klyx_finalize_split_payment_run_13_27",
      "idempotencyKey",
    ]) {
      expect(source).toContain(marker);
    }
  });

  it("checks live Stripe country before split checkout creation is invoked", () => {
    const postSource = source.slice(source.indexOf("export async function POST"));
    const providerCountryCheck = postSource.indexOf(
      "const countryAssessment = assessStripeConnectCountry"
    );
    const checkoutInvocation = postSource.indexOf("createCheckoutSession({");

    expect(providerCountryCheck).toBeGreaterThan(-1);
    expect(checkoutInvocation).toBeGreaterThan(-1);
    expect(providerCountryCheck).toBeLessThan(checkoutInvocation);
  });
});
