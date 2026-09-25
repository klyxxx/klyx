import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const serverShadow = readFileSync(
  "lib/pure-finance-shadow-server.ts",
  "utf8"
).replace(/\r\n/g, "\n");

describe("KLYX pure-finance runtime shadow scope resolution", () => {
  it("treats historical-backfill-only truth as non-runtime evidence", () => {
    expect(serverShadow).toContain("effectiveLedger.length > 0");
    expect(serverShadow).toContain(
      'effectiveLedger.every((row) => row.source === "historical_backfill")'
    );
    expect(serverShadow).toContain(
      '"PURE_FINANCE_RUNTIME_HISTORICAL_BACKFILL_ONLY"'
    );
    expect(serverShadow).toContain('status: "not_applicable"');
  });

  it("does not blanket-exclude legacy payment modes", () => {
    expect(serverShadow).not.toContain(
      'booking.payment_mode === "connect_destination"'
    );
    expect(serverShadow).not.toContain(
      'booking.payment_mode !== "platform_held"'
    );
  });

  it("keeps any booking with non-backfill runtime evidence in strict comparison", () => {
    expect(serverShadow).toContain(
      "const historicalBackfillOnly ="
    );
    expect(serverShadow).toContain(
      "const observed = effectiveLedger.map(observedMovement)"
    );
    expect(serverShadow).toContain(
      "certifyPureFinanceRuntimeShadow({"
    );
  });

  it("resolves obsolete shadow cases through immutable reconciliation decisions", () => {
    expect(serverShadow).toContain(
      "recordFinancialReconciliationDecision"
    );
    expect(serverShadow).toContain(
      '.eq("dimension", "pure_finance_runtime")'
    );
    expect(serverShadow).toContain(
      '.in("state", ["reconciliation", "human_review"])'
    );
    expect(serverShadow).toContain('state: "resolved"');
    expect(serverShadow).toContain(
      'cause: "pure_finance_runtime_scope_excluded"'
    );
    expect(serverShadow).toContain(
      'actorRef: "pure_finance_runtime_shadow"'
    );
  });

  it("also retires stale test-only shadow cases after the approved exclusion", () => {
    expect(serverShadow).toContain(
      'booking.payment_mode === "platform_test_only"'
    );
    expect(serverShadow).toContain(
      '"PURE_FINANCE_RUNTIME_TEST_ONLY_PAYMENT_MODE"'
    );
    expect(serverShadow).toContain(
      "await resolveObsoleteRuntimeShadowCases({"
    );
  });
});
