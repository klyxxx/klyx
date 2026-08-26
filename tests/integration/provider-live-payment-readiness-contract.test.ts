import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("KLYX provider live payment readiness contract", () => {
  it("Connect status combines Stripe runtime, market readiness and provider payment readiness", () => {
    const route = source("app/api/stripe/connect/status/route.ts");
    const readiness = source("lib/klyx-provider-payment-readiness.ts");

    expect(route).toMatch(/assertStripeConnectRuntimeConfigured/);
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
  });

  it("provider onboarding cannot complete payments from raw Stripe flags alone", () => {
    const progress = source("app/onboarding/ProviderOnboardingProgress.tsx");

    expect(progress).toMatch(/stripe\?\.livePaymentsOperational/);
    expect(progress).toMatch(/stripe\?\.stripeConfigured/);
    expect(progress).toMatch(/translateKlyxProviderPaymentReadiness/);
  });

  it("keeps Connect onboarding preparatory while transactional routes stay strict", () => {
    const connectCreate = source("app/api/stripe/connect/create-account/route.ts");
    const checkoutRoutes = [
      source("app/api/stripe/create-checkout-session/route.ts"),
      source("app/api/stripe/create-group-checkout-session/route.ts"),
    ];

    expect(connectCreate).toMatch(/assertStripeConnectRuntimeConfigured/);
    expect(connectCreate).toMatch(/type:\s*"account_onboarding"/);
    expect(connectCreate).toMatch(/KLYX_STRIPE_COUNTRY_UNSUPPORTED/);
    expect(connectCreate).toMatch(/stripeRuntime\.mode === "live"/);

    for (const route of checkoutRoutes) {
      expect(route).toMatch(/assertStripeRuntimeReady/);
      expect(route).not.toMatch(/assertStripeConnectRuntimeConfigured/);
    }
  });
});
