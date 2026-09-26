import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`function ${name}`);
  expect(start).toBeGreaterThan(-1);

  const nextExport = source.indexOf("\nexport ", start + 1);
  return source.slice(start, nextExport > start ? nextExport : source.length);
}

describe("KLYX financial Stripe observation vs mutation authority", () => {
  const runtime = read("lib/klyx-financial-stripe-runtime.ts");
  const stripeRuntime = read("lib/stripe-runtime.ts");

  it("keeps observation independent from kill-switch/canary authorization", () => {
    const observation = functionBody(
      runtime,
      "requireKlyxFinancialStripeObservationRuntime"
    );

    expect(observation).toContain(
      "assertStripeObservationRuntimeConfigured"
    );
    expect(observation).not.toContain("requireOpsPayments");
    expect(observation).not.toContain(
      "KLYX_LIVE_CERTIFICATION_PROFILE_ID"
    );
    expect(observation).not.toContain(
      "KLYX_LIVE_PAYMENTS_ENABLED"
    );
    expect(observation).not.toContain(
      "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
    );
    expect(observation).not.toContain(
      "KLYX_DR_CERTIFIED_SHA"
    );
  });

  it("keeps mutation authorization fail-closed on Ops + exact LIVE boundaries", () => {
    const mutation = functionBody(
      runtime,
      "requireKlyxFinancialStripeRuntime"
    );

    expect(mutation).toContain("requireExactLiveShaBoundary");
    expect(mutation).toContain("requireLiveOperationalReadiness");
    expect(mutation).toContain(
      "requireKlyxFinancialLiveAuthority"
    );
    expect(mutation).toContain(
      "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
    );
    expect(mutation).toContain(
      "KLYX_LIVE_PAYMENTS_ENABLED"
    );

    expect(runtime).toContain("requireOpsCapability");
    expect(runtime).toContain("requireLiveRuntimeHeartbeats");
    expect(runtime).toContain("requireCanonicalLedgerHealthy");
    expect(runtime).toContain("requireNoBlockingFinancialRuntimeTruth");
    expect(runtime).toContain("requireFinancialDlqEmpty");
    expect(runtime).not.toContain("requireNoOpenFinancialReconciliation");
    expect(runtime).not.toContain("requireNoCriticalFinancialSignal");
  });

  it("validates only server key/mode for Stripe truth observation", () => {
    const observation = functionBody(
      stripeRuntime,
      "assertStripeObservationRuntimeConfigured"
    );

    expect(observation).toContain(
      'check.key === "secret_key"'
    );
    expect(observation).not.toContain("live_switch");
    expect(observation).not.toContain("publishable_key");
    expect(observation).not.toContain("app_url");
  });

  it("uses observation authority for signed webhooks and reconciliation", () => {
    for (const file of [
      "app/api/stripe/webhook/route.ts",
      "lib/stripe-payments.ts",
      "lib/stripe-refunds.ts",
      "lib/platform-held-group-payments.ts",
      "lib/booking-settlement-reconciliation-server.ts",
      "lib/financial-ledger-reconciliation-server.ts",
    ]) {
      expect(read(file)).toContain(
        "requireKlyxFinancialStripeObservationRuntime"
      );
    }
  });

  it("keeps outgoing financial mutations on mutation authority", () => {
    const singleSettlement = read(
      "lib/booking-settlement-server.ts"
    );
    const groupSettlement = read(
      "lib/platform-held-group-settlement-server.ts"
    );
    const singleCheckout = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );
    const splitCheckout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );
    const refundRoute = read(
      "app/api/bookings/status/route-core.ts"
    );

    expect(singleSettlement).toContain(
      "requireKlyxFinancialStripeRuntimeForBooking"
    );
    expect(groupSettlement).toContain(
      "requireKlyxFinancialStripeRuntime"
    );
    expect(singleCheckout).toContain(
      "requireKlyxFinancialStripeRuntime"
    );
    expect(splitCheckout).toContain(
      "requireKlyxFinancialStripeRuntime"
    );
    expect(refundRoute).toContain(
      "requireKlyxFinancialStripeRuntime"
    );

    for (const source of [
      singleSettlement,
      groupSettlement,
      singleCheckout,
      splitCheckout,
      refundRoute,
    ]) {
      expect(source).not.toContain(
        "requireKlyxFinancialStripeObservationRuntime().key"
      );
    }
  });

  it("keeps recipient readiness mode-aware and country-agnostic", () => {
    const singleCheckout = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );
    const splitCheckout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );

    expect(singleCheckout).toContain(
      'const expectedLive = financialRuntime.mode !== "test"'
    );
    expect(singleCheckout).toContain(
      "expectedProviderCountry"
    );
    expect(singleCheckout).toContain(
      "providerRecipientAccount.livemode === expectedLive"
    );
    expect(singleCheckout).not.toContain(
      'providerRecipientAccount.identity?.country === "BE"'
    );

    expect(splitCheckout).toContain(
      'remoteAccount.livemode === (input.stripeRuntimeMode === "live")'
    );
    expect(splitCheckout).not.toContain(
      "remoteAccount.livemode === false"
    );
  });

  it("never lets observation helpers create Stripe money movement", () => {
    for (const file of [
      "app/api/stripe/webhook/route.ts",
      "lib/stripe-payments.ts",
      "lib/stripe-refunds.ts",
      "lib/financial-ledger-reconciliation-server.ts",
    ]) {
      const source = read(file);

      expect(source).not.toContain("stripe.transfers.create(");
      expect(source).not.toContain(
        "stripe.transfers.createReversal("
      );
      expect(source).not.toContain("stripe.payouts.create(");
    }
  });
});
