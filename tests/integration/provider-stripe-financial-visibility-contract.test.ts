import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "app/api/stripe/connect/financial-status/route.ts"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

const providerFinanceUi = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "app/provider/payments/ProviderFinanceAudit.tsx"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX account-level Stripe financial visibility", () => {
  it("authenticates the canonical KLYX account and reads its Connect identity", () => {
    expect(route).toContain("getAuthenticatedAccount(request)");
    expect(route).toContain("getCanonicalStripeConnect(account.id)");
    expect(route).not.toContain('requireAccountType(activeProfile, "provider")');
    expect(route).not.toContain('.eq("id", activeProfile.id)');
  });

  it("fails closed while canonical Stripe identity requires review", () => {
    expect(route).toContain('connect.state === "review_required"');
    expect(route).toContain("StripeConnectIdentityReviewRequiredError");
    expect(route).toContain("KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED");
  });

  it("uses read-only Stripe diagnostics and connected-account scoped financial APIs", () => {
    expect(route).toContain("assertStripeRuntimeConfiguredForDiagnostics()");
    expect(route).toContain("stripe.balance.retrieve");
    expect(route).toContain("stripe.payouts.list");
    expect(route).toContain("{ stripeAccount: stripeAccountId }");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("returns sanitized balances and payouts without bank details or a Connect id", () => {
    expect(route).toContain("amountCents: entry.amount");
    expect(route).toContain("amountCents: payout.amount");
    expect(route).not.toContain("external_accounts");
    expect(route).not.toContain("routing_number");
    expect(route).not.toContain("bank_account");
    expect(route).not.toMatch(/accountId\s*:/);
  });

  it("keeps Stripe balance visibility independent from the legacy finance audit", () => {
    expect(providerFinanceUi).toContain("let stripeFinanceResolved = false;");
    expect(providerFinanceUi).toContain("stripeFinanceResolved = true;");
    expect(providerFinanceUi).toContain("if (!stripeFinanceResolved)");
  });

  it("keeps the existing finance UI inside KLYX while the backend authority is account-level", () => {
    expect(providerFinanceUi).toContain("Solde Stripe Connect");
    expect(providerFinanceUi).toContain("Solde disponible");
    expect(providerFinanceUi).toContain("En attente");
    expect(providerFinanceUi).toContain("Dernier virement");
    expect(providerFinanceUi).toContain(
      "/api/stripe/connect/financial-status"
    );
  });
});
