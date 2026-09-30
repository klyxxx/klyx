import { describe, expect, it } from "vitest";

import {
  getKlyxExternalCostDecision,
  getKlyxExternalCostMode,
  getKlyxCostControlPolicyOverrides,
  KLYX_ZERO_COST_RUNTIME_PROVIDERS,
  type KlyxCostEnvironment,
} from "@/lib/providers/cost-control";
import {
  KlyxProviderControlPlane,
} from "@/lib/providers/control-plane";
import {
  createKlyxCostAwareProviderControlPlaneRegistry,
} from "@/lib/providers/control-plane-registry";

function env(
  values: Record<string, string | undefined> = {}
): KlyxCostEnvironment {
  return values;
}

describe("KLYX zero-cost external provider control", () => {
  it("defaults to zero mode and blocks every runtime provider that can create variable spend", () => {
    const zeroEnv = env();

    expect(getKlyxExternalCostMode(zeroEnv)).toBe("zero");

    for (const provider of KLYX_ZERO_COST_RUNTIME_PROVIDERS) {
      expect(getKlyxExternalCostDecision(provider, zeroEnv)).toMatchObject({
        provider,
        mode: "zero",
        allowed: false,
        reason: "ZERO_COST_BLOCK",
        budgetMinor: 0,
      });
    }
  });

  it("keeps capped/free infrastructure available in zero mode while requiring Stripe TEST", () => {
    const zeroEnv = env();

    for (const provider of [
      "supabase",
      "tolgee",
      "cloudflare_turnstile",
      "vercel",
      "github",
    ] as const) {
      expect(getKlyxExternalCostDecision(provider, zeroEnv)).toMatchObject({
        allowed: true,
        reason: "FREE_OR_LOCAL",
      });
    }

    expect(getKlyxExternalCostDecision("stripe", zeroEnv)).toMatchObject({
      allowed: false,
      reason: "STRIPE_TEST_REQUIRED",
    });

    expect(
      getKlyxExternalCostDecision(
        "stripe",
        env({ KLYX_STRIPE_MODE: "test" })
      )
    ).toMatchObject({
      allowed: true,
      reason: "FREE_OR_LOCAL",
    });

    expect(
      getKlyxExternalCostDecision(
        "stripe",
        env({
          KLYX_STRIPE_MODE: "test",
          KLYX_LIVE_PAYMENTS_ENABLED: "1",
        })
      )
    ).toMatchObject({
      allowed: false,
      reason: "STRIPE_TEST_REQUIRED",
    });
  });

  it("requires explicit enablement, provider-side spend-cap confirmation and a positive budget", () => {
    const guarded = {
      KLYX_EXTERNAL_COST_MODE: "guarded",
    } as const;

    expect(getKlyxExternalCostDecision("resend", guarded).reason).toBe(
      "PROVIDER_NOT_ENABLED"
    );

    expect(
      getKlyxExternalCostDecision("resend", {
        ...guarded,
        KLYX_PROVIDER_RESEND_ENABLED: "1",
      }).reason
    ).toBe("PROVIDER_SPEND_CAP_NOT_CONFIRMED");

    expect(
      getKlyxExternalCostDecision("resend", {
        ...guarded,
        KLYX_PROVIDER_RESEND_ENABLED: "1",
        KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED: "1",
      }).reason
    ).toBe("PROVIDER_BUDGET_NOT_CONFIGURED");

    expect(
      getKlyxExternalCostDecision("resend", {
        ...guarded,
        KLYX_PROVIDER_RESEND_ENABLED: "1",
        KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED: "1",
        KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR: "500",
      })
    ).toMatchObject({
      allowed: true,
      budgetMinor: 500,
      currency: "USD",
    });
  });

  it("requires the legacy OpenAI opt-in in addition to the cost-control gates", () => {
    const guardedOpenAi = {
      KLYX_EXTERNAL_COST_MODE: "guarded",
      KLYX_PROVIDER_OPENAI_ENABLED: "1",
      KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED: "1",
      KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR: "100",
    } as const;

    expect(
      getKlyxExternalCostDecision("openai", guardedOpenAi).reason
    ).toBe("PROVIDER_NOT_ENABLED");

    expect(
      getKlyxExternalCostDecision("openai", {
        ...guardedOpenAi,
        KLYX_OPENAI_ENABLED: "1",
      }).allowed
    ).toBe(true);
  });

  it("installs quota, rate-limit, timeout, budget warning and circuit-breaker policies only in guarded mode", () => {
    const guardedResend = env({
      KLYX_EXTERNAL_COST_MODE: "guarded",
      KLYX_PROVIDER_RESEND_ENABLED: "1",
      KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED: "1",
      KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR: "100",
    });

    const resend = getKlyxCostControlPolicyOverrides(guardedResend).resend;

    expect(resend).toMatchObject({
      enabled: true,
      quota: { max: 100 },
      rateLimit: { max: 10 },
      timeoutMs: 10_000,
      budget: {
        currency: "USD",
        maxMinor: 100,
        warnAtBps: 8_000,
      },
      circuitBreaker: {
        failureThreshold: 4,
        halfOpenMaxCalls: 1,
      },
    });
  });

  it("automatically blocks a non-critical provider after its local guarded budget is exhausted", () => {
    const guardedResend = env({
      KLYX_EXTERNAL_COST_MODE: "guarded",
      KLYX_PROVIDER_RESEND_ENABLED: "1",
      KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED: "1",
      KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR: "10",
    });

    const controlPlane = new KlyxProviderControlPlane(
      createKlyxCostAwareProviderControlPlaneRegistry(guardedResend)
    );

    const first = controlPlane.admit({
      provider: "resend",
      capability: "transactional_email",
      operation: "send",
      kind: "mutation",
      retrySafety: "provider_idempotent",
      idempotencyKey: "mail-1",
      estimatedCostMinor: 10,
      costCurrency: "USD",
    });

    expect(first.allowed).toBe(true);
    if (first.allowed) {
      controlPlane.recordAttempt(first.permit, {
        ok: true,
        code: "OK",
        actualCostMinor: 10,
        costCurrency: "USD",
      });
    }

    expect(
      controlPlane.admit({
        provider: "resend",
        capability: "transactional_email",
        operation: "send",
        kind: "mutation",
        retrySafety: "provider_idempotent",
        idempotencyKey: "mail-2",
        estimatedCostMinor: 1,
        costCurrency: "USD",
      })
    ).toMatchObject({
      allowed: false,
      reason: "BUDGET_EXCEEDED",
      fallback: {
        action: "degrade",
      },
    });
  });
});
