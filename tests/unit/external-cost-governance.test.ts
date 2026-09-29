import { describe, expect, it } from "vitest";

import {
  createKlyxCostGovernedProviderControlPlaneRegistry,
  createKlyxZeroCashControlPlaneOverrides,
  getKlyxExternalCostDecision,
  getKlyxExternalCostMode,
} from "@/lib/providers/cost-governance";
import { KLYX_EXTERNAL_PROVIDER_NAMES } from "@/lib/providers/contracts";

function env(
  values: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...values,
  };
}

describe("KLYX external cost governance", () => {
  it("defaults to zero cash when configuration is missing or invalid", () => {
    expect(getKlyxExternalCostMode(env())).toBe("zero_cash");
    expect(
      getKlyxExternalCostMode(
        env({ KLYX_EXTERNAL_COST_MODE: "unexpected" })
      )
    ).toBe("zero_cash");
  });

  it("allows only free paths, control-plane paths and Stripe TEST in zero cash", () => {
    const zeroCash = env({
      KLYX_EXTERNAL_COST_MODE: "zero_cash",
      KLYX_STRIPE_MODE: "test",
      STRIPE_SECRET_KEY: "sk_test_fixture",
      KLYX_LIVE_PAYMENTS_ENABLED: "false",
    });

    for (const provider of [
      "supabase",
      "resend",
      "cloudflare_turnstile",
      "vercel",
      "github",
      "stripe",
    ] as const) {
      expect(
        getKlyxExternalCostDecision(provider, zeroCash).allowed
      ).toBe(true);
    }

    for (const provider of [
      "openai",
      "sumsub",
      "twilio",
      "elmah_io",
      "tolgee",
    ] as const) {
      expect(
        getKlyxExternalCostDecision(provider, zeroCash).allowed
      ).toBe(false);
    }
  });

  it("refuses Stripe LIVE in zero cash even when credentials exist", () => {
    const live = env({
      KLYX_EXTERNAL_COST_MODE: "zero_cash",
      KLYX_STRIPE_MODE: "live",
      KLYX_LIVE_PAYMENTS_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_live_fixture",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_fixture",
    });

    expect(
      getKlyxExternalCostDecision("stripe", live)
    ).toMatchObject({
      allowed: false,
      reasonCode: "ZERO_CASH_TEST_ONLY",
    });
  });

  it("requires an explicit guarded mode before paid providers may run", () => {
    const guarded = env({
      KLYX_EXTERNAL_COST_MODE: "guarded",
    });

    for (const provider of KLYX_EXTERNAL_PROVIDER_NAMES) {
      expect(
        getKlyxExternalCostDecision(provider, guarded)
      ).toMatchObject({
        allowed: true,
        reasonCode: "GUARDED_MODE",
      });
    }
  });

  it("automatically disables paid non-critical providers and protects the Resend free tier", () => {
    const overrides = createKlyxZeroCashControlPlaneOverrides();

    expect(overrides.openai.enabled).toBe(false);
    expect(overrides.sumsub.enabled).toBe(false);
    expect(overrides.twilio.enabled).toBe(false);
    expect(overrides.elmah_io.enabled).toBe(false);

    expect(overrides.resend.enabled).toBe(true);
    expect(overrides.resend.quota).toEqual({
      max: 90,
      windowMs: 86_400_000,
    });
    expect(overrides.resend.rateLimit).toEqual({
      max: 8,
      windowMs: 1_000,
    });
    expect(overrides.resend.circuitBreaker).toEqual({
      failureThreshold: 3,
      openMs: 60_000,
      halfOpenMaxCalls: 1,
    });
  });

  it("builds a canonical zero-cash control-plane registry for every provider", () => {
    const registry = createKlyxCostGovernedProviderControlPlaneRegistry(
      env({ KLYX_EXTERNAL_COST_MODE: "zero_cash" })
    );

    expect(registry.map((entry) => entry.provider).sort()).toEqual(
      [...KLYX_EXTERNAL_PROVIDER_NAMES].sort()
    );

    const byProvider = Object.fromEntries(
      registry.map((entry) => [entry.provider, entry])
    );

    expect(byProvider.openai.policy.enabled).toBe(false);
    expect(byProvider.sumsub.policy.enabled).toBe(false);
    expect(byProvider.twilio.policy.enabled).toBe(false);
    expect(byProvider.elmah_io.policy.enabled).toBe(false);
    expect(byProvider.resend.policy.quota?.max).toBe(90);
    expect(byProvider.resend.policy.rateLimit?.max).toBe(8);
  });
});
