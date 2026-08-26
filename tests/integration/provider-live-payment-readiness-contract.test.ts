import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("KLYX provider live payment readiness contract", () => {
  it("Connect status combines Stripe runtime, market readiness and provider payment readiness", () => {
    const route = source("app/api/stripe/connect/status/route.ts");
    const readiness = source("lib/klyx-provider-payment-readiness.ts");

    expect(route).toMatch(/assertStripeRuntimeConfiguredForDiagnostics/);
    expect(route).not.toMatch(/assertStripeRuntimeReady/);
    expect(route).toMatch(/export async function GET/);
    expect(route).not.toMatch(/export async function POST/);
    expect(route).toMatch(/getKlyxMarketReadiness/);
    expect(route).toMatch(/assessKlyxMarketReadiness/);
    expect(route).toMatch(/assessKlyxProviderPaymentReadiness/);
    expect(route).toMatch(/marketCommerciallyReady/);
    expect(route).toMatch(/marketBlockers/);
    expect(route).toMatch(/\.\.\.readiness/);
    expect(route).toMatch(/paymentBlockReason/);
    expect(readiness).toMatch(/connectSetupAllowed/);
    expect(readiness).toMatch(/livePaymentsOperational/);
  });

  it("provider payments uses live KLYX readiness for the global payment state", () => {
    const page = source("app/provider/payments/page.tsx");

    expect(page).toMatch(/status\.livePaymentsOperational/);
    expect(page).toMatch(/status\.connectSetupAllowed/);
    expect(page).toMatch(/Paiements réels pas encore ouverts dans ce pays/);
    expect(page).toMatch(/Stripe configuré en mode test/);
    expect(page).toMatch(/Paiements Stripe/);
    expect(page).toMatch(/Virements Stripe/);
    expect(page).not.toMatch(
      /const fullyReady\s*=\s*status\.connected\s*&&\s*status\.onboardingComplete\s*&&\s*status\.chargesEnabled\s*&&\s*status\.payoutsEnabled/
    );
  });

  it("provider onboarding cannot complete payments from raw Stripe flags alone", () => {
    const progress = source("app/onboarding/ProviderOnboardingProgress.tsx");

    expect(progress).toMatch(/stripe\?\.livePaymentsOperational/);
    expect(progress).toMatch(/stripe\?\.stripeConfigured/);
    expect(progress).toMatch(/translateKlyxProviderPaymentReadiness/);
    expect(progress).not.toMatch(
      /stripe\?\.connected\s*&&\s*stripe\.onboardingComplete\s*&&\s*stripe\.chargesEnabled\s*&&\s*stripe\.payoutsEnabled/
    );
  });

  it("transactional Stripe routes keep the strict runtime authority", () => {
    const transactionalRoutes = [
      source("app/api/stripe/connect/create-account/route.ts"),
      source("app/api/stripe/create-checkout-session/route.ts"),
      source("app/api/stripe/create-group-checkout-session/route.ts"),
    ];

    for (const route of transactionalRoutes) {
      expect(route).toMatch(/assertStripeRuntimeReady/);
      expect(route).not.toMatch(/assertStripeRuntimeConfiguredForDiagnostics/);
    }

    const connectCreate = transactionalRoutes[0];
    expect(connectCreate).toMatch(/KLYX_MARKET_NOT_COMMERCIALLY_READY/);
    expect(connectCreate).toMatch(/assessKlyxMarketReadiness/);
    expect(connectCreate).toMatch(/stripeRuntime\.mode === "live"/);
  });
});
