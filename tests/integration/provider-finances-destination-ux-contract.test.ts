import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX provider Finances destination contract", () => {
  it("keeps the real finance and Stripe business boundaries", () => {
    const page = read("app/provider/payments/page.tsx");

    expect(page).toContain('fetch("/api/stripe/connect/status"');
    expect(page).toContain('fetch("/api/provider/finance"');
    expect(page).toContain('fetch("/api/stripe/connect/create-account"');
    expect(page).toContain("FinanceReconciliationStatus");
    expect(page).toContain("FinanceExportButton");
    expect(page).toContain("ProviderFinanceAudit");
  });

  it("uses one calm financial summary instead of a dashboard wall", () => {
    const page = read("app/provider/payments/page.tsx");

    expect(page).toContain("Ton argent, sans détour.");
    expect(page).toContain("Montant prestataire après remboursements");
    expect(page).toContain("Transactions récentes");
    expect(page).toContain("Détails du compte de paiement");
    expect(page).toContain("transactions.slice(0, 5)");
    expect(page).not.toContain('xl:grid-cols-4');
    expect(page).not.toContain("function MoneyCard");
  });

  it("keeps KLYX blue as the only normal accent", () => {
    const page = read("app/provider/payments/page.tsx");

    expect(page).toContain("#2563EB");
    expect(page).not.toMatch(/text-blue-(?:300|400|500|600|700)/);
    expect(page).not.toMatch(/violet|indigo|fuchsia|gradient/i);
    expect(page).not.toContain("bg-emerald-500/10");
    expect(page).not.toContain("bg-amber-500/10");
  });
});
