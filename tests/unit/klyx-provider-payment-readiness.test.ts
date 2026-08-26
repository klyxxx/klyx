import assert from "node:assert/strict";
import test from "node:test";

import { assessKlyxProviderPaymentReadiness } from "../../lib/klyx-provider-payment-readiness";

const configuredStripe = {
  connected: true,
  onboardingComplete: true,
  chargesEnabled: true,
  payoutsEnabled: true,
};

test("live open market with configured Stripe is operational", () => {
  const result = assessKlyxProviderPaymentReadiness({
    runtimeMode: "live",
    livePaymentsEnabled: true,
    marketCommerciallyReady: true,
    ...configuredStripe,
  });

  assert.equal(result.stripeConfigured, true);
  assert.equal(result.connectSetupAllowed, true);
  assert.equal(result.livePaymentsOperational, true);
  assert.equal(result.blockReason, null);
});

test("live closed market stays fail-closed even when Stripe is configured", () => {
  const result = assessKlyxProviderPaymentReadiness({
    runtimeMode: "live",
    livePaymentsEnabled: true,
    marketCommerciallyReady: false,
    ...configuredStripe,
  });

  assert.equal(result.stripeConfigured, true);
  assert.equal(result.connectSetupAllowed, false);
  assert.equal(result.livePaymentsOperational, false);
  assert.equal(result.blockReason, "MARKET_NOT_COMMERCIALLY_READY");
});

test("test mode can configure Stripe without claiming real payments are operational", () => {
  const result = assessKlyxProviderPaymentReadiness({
    runtimeMode: "test",
    livePaymentsEnabled: false,
    marketCommerciallyReady: false,
    ...configuredStripe,
  });

  assert.equal(result.stripeConfigured, true);
  assert.equal(result.connectSetupAllowed, true);
  assert.equal(result.livePaymentsOperational, false);
  assert.equal(result.blockReason, "TEST_MODE");
});

test("live open market with incomplete Stripe stays configurable but not operational", () => {
  const result = assessKlyxProviderPaymentReadiness({
    runtimeMode: "live",
    livePaymentsEnabled: true,
    marketCommerciallyReady: true,
    connected: true,
    onboardingComplete: true,
    chargesEnabled: false,
    payoutsEnabled: false,
  });

  assert.equal(result.stripeConfigured, false);
  assert.equal(result.connectSetupAllowed, true);
  assert.equal(result.livePaymentsOperational, false);
  assert.equal(result.blockReason, "STRIPE_NOT_CONFIGURED");
});

test("disabled live payments block operation and setup", () => {
  const result = assessKlyxProviderPaymentReadiness({
    runtimeMode: "live",
    livePaymentsEnabled: false,
    marketCommerciallyReady: true,
    ...configuredStripe,
  });

  assert.equal(result.connectSetupAllowed, false);
  assert.equal(result.livePaymentsOperational, false);
  assert.equal(result.blockReason, "LIVE_PAYMENTS_DISABLED");
});
