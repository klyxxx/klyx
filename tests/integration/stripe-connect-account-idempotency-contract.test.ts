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
  it("passes a deterministic account-level idempotency key to Stripe", () => {
    expect(route).toContain("stripeConnectAccountCreateIdempotencyKey");
    expect(route).toContain("accountId: account.id");
    expect(route).toContain("{ idempotencyKey }");
    expect(route).toContain("await stripe.accounts.create(");
    expect(helper).toContain("accountId: string");
    expect(helper).not.toContain("profileId: string");
  });

  it("never automatically creates a replacement for an existing Stripe identity", () => {
    expect(route).toContain("isRecoverableStripeConnectAccountForOnboarding");
    expect(route).toContain("STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED");
    expect(route).not.toContain("staleAccountId");
    expect(route).not.toContain("createAndPersistAccount({ staleAccountId })");
  });

  it("persists the canonical identity before maintaining the profile compatibility mirror", () => {
    const stripeCreate = route.indexOf("await stripe.accounts.create(");
    const canonicalPersist = route.indexOf(
      "await persistAccountStripeConnectIdentity({"
    );
    const profileMirror = route.indexOf("stripe_account_id: created.id");

    expect(stripeCreate).toBeGreaterThanOrEqual(0);
    expect(canonicalPersist).toBeGreaterThan(stripeCreate);
    expect(profileMirror).toBeGreaterThan(canonicalPersist);
  });

  it("does not weaken payment checkout authority", () => {
    expect(route).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
    expect(checkout).toContain("getProfileAccountStripeConnectIdentity");
  });
});
