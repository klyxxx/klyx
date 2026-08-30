import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/payments/page.tsx"),
  "utf8"
);

describe("provider finances UX", () => {
  it("keeps finances balance-first instead of dashboard-first", () => {
    expect(source).toContain("Montant prestataire après remboursements");
    expect(source).toContain("Transactions récentes");
    expect(source).toContain("État du compte et contrôles avancés");
    expect(source).not.toContain("function MoneyCard(");
    expect(source).not.toContain("function StatusCard(");
    expect(source).not.toContain("bg-[linear-gradient");
  });

  it("uses the single-blue KLYX identity while keeping semantic finance states", () => {
    expect(source).toContain("bg-blue-600");
    expect(source).toContain("text-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
    expect(source).toContain("emerald-500");
    expect(source).toContain("amber-500");
    expect(source).toContain("red-500");
  });

  it("preserves Stripe and finance endpoints without automating money movement", () => {
    expect(source).toContain('fetch("/api/stripe/connect/status"');
    expect(source).toContain('fetch("/api/provider/finance"');
    expect(source).toContain('fetch("/api/stripe/connect/create-account"');
    expect(source).toContain('method: "POST"');
    expect(source).not.toContain("/api/stripe/refund");
    expect(source).not.toContain("payment_intent.confirm");
  });

  it("keeps advanced finance controls present but secondary", () => {
    expect(source).toContain("<FinanceReconciliationStatus />");
    expect(source).toContain("<FinanceExportButton />");
    expect(source).toContain("<ProviderFinanceAudit />");
    expect(source).toContain("<details");
  });
});
