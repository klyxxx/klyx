import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX platform-held provider Stripe TEST fixture", () => {
  const fixture = read("scripts/golden-path-provider-fixture.mjs");

  it("activates remote Stripe only behind the explicit platform-held TEST guard", () => {
    expect(fixture).toContain('process.env.KLYX_STRIPE_MODE === "test"');
    expect(fixture).toContain(
      'process.env.KLYX_STRIPE_SETTLEMENT_MODE === "platform_held"'
    );
    expect(fixture).toContain(
      'process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true"'
    );
    expect(fixture).toContain(
      'process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false"'
    );

    const guardIndex = fixture.indexOf(
      "if (!platformHeldStripeFixtureEnabled())"
    );
    const secretIndex = fixture.indexOf(
      'requiredGoldenPathEnv("STRIPE_SECRET_KEY")'
    );
    const stripeIndex = fixture.indexOf("new Stripe(stripeSecretKey)");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(secretIndex).toBeGreaterThan(guardIndex);
    expect(stripeIndex).toBeGreaterThan(secretIndex);
    expect(fixture).toContain('stripeSecretKey.startsWith("sk_test_")');
    expect(fixture).not.toContain("sk_live_");
  });

  it("uses Accounts v2 TEST identity signals and bounded readiness polling", () => {
    expect(fixture).toContain("stripe.v2.core.accounts.create(");
    expect(fixture).toContain('dashboard: "none"');
    expect(fixture).toContain('country: "BE"');
    expect(fixture).toContain('entity_type: "individual"');
    expect(fixture).toContain(
      "date_of_birth: { day: 1, month: 1, year: 1902 }"
    );
    expect(fixture).toContain('line1: "address_full_match"');
    expect(fixture).toContain("terms_of_service");
    expect(fixture).toContain('fees_collector: "application"');
    expect(fixture).toContain('losses_collector: "application"');
    expect(fixture).toContain("stripe_transfers: { requested: true }");
    expect(fixture).toContain(
      "klyx-platform-held-v2-fixture-${providerId}"
    );

    // The Stripe platform has migrated account creation to Accounts v2. KLYX
    // may still use v1 only for already-created account compatibility updates,
    // reads and external-account management while #803 remains TEST-only.
    expect(fixture).not.toContain("stripe.accounts.create({");
    expect(fixture).toContain("stripe.accounts.list({ limit: 100 })");
    expect(fixture).toContain("stripe.accounts.update(created.id");
    expect(fixture).toContain('url: "https://accessible.stripe.com"');
    expect(fixture).toContain("stripe.accounts.createExternalAccount(created.id");
    expect(fixture).toContain("stripe.accounts.retrieve(created.id)");
    expect(fixture).toContain("stripe.v2.core.accounts.retrieve(created.id");
    expect(fixture).toContain("attempt < 20");
    expect(fixture).toContain("requirements?.currently_due");
    expect(fixture).toContain("requirements?.past_due");
  });

  it("never performs a settlement, refund, reversal or bank payout mutation", () => {
    expect(fixture).not.toContain("stripe.transfers.create(");
    expect(fixture).not.toContain("stripe.transfers.createReversal(");
    expect(fixture).not.toContain("stripe.refunds.create(");
    expect(fixture).not.toContain("stripe.payouts.create(");
  });
});
