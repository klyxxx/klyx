import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider finance visual contract", () => {
  it("keeps finance data and Stripe actions while using the focused KLYX visual language", () => {
    const finance = read("app/provider/payments/page.tsx");

    expect(finance).toContain("KLYX_PROVIDER_FINANCE_VISUAL_2026_08_31");
    expect(finance).toContain("KLYX_PROVIDER_FINANCE_DESTINATION_2026_09_02");
    expect(finance).toContain("Ton argent, sans détour.");
    expect(finance).toContain("Montant prestataire après remboursements");
    expect(finance).toContain("Transactions récentes");
    expect(finance).toContain("Détails du compte de paiement");

    expect(finance).toContain('fetch("/api/stripe/connect/status"');
    expect(finance).toContain('fetch("/api/provider/finance"');
    expect(finance).toContain('"/api/stripe/connect/create-account"');
    expect(finance).toContain("window.location.assign(result.url)");
    expect(finance).toContain("FinanceReconciliationStatus");
    expect(finance).toContain("FinanceExportButton");
    expect(finance).toContain("ProviderFinanceAudit");

    expect(finance).toContain("text-blue-600");
    expect(finance).not.toContain("violet-");
    expect(finance).not.toContain("indigo-");
    expect(finance).not.toContain("#2b1452");
    expect(finance).not.toContain("bg-emerald-500/10");
    expect(finance).not.toContain("bg-amber-500/10");
    expect(finance).not.toContain("bg-rose-500/10");
    expect(finance).not.toContain("function MoneyCard");
  });
});
