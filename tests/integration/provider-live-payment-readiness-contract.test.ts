import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Connect status combines Stripe runtime, market readiness and Stripe flags", () => {
  const route = source("app/api/stripe/connect/status/route.ts");

  assert.match(route, /getKlyxMarketReadiness/);
  assert.match(route, /assessKlyxMarketReadiness/);
  assert.match(route, /assessKlyxProviderPaymentReadiness/);
  assert.match(route, /marketCommerciallyReady/);
  assert.match(route, /marketBlockers/);
  assert.match(route, /connectSetupAllowed/);
  assert.match(route, /livePaymentsOperational/);
  assert.match(route, /paymentBlockReason/);
});

test("provider payments uses live KLYX readiness for the global payment state", () => {
  const page = source("app/provider/payments/page.tsx");

  assert.match(page, /status\.livePaymentsOperational/);
  assert.match(page, /status\.connectSetupAllowed/);
  assert.match(page, /Paiements réels pas encore ouverts dans ce pays/);
  assert.match(page, /Stripe configuré en mode test/);
  assert.match(page, /Paiements Stripe/);
  assert.match(page, /Virements Stripe/);
  assert.doesNotMatch(
    page,
    /const fullyReady\s*=\s*status\.connected\s*&&\s*status\.onboardingComplete\s*&&\s*status\.chargesEnabled\s*&&\s*status\.payoutsEnabled/
  );
});

test("provider onboarding cannot complete payments from raw Stripe flags alone", () => {
  const progress = source("app/onboarding/ProviderOnboardingProgress.tsx");

  assert.match(progress, /stripe\?\.livePaymentsOperational/);
  assert.match(progress, /stripe\?\.stripeConfigured/);
  assert.match(progress, /translateKlyxProviderPaymentReadiness/);
  assert.doesNotMatch(
    progress,
    /stripe\?\.connected\s*&&\s*stripe\.onboardingComplete\s*&&\s*stripe\.chargesEnabled\s*&&\s*stripe\.payoutsEnabled/
  );
});

test("Connect account creation remains the final live-market authority", () => {
  const route = source("app/api/stripe/connect/create-account/route.ts");

  assert.match(route, /KLYX_MARKET_NOT_COMMERCIALLY_READY/);
  assert.match(route, /assessKlyxMarketReadiness/);
  assert.match(route, /stripeRuntime\.mode === "live"/);
});
