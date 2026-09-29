import { afterEach, describe, expect, it } from "vitest";

import {
  getKlyxExternalCostDecision,
  getKlyxExternalCostMode,
  getKlyxCostControlPolicyOverrides,
  KLYX_ZERO_COST_RUNTIME_PROVIDERS,
} from "@/lib/providers/cost-control";
import {
  KlyxProviderControlPlane,
} from "@/lib/providers/control-plane";
import {
  createKlyxCostAwareProviderControlPlaneRegistry,
} from "@/lib/providers/control-plane-registry";

const trackedEnv = [
  "KLYX_EXTERNAL_COST_MODE",
  "KLYX_OPENAI_ENABLED",
  "KLYX_PROVIDER_OPENAI_ENABLED",
  "KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED",
  "KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR",
  "KLYX_PROVIDER_RESEND_ENABLED",
  "KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED",
  "KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR",
] as const;

const originalEnv = Object.fromEntries(
  trackedEnv.map((name) => [name, process.env[name]])
);

afterEach(() => {
  for (const name of trackedEnv) {
    const value = originalEnv[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("KLYX zero-cost external provider control", () => {
  it("defaults to zero mode and blocks every runtime provider that can create variable spend", () => {
    delete process.env.KLYX_EXTERNAL_COST_MODE;

    expect(getKlyxExternalCostMode()).toBe("zero");

    for (const provider of KLYX_ZERO_COST_RUNTIME_PROVIDERS) {
      expect(getKlyxExternalCostDecision(provider)).toMatchObject({
        provider,
        mode: "zero",
        allowed: false,
        reason: "ZERO_COST_BLOCK",
        budgetMinor: 0,
      });
    }
  });

  it("keeps capped/free infrastructure available in zero mode", () => {
    delete process.env.KLYX_EXTERNAL_COST_MODE;

    for (const provider of [
      "supabase",
      "stripe",
      "tolgee",
      "cloudflare_turnstile",
      "vercel",
      "github",
    ] as const) {
      expect(getKlyxExternalCostDecision(provider)).toMatchObject({
        allowed: true,
        reason: "FREE_OR_LOCAL",
      });
    }
  });

  it("requires explicit enablement, provider-side spend-cap confirmation and a positive budget", () => {
    process.env.KLYX_EXTERNAL_COST_MODE = "guarded";

    expect(getKlyxExternalCostDecision("resend").reason).toBe(
      "PROVIDER_NOT_ENABLED"
    );

    process.env.KLYX_PROVIDER_RESEND_ENABLED = "1";
    expect(getKlyxExternalCostDecision("resend").reason).toBe(
      "PROVIDER_SPEND_CAP_NOT_CONFIRMED"
    );

    process.env.KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED = "1";
    expect(getKlyxExternalCostDecision("resend").reason).toBe(
      "PROVIDER_BUDGET_NOT_CONFIGURED"
    );

    process.env.KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR = "500";
    expect(getKlyxExternalCostDecision("resend")).toMatchObject({
      allowed: true,
      budgetMinor: 500,
      currency: "USD",
    });
  });

  it("requires the legacy OpenAI opt-in in addition to the cost-control gates", () => {
    process.env.KLYX_EXTERNAL_COST_MODE = "guarded";
    process.env.KLYX_PROVIDER_OPENAI_ENABLED = "1";
    process.env.KLYX_PROVIDER_OPENAI_SPEND_CAP_CONFIRMED = "1";
    process.env.KLYX_PROVIDER_OPENAI_MONTHLY_BUDGET_MINOR = "100";
    delete process.env.KLYX_OPENAI_ENABLED;

    expect(getKlyxExternalCostDecision("openai").reason).toBe(
      "PROVIDER_NOT_ENABLED"
    );

    process.env.KLYX_OPENAI_ENABLED = "1";
    expect(getKlyxExternalCostDecision("openai").allowed).toBe(true);
  });

  it("installs quota, rate-limit, timeout, budget warning and circuit-breaker policies only in guarded mode", () => {
    process.env.KLYX_EXTERNAL_COST_MODE = "guarded";
    process.env.KLYX_PROVIDER_RESEND_ENABLED = "1";
    process.env.KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED = "1";
    process.env.KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR = "100";

    const resend = getKlyxCostControlPolicyOverrides().resend;

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
    process.env.KLYX_EXTERNAL_COST_MODE = "guarded";
    process.env.KLYX_PROVIDER_RESEND_ENABLED = "1";
    process.env.KLYX_PROVIDER_RESEND_SPEND_CAP_CONFIRMED = "1";
    process.env.KLYX_PROVIDER_RESEND_MONTHLY_BUDGET_MINOR = "10";

    const controlPlane = new KlyxProviderControlPlane(
      createKlyxCostAwareProviderControlPlaneRegistry()
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
