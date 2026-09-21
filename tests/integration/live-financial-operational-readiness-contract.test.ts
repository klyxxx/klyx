import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX LIVE financial operational readiness contract", () => {
  it("requires fresh worker and critical-alert heartbeats on the deployed SHA", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");
    const migration = read(
      "supabase/migrations/20260921183000_klyx_live_runtime_heartbeats.sql"
    );
    const worker = read("lib/financial-durable-worker-server.ts");
    const alert = read("lib/critical-alert-delivery-server.ts");
    const workflow = read(
      ".github/workflows/klyx-financial-ops-pulse.yml"
    );

    expect(runtime).toContain("financial_durable_worker");
    expect(runtime).toContain("critical_alert_delivery");
    expect(runtime).toContain("LIVE_HEARTBEAT_MAX_AGE_MS");
    expect(runtime).toContain(
      "row.source_sha?.trim().toLowerCase() !== deployedSha"
    );
    expect(runtime).toContain('row.status !== "healthy"');

    expect(migration).toContain("ops_runtime_heartbeats");
    expect(migration).toContain("klyx_record_ops_runtime_heartbeat");
    expect(migration).toContain("financial_durable_worker");
    expect(migration).toContain("critical_alert_delivery");
    expect(migration).toContain("source_sha ~ '^[0-9a-f]{40}$'");

    expect(worker).toContain(
      'component: "financial_durable_worker"'
    );
    expect(alert).toContain(
      'component: "critical_alert_delivery"'
    );
    expect(workflow).toContain('cron: "3-58/5 * * * *"');
    expect(workflow).toContain(
      "/api/ops/financial-durable-worker"
    );
    expect(workflow).toContain(
      "/api/ops/critical-alert-delivery"
    );
  });

  it("fails LIVE mutations closed on DLQ, reconciliation, ledger or critical monitoring", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(runtime).toContain("ops_durable_job_dlq");
    expect(runtime).toContain("financial_reconciliation_current");
    expect(runtime).toContain("financial_ledger_current");
    expect(runtime).toContain("severityCounts.critical");
    expect(runtime).toContain("KLYX_FINANCIAL_RUNTIME_DLQ_NOT_EMPTY");
    expect(runtime).toContain("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_OPEN");
    expect(runtime).toContain("KLYX_FINANCIAL_RUNTIME_LEDGER_UNAVAILABLE");
    expect(runtime).toContain("KLYX_FINANCIAL_RUNTIME_CRITICAL_SIGNAL_OPEN");
  });

  it("checks operation-specific circuit breakers for settlement and refunds", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");
    const singleSettlement = read("lib/booking-settlement-server.ts");
    const groupSettlement = read(
      "lib/platform-held-group-settlement-server.ts"
    );
    const singleRefund = read("app/api/bookings/status/route-core.ts");
    const groupRefund = read(
      "app/api/booking-groups/[id]/cancellation/route-core.ts"
    );

    expect(runtime).toContain('"settlement_release"');
    expect(runtime).toContain('"refunds"');
    expect(runtime).toContain("requireKlyxOpsCapabilityAvailable");

    expect(singleSettlement).toContain(
      'capability: "settlement_release"'
    );
    expect(singleSettlement).toContain('capability: "refunds"');
    expect(groupSettlement).toContain(
      'capability: "settlement_release"'
    );
    expect(groupSettlement).toContain('capability: "refunds"');
    expect(singleRefund).toContain('capability: "refunds"');
    expect(groupRefund).toContain('capability: "refunds"');
  });

  it("uses canonical account-first Stripe identity in LIVE without historical bootstrap", () => {
    const identity = read("lib/stripe-connect-account-identity.ts");
    const connect = read("lib/stripe-connect-account.ts");
    const singleCheckout = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );
    const groupCheckout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );
    const singleSettlement = read("lib/booking-settlement-server.ts");
    const groupSettlement = read(
      "lib/platform-held-group-settlement-server.ts"
    );

    expect(identity).toContain("getAccountStripeConnectIdentityStrict");
    expect(identity).toContain("return normalizeIdentity(accountId, canonical)");
    expect(connect).toContain("getCanonicalStripeConnectStrict");
    expect(connect).toContain("getProviderStripeDestinationStrict");

    for (const source of [
      singleCheckout,
      groupCheckout,
      singleSettlement,
      groupSettlement,
    ]) {
      expect(source).toContain("getProviderStripeDestinationStrict");
    }
  });

  it("keeps observation and reconciliation available while mutation gates are closed", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(runtime).toContain(
      "requireKlyxFinancialStripeObservationRuntime"
    );
    expect(runtime).toContain(
      "This path performs no new Stripe money movement."
    );
    expect(runtime).not.toMatch(
      /requireKlyxFinancialStripeObservationRuntime[\s\S]{0,1200}requireLiveOperationalReadiness/
    );
  });
});
