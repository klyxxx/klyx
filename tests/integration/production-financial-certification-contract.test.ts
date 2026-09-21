import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const verifier = read(
  "scripts/verify-klyx-production-financial-certification.mjs"
);
const workflow = read(
  ".github/workflows/klyx-production-financial-certification.yml"
);
const runtime = read("lib/klyx-financial-stripe-runtime.ts");
const stripeRuntime = read("lib/stripe-runtime.ts");
const health = read("app/api/health/build/route.ts");
const webhookEvents = read("lib/stripe-webhook-events.ts");
const webhookAudit = read(
  "supabase/migrations/20260921180000_klyx_stripe_webhook_delivery_audit.sql"
);
const readiness = read(
  "app/api/founder/transaction-readiness/route.ts"
);
const docs = read(
  "docs/KLYX_PRODUCTION_FINANCIAL_CERTIFICATION.md"
);
const reconciliation = read(
  "lib/financial-ledger-reconciliation-server.ts"
);

describe("KLYX Mission 1 production financial certification contract", () => {
  it("requires the exact ten-by-four controlled production matrix", () => {
    for (const scenario of [
      "happy_path",
      "partial_refund",
      "full_refund",
      "reversal",
      "failed_payment",
      "failed_transfer",
      "late_webhook",
      "duplicate_webhook",
      "timeout",
      "recovery",
    ]) {
      expect(verifier).toContain('"' + scenario + '"');
      expect(docs).toContain(String.fromCharCode(96) + scenario + String.fromCharCode(96));
    }

    for (const topology of [
      "single",
      "group",
      "split",
      "multi_provider",
    ]) {
      expect(verifier).toContain('"' + topology + '"');
      expect(docs).toContain(String.fromCharCode(96) + topology + String.fromCharCode(96));
    }

    expect(verifier).toContain(
      "manifest.cells.length === 40"
    );
    expect(verifier).toContain(
      "KLYX_CERT_MATRIX_MUST_HAVE_40_CELLS"
    );
    expect(verifier).toContain(
      "KLYX_CERT_BOOKING_REUSED_ACROSS_CELLS"
    );
    expect(docs).toContain("40 required cells");
  });

  it("never treats one successful payment or readiness preflight as certification", () => {
    expect(docs).toContain(
      "A successful customer payment is **not** Mission 1 certification."
    );
    expect(readiness).toContain(
      "A successful payment alone never certifies Mission 1."
    );
    expect(readiness).toContain(
      'readinessScope: "transaction_preflight_only"'
    );
    expect(readiness).toContain(
      'status: "separate_exact_sha_gate_required"'
    );
    expect(readiness).toContain(
      "Toute mutation financière doit rester fail-closed."
    );
    expect(readiness).toContain(
      "KLYX Production Financial Certification"
    );
  });

  it("requires deployed, DR and controlled-certification SHA evidence", () => {
    expect(runtime).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(runtime).toContain("KLYX_DR_CERTIFIED_SHA");
    expect(runtime).toContain("KLYX_LIVE_CERTIFICATION_SHA");
    expect(runtime).toContain(
      "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
    );
    expect(runtime).toContain(
      "KLYX_FINANCIAL_RUNTIME_DR_SHA_MISMATCH"
    );
    expect(runtime).toContain(
      "KLYX_FINANCIAL_RUNTIME_CERTIFICATION_SHA_MISMATCH"
    );
    expect(stripeRuntime).toContain(
      'key: "financial_certification_sha"'
    );

    expect(health).toContain("drShaMatchesDeployment");
    expect(health).toContain("certificationShaMatchesDeployment");
    expect(health).toContain(
      "financialCertifiedShaMatchesDeployment"
    );
    expect(health).toContain("stripeSecretModeCompatible");
    expect(health).toContain("stripeWebhookConfigured");
    expect(health).toContain("certificationProfileConfigured");
  });

  it("keeps general LIVE off during certification and restricts canary bookings to one profile", () => {
    expect(runtime).toContain(
      "KLYX_LIVE_CERTIFICATION_ENABLED"
    );
    expect(runtime).toContain(
      "KLYX_LIVE_CERTIFICATION_PROFILE_ID"
    );
    expect(runtime).toContain(
      "KLYX_FINANCIAL_RUNTIME_CERTIFICATION_PROFILE_BLOCKED"
    );

    expect(verifier).toContain(
      "KLYX_CERT_GENERAL_LIVE_MUST_REMAIN_OFF"
    );
    expect(verifier).toContain(
      "KLYX_CERT_CONTROLLED_LIVE_NOT_ENABLED"
    );
    expect(verifier).toContain(
      "KLYX_CERT_PROFILE_BOOKING_MISMATCH"
    );
    expect(verifier).toContain(
      "KLYX_CERT_STRIPE_RUNTIME_KEY_MODE_MISMATCH"
    );
    expect(verifier).toContain(
      "KLYX_CERT_STRIPE_WEBHOOK_NOT_CONFIGURED"
    );
  });

  it("certifies through the existing central reconciliation authority", () => {
    expect(verifier).toContain(
      '"/api/ops/financial-reconciliation"'
    );
    expect(verifier).toContain(
      'body?.result?.status === "coherent"'
    );
    expect(verifier).toContain(
      '"financial_reconciliation_current"'
    );
    expect(verifier).toContain(
      "KLYX_CERT_OPEN_RECONCILIATION_BEFORE"
    );
    expect(verifier).toContain(
      "KLYX_CERT_OPEN_RECONCILIATION_AFTER"
    );

    expect(reconciliation).toContain("compareLocalTruth(local)");
    expect(reconciliation).toContain("compareStripeTruth({");
    expect(reconciliation).toContain(
      "openFinancialReconciliationCase"
    );
  });

  it("does not create financial side effects from the certification verifier", () => {
    for (const forbidden of [
      "stripe.paymentIntents.create(",
      "stripe.checkout.sessions.create(",
      "stripe.transfers.create(",
      "stripe.transfers.createReversal(",
      "stripe.refunds.create(",
      "stripe.payouts.create(",
      '.from("financial_reconciliation_cases").update(',
    ]) {
      expect(verifier).not.toContain(forbidden);
    }

    expect(workflow).toContain("supabase db push");
    expect(workflow).toContain("--dry-run");
    expect(workflow).toContain(
      "scripts/verify-klyx-production-financial-certification.mjs"
    );
    expect(workflow).not.toContain(
      "scripts/certify-production-financial-matrix.mjs"
    );
  });

  it("is manual-only, exact-main, DR-gated and publishes a dedicated commit status", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("\npush:");
    expect(workflow).toContain(
      "KLYX Disaster Recovery Certification"
    );
    expect(workflow).toContain(
      "KLYX Production Financial Certification"
    );
    expect(workflow).toContain(
      "CERTIFY_CONTROLLED_LIVE_FINANCE"
    );
    expect(workflow).toContain(
      'if [ "$GITHUB_SHA" != "$KLYX_EXPECTED_SHA" ]'
    );
    expect(workflow).toContain(
      "/git/ref/heads/main"
    );
  });

  it("persists duplicate webhook delivery evidence without replaying financial effects", () => {
    expect(webhookAudit).toContain(
      "delivery_count integer"
    );
    expect(webhookAudit).toContain(
      "klyx_record_stripe_webhook_redelivery"
    );
    expect(webhookAudit).toContain(
      "delivery_count = e.delivery_count + 1"
    );
    expect(webhookEvents).toContain(
      '"klyx_record_stripe_webhook_redelivery"'
    );
    expect(webhookEvents).toContain(
      'reason: "already_processed"'
    );
    expect(webhookEvents).not.toContain("stripe.transfers.create");
    expect(webhookEvents).not.toContain("stripe.refunds.create");
    expect(verifier).toContain(
      "KLYX_CERT_DUPLICATE_WEBHOOK_DELIVERY_MISSING"
    );
  });

  it("keeps automated Stripe network proofs TEST-only", () => {
    for (const file of [
      ".github/workflows/klyx-stripe-network-test.yml",
      ".github/workflows/klyx-stripe-split-settlement-network.yml",
      ".github/workflows/klyx-stripe-group-multiexecutor-network.yml",
    ]) {
      const source = read(file);
      expect(source).toContain('KLYX_STRIPE_MODE: "test"');
      expect(source).toContain(
        'KLYX_LIVE_PAYMENTS_ENABLED: "false"'
      );
    }
  });

  it("fails closed on every required negative-path evidence gap", () => {
    for (const code of [
      "KLYX_CERT_FAILED_PAYMENT_LIVE_WEBHOOK_MISSING",
      "KLYX_CERT_FAILED_TRANSFER_STATE_MISSING",
      "KLYX_CERT_LATE_WEBHOOK_RECOVERY_EVENT_MISSING",
      "KLYX_CERT_DUPLICATE_WEBHOOK_DELIVERY_MISSING",
      "KLYX_CERT_TIMEOUT_EVIDENCE_MISSING",
      "KLYX_CERT_RECOVERY_EVENT_MISSING",
    ]) {
      expect(verifier).toContain(code);
    }
  });
});
