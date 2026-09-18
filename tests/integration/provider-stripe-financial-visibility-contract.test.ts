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

describe("KLYX Stripe financial visibility", () => {
  it("authenticates the canonical KLYX account and resolves its single Connect identity", () => {
    expect(route).toContain("getAuthenticatedAccount(request)");
    expect(route).toContain("getAccountStripeConnectIdentity(account.id)");
    expect(route).toContain("assertStripeConnectIdentityUsable(identity)");
    expect(route).toContain("STRIPE_CONNECT_IDENTITY_CONFLICT");
    expect(route).not.toContain('.select("stripe_account_id")');
    expect(route).not.toContain('requireAccountType(activeProfile, "provider")');
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

  it("keeps the earner inside KLYX for balance and payout visibility", () => {
    expect(providerFinanceUi).toContain("Solde Stripe Connect");
    expect(providerFinanceUi).toContain("Solde disponible");
    expect(providerFinanceUi).toContain("En attente");
    expect(providerFinanceUi).toContain("Dernier virement");
    expect(providerFinanceUi).toContain(
      "/api/stripe/connect/financial-status"
    );
  });
});
