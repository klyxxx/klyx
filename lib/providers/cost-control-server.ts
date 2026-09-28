import "server-only";

import { consumeApiRateLimit } from "@/lib/api-rate-limit";
import { logServerWarning } from "@/lib/server-log";
import type { KlyxExternalProviderName } from "./contracts";
import {
  evaluateKlyxExternalCost,
  isKlyxPaidExternalProvider,
  KLYX_EXTERNAL_COST_POLICIES,
  type KlyxExternalCostDecision,
  type KlyxExternalCostMode,
} from "./cost-control";

const DAY_SECONDS = 24 * 60 * 60;
const ROLLING_30D_SECONDS = 30 * DAY_SECONDS;
const QUOTA_WARNING_RATIO = 0.2;
const GLOBAL_SUBJECT = "klyx-external-provider-budget";

function providerEnvSuffix(provider: KlyxExternalProviderName): string {
  return provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function nonNegativeNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  return process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() === "guarded"
    ? "guarded"
    : "zero";
}

function providerMonthlyBudgetUsd(provider: KlyxExternalProviderName): number {
  return nonNegativeNumber(
    process.env[`KLYX_COST_${providerEnvSuffix(provider)}_MONTHLY_BUDGET_USD`],
    0
  );
}

function configuredPaidBudgetsTotalUsd(): number {
  return (Object.keys(KLYX_EXTERNAL_COST_POLICIES) as KlyxExternalProviderName[])
    .filter(isKlyxPaidExternalProvider)
    .reduce((total, provider) => total + providerMonthlyBudgetUsd(provider), 0);
}

function globalMonthlyBudgetUsd(): number {
  return nonNegativeNumber(process.env.KLYX_EXTERNAL_MONTHLY_BUDGET_USD, 0);
}

function providerExplicitlyEnabled(provider: KlyxExternalProviderName): boolean {
  return process.env[`KLYX_COST_${providerEnvSuffix(provider)}_ENABLED`] === "1";
}

function resolvedCallLimits(provider: KlyxExternalProviderName): {
  daily: number | null;
  rolling30d: number | null;
} {
  const policy = KLYX_EXTERNAL_COST_POLICIES[provider];
  const suffix = providerEnvSuffix(provider);
  let daily = policy.defaultDailyCalls;
  let rolling30d = policy.defaultRolling30DayCalls;

  if (daily !== null) {
    daily = positiveInteger(
      process.env[`KLYX_COST_${suffix}_DAILY_CALLS`],
      daily
    );
  }
  if (rolling30d !== null) {
    rolling30d = positiveInteger(
      process.env[`KLYX_COST_${suffix}_ROLLING_30D_CALLS`],
      rolling30d
    );
  }

  if (
    policy.billingKind === "metered" &&
    policy.conservativeUnitCostUsd > 0 &&
    getKlyxExternalCostMode() === "guarded"
  ) {
    const budget = providerMonthlyBudgetUsd(provider);
    const budgetBound = Math.floor(budget / policy.conservativeUnitCostUsd);
    rolling30d = rolling30d === null
      ? budgetBound
      : Math.min(rolling30d, budgetBound);
  }

  return { daily, rolling30d };
}

function baseDecision(provider: KlyxExternalProviderName): KlyxExternalCostDecision {
  return evaluateKlyxExternalCost({
    provider,
    mode: getKlyxExternalCostMode(),
    explicitlyEnabled: providerExplicitlyEnabled(provider),
    providerMonthlyBudgetUsd: providerMonthlyBudgetUsd(provider),
    globalMonthlyBudgetUsd: globalMonthlyBudgetUsd(),
    configuredPaidBudgetsTotalUsd: configuredPaidBudgetsTotalUsd(),
  });
}

function alertDecision(
  provider: KlyxExternalProviderName,
  action: string,
  decision: KlyxExternalCostDecision
): void {
  logServerWarning({
    event: "external_cost_circuit_open",
    code: `KLYX_COST_${providerEnvSuffix(provider)}_${decision.reason}`,
    route: action,
  });
}

function alertLowQuota(
  provider: KlyxExternalProviderName,
  action: string,
  scope: "daily" | "rolling30d",
  remaining: number,
  limit: number
): void {
  if (limit <= 0 || remaining / limit > QUOTA_WARNING_RATIO) return;
  logServerWarning({
    event: "external_cost_quota_low",
    code: `KLYX_COST_${providerEnvSuffix(provider)}_${scope}_${remaining}_OF_${limit}`,
    route: action,
  });
}

export async function authorizeExternalProviderCall(
  provider: KlyxExternalProviderName,
  action: string
): Promise<KlyxExternalCostDecision> {
  const initial = baseDecision(provider);
  if (!initial.allowed) {
    alertDecision(provider, action, initial);
    return initial;
  }

  const limits = resolvedCallLimits(provider);
  if (limits.daily === null && limits.rolling30d === null) {
    return initial;
  }

  try {
    let dailyAllowed: boolean | undefined;
    let rolling30DayAllowed: boolean | undefined;

    if (limits.daily !== null) {
      const daily = await consumeApiRateLimit(GLOBAL_SUBJECT, {
        action: `external_cost_${provider}_day`,
        limit: limits.daily,
        windowSeconds: DAY_SECONDS,
      });
      dailyAllowed = daily.allowed;
      alertLowQuota(provider, action, "daily", daily.remaining, limits.daily);
    }

    if (limits.rolling30d !== null) {
      const monthly = await consumeApiRateLimit(GLOBAL_SUBJECT, {
        action: `external_cost_${provider}_30d`,
        limit: limits.rolling30d,
        windowSeconds: ROLLING_30D_SECONDS,
      });
      rolling30DayAllowed = monthly.allowed;
      alertLowQuota(
        provider,
        action,
        "rolling30d",
        monthly.remaining,
        limits.rolling30d
      );
    }

    const decision = evaluateKlyxExternalCost({
      provider,
      mode: getKlyxExternalCostMode(),
      explicitlyEnabled: providerExplicitlyEnabled(provider),
      providerMonthlyBudgetUsd: providerMonthlyBudgetUsd(provider),
      globalMonthlyBudgetUsd: globalMonthlyBudgetUsd(),
      configuredPaidBudgetsTotalUsd: configuredPaidBudgetsTotalUsd(),
      dailyQuotaAllowed: dailyAllowed,
      rolling30DayQuotaAllowed: rolling30DayAllowed,
      quotaAuthorityAvailable: true,
    });

    if (!decision.allowed) alertDecision(provider, action, decision);
    return decision;
  } catch {
    const decision = evaluateKlyxExternalCost({
      provider,
      mode: getKlyxExternalCostMode(),
      explicitlyEnabled: providerExplicitlyEnabled(provider),
      providerMonthlyBudgetUsd: providerMonthlyBudgetUsd(provider),
      globalMonthlyBudgetUsd: globalMonthlyBudgetUsd(),
      configuredPaidBudgetsTotalUsd: configuredPaidBudgetsTotalUsd(),
      quotaAuthorityAvailable: false,
    });
    alertDecision(provider, action, decision);
    return decision;
  }
}

export async function assertExternalProviderCallAllowed(
  provider: KlyxExternalProviderName,
  action: string
): Promise<void> {
  const decision = await authorizeExternalProviderCall(provider, action);
  if (!decision.allowed) {
    throw new Error(
      `KLYX_EXTERNAL_COST_BLOCKED:${provider}:${decision.reason}`
    );
  }
}
