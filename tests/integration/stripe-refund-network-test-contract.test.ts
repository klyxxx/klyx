import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function read(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = read(".github/workflows/klyx-stripe-network-test.yml");
const proof = read("scripts/golden-path-stripe-network-refund.mjs");

describe("KLYX Stripe refund network proof", () => {
  it("keeps the refund proof syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-stripe-network-refund.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs only inside the existing manual test-network workflow", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain(
      "node scripts/golden-path-stripe-network-refund.mjs"
    );
    expect(workflow.indexOf("golden-path-stripe-network-checkout.mjs")).toBeLessThan(
      workflow.indexOf("golden-path-stripe-network-refund.mjs")
    );
  });

  it("requires Stripe test keys, local Supabase and live payments disabled", () => {
    expect(proof).toContain('stripeSecretKey.startsWith("sk_test_")');
    expect(proof).toContain('stripePublishableKey.startsWith("pk_test_")');
    expect(proof).toContain("assertGoldenPathIsolation");
    expect(proof).toContain("if (!localSupabase)");
    expect(proof).toContain('process.env.KLYX_STRIPE_MODE !== "test"');
    expect(proof).toContain('process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "false"');
    expect(proof).not.toContain("sk_live_");
    expect(proof).not.toContain("pk_live_");
  });

  it("creates a real Stripe TEST PaymentIntent and refund through the real KLYX cancellation API", () => {
    expect(proof).toContain("stripe.paymentIntents.create");
    expect(proof).toContain('payment_method: "pm_card_visa"');
    expect(proof).toContain('intent.livemode !== false');
    expect(proof).toContain('path: "/api/bookings/status"');
    expect(proof).toContain('status: "cancelled"');
    expect(proof).toContain("stripe.refunds.retrieve");
    expect(proof).toContain('remoteRefund.livemode !== false');
    expect(proof).toContain('remoteRefund.status !== "succeeded"');
  });

  it("proves canonical refunded state, ledger, finance and webhook replay protection", () => {
    expect(proof).toContain('refundedBooking.payment_status !== "refunded"');
    expect(proof).toContain('refund_status !== "succeeded"');
    expect(proof).toContain('"payment_succeeded", "refund_succeeded"');
    expect(proof).toContain('path: "/api/provider/finance"');
    expect(proof).toContain("Number(finance?.summary?.refundedCents) !== 7000");
    expect(proof).toContain("duplicateRefundWebhook?.duplicate !== true");
  });

  it("does not claim real money, payout or Stripe-hosted webhook delivery", () => {
    expect(proof).toContain("realStripeHostedWebhookDeliveryClaimed: false");
    expect(proof).toContain("realMoneyMoved: false");
    expect(proof).toContain("payoutClaimed: false");
  });
});
