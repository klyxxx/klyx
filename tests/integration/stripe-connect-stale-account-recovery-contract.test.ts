import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const createAccount = read(
  "app/api/stripe/connect/create-account/route.ts"
);
const statusRoute = read("app/api/stripe/connect/status/route.ts");
const recovery = read("lib/stripe-connect-account-recovery.ts");
const checkout = read("app/api/stripe/create-checkout-session/route.ts");

describe("Stripe Connect stale account recovery contract", () => {
  it("recovers only Stripe's definitive missing-account signal", () => {
    expect(recovery).toContain('code === "resource_missing"');
    expect(recovery).toContain('param === "account"');
    expect(createAccount).toContain("isMissingStripeConnectAccount(error)");
    expect(createAccount).toContain("throw error;");
  });

  it("replaces a stale stored account only inside the onboarding POST", () => {
    const linkAttempt = createAccount.indexOf(
      "accountLink = await createAccountLink(accountId)"
    );
    const missingGuard = createAccount.indexOf(
      "isMissingStripeConnectAccount(error)"
    );
    const staleCapture = createAccount.indexOf(
      "const staleAccountId = accountId;",
      missingGuard
    );
    const replacement = createAccount.indexOf(
      "accountId = await createAndPersistAccount({ staleAccountId });",
      staleCapture
    );

    expect(linkAttempt).toBeGreaterThanOrEqual(0);
    expect(missingGuard).toBeGreaterThan(linkAttempt);
    expect(staleCapture).toBeGreaterThan(missingGuard);
    expect(replacement).toBeGreaterThan(staleCapture);
    expect(createAccount).toContain("stripe_account_id: account.id");
    expect(createAccount).toContain("stripe_onboarding_complete: false");
    expect(createAccount).toContain("stripe_charges_enabled: false");
    expect(createAccount).toContain("stripe_payouts_enabled: false");
  });

  it("keeps status read-only for account identity and exposes recovery state", () => {
    expect(statusRoute).toContain("isMissingStripeConnectAccount(error)");
    expect(statusRoute).toContain("return disconnectedResponse(true);");
    expect(statusRoute).toContain("accountUnavailable");
    expect(statusRoute).not.toContain("stripe_account_id: null");
  });

  it("does not weaken checkout transaction readiness", () => {
    expect(createAccount).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
  });
});
