import { describe, expect, it } from "vitest";

import {
  decideExternalCostAction,
  getExternalCostPolicy,
} from "../../lib/external-cost-policy";

const productionEnv = {
  NODE_ENV: "production",
  KLYX_EXTERNAL_COST_CONTROL_ENABLED: "1",
} as NodeJS.ProcessEnv;

describe("KLYX external cost policy", () => {
  it("falls back locally instead of spending OpenAI budget at zero euros", () => {
    expect(
      decideExternalCostAction({
        provider: "openai",
        estimatedCostMicrousd: 10_000,
        env: productionEnv,
      })
    ).toMatchObject({
      action: "fallback",
      reason: "ZERO_BUDGET_FALLBACK",
      monthlyBudgetMicrousd: 0,
    });
  });

  it("blocks production KYC initiation when Sumsub budget is zero", () => {
    expect(
      decideExternalCostAction({
        provider: "sumsub",
        estimatedCostMicrousd: 1_350_000,
        env: productionEnv,
      })
    ).toMatchObject({
      action: "block",
      reason: "ZERO_BUDGET_BLOCK",
    });
  });

  it("keeps Twilio optional and falls back when its budget is zero", () => {
    expect(
      decideExternalCostAction({
        provider: "twilio",
        estimatedCostMicrousd: 200_000,
        env: productionEnv,
      })
    ).toMatchObject({
      action: "fallback",
      reason: "ZERO_BUDGET_FALLBACK",
    });
  });

  it("allows Resend only inside the internal free-tier unit policy", () => {
    expect(getExternalCostPolicy("resend", productionEnv)).toMatchObject({
      paidRisk: false,
      defaultMonthlyUnitLimit: 2700,
    });
    expect(
      decideExternalCostAction({ provider: "resend", env: productionEnv })
    ).toMatchObject({ action: "allow", reason: "FREE_QUOTA_ALLOWED" });
  });

  it("uses committed Tolgee catalogs without runtime provider calls", () => {
    expect(
      decideExternalCostAction({ provider: "tolgee", env: productionEnv })
    ).toMatchObject({ action: "allow", reason: "NO_EXTERNAL_RUNTIME_CALL" });
  });

  it("requires an explicit non-zero budget before allowing paid OpenAI", () => {
    const env = {
      ...productionEnv,
      KLYX_OPENAI_MONTHLY_BUDGET_USD: "1",
      KLYX_OPENAI_MONTHLY_CALL_LIMIT: "100",
    } as NodeJS.ProcessEnv;

    expect(
      decideExternalCostAction({
        provider: "openai",
        estimatedCostMicrousd: 10_000,
        env,
      })
    ).toMatchObject({
      action: "allow",
      reason: "PAID_BUDGET_ALLOWED",
      monthlyBudgetMicrousd: 1_000_000,
      monthlyUnitLimit: 100,
    });
  });

  it("does not make mocked unit tests consume external budgets by default", () => {
    expect(
      decideExternalCostAction({
        provider: "openai",
        estimatedCostMicrousd: 10_000,
        env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      })
    ).toMatchObject({ action: "allow", reason: "CONTROL_DISABLED_FOR_TEST" });
  });
});
