import "server-only";

import {
  consumeApiRateLimit,
  type ApiRateLimitPolicy,
} from "@/lib/api-rate-limit";
import {
  KLYX_EXTERNAL_PROVIDER_POLICIES,
  decideKlyxExternalCost,
  klyxCostAlertPercent,
  parseKlyxExternalCostMode,
  type KlyxExternalCostDecision,
  type KlyxExternalCostMode,
  type KlyxExternalProvider,
} from "@/lib/external-cost-control";

const DAY_SECONDS = 24 * 60 * 60;
const MONTH_SECONDS = 30 * DAY_SECONDS;
const USD_NANO = 1_000_000_000;

export type KlyxExternalCallAuthorization = KlyxExternalCostDecision & {
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  monthlyBudgetNanousd: number;
};

function envName(provider: KlyxExternalProvider): string {
  return provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function nonNegativeInteger(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function providerBudgetNanousd(provider: KlyxExternalProvider): number {
  const raw = process.env[`KLYX_EXTERNAL_COST_BUDGET_${envName(provider)}_USD`];
  if (!raw?.trim()) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed * USD_NANO);
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  return parseKlyxExternalCostMode(process.env.KLYX_EXTERNAL_COST_MODE);
}

function dynamicLimit(provider: KlyxExternalProvider, window: "daily" | "monthly"): number | null {
  const override = nonNegativeInteger(
    process.env[`KLYX_EXTERNAL_COST_${envName(provider)}_${window.toUpperCase()}_ACTIONS`]
  );
  if (override !== null) return override;

  const policy = KLYX_EXTERNAL_PROVIDER_POLICIES[provider];
  const mode = getKlyxExternalCostMode();

  if (mode === "PAID_CONTROLLED" && window === "monthly" && policy.worstCaseActionNanousd > 0) {
    const budget = providerBudgetNanousd(provider);
    if (budget <= 0) return 0;
    return Math.floor(budget / policy.worstCaseActionNanousd);
  }

  return window === "daily"
    ? policy.freeDailyActions
    : policy.freeMonthlyActions;
}

function ratePolicy(provider: KlyxExternalProvider, window: "daily" | "monthly", limit: number): ApiRateLimitPolicy {
  return {
    action: `external_cost_${provider}_${window}`,
    limit,
    windowSeconds: window === "daily" ? DAY_SECONDS : MONTH_SECONDS,
  };
}

function blockedFromQuota(
  base: KlyxExternalCostDecision,
  reason: "FREE_TIER_DAILY_EXHAUSTED" | "FREE_TIER_MONTHLY_EXHAUSTED" | "PAID_BUDGET_EXHAUSTED",
  params: {
    dailyUsed: number;
    monthlyUsed: number;
    dailyLimit: number | null;
    monthlyLimit: number | null;
    monthlyBudgetNanousd: number;
  },
): KlyxExternalCallAuthorization {
  const policy = KLYX_EXTERNAL_PROVIDER_POLICIES[base.provider];
  return {
    ...base,
    allowed: false,
    reason,
    autoDisableNonCritical:
      policy.criticality === "noncritical" || policy.criticality === "degradable",
    alertPercent: 100,
    ...params,
  };
}

function costWarning(result: KlyxExternalCallAuthorization, operation: string): void {
  if (result.alertPercent === 0 && result.allowed) return;
  console.warn(
    JSON.stringify({
      marker: "KLYX_EXTERNAL_COST_CONTROL",
      provider: result.provider,
      operation,
      mode: result.mode,
      allowed: result.allowed,
      reason: result.reason,
      alertPercent: result.alertPercent,
      dailyUsed: result.dailyUsed,
      dailyLimit: result.dailyLimit,
      monthlyUsed: result.monthlyUsed,
      monthlyLimit: result.monthlyLimit,
      autoDisableNonCritical: result.autoDisableNonCritical,
    })
  );
}

/**
 * Global durable quota authority for external calls that can create spend.
 *
 * The existing Supabase-backed KLYX rate-limit RPC is reused deliberately: it
 * is already concurrency-safe and avoids introducing a second quota store.
 * If that authority is unavailable, metered/free-tier calls fail closed.
 */
export async function authorizeKlyxExternalCall(input: {
  provider: KlyxExternalProvider;
  operation: string;
}): Promise<KlyxExternalCallAuthorization> {
  const mode = getKlyxExternalCostMode();
  const monthlyBudgetNanousd = providerBudgetNanousd(input.provider);
  const initial = decideKlyxExternalCost({
    provider: input.provider,
    mode,
    dailyUsed: 0,
    monthlyUsed: 0,
    monthlyBudgetNanousd,
  });
  const dailyLimit = dynamicLimit(input.provider, "daily");
  const monthlyLimit = dynamicLimit(input.provider, "monthly");

  const initialResult: KlyxExternalCallAuthorization = {
    ...initial,
    dailyUsed: 0,
    monthlyUsed: 0,
    dailyLimit,
    monthlyLimit,
    monthlyBudgetNanousd,
  };

  if (!initial.allowed) {
    costWarning(initialResult, input.operation);
    return initialResult;
  }

  // Unlimited zero-cost providers need no metering call at all.
  if (dailyLimit === null && monthlyLimit === null) {
    return initialResult;
  }

  // A zero limit is a hard circuit breaker and must not be sent to the RPC.
  if (dailyLimit === 0 || monthlyLimit === 0) {
    const reason = mode === "PAID_CONTROLLED"
      ? "PAID_BUDGET_EXHAUSTED"
      : dailyLimit === 0
        ? "FREE_TIER_DAILY_EXHAUSTED"
        : "FREE_TIER_MONTHLY_EXHAUSTED";
    const blocked = blockedFromQuota(initial, reason, {
      dailyUsed: 0,
      monthlyUsed: 0,
      dailyLimit,
      monthlyLimit,
      monthlyBudgetNanousd,
    });
    costWarning(blocked, input.operation);
    return blocked;
  }

  let monthlyUsed = 0;
  let dailyUsed = 0;

  try {
    if (monthlyLimit !== null) {
      const monthly = await consumeApiRateLimit(
        `klyx-external-cost:${input.provider}:global`,
        ratePolicy(input.provider, "monthly", monthlyLimit),
      );
      monthlyUsed = monthly.requestCount;
      if (!monthly.allowed) {
        const blocked = blockedFromQuota(
          initial,
          mode === "PAID_CONTROLLED"
            ? "PAID_BUDGET_EXHAUSTED"
            : "FREE_TIER_MONTHLY_EXHAUSTED",
          { dailyUsed, monthlyUsed, dailyLimit, monthlyLimit, monthlyBudgetNanousd },
        );
        costWarning(blocked, input.operation);
        return blocked;
      }
    }

    if (dailyLimit !== null) {
      const daily = await consumeApiRateLimit(
        `klyx-external-cost:${input.provider}:global`,
        ratePolicy(input.provider, "daily", dailyLimit),
      );
      dailyUsed = daily.requestCount;
      if (!daily.allowed) {
        const blocked = blockedFromQuota(initial, "FREE_TIER_DAILY_EXHAUSTED", {
          dailyUsed,
          monthlyUsed,
          dailyLimit,
          monthlyLimit,
          monthlyBudgetNanousd,
        });
        costWarning(blocked, input.operation);
        return blocked;
      }
    }
  } catch {
    const blocked = blockedFromQuota(
      initial,
      mode === "PAID_CONTROLLED"
        ? "PAID_BUDGET_EXHAUSTED"
        : "FREE_TIER_MONTHLY_EXHAUSTED",
      { dailyUsed, monthlyUsed, dailyLimit, monthlyLimit, monthlyBudgetNanousd },
    );
    costWarning(blocked, input.operation);
    return blocked;
  }

  const referenceLimit = monthlyLimit ?? dailyLimit;
  const referenceUsed = monthlyLimit !== null ? monthlyUsed : dailyUsed;
  const allowed: KlyxExternalCallAuthorization = {
    ...initial,
    alertPercent: referenceLimit && referenceLimit > 0
      ? klyxCostAlertPercent(referenceUsed, referenceLimit)
      : 0,
    dailyUsed,
    monthlyUsed,
    dailyLimit,
    monthlyLimit,
    monthlyBudgetNanousd,
  };
  costWarning(allowed, input.operation);
  return allowed;
}

export async function requireKlyxExternalCall(input: {
  provider: KlyxExternalProvider;
  operation: string;
}): Promise<KlyxExternalCallAuthorization> {
  const decision = await authorizeKlyxExternalCall(input);
  if (!decision.allowed) {
    throw new Error(
      `KLYX_EXTERNAL_COST_BLOCKED:${decision.provider}:${decision.reason}`
    );
  }
  return decision;
}
