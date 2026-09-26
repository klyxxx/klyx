import "server-only";

import {
  consumeApiRateLimit,
  type ApiRateLimitPolicy,
} from "@/lib/api-rate-limit";
import {
  evaluateKlyxExternalCost,
  KLYX_EXTERNAL_PROVIDER_DEFAULTS,
  type KlyxExternalCostCriticality,
  type KlyxExternalCostMode,
  type KlyxExternalProvider,
} from "@/lib/external-cost-control";

const ROLLING_MONTH_SECONDS = 30 * 24 * 60 * 60;
const DAY_SECONDS = 24 * 60 * 60;
const RESEND_ZERO_MODE_DAILY_LIMIT = 80;
const RESEND_ZERO_MODE_MONTHLY_LIMIT = 2_400;

export type KlyxExternalCostAuthorization = {
  allowed: boolean;
  provider: KlyxExternalProvider;
  operation: string;
  mode: KlyxExternalCostMode;
  reason: string;
  fallback: string;
  remainingCalls: number | null;
};

function integerEnv(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function providerEnvToken(provider: KlyxExternalProvider): string {
  return provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  return process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() === "guarded"
    ? "guarded"
    : "zero";
}

function providerBudgetMicroUsd(provider: KlyxExternalProvider): number | null {
  return integerEnv(
    `KLYX_EXTERNAL_COST_${providerEnvToken(provider)}_MONTHLY_BUDGET_MICRO_USD`
  );
}

function providerConfiguredCallLimit(provider: KlyxExternalProvider): number | null {
  return integerEnv(
    `KLYX_EXTERNAL_COST_${providerEnvToken(provider)}_MONTHLY_CALL_LIMIT`
  );
}

function warnCost(input: {
  provider: KlyxExternalProvider;
  operation: string;
  reason: string;
  remainingCalls?: number | null;
}) {
  console.warn(
    JSON.stringify({
      marker: "KLYX_EXTERNAL_COST_GUARD",
      provider: input.provider,
      operation: input.operation,
      reason: input.reason,
      remainingCalls: input.remainingCalls ?? null,
    })
  );
}

async function consumeQuota(input: {
  provider: KlyxExternalProvider;
  bucket: "daily" | "monthly";
  limit: number;
  windowSeconds: number;
}) {
  const policy: ApiRateLimitPolicy = {
    action: `external_cost_${input.provider}_${input.bucket}`,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  };

  return consumeApiRateLimit(
    `external-cost:${input.provider}`,
    policy
  );
}

async function authorizeResendFreeQuota(
  operation: string
): Promise<KlyxExternalCostAuthorization> {
  const mode = getKlyxExternalCostMode();
  try {
    const daily = await consumeQuota({
      provider: "resend",
      bucket: "daily",
      limit: RESEND_ZERO_MODE_DAILY_LIMIT,
      windowSeconds: DAY_SECONDS,
    });
    if (!daily.allowed) {
      warnCost({
        provider: "resend",
        operation,
        reason: "FREE_DAILY_QUOTA_GUARD",
        remainingCalls: daily.remaining,
      });
      return {
        allowed: false,
        provider: "resend",
        operation,
        mode,
        reason: "FREE_DAILY_QUOTA_GUARD",
        fallback: "in_app_notification",
        remainingCalls: 0,
      };
    }

    const monthly = await consumeQuota({
      provider: "resend",
      bucket: "monthly",
      limit: RESEND_ZERO_MODE_MONTHLY_LIMIT,
      windowSeconds: ROLLING_MONTH_SECONDS,
    });
    if (!monthly.allowed) {
      warnCost({
        provider: "resend",
        operation,
        reason: "FREE_MONTHLY_QUOTA_GUARD",
        remainingCalls: monthly.remaining,
      });
      return {
        allowed: false,
        provider: "resend",
        operation,
        mode,
        reason: "FREE_MONTHLY_QUOTA_GUARD",
        fallback: "in_app_notification",
        remainingCalls: 0,
      };
    }

    const remaining = Math.min(daily.remaining, monthly.remaining);
    if (daily.remaining <= 16 || monthly.remaining <= 480) {
      warnCost({
        provider: "resend",
        operation,
        reason: "FREE_QUOTA_80_PERCENT_WARNING",
        remainingCalls: remaining,
      });
    }

    return {
      allowed: true,
      provider: "resend",
      operation,
      mode,
      reason: "FREE_QUOTA_AVAILABLE",
      fallback: "in_app_notification",
      remainingCalls: remaining,
    };
  } catch {
    warnCost({ provider: "resend", operation, reason: "QUOTA_AUTHORITY_UNAVAILABLE" });
    return {
      allowed: false,
      provider: "resend",
      operation,
      mode,
      reason: "QUOTA_AUTHORITY_UNAVAILABLE",
      fallback: "in_app_notification",
      remainingCalls: null,
    };
  }
}

export async function authorizeKlyxExternalCall(input: {
  provider: KlyxExternalProvider;
  operation: string;
  estimatedCostMicroUsd?: number;
  criticality?: KlyxExternalCostCriticality;
}): Promise<KlyxExternalCostAuthorization> {
  const mode = getKlyxExternalCostMode();
  const defaults = KLYX_EXTERNAL_PROVIDER_DEFAULTS[input.provider];

  if (
    process.env.NODE_ENV === "test" &&
    process.env.KLYX_EXTERNAL_COST_TEST_BYPASS === "1"
  ) {
    return {
      allowed: true,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: "TEST_MOCK_BYPASS",
      fallback: defaults.fallback,
      remainingCalls: null,
    };
  }

  if (input.provider === "resend") {
    return authorizeResendFreeQuota(input.operation);
  }

  const conservativeCost = Math.max(
    defaults.estimatedCostMicroUsd,
    Math.max(0, Math.floor(input.estimatedCostMicroUsd ?? 0))
  );
  const decision = evaluateKlyxExternalCost({
    mode,
    provider: input.provider,
    estimatedCostMicroUsd: conservativeCost,
    monthlyBudgetMicroUsd: providerBudgetMicroUsd(input.provider),
    criticality: input.criticality,
  });

  if (!decision.allowed) {
    warnCost({
      provider: input.provider,
      operation: input.operation,
      reason: decision.reason,
    });
    return {
      allowed: false,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: decision.reason,
      fallback: decision.fallback,
      remainingCalls: 0,
    };
  }

  if (!defaults.metered) {
    return {
      allowed: true,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: decision.reason,
      fallback: decision.fallback,
      remainingCalls: null,
    };
  }

  const configuredLimit = providerConfiguredCallLimit(input.provider);
  const budgetLimit = decision.maxCallsFromBudget;
  const limit = Math.min(
    configuredLimit ?? Number.MAX_SAFE_INTEGER,
    budgetLimit ?? Number.MAX_SAFE_INTEGER
  );

  if (!Number.isSafeInteger(limit) || limit <= 0 || limit === Number.MAX_SAFE_INTEGER) {
    warnCost({
      provider: input.provider,
      operation: input.operation,
      reason: "FINITE_QUOTA_REQUIRED",
    });
    return {
      allowed: false,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: "FINITE_QUOTA_REQUIRED",
      fallback: decision.fallback,
      remainingCalls: 0,
    };
  }

  try {
    const quota = await consumeQuota({
      provider: input.provider,
      bucket: "monthly",
      limit,
      windowSeconds: ROLLING_MONTH_SECONDS,
    });

    if (!quota.allowed) {
      warnCost({
        provider: input.provider,
        operation: input.operation,
        reason: "MONTHLY_COST_CIRCUIT_OPEN",
        remainingCalls: quota.remaining,
      });
      return {
        allowed: false,
        provider: input.provider,
        operation: input.operation,
        mode,
        reason: "MONTHLY_COST_CIRCUIT_OPEN",
        fallback: decision.fallback,
        remainingCalls: 0,
      };
    }

    if (quota.remaining <= Math.max(1, Math.floor(limit * 0.2))) {
      warnCost({
        provider: input.provider,
        operation: input.operation,
        reason: "MONTHLY_COST_80_PERCENT_WARNING",
        remainingCalls: quota.remaining,
      });
    }

    return {
      allowed: true,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: decision.reason,
      fallback: decision.fallback,
      remainingCalls: quota.remaining,
    };
  } catch {
    warnCost({
      provider: input.provider,
      operation: input.operation,
      reason: "COST_AUTHORITY_UNAVAILABLE",
    });
    return {
      allowed: false,
      provider: input.provider,
      operation: input.operation,
      mode,
      reason: "COST_AUTHORITY_UNAVAILABLE",
      fallback: decision.fallback,
      remainingCalls: null,
    };
  }
}

export function klyxFixedCostProviderEnabled(provider: "elmah_io"): boolean {
  if (getKlyxExternalCostMode() === "zero") {
    return false;
  }
  const token = providerEnvToken(provider);
  return process.env[`KLYX_EXTERNAL_COST_${token}_ENABLED`]?.trim() === "1";
}
