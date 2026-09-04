import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider finance visual contract", () => {
  it("keeps finance behavior while using the exact KLYX blue across the provider finance surface", () => {
    const finance = read("app/provider/payments/page.tsx");
    const exportButton = read("app/provider/payments/FinanceExportButton.tsx");
    const reconciliation = read(
      "app/provider/payments/FinanceReconciliationStatus.tsx"
    );
    const audit = read("app/provider/payments/ProviderFinanceAudit.tsx");
    const surface = [finance, exportButton, reconciliation, audit].join("\n");

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
    expect(exportButton).toContain('"/api/provider/finance"');
    expect(reconciliation).toContain('"/api/provider/finance"');
    expect(audit).toContain('fetch("/api/provider/finance-audit"');
    expect(audit).toContain('fetch("/api/stripe/connect/financial-status"');

    expect(surface).toContain("#2563EB");
    for (const legacyClass of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "#2b1452",
    ]) {
      expect(surface).not.toContain(legacyClass);
    }

    expect(surface).toContain("emerald-500");
    expect(surface).toContain("amber-500");
    expect(surface).toContain("rose-500");
    expect(finance).not.toContain("function MoneyCard");
  });
});
