import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("KLYX LIVE financial runtime gate contract", () => {
  it("requires explicit arming and exact deployed/certified SHA equality", () => {
    const policy = source("lib/live-financial-runtime-policy.ts");

    expect(policy).toContain("KLYX_LIVE_FINANCIAL_STATE");
    expect(policy).toContain('"armed"');
    expect(policy).toContain("KLYX_LIVE_CERTIFIED_SHA");
    expect(policy).toContain("KLYX_DEPLOYED_SHA");
    expect(policy).toContain("certifiedSha.toLowerCase() === deployedSha.toLowerCase()");
    expect(policy).toContain("KLYX_LIVE_WEBHOOKS_READY");
    expect(policy).toContain("KLYX_LIVE_CONNECT_READY");
    expect(policy).toContain("KLYX_LIVE_CRITICAL_ALERTS_READY");
    expect(policy).toContain("KLYX_LIVE_DURABLE_JOBS_READY");
    expect(policy).toContain("KLYX_LIVE_LEDGER_READY");
    expect(policy).toContain("KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED");
    expect(policy).toContain("KLYX_LIVE_RECONCILIATION_READY");
    expect(policy).toContain("KLYX_SETTLEMENT_CONTROL_LIVE_READY");
  });

  it("checks operational truth before every new Stripe money side effect", () => {
    const gate = source("lib/live-financial-runtime-gate.ts");

    expect(gate).toContain("requireKlyxOpsCapabilityAvailable");
    expect(gate).toContain("financial_ledger_current");
    expect(gate).toContain("financial_reconciliation_current");
    expect(gate).toContain("ops_durable_job_dlq");
    expect(gate).toContain("severityCounts.critical");
  });

  it("gates checkout, transfer, reversal and refund writes", () => {
    const checkoutSources = [
      "app/api/stripe/create-checkout-session/route-core.ts",
      "app/api/stripe/create-group-checkout-session/route-core.ts",
      "app/api/bookings/split-missions/[id]/checkout/route-core.ts",
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts",
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts",
    ].map(source);

    for (const checkout of checkoutSources) {
      expect(checkout).toContain(
        'requireLiveFinancialMutationAuthorized({ mutation: "checkout" })'
      );
      expect(checkout).toContain("stripe.checkout.sessions.create(");
    }

    const singleSettlement = source("lib/booking-settlement-server.ts");
    expect(singleSettlement).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "transfer" })'
    );
    expect(singleSettlement).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "transfer_reversal" })'
    );
    expect(singleSettlement).toContain("stripe.transfers.create(");
    expect(singleSettlement).toContain("stripe.transfers.createReversal(");

    const groupSettlement = source(
      "lib/platform-held-group-settlement-server.ts"
    );
    expect(groupSettlement).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "transfer" })'
    );
    expect(groupSettlement).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "transfer_reversal" })'
    );
    expect(groupSettlement).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "refund" })'
    );

    const individualRefund = source("app/api/bookings/status/route-core.ts");
    const groupRefund = source(
      "app/api/booking-groups/[id]/cancellation/route-core.ts"
    );

    expect(individualRefund).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "refund" })'
    );
    expect(groupRefund).toContain(
      'requireLiveFinancialMutationAuthorized({ mutation: "refund" })'
    );
  });

  it("keeps webhook reconciliation independent from the master mutation gate", () => {
    const webhook = source("app/api/stripe/webhook/route.ts");

    expect(webhook).not.toContain("requireLiveFinancialMutationAuthorized");
    expect(webhook).toContain("claimStripeWebhookEvent");
    expect(webhook).toContain("markStripeWebhookProcessed");
    expect(webhook).toContain("reconcileStripeRefund");
  });

  it("requires Stripe object livemode to match the configured runtime", () => {
    const policy = source("lib/live-financial-runtime-policy.ts");
    const groupWebhook = source("lib/platform-held-group-payments.ts");
    const singleSettlement = source("lib/booking-settlement-server.ts");
    const recovery = source("lib/booking-settlement-reconciliation-server.ts");

    expect(policy).toContain("assertStripeFinancialObjectMode");
    expect(groupWebhook).toContain("assertStripeFinancialObjectMode");
    expect(singleSettlement).toContain("assertStripeFinancialObjectMode");
    expect(recovery).toContain("assertStripeFinancialObjectMode");
  });

  it("documents circuit-breaker rollback before environment rollback", () => {
    const runbook = source("docs/KLYX_LIVE_FINANCIAL_ACTIVATION.md");

    expect(runbook).toContain("Level 0 — Operations kill switch");
    expect(runbook).toContain("Level 1 — Disarm LIVE");
    expect(runbook).toContain("Level 2 — Traffic rollback");
    expect(runbook).toContain("Do not rotate webhook secrets");
    expect(runbook).toContain("Do not execute a second real transaction");
  });
});
