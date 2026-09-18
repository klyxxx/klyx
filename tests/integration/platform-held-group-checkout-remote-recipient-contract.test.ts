import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
  ),
  "utf8"
);

describe("Platform-Held group checkout remote recipient authority", () => {
  it("requires account-first identity plus current Stripe recipient transfer capability", () => {
    expect(source).toContain("getProviderStripeDestination(unit.providerId)");
    expect(source).toContain(
      "destination.connect.stripeAccountId !== unit.stripeAccountId"
    );
    expect(source).toContain("input.stripe.v2.core.accounts.retrieve");
    expect(source).toContain(
      'include: ["configuration.recipient", "identity", "requirements"]'
    );
    expect(source).toContain('stripe_transfers?.status === "active"');
  });

  it("does not restore destination-charge readiness flags as Platform-Held authority", () => {
    expect(source).not.toContain("destination.connect.chargesEnabled");
    expect(source).not.toContain("destination.connect.payoutsEnabled");
  });
});
