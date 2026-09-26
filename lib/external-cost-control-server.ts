import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  decideExternalCostAction,
  getExternalCostPolicy,
  type KlyxExternalProvider,
} from "@/lib/external-cost-policy";

export type KlyxExternalCostReservation = {
  allowed: boolean;
  provider: KlyxExternalProvider;
  reason: string;
  fallback: string;
  periodStart: string | null;
  dayStart: string | null;
  unitsUsed: number;
  dailyUnitsUsed: number;
  costMicrousd: number;
  unitsRemaining: number | null;
  dailyUnitsRemaining: number | null;
  budgetRemainingMicrousd: number;
};

type RpcRow = {
  allowed?: unknown;
  reason?: unknown;
  period_start?: unknown;
  day_start?: unknown;
  units_used?: unknown;
  daily_units_used?: unknown;
  cost_microusd?: unknown;
  units_remaining?: unknown;
  daily_units_remaining?: unknown;
  budget_remaining_microusd?: unknown;
};

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function ratio(used: number, limit: number | null): number {
  return limit && limit > 0 ? used / limit : 0;
}

function alertThreshold(maxRatio: number): 0 | 75 | 90 | 100 {
  if (maxRatio >= 1) return 100;
  if (maxRatio >= 0.9) return 90;
  if (maxRatio >= 0.75) return 75;
  return 0;
}

function emitCostMarker(input: {
  provider: KlyxExternalProvider;
  action: string;
  reservation: KlyxExternalCostReservation;
  monthlyUnitLimit: number | null;
  dailyUnitLimit: number | null;
  monthlyBudgetMicrousd: number;
}) {
  const monthlyUnitRatio = ratio(
    input.reservation.unitsUsed,
    input.monthlyUnitLimit
  );
  const dailyUnitRatio = ratio(
    input.reservation.dailyUnitsUsed,
    input.dailyUnitLimit
  );
  const budgetRatio =
    input.monthlyBudgetMicrousd > 0
      ? input.reservation.costMicrousd / input.monthlyBudgetMicrousd
      : 0;
  const maxRatio = Math.max(monthlyUnitRatio, dailyUnitRatio, budgetRatio);
  const thresholdPct = input.reservation.allowed
    ? alertThreshold(maxRatio)
    : 100;

  if (thresholdPct === 0) return;

  console.warn(
    JSON.stringify({
      marker:
        thresholdPct === 100
          ? "KLYX_EXTERNAL_COST_CIRCUIT_OPEN"
          : "KLYX_EXTERNAL_COST_ALERT",
      thresholdPct,
      provider: input.provider,
      action: input.action,
      reason: input.reservation.reason,
      unitsUsed: input.reservation.unitsUsed,
      dailyUnitsUsed: input.reservation.dailyUnitsUsed,
      costMicrousd: input.reservation.costMicrousd,
      monthlyUnitRatio,
      dailyUnitRatio,
      budgetRatio,
      fallback: input.reservation.fallback,
    })
  );
}

export async function reserveExternalProviderAction(input: {
  provider: KlyxExternalProvider;
  action: string;
  estimatedCostMicrousd?: number;
}): Promise<KlyxExternalCostReservation> {
  const estimatedCostMicrousd = Math.max(
    0,
    Math.floor(input.estimatedCostMicrousd ?? 0)
  );
  const policy = getExternalCostPolicy(input.provider);
  const decision = decideExternalCostAction({
    provider: input.provider,
    estimatedCostMicrousd,
  });

  if (decision.action !== "allow") {
    const reservation: KlyxExternalCostReservation = {
      allowed: false,
      provider: input.provider,
      reason: decision.reason,
      fallback: policy.fallback,
      periodStart: null,
      dayStart: null,
      unitsUsed: 0,
      dailyUnitsUsed: 0,
      costMicrousd: 0,
      unitsRemaining: policy.defaultMonthlyUnitLimit,
      dailyUnitsRemaining: policy.defaultDailyUnitLimit,
      budgetRemainingMicrousd: decision.monthlyBudgetMicrousd,
    };

    console.warn(
      JSON.stringify({
        marker: "KLYX_EXTERNAL_COST_CIRCUIT_OPEN",
        thresholdPct: 100,
        provider: input.provider,
        action: input.action,
        reason: decision.reason,
        fallback: policy.fallback,
      })
    );

    return reservation;
  }

  if (
    decision.reason === "CONTROL_DISABLED_FOR_TEST" ||
    decision.reason === "NO_EXTERNAL_RUNTIME_CALL" ||
    (policy.defaultMonthlyUnitLimit === null &&
      policy.defaultDailyUnitLimit === null &&
      estimatedCostMicrousd === 0)
  ) {
    return {
      allowed: true,
      provider: input.provider,
      reason: decision.reason,
      fallback: policy.fallback,
      periodStart: null,
      dayStart: null,
      unitsUsed: 0,
      dailyUnitsUsed: 0,
      costMicrousd: 0,
      unitsRemaining: policy.defaultMonthlyUnitLimit,
      dailyUnitsRemaining: policy.defaultDailyUnitLimit,
      budgetRemainingMicrousd: decision.monthlyBudgetMicrousd,
    };
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_reserve_external_provider_usage",
    {
      p_provider: input.provider,
      p_action: input.action.slice(0, 120),
      p_units: 1,
      p_cost_microusd: estimatedCostMicrousd,
      p_unit_limit: policy.defaultMonthlyUnitLimit,
      p_daily_unit_limit: policy.defaultDailyUnitLimit,
      p_budget_microusd: decision.monthlyBudgetMicrousd,
    }
  );

  if (error) {
    throw new Error(`KLYX_EXTERNAL_COST_CONTROL_UNAVAILABLE:${error.message}`);
  }

  const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : (data as RpcRow | null);
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("KLYX_EXTERNAL_COST_CONTROL_INVALID_RESULT");
  }

  const result: KlyxExternalCostReservation = {
    allowed: row.allowed,
    provider: input.provider,
    reason: typeof row.reason === "string" ? row.reason : "UNKNOWN",
    fallback: policy.fallback,
    periodStart: typeof row.period_start === "string" ? row.period_start : null,
    dayStart: typeof row.day_start === "string" ? row.day_start : null,
    unitsUsed: int(row.units_used),
    dailyUnitsUsed: int(row.daily_units_used),
    costMicrousd: int(row.cost_microusd),
    unitsRemaining:
      row.units_remaining === null || row.units_remaining === undefined
        ? null
        : int(row.units_remaining),
    dailyUnitsRemaining:
      row.daily_units_remaining === null || row.daily_units_remaining === undefined
        ? null
        : int(row.daily_units_remaining),
    budgetRemainingMicrousd: int(row.budget_remaining_microusd),
  };

  emitCostMarker({
    provider: input.provider,
    action: input.action,
    reservation: result,
    monthlyUnitLimit: policy.defaultMonthlyUnitLimit,
    dailyUnitLimit: policy.defaultDailyUnitLimit,
    monthlyBudgetMicrousd: decision.monthlyBudgetMicrousd,
  });

  return result;
}

export async function assertExternalProviderAction(input: {
  provider: KlyxExternalProvider;
  action: string;
  estimatedCostMicrousd?: number;
}): Promise<KlyxExternalCostReservation> {
  const reservation = await reserveExternalProviderAction(input);
  if (!reservation.allowed) {
    throw new Error(
      `KLYX_EXTERNAL_COST_BLOCKED:${input.provider}:${reservation.reason}:${reservation.fallback}`
    );
  }
  return reservation;
}
