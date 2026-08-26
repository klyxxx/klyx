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

describe("KLYX provider Stripe financial visibility", () => {
  it("is provider-authenticated and reads only the active profile Connect account", () => {
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain('requireAccountType(activeProfile, "provider")');
    expect(route).toContain('.select("stripe_account_id")');
    expect(route).toContain('.eq("id", activeProfile.id)');
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

  it("keeps the provider inside KLYX for balance and payout visibility", () => {
    expect(providerFinanceUi).toContain("Solde Stripe Connect");
    expect(providerFinanceUi).toContain("Solde disponible");
    expect(providerFinanceUi).toContain("En attente");
    expect(providerFinanceUi).toContain("Dernier virement");
    expect(providerFinanceUi).toContain(
      "/api/stripe/connect/financial-status"
    );
  });
});
