import { describe, expect, it } from "vitest";

import {
  evaluateKlyxExternalCost,
  KLYX_EXTERNAL_COST_POLICIES,
} from "@/lib/providers/cost-control";

describe("KLYX external cost policy", () => {
  it("governs the complete provider catalog", () => {
    expect(Object.keys(KLYX_EXTERNAL_COST_POLICIES).sort()).toEqual(
      [
        "cloudflare_turnstile",
        "elmah_io",
        "github",
        "openai",
        "resend",
        "stripe",
        "sumsub",
        "supabase",
        "tolgee",
        "twilio",
        "vercel",
      ]
    );
  });

  it.each(["openai", "sumsub", "twilio", "elmah_io"] as const)(
    "blocks paid provider %s by default in zero mode",
    (provider) => {
      const decision = evaluateKlyxExternalCost({
        provider,
        mode: "zero",
        explicitlyEnabled: true,
        providerMonthlyBudgetUsd: 100,
        globalMonthlyBudgetUsd: 100,
        configuredPaidBudgetsTotalUsd: 100,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("zero_budget_paid_provider");
      expect(decision.circuitOpen).toBe(true);
    }
  );

  it.each([
    "supabase",
    "stripe",
    "resend",
    "tolgee",
    "cloudflare_turnstile",
    "vercel",
    "github",
  ] as const)("keeps zero-cost provider %s usable in zero mode", (provider) => {
    const decision = evaluateKlyxExternalCost({
      provider,
      mode: "zero",
      explicitlyEnabled: false,
      providerMonthlyBudgetUsd: 0,
      globalMonthlyBudgetUsd: 0,
      configuredPaidBudgetsTotalUsd: 0,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("requires explicit enablement for paid providers in guarded mode", () => {
    const decision = evaluateKlyxExternalCost({
      provider: "openai",
      mode: "guarded",
      explicitlyEnabled: false,
      providerMonthlyBudgetUsd: 5,
      globalMonthlyBudgetUsd: 10,
      configuredPaidBudgetsTotalUsd: 5,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("provider_not_explicitly_enabled");
  });

  it("requires both provider and global budgets", () => {
    expect(
      evaluateKlyxExternalCost({
        provider: "openai",
        mode: "guarded",
        explicitlyEnabled: true,
        providerMonthlyBudgetUsd: 0,
        globalMonthlyBudgetUsd: 10,
        configuredPaidBudgetsTotalUsd: 0,
      }).reason
    ).toBe("provider_budget_missing");

    expect(
      evaluateKlyxExternalCost({
        provider: "openai",
        mode: "guarded",
        explicitlyEnabled: true,
        providerMonthlyBudgetUsd: 5,
        globalMonthlyBudgetUsd: 0,
        configuredPaidBudgetsTotalUsd: 5,
      }).reason
    ).toBe("global_budget_missing");
  });

  it("rejects configured paid budgets above the global cap", () => {
    const decision = evaluateKlyxExternalCost({
      provider: "openai",
      mode: "guarded",
      explicitlyEnabled: true,
      providerMonthlyBudgetUsd: 5,
      globalMonthlyBudgetUsd: 10,
      configuredPaidBudgetsTotalUsd: 12,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("global_budget_overcommitted");
  });

  it("fails closed when quota authority is unavailable", () => {
    const decision = evaluateKlyxExternalCost({
      provider: "resend",
      mode: "zero",
      explicitlyEnabled: false,
      providerMonthlyBudgetUsd: 0,
      globalMonthlyBudgetUsd: 0,
      configuredPaidBudgetsTotalUsd: 0,
      quotaAuthorityAvailable: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("quota_authority_unavailable");
  });

  it("opens the circuit when daily or 30-day quota is exhausted", () => {
    expect(
      evaluateKlyxExternalCost({
        provider: "resend",
        mode: "zero",
        explicitlyEnabled: false,
        providerMonthlyBudgetUsd: 0,
        globalMonthlyBudgetUsd: 0,
        configuredPaidBudgetsTotalUsd: 0,
        dailyQuotaAllowed: false,
      }).reason
    ).toBe("daily_quota_exhausted");

    expect(
      evaluateKlyxExternalCost({
        provider: "resend",
        mode: "zero",
        explicitlyEnabled: false,
        providerMonthlyBudgetUsd: 0,
        globalMonthlyBudgetUsd: 0,
        configuredPaidBudgetsTotalUsd: 0,
        dailyQuotaAllowed: true,
        rolling30DayQuotaAllowed: false,
      }).reason
    ).toBe("rolling_30d_quota_exhausted");
  });
});
