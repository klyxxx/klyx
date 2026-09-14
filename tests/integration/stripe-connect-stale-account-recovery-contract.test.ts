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
  it("keeps recovery classification narrow to missing accounts and explicit link-mode mismatch", () => {
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

  it("surfaces incomplete Stripe Connect platform profile safely", () => {
    expect(recovery).toContain(
      "You must complete your platform profile to use Connect and create live connected accounts."
    );
    expect(createAccount).toContain("isStripePlatformProfileRequired(error)");
    expect(createAccount).toContain(
      'code: "KLYX_STRIPE_PLATFORM_PROFILE_REQUIRED"'
    );
    expect(createAccount).toContain(
      "Le profil de plateforme Stripe Connect de KLYX doit être complété"
    );
  });

  it("never replaces a stale historical account during onboarding", () => {
    expect(createAccount).toContain(
      "isRecoverableStripeConnectAccountForOnboarding(error)"
    );
    expect(createAccount).toContain('reason: "stored_stripe_account_unavailable"');
    expect(createAccount).toContain("markStripeConnectIdentityReview");
    expect(createAccount).toContain("StripeConnectIdentityReviewRequiredError");
    expect(createAccount).not.toContain("const staleAccountId = accountId;");
    expect(createAccount).not.toContain(
      "createAndPersistAccount({ staleAccountId })"
    );
  });

  it("keeps status read-only for identity and escalates a missing canonical account to review", () => {
    expect(statusRoute).toContain("isMissingStripeConnectAccount(error)");
    expect(statusRoute).toContain('reason: "stored_stripe_account_unavailable"');
    expect(statusRoute).toContain("markStripeConnectIdentityReview");
    expect(statusRoute).toContain("StripeConnectIdentityReviewRequiredError");
    expect(statusRoute).toContain(
      'code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED"'
    );
    expect(statusRoute).not.toContain("stripe_account_id: null");
  });

  it("does not weaken checkout transaction readiness", () => {
    expect(createAccount).toContain("assertStripeConnectRuntimeConfigured()");
    expect(checkout).toContain("assertStripeRuntimeReady()");
  });
});
