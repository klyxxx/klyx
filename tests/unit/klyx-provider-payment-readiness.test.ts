import { describe, expect, it } from "vitest";

import { assessKlyxProviderPaymentReadiness } from "../../lib/klyx-provider-payment-readiness";

const configuredStripe = {
  connected: true,
  onboardingComplete: true,
  chargesEnabled: true,
  payoutsEnabled: true,
};

describe("KLYX provider payment readiness", () => {
  it("live open market with configured Stripe is operational", () => {
    const result = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: true,
      marketCommerciallyReady: true,
      ...configuredStripe,
    });

    expect(result.stripeConfigured).toBe(true);
    expect(result.connectSetupAllowed).toBe(true);
    expect(result.livePaymentsOperational).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it("live closed market stays fail-closed even when Stripe is configured", () => {
    const result = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: true,
      marketCommerciallyReady: false,
      ...configuredStripe,
    });

    expect(result.stripeConfigured).toBe(true);
    expect(result.connectSetupAllowed).toBe(false);
    expect(result.livePaymentsOperational).toBe(false);
    expect(result.blockReason).toBe("MARKET_NOT_COMMERCIALLY_READY");
  });

  it("test mode can configure Stripe without claiming real payments are operational", () => {
    const result = assessKlyxProviderPaymentReadiness({
      runtimeMode: "test",
      livePaymentsEnabled: false,
      marketCommerciallyReady: false,
      ...configuredStripe,
    });

    expect(result.stripeConfigured).toBe(true);
    expect(result.connectSetupAllowed).toBe(true);
    expect(result.livePaymentsOperational).toBe(false);
    expect(result.blockReason).toBe("TEST_MODE");
  });

  it("live open market with incomplete Stripe stays configurable but not operational", () => {
    const result = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: true,
      marketCommerciallyReady: true,
      connected: true,
      onboardingComplete: true,
      chargesEnabled: false,
      payoutsEnabled: false,
    });

    expect(result.stripeConfigured).toBe(false);
    expect(result.connectSetupAllowed).toBe(true);
    expect(result.livePaymentsOperational).toBe(false);
    expect(result.blockReason).toBe("STRIPE_NOT_CONFIGURED");
  });

  it("disabled live payments block operation and setup", () => {
    const result = assessKlyxProviderPaymentReadiness({
      runtimeMode: "live",
      livePaymentsEnabled: false,
      marketCommerciallyReady: true,
      ...configuredStripe,
    });

    expect(result.connectSetupAllowed).toBe(false);
    expect(result.livePaymentsOperational).toBe(false);
    expect(result.blockReason).toBe("LIVE_PAYMENTS_DISABLED");
  });
});
