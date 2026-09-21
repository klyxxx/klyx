import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("KLYX real financial Ops heartbeat producers", () => {
  const heartbeat = read("lib/ops-runtime-heartbeat-server.ts");
  const worker = read("lib/financial-durable-worker-server.ts");
  const workerRoute = read(
    "app/api/ops/financial-durable-worker/route.ts"
  );
  const alert = read("lib/critical-alert-delivery-server.ts");
  const alertRoute = read(
    "app/api/ops/critical-alert-delivery/route.ts"
  );
  const workflow = read(
    ".github/workflows/klyx-financial-ops-pulse.yml"
  );
  const runtime = read("lib/klyx-financial-stripe-runtime.ts");
  const reconciliationRoute = read(
    "app/api/ops/financial-reconciliation/route.ts"
  );

  it("binds every heartbeat to the deployed Vercel SHA, never caller input", () => {
    expect(heartbeat).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(heartbeat).toContain(
      '"klyx_record_ops_runtime_heartbeat"'
    );
    expect(heartbeat).toContain("p_source_sha: sourceSha");
    expect(heartbeat).not.toContain("input.sourceSha");
    expect(heartbeat).not.toContain("request.headers");
  });

  it("runs a real fenced durable worker on one allowlisted reconciliation job", () => {
    expect(worker).toContain("claimKlyxDurableJobs");
    expect(worker).toContain("completeKlyxDurableJob");
    expect(worker).toContain("failKlyxDurableJob");
    expect(worker).toContain(
      '"financial_reconciliation_booking"'
    );
    expect(worker).toContain("reconcileCentralFinancialTruth");
    expect(worker).toContain(
      'component: "financial_durable_worker"'
    );

    for (const forbidden of [
      "stripe.transfers.create(",
      "stripe.transfers.createReversal(",
      "stripe.refunds.create(",
      "stripe.checkout.sessions.create(",
      "stripe.payouts.create(",
      "releasePlatformHeldBookingSettlement(",
    ]) {
      expect(worker).not.toContain(forbidden);
    }
  });

  it("exposes an idempotent durable enqueue boundary without replacing synchronous reconciliation", () => {
    expect(worker).toContain("enqueueKlyxDurableJob");
    expect(worker).toContain(
      "financial-reconciliation:${bookingId}:${requestKey}"
    );
    expect(reconciliationRoute).toContain(
      "enqueueKlyxFinancialReconciliationJob"
    );
    expect(reconciliationRoute).toContain("body.durable === true");
    expect(reconciliationRoute).toContain(
      "reconcileCentralFinancialTruth({ bookingId })"
    );
  });

  it("uses critical monitoring as a real GitHub Actions failure signal", () => {
    expect(alert).toContain(
      "getKlyxObservabilityFinancialMonitoringSnapshot"
    );
    expect(alert).toContain("snapshot.severityCounts.critical");
    expect(alert).toContain(
      'component: "critical_alert_delivery"'
    );
    expect(alertRoute).toContain(
      "KLYX_CRITICAL_FINANCIAL_SIGNAL_OPEN"
    );
    expect(alertRoute).toContain("healthy ? 200 : 503");
  });

  it("authenticates both scheduled Ops endpoints with the existing finance Ops secret", () => {
    for (const source of [workerRoute, alertRoute]) {
      expect(source).toContain("isKlyxFinancialOpsConfigured");
      expect(source).toContain("isKlyxFinancialOpsAuthorized");
      expect(source).toContain('"Cache-Control": "no-store"');
    }

    const auth = read("lib/financial-ops-auth-server.ts");
    expect(auth).toContain(
      '"KLYX_FINANCIAL_RECONCILIATION_SECRET"'
    );
    expect(auth).toContain("timingSafeEqual");
  });

  it("runs every five minutes and turns degraded finance into a failed scheduled workflow", () => {
    expect(workflow).toContain(
      "name: KLYX Financial Operations Pulse"
    );
    expect(workflow).toContain('cron: "3-58/5 * * * *"');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain(
      "secrets.KLYX_FINANCIAL_RECONCILIATION_SECRET"
    );
    expect(workflow).toContain(
      "/api/ops/financial-durable-worker"
    );
    expect(workflow).toContain(
      "/api/ops/critical-alert-delivery"
    );
    expect(workflow).toContain("curl --fail-with-body");
    expect(workflow).not.toContain("STRIPE_SECRET_KEY");
  });

  it("keeps the LIVE gate fail-closed with a scheduler-compatible freshness budget", () => {
    expect(runtime).toContain(
      "const LIVE_HEARTBEAT_MAX_AGE_MS = 15 * 60 * 1000"
    );
    expect(runtime).toContain("financial_durable_worker");
    expect(runtime).toContain("critical_alert_delivery");
    expect(runtime).toContain('row.status !== "healthy"');
    expect(runtime).toContain(
      "row.source_sha?.trim().toLowerCase() !== deployedSha"
    );
  });
});
