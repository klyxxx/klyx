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

describe("Stripe Connect provider business type onboarding contract", () => {
  it("does not force every provider to be an individual", () => {
    expect(route).not.toContain('business_type: "individual"');
    expect(route).not.toContain("business_type: 'individual'");
  });

  it("keeps Stripe-hosted onboarding as the KYC and legal-entity collection boundary", () => {
    expect(route).toContain('type: "express"');
    expect(route).toContain('type: "account_onboarding"');
    expect(route).toContain("stripe.accountLinks.create");
  });

  it("preserves capabilities, idempotency and provider-only authority", () => {
    expect(route).toContain("card_payments: { requested: true }");
    expect(route).toContain("transfers: { requested: true }");
    expect(route).toContain("stripeConnectAccountCreateIdempotencyKey");
    expect(route).toContain("{ idempotencyKey }");
    expect(route).toContain('requireAccountType(activeProfile, "provider")');
  });
});
