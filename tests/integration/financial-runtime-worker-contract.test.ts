import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("KLYX financial runtime worker contract", () => {
  it("installs a fail-closed Supabase scheduler with Vault-only raw secret", () => {
    const migration = read(
      "supabase/migrations/20260921190000_klyx_financial_runtime_scheduler.sql"
    );

    expect(migration).toContain("create extension if not exists pg_cron");
    expect(migration).toContain("create extension if not exists pg_net");
    expect(migration).toContain("ops_financial_runtime_scheduler");
    expect(migration).toContain("financial_runtime_tick");
    expect(migration).toContain("false");
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).toContain("klyx_financial_scheduler_token");
    expect(migration).toContain("token_sha256");
    expect(migration).toContain("net.http_post");
    expect(migration).toContain("'* * * * *'");
    expect(migration).not.toMatch(
      /Bearer\s+[A-Za-z0-9_-]{32,}/
    );
  });

  it("uses the canonical durable queue instead of inventing another queue", () => {
    const worker = read("lib/financial-runtime-worker-server.ts");

    expect(worker).toContain("enqueueKlyxDurableJob");
    expect(worker).toContain("claimKlyxDurableJobs");
    expect(worker).toContain("completeKlyxDurableJob");
    expect(worker).toContain("failKlyxDurableJob");
    expect(worker).toContain('"financial_reconciliation"');
    expect(worker).toContain('"critical_alert_delivery"');
    expect(worker).not.toContain("stripe.transfers.create(");
    expect(worker).not.toContain("stripe.refunds.create(");
    expect(worker).not.toContain("stripe.checkout.sessions.create(");
  });

  it("reuses central financial reconciliation as the only repair authority", () => {
    const worker = read("lib/financial-runtime-worker-server.ts");

    expect(worker).toContain("reconcileCentralFinancialTruth");
    expect(worker).toContain("financial_reconciliation_current");
    expect(worker).toContain(
      "KLYX_FINANCIAL_WORKER_RECONCILIATION_STILL_OPEN"
    );
  });

  it("delivers critical alerts through the deduplicated email registry", () => {
    const worker = read("lib/financial-runtime-worker-server.ts");

    expect(worker).toContain("sendKlyxDeduplicatedEmail");
    expect(worker).toContain("critical_operational_alert");
    expect(worker).toContain(
      "critical_operational_alert_sentinel"
    );
    expect(worker).toContain("emailAlreadySent");
    expect(worker).toContain("Aucune donnée utilisateur");
  });

  it("keeps the daily sentinel idempotency fingerprint stable across repeated ticks", () => {
    const worker = read("lib/financial-runtime-worker-server.ts");
    const durableJobsMigration = read(
      "supabase/migrations/20260920190000_klyx_durable_jobs_retry_dlq.sql"
    );

    expect(worker).toContain("function criticalAlertSentinelIdentity");
    expect(worker).toContain(
      "const dayBucket = now.toISOString().slice(0, 10)"
    );
    expect(worker).toContain(
      "`klyx-critical-alert-sentinel:${dayBucket}`"
    );
    expect(worker).toContain(
      "`${dayBucket}T00:00:00.000Z`"
    );
    expect(worker).toContain(
      "criticalAlertSentinelIdentity();"
    );
    expect(worker).toContain("occurredAt,");
    expect(worker).not.toContain(
      "occurredAt: new Date().toISOString()"
    );

    // The worker must adapt to canonical idempotency, not weaken it.
    expect(durableJobsMigration).toContain(
      "KLYX_DURABLE_JOB_IDEMPOTENCY_CONFLICT"
    );
    expect(durableJobsMigration).toContain("request_fingerprint");
  });

  it("records worker and alert heartbeats only from the deployed SHA", () => {
    const worker = read("lib/financial-runtime-worker-server.ts");

    expect(worker).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(worker).toContain("financial_durable_worker");
    expect(worker).toContain("critical_alert_delivery");
    expect(worker).toContain("klyx_record_ops_runtime_heartbeat");
  });

  it("requires a recent actually-sent alert sentinel before LIVE money movement", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(runtime).toContain("requireRecentCriticalAlertSentinel");
    expect(runtime).toContain(
      "critical_operational_alert_sentinel"
    );
    expect(runtime).toContain(
      "KLYX_FINANCIAL_RUNTIME_ALERT_SENTINEL_NOT_READY"
    );
    expect(runtime).toContain("36 * 60 * 60 * 1000");
  });

  it("keeps the internal endpoint POST-only and bearer-hash authenticated", () => {
    const route = read(
      "app/api/ops/financial-runtime-tick/route.ts"
    );
    const worker = read("lib/financial-runtime-worker-server.ts");

    expect(route).toContain("export async function POST");
    expect(route).not.toContain("export async function GET");
    expect(route).toContain("authorizeFinancialRuntimeTick");
    expect(worker).toContain("timingSafeEqual");
    expect(worker).toContain("sha256(token)");
    expect(worker).toContain("KLYX_FINANCIAL_WORKER_DISABLED");
  });

  it("makes scheduler, worker, alert heartbeat and sentinel visible to Founder readiness", () => {
    const readiness = read(
      "app/api/founder/transaction-readiness/route.ts"
    );

    expect(readiness).toContain("financial_runtime_scheduler");
    expect(readiness).toContain("financial_worker_heartbeat");
    expect(readiness).toContain("critical_alert_heartbeat");
    expect(readiness).toContain("critical_alert_sentinel");
  });
});
