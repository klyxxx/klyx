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

  it("uses Accounts v2 recipient transfer readiness with bounded polling", () => {
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
    expect(fixture).toContain(
      'account?.applied_configurations?.includes("recipient") === true'
    );
    expect(fixture).toContain(
      "account?.configuration?.recipient?.applied === true"
    );
    expect(fixture).toContain('v2TransferStatus(account) === "active"');

    // Account creation is Accounts v2-only. v1 is allowed only as a read/update
    // compatibility surface for already-created accounts; Platform-Held itself
    // must not require an external bank account or a bank payout capability.
    expect(fixture).not.toContain("stripe.accounts.create({");
    expect(fixture).toContain("stripe.accounts.list({ limit: 100 })");
    expect(fixture).toContain("stripe.accounts.update(created.id");
    expect(fixture).toContain('url: "https://accessible.stripe.com"');
    expect(fixture).toContain("stripe.v2.core.accounts.retrieve(created.id");
    expect(fixture).toContain("attempt < 20");
    expect(fixture).not.toContain("createExternalAccount");
    expect(fixture).not.toContain("stripe.tokens.create(");
  });

  it("hands off the exact recipient account and never reuses an unrelated TEST account", () => {
    expect(fixture).toContain(
      'account.metadata?.klyx_platform_held_network_fixture === "true"'
    );
    expect(fixture).toContain(
      "account.metadata?.klyx_provider_profile_id === providerId"
    );
    expect(fixture).toContain(
      '"stripe-network-proof/platform-held-provider-fixture.json"'
    );
    expect(fixture).toContain("accountId: stripeFixture.accountId");
    expect(fixture).toContain("created: stripeFixture.created");
  });

  it("never performs a settlement, refund, reversal or bank payout mutation", () => {
    expect(fixture).not.toContain("stripe.transfers.create(");
    expect(fixture).not.toContain("stripe.transfers.createReversal(");
    expect(fixture).not.toContain("stripe.refunds.create(");
    expect(fixture).not.toContain("stripe.payouts.create(");
  });
});
