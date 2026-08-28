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
  it("keeps recovery narrow to missing accounts and explicit link-mode mismatch", () => {
    expect(recovery).toContain('code === "resource_missing"');
    expect(recovery).toContain('param === "account"');
    expect(recovery).toContain(
      "You tried to create a live mode account link for an account that was created in test mode."
    );
    expect(recovery).toContain(
      "You tried to create a test mode account link for an account that was created in live mode."
    );
    expect(createAccount).toContain(
      "isRecoverableStripeConnectAccountForOnboarding(error)"
    );
    expect(createAccount).toContain("throw error;");
  });

  it("surfaces Stripe platform activation as a safe actionable conflict", () => {
    expect(recovery).toContain(
      "Your account must be activated in order to create accounts."
    );
    expect(createAccount).toContain(
      "isStripePlatformActivationRequired(error)"
    );
    expect(createAccount).toContain(
      'code: "KLYX_STRIPE_PLATFORM_ACTIVATION_REQUIRED"'
    );
    expect(createAccount).toContain("status: 409");
    expect(createAccount).toContain(
      "Le compte Stripe principal KLYX doit être activé"
    );
  });

  it("replaces a stale stored account only inside the onboarding POST", () => {
    const linkAttempt = createAccount.indexOf(
      "accountLink = await createAccountLink(accountId)"
    );
    const recoveryGuard = createAccount.indexOf(
      "isRecoverableStripeConnectAccountForOnboarding(error)"
    );
    const staleCapture = createAccount.indexOf(
      "const staleAccountId = accountId;",
      recoveryGuard
    );
    const replacement = createAccount.indexOf(
      "accountId = await createAndPersistAccount({ staleAccountId });",
      staleCapture
    );

    expect(linkAttempt).toBeGreaterThanOrEqual(0);
    expect(recoveryGuard).toBeGreaterThan(linkAttempt);
    expect(staleCapture).toBeGreaterThan(recoveryGuard);
    expect(replacement).toBeGreaterThan(staleCapture);
    expect(createAccount).toContain("stripe_account_id: account.id");
    expect(createAccount).toContain("stripe_onboarding_complete: false");
    expect(createAccount).toContain("stripe_charges_enabled: false");
    expect(createAccount).toContain("stripe_payouts_enabled: false");
  });

  it("keeps status read-only and conservative for account identity", () => {
    expect(statusRoute).toContain("isMissingStripeConnectAccount(error)");
    expect(statusRoute).toContain("return disconnectedResponse(true);");
    expect(statusRoute).toContain("accountUnavailable");
    expect(statusRoute).not.toContain(
      "isRecoverableStripeConnectAccountForOnboarding(error)"
    );
    expect(statusRoute).not.toContain("stripe_account_id: null");
  });

  it("does not weaken checkout transaction readiness", () => {
    expect(createAccount).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
  });
});
