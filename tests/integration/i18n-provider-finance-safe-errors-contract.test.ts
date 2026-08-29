import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const page = read("app/provider/payments/page.tsx");
const exportButton = read("app/provider/payments/FinanceExportButton.tsx");
const reconciliation = read(
  "app/provider/payments/FinanceReconciliationStatus.tsx"
);
const audit = read("app/provider/payments/ProviderFinanceAudit.tsx");
const dictionary = read("lib/klyx-provider-finance-i18n.ts");

describe("KLYX provider finance i18n and safe-error contract", () => {
  it("localizes the provider finance family through the shared locale provider", () => {
    for (const source of [page, exportButton, reconciliation, audit]) {
      expect(source).toContain("useKlyxLocale");
      expect(source).toContain("translateKlyxProviderFinance");
    }

    for (const locale of ["fr", "en", "nl", "de"]) {
      expect(dictionary).toContain(`"${locale}"`);
    }
  });

  it("formats money and dates with the active locale instead of forcing fr-BE", () => {
    expect(page).toContain("klyxProviderFinanceIntlLocale(locale)");
    expect(audit).toContain("klyxProviderFinanceIntlLocale(locale)");
    expect(reconciliation).toContain("klyxProviderFinanceIntlLocale(locale)");

    for (const source of [page, reconciliation, audit]) {
      expect(source).not.toContain('"fr-BE"');
    }
  });

  it("does not reflect raw API, Supabase or Stripe failure messages into finance UI", () => {
    for (const source of [page, exportButton, reconciliation, audit]) {
      expect(source).not.toContain("error instanceof Error");
      expect(source).not.toContain("error.message");
      expect(source).not.toContain("body.error ||");
    }

    expect(page).not.toContain("{entry.failureMessage}");
    expect(audit).not.toContain("{latestPayout.failureMessage}");
    expect(audit).not.toContain("return status;");
    expect(page).toContain('t("genericTransactionFailure")');
    expect(audit).toContain('t("genericPayoutFailure")');
    expect(audit).toContain('return t("statusProcessing")');
  });

  it("preserves the canonical finance, Stripe and booking routes", () => {
    expect(page).toContain('fetch("/api/stripe/connect/status"');
    expect(page).toContain('fetch("/api/provider/finance"');
    expect(page).toContain('"/api/stripe/connect/create-account"');
    expect(page).toContain('href={`/bookings/${entry.bookingId}`}');
    expect(exportButton).toContain('fetch("/api/provider/finance"');
    expect(reconciliation).toContain('fetch("/api/provider/finance"');
    expect(audit).toContain('fetch("/api/provider/finance-audit"');
    expect(audit).toContain('fetch("/api/stripe/connect/financial-status"');
  });

  it("keeps finance tools read-only where they were already read-only", () => {
    expect(exportButton).toContain('t("exportReadOnly")');
    expect(reconciliation).toContain('t("reconciliationReadOnly")');
    expect(audit).toContain('t("auditReadOnly")');
    expect(dictionary).toContain("Export manuel uniquement");
    expect(dictionary).toContain("Read-only control");
    expect(dictionary).toContain("Read-only audit");
    expect(page).toContain("<FinanceReconciliationStatus />");
    expect(page).toContain("<FinanceExportButton />");
    expect(page).toContain("<ProviderFinanceAudit />");
  });
});
