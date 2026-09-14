import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX account-level Stripe Connect contract", () => {
  const migration = source(
    "supabase/migrations/20260914194500_klyx_account_level_stripe_connect.sql"
  );
  const bindMigration = source(
    "supabase/migrations/20260914194600_klyx_account_stripe_bind_review_result.sql"
  );
  const splitGuard = source(
    "supabase/migrations/20260914194700_klyx_split_canonical_stripe_guard.sql"
  );
  const createAccount = source(
    "app/api/stripe/connect/create-account/route.ts"
  );
  const checkout = source(
    "app/api/stripe/create-checkout-session/route.ts"
  );
  const groupCheckout = source(
    "app/api/stripe/create-group-checkout-session/route.ts"
  );
  const webhook = source("app/api/stripe/webhook/route.ts");
  const connectWebhook = source("app/api/stripe/connect-webhook/route.ts");
  const accountDelete = source("app/api/account/delete/route.ts");

  it("stores one canonical Connect identity on accounts and queues conflicts", () => {
    expect(migration).toContain("alter table public.accounts");
    expect(migration).toContain("stripe_account_id text");
    expect(migration).toContain("accounts_stripe_account_id_unique");
    expect(migration).toContain("stripe_connect_identity_reviews");
    expect(migration).toContain("review_required");
    expect(migration).not.toContain("update public.bookings");
  });

  it("persists fail-closed review results atomically", () => {
    expect(bindMigration).toContain("returns text");
    expect(bindMigration).toContain("return 'review_required'");
    expect(bindMigration).toContain("return 'linked'");
    expect(bindMigration).toContain("stripe_connect_identity_reviews");
  });

  it("allows Connect onboarding from the canonical account rather than provider role", () => {
    expect(createAccount).toContain("getAuthenticatedAccount");
    expect(createAccount).not.toContain("requireAccountType(activeProfile");
    expect(createAccount).toContain("klyx_account_id");
    expect(createAccount).toContain("getStripeConnectCreationDecision");
    expect(createAccount).toContain(
      "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED"
    );
  });

  it("keeps destination charges and KLYX fee while resolving destination canonically", () => {
    for (const route of [checkout, groupCheckout]) {
      expect(route).toContain("getProviderStripeDestination");
      expect(route).toContain("application_fee_amount");
      expect(route).toContain("transfer_data");
      expect(route).toContain("canonicalStripeAccountId");
      expect(route).toContain(
        "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED"
      );
    }
  });

  it("keeps split payouts fail closed against the canonical destination", () => {
    expect(splitGuard).toContain("klyx_assert_canonical_split_stripe_identity");
    expect(splitGuard).toContain("v_state is distinct from 'linked'");
    expect(splitGuard).toContain(
      "p_stripe_account_id is distinct from v_canonical_stripe_account_id"
    );
    expect(splitGuard).toContain("klyx_claim_split_payment_unit_13_27");
  });

  it("reconciles account.updated against canonical account identity", () => {
    expect(webhook).toContain("syncCanonicalConnectedAccountFromStripe");
    expect(connectWebhook).toContain("syncCanonicalConnectedAccountFromStripe");
    expect(webhook).toContain("claimStripeWebhookEvent");
    expect(connectWebhook).toContain("claimStripeWebhookEvent");
  });

  it("never deletes canonical Connect identity from profile deletion", () => {
    expect(accountDelete).not.toContain("stripe.accounts.del");
    expect(accountDelete).not.toContain("new Stripe(");
    expect(accountDelete).toContain("profile-only");
  });
});
