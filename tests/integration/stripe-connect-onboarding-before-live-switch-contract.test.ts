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
const connectPage = read("app/connect/page.tsx");
const checkoutRoute = read(
  "app/api/stripe/create-checkout-session/route.ts"
);
const groupCheckoutRoute = read(
  "app/api/stripe/create-group-checkout-session/route.ts"
);

describe("KLYX Stripe Connect onboarding before live payment activation", () => {
  it("allows a provider to complete Connect setup while real charges stay disabled", () => {
    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: false,
      marketCommerciallyReady: false,
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

  it("still blocks real payments after setup when the market is not commercially ready", () => {
    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: true,
      marketCommerciallyReady: false,
      connected: true,
      onboardingComplete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    });

    expect(readiness.connectSetupAllowed).toBe(true);
    expect(readiness.livePaymentsOperational).toBe(false);
    expect(readiness.blockReason).toBe("MARKET_NOT_COMMERCIALLY_READY");
  });

  it("treats onboarding as configuration rather than a live charge", () => {
    expect(onboardingRoute).toContain(
      "assertStripeRuntimeConfiguredForDiagnostics()"
    );
    expect(onboardingRoute).not.toContain("assertStripeRuntimeReady()");
    expect(onboardingRoute).toContain('type: "account_onboarding"');
    expect(onboardingRoute).toContain(
      'marketReadiness.monetarySupport !== "supported"'
    );
    expect(onboardingRoute).not.toContain("assessKlyxMarketReadiness");
  });

  it("keeps a dedicated KLYX entry point for provider KYC and payout setup", () => {
    expect(connectPage).toContain('/api/stripe/connect/create-account');
    expect(connectPage).toContain("Configurer mes versements");
    expect(connectPage).toContain("Stripe vérifie ton identité et tes coordonnées bancaires");
  });

  it("still requires full live runtime readiness for every client checkout", () => {
    expect(checkoutRoute).toContain("assertStripeRuntimeReady()");
    expect(groupCheckoutRoute).toContain("assertStripeRuntimeReady");
  });
});
