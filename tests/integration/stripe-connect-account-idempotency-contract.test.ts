import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const route = read("app/api/stripe/connect/create-account/route.ts");
const helper = read("lib/stripe-connect-account-idempotency.ts");
const checkout = read("app/api/stripe/create-checkout-session/route.ts");

describe("Stripe Connect account creation idempotency contract", () => {
  it("passes a deterministic idempotency key to Stripe account creation", () => {
    expect(route).toContain("stripeConnectAccountCreateIdempotencyKey");
    expect(route).toContain("{ idempotencyKey }");
    expect(route).toContain("await stripe.accounts.create(");

    const keyIndex = route.indexOf(
      "stripeConnectAccountCreateIdempotencyKey"
    );
    const createIndex = route.indexOf("await stripe.accounts.create(");

    expect(keyIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThan(keyIndex);
  });

  it("keys account creation by the canonical KLYX account", () => {
    expect(helper).toContain("accountId: string");
    expect(helper).toContain("params.accountId");
    expect(helper).toContain("account-v1");
    expect(helper).not.toContain("profileId");
    expect(helper).not.toContain("staleAccountId");
    expect(route).toContain("accountId: account.id");
  });

  it("never uses a stale historical Connect id to create a replacement", () => {
    expect(route).toContain("getStripeConnectCreationDecision");
    expect(route).toContain('decision === "review_required"');
    expect(route).not.toContain("createAndPersistAccount({ staleAccountId })");
    expect(route).not.toContain("const staleAccountId = accountId");
  });

  it("binds a newly created Stripe account only through the canonical account guard", () => {
    const stripeCreate = route.indexOf("await stripe.accounts.create(");
    const canonicalBind = route.indexOf("bindCanonicalStripeAccount(");

    expect(stripeCreate).toBeGreaterThanOrEqual(0);
    expect(canonicalBind).toBeGreaterThan(stripeCreate);
    expect(route).not.toContain("stripe_account_id: account.id");
  });

  it("does not weaken payment checkout authority", () => {
    expect(route).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
  });
});
