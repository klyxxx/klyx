import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX LIVE gate legacy-shadow readiness contract", () => {
  it("routes LIVE readiness through the classified blocking-truth authority", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(runtime).toContain("requireNoBlockingFinancialRuntimeTruth");
    expect(runtime).toContain(
      'from "@/lib/pure-finance/runtime-reconciliation-readiness-server"'
    );
    expect(runtime).not.toContain(
      "requireNoOpenFinancialReconciliation"
    );
    expect(runtime).not.toContain(
      "requireNoCriticalFinancialSignal"
    );
  });

  it("exempts only explicitly classified Pure Finance historical shadow cases", () => {
    const readiness = read(
      "lib/pure-finance/runtime-reconciliation-readiness-server.ts"
    );

    expect(readiness).toContain(
      'reconciliation.dimension !== "pure_finance_runtime"'
    );
    expect(readiness).toContain(
      'reconciliation.cause !== "pure_finance_runtime_shadow_divergence"'
    );
    expect(readiness).toContain(
      'reconciliation.reason_code.startsWith("PURE_FINANCE_RUNTIME_")'
    );
    expect(readiness).toContain(
      "classifyPureFinanceRuntimeEvidence"
    );
    expect(readiness).toContain(
      'classification.evidenceClass === "legacy_historical"'
    );
    expect(readiness).toContain(
      'classification.evidenceBasis === "test_only_payment_mode"'
    );
  });

  it("keeps missing, ambiguous, non-final and current-runtime cases blocking", () => {
    const readiness = read(
      "lib/pure-finance/runtime-reconciliation-readiness-server.ts"
    );

    expect(readiness).toContain("return null;");
    expect(readiness).toContain("blockingCaseIds.push(reconciliation.id)");
    expect(readiness).toContain(
      'throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_OPEN")'
    );
  });

  it("filters critical financial signals only when they reference a proven legacy case", () => {
    const readiness = read(
      "lib/pure-finance/runtime-reconciliation-readiness-server.ts"
    );

    expect(readiness).toContain(
      'signal.source_type === "financial_reconciliation_case"'
    );
    expect(readiness).toContain("legacyCaseIds.has(signal.source_ref)");
    expect(readiness).toContain(
      "legacyHistoricalSignalKeys.push(signal.signal_key)"
    );
    expect(readiness).toContain(
      "blockingCriticalSignalKeys.push(signal.signal_key)"
    );
  });

  it("never exempts Operations critical signals", () => {
    const readiness = read(
      "lib/pure-finance/runtime-reconciliation-readiness-server.ts"
    );

    expect(readiness).toContain(
      "for (const signal of (opsSignalResult.data ?? [])"
    );
    expect(readiness).toContain(
      "blockingCriticalSignalKeys.push(signal.signal_key)"
    );
  });

  it("keeps Founder readiness aligned with the runtime authority", () => {
    const founder = read(
      "app/api/founder/transaction-readiness/route.ts"
    );

    expect(founder).toContain("inspectFinancialRuntimeBlockingTruth");
    expect(founder).toContain("blockingCaseIds.length");
    expect(founder).toContain("blockingCriticalSignalKeys.length");
    expect(founder).toContain("legacyHistoricalCases.length");
    expect(founder).toContain("legacyHistoricalSignalKeys.length");
    expect(founder).toContain('key: "legacy_historical_reconciliation"');
    expect(founder).toContain('severity: "warning"');
    expect(founder).toContain(
      "Ils sont exclus du gate current-runtime mais ne sont pas supprimés."
    );
  });

  it("does not close or mutate reconciliation evidence", () => {
    const readiness = read(
      "lib/pure-finance/runtime-reconciliation-readiness-server.ts"
    );

    expect(readiness).not.toContain(".update(");
    expect(readiness).not.toContain(".delete(");
    expect(readiness).not.toContain("openFinancialReconciliationCase");
  });
});
