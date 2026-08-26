import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assessKlyxProviderPaymentReadiness } from "@/lib/klyx-provider-payment-readiness";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const onboardingRoute = read(
  "app/api/stripe/connect/create-account/route.ts"
);
const checkoutRoute = read(
  "app/api/stripe/create-checkout-session/route.ts"
);

describe("KLYX Stripe Connect onboarding before live payment activation", () => {
  it("allows a market-ready provider to complete Connect setup while real charges stay disabled", () => {
    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: false,
      marketCommerciallyReady: true,
      connected: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    });

    expect(readiness).toMatchObject({
      stripeConfigured: false,
      connectSetupAllowed: true,
      livePaymentsOperational: false,
      blockReason: "LIVE_PAYMENTS_DISABLED",
    });
  });

  it("keeps Connect setup closed for a market that KLYX has not approved", () => {
    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: false,
      marketCommerciallyReady: false,
      connected: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    });

    expect(readiness.connectSetupAllowed).toBe(false);
    expect(readiness.livePaymentsOperational).toBe(false);
  });

  it("treats onboarding as configuration rather than a live charge", () => {
    expect(onboardingRoute).toContain(
      "assertStripeRuntimeConfiguredForDiagnostics()"
    );
    expect(onboardingRoute).not.toContain("assertStripeRuntimeReady()");
    expect(onboardingRoute).toContain('type: "account_onboarding"');
  });

  it("still requires full live runtime readiness for client checkout", () => {
    expect(checkoutRoute).toContain("assertStripeRuntimeReady()");
  });
});
