import { describe, expect, it } from "vitest";

import {
  KLYX_EXTERNAL_PROVIDER_POLICIES,
  decideKlyxExternalCost,
  klyxCostAlertPercent,
  parseKlyxExternalCostMode,
} from "../../lib/external-cost-control";

describe("KLYX external cost control", () => {
  it("defaults to ZERO_COST", () => {
    expect(parseKlyxExternalCostMode(undefined)).toBe("ZERO_COST");
    expect(parseKlyxExternalCostMode("garbage")).toBe("ZERO_COST");
  });

  it.each(["openai", "sumsub", "twilio", "elmah"] as const)(
    "blocks %s network spend in ZERO_COST",
    (provider) => {
      const decision = decideKlyxExternalCost({
        provider,
        mode: "ZERO_COST",
        dailyUsed: 0,
        monthlyUsed: 0,
        monthlyBudgetNanousd: 0,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("ZERO_COST_BLOCKED");
      expect(decision.alertPercent).toBe(100);
    }
  );

  it.each(["supabase", "stripe", "resend", "tolgee", "cloudflare", "vercel", "github"] as const)(
    "keeps zero-cost path available for %s",
    (provider) => {
      expect(
        decideKlyxExternalCost({
          provider,
          mode: "ZERO_COST",
          dailyUsed: 0,
          monthlyUsed: 0,
          monthlyBudgetNanousd: 0,
        }).allowed
      ).toBe(true);
    }
  );

  it("keeps Resend below provider free limits with a safety margin", () => {
    expect(KLYX_EXTERNAL_PROVIDER_POLICIES.resend.freeDailyActions).toBe(80);
    expect(KLYX_EXTERNAL_PROVIDER_POLICIES.resend.freeMonthlyActions).toBe(2400);
  });

  it("refuses Sumsub paid mode below the monthly commitment", () => {
    const decision = decideKlyxExternalCost({
      provider: "sumsub",
      mode: "PAID_CONTROLLED",
      dailyUsed: 0,
      monthlyUsed: 0,
      monthlyBudgetNanousd: 100 * 1_000_000_000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("PAID_BUDGET_BELOW_ACTIVATION_FLOOR");
  });

  it("requires a positive explicit budget before paid usage", () => {
    expect(
      decideKlyxExternalCost({
        provider: "openai",
        mode: "PAID_CONTROLLED",
        dailyUsed: 0,
        monthlyUsed: 0,
        monthlyBudgetNanousd: 0,
      }).reason
    ).toBe("PAID_BUDGET_NOT_ENABLED");
  });

  it("opens a hard breaker when conservative paid call budget is exhausted", () => {
    const budget = 20_000_000;
    const first = decideKlyxExternalCost({
      provider: "openai",
      mode: "PAID_CONTROLLED",
      dailyUsed: 0,
      monthlyUsed: 1,
      monthlyBudgetNanousd: budget,
    });
    const exhausted = decideKlyxExternalCost({
      provider: "openai",
      mode: "PAID_CONTROLLED",
      dailyUsed: 0,
      monthlyUsed: 2,
      monthlyBudgetNanousd: budget,
    });

    expect(first.allowed).toBe(true);
    expect(exhausted.allowed).toBe(false);
    expect(exhausted.reason).toBe("PAID_BUDGET_EXHAUSTED");
  });

  it("emits deterministic alert thresholds", () => {
    expect(klyxCostAlertPercent(74, 100)).toBe(0);
    expect(klyxCostAlertPercent(75, 100)).toBe(75);
    expect(klyxCostAlertPercent(90, 100)).toBe(90);
    expect(klyxCostAlertPercent(100, 100)).toBe(100);
  });
});
