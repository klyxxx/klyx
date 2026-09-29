import { describe, expect, it } from "vitest";

import { KLYX_EXTERNAL_PROVIDER_NAMES } from "../../lib/providers/contracts";
import {
  createKlyxCostAwareProviderRegistry,
  createKlyxZeroBudgetProviderOverrides,
  KLYX_ZERO_BUDGET_RESEND_ENVELOPE,
} from "../../lib/providers/cost-policy";

describe("KLYX zero-budget Provider Control Plane policy", () => {
  it("configures every canonical provider without creating a second control-plane engine", () => {
    const registry = createKlyxCostAwareProviderRegistry({ mode: "zero_budget" });

    expect(registry.map((entry) => entry.provider).sort()).toEqual(
      [...KLYX_EXTERNAL_PROVIDER_NAMES].sort()
    );
  });

  it("hard-disables variable-cost providers by default", () => {
    const overrides = createKlyxZeroBudgetProviderOverrides();

    expect(overrides.openai?.enabled).toBe(false);
    expect(overrides.sumsub?.enabled).toBe(false);
    expect(overrides.twilio?.enabled).toBe(false);
    expect(overrides.elmah_io?.enabled).toBe(false);
    expect(overrides.tolgee?.enabled).toBe(false);
  });

  it("allows only explicit zero-money development modes for Stripe, Sumsub and Twilio", () => {
    const safe = createKlyxZeroBudgetProviderOverrides({
      stripe: "test",
      sumsub: "sandbox",
      twilio: "trial",
      livePaymentsEnabled: false,
    });

    expect(safe.stripe?.enabled).toBe(true);
    expect(safe.sumsub?.enabled).toBe(true);
    expect(safe.twilio?.enabled).toBe(true);

    const unsafeStripe = createKlyxZeroBudgetProviderOverrides({
      stripe: "live",
      livePaymentsEnabled: true,
    });
    expect(unsafeStripe.stripe?.enabled).toBe(false);
  });

  it("keeps free/no-overage runtime providers available", () => {
    const overrides = createKlyxZeroBudgetProviderOverrides();

    expect(overrides.supabase?.enabled).toBe(true);
    expect(overrides.resend?.enabled).toBe(true);
    expect(overrides.cloudflare_turnstile?.enabled).toBe(true);
    expect(overrides.vercel?.enabled).toBe(true);
    expect(overrides.github?.enabled).toBe(true);
  });

  it("puts Resend below the vendor free allowance with rate limit, daily quota and circuit breaker", () => {
    const policy = createKlyxCostAwareProviderRegistry({ mode: "zero_budget" })
      .find((entry) => entry.provider === "resend")?.policy;

    expect(KLYX_ZERO_BUDGET_RESEND_ENVELOPE).toEqual({
      perMinute: 5,
      perDay: 50,
      perMonth: 1_500,
      warnAtRatio: 0.75,
    });
    expect(policy?.rateLimit).toEqual({ max: 5, windowMs: 60_000 });
    expect(policy?.quota).toEqual({ max: 50, windowMs: 86_400_000 });
    expect(policy?.circuitBreaker).toEqual({
      failureThreshold: 3,
      openMs: 300_000,
      halfOpenMaxCalls: 1,
    });
  });

  it("fails closed for every provider when paid mode is requested before durable spend authority exists", () => {
    const registry = createKlyxCostAwareProviderRegistry({ mode: "guarded_paid" });

    for (const entry of registry) {
      expect(entry.policy.enabled).toBe(false);
    }
  });
});
