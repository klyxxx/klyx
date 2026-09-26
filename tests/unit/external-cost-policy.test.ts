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

  it("requires explicit paid activation before Sumsub can ever spend", () => {
    const budgeted = {
      ...productionEnv,
      KLYX_EXTERNAL_PAID_BUDGET_USD: "200",
      KLYX_SUMSUB_MONTHLY_BUDGET_USD: "200",
      KLYX_SUMSUB_MONTHLY_VERIFICATION_LIMIT: "100",
      KLYX_SUMSUB_DAILY_VERIFICATION_LIMIT: "10",
    } as NodeJS.ProcessEnv;

    expect(
      decideExternalCostAction({
        provider: "sumsub",
        estimatedCostMicrousd: 1_350_000,
        env: budgeted,
      })
    ).toMatchObject({
      action: "block",
      reason: "PAID_ACTIVATION_REQUIRED",
      fixedMonthlyCommitmentMicrousd: 149_000_000,
    });

    expect(
      decideExternalCostAction({
        provider: "sumsub",
        estimatedCostMicrousd: 1_350_000,
        env: {
          ...budgeted,
          KLYX_SUMSUB_PAID_SUBSCRIPTION_AUTHORIZED: "1",
        },
      })
    ).toMatchObject({
      action: "allow",
      reason: "PAID_BUDGET_ALLOWED",
      dailyUnitLimit: 10,
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

  it("keeps Resend below both free daily and monthly quotas", () => {
    expect(getExternalCostPolicy("resend", productionEnv)).toMatchObject({
      paidRisk: false,
      defaultMonthlyUnitLimit: 2700,
      defaultDailyUnitLimit: 90,
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

  it("requires both global and provider budgets before allowing paid OpenAI", () => {
    const providerOnly = {
      ...productionEnv,
      KLYX_OPENAI_MONTHLY_BUDGET_USD: "1",
      KLYX_OPENAI_MONTHLY_CALL_LIMIT: "100",
      KLYX_OPENAI_DAILY_CALL_LIMIT: "10",
    } as NodeJS.ProcessEnv;

    expect(
      decideExternalCostAction({
        provider: "openai",
        estimatedCostMicrousd: 10_000,
        env: providerOnly,
      })
    ).toMatchObject({
      action: "fallback",
      reason: "ZERO_BUDGET_FALLBACK",
    });

    const fullyAuthorized = {
      ...providerOnly,
      KLYX_EXTERNAL_PAID_BUDGET_USD: "1",
    } as NodeJS.ProcessEnv;

    expect(
      decideExternalCostAction({
        provider: "openai",
        estimatedCostMicrousd: 10_000,
        env: fullyAuthorized,
      })
    ).toMatchObject({
      action: "allow",
      reason: "PAID_BUDGET_ALLOWED",
      monthlyBudgetMicrousd: 1_000_000,
      monthlyUnitLimit: 100,
      dailyUnitLimit: 10,
    });
  });

  it("marks fixed subscription commitments separately from runtime usage", () => {
    expect(getExternalCostPolicy("elmah", productionEnv)).toMatchObject({
      fixedMonthlyCommitmentMicrousd: 26_000_000,
      paidActivationEnv: "KLYX_ELMAH_PAID_SUBSCRIPTION_AUTHORIZED",
    });
    expect(getExternalCostPolicy("vercel", productionEnv)).toMatchObject({
      fixedMonthlyCommitmentMicrousd: 20_000_000,
      paidActivationEnv: "KLYX_VERCEL_PRO_AUTHORIZED",
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
