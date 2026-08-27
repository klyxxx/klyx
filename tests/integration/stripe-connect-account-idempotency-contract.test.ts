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

  it("separates initial account creation from stale-account replacement", () => {
    expect(helper).toContain('const purpose = staleAccountId ?');
    expect(helper).toContain('"initial"');
    expect(helper).toContain("replace-${staleAccountId}");
    expect(route).toContain("const staleAccountId = accountId;");
    expect(route).toContain(
      "createAndPersistAccount({ staleAccountId })"
    );
  });

  it("persists the Stripe account only after Stripe returns it and remains retry-safe if persistence fails", () => {
    const stripeCreate = route.indexOf("await stripe.accounts.create(");
    const profileUpdate = route.indexOf("stripe_account_id: account.id");

    expect(stripeCreate).toBeGreaterThanOrEqual(0);
    expect(profileUpdate).toBeGreaterThan(stripeCreate);
    expect(route).toContain("if (updateError)");
    expect(route).toContain("throw new Error(updateError.message)");
  });

  it("does not weaken payment checkout authority", () => {
    expect(route).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
  });
});
