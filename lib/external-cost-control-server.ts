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
  unitsUsed: number;
  costMicrousd: number;
  unitsRemaining: number | null;
  budgetRemainingMicrousd: number;
};

type RpcRow = {
  allowed?: unknown;
  reason?: unknown;
  period_start?: unknown;
  units_used?: unknown;
  cost_microusd?: unknown;
  units_remaining?: unknown;
  budget_remaining_microusd?: unknown;
};

function int(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
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
    console.warn(
      JSON.stringify({
        marker: "KLYX_EXTERNAL_COST_BLOCKED",
        provider: input.provider,
        action: input.action,
        reason: decision.reason,
        fallback: policy.fallback,
      })
    );

    return {
      allowed: false,
      provider: input.provider,
      reason: decision.reason,
      fallback: policy.fallback,
      periodStart: null,
      unitsUsed: 0,
      costMicrousd: 0,
      unitsRemaining: policy.defaultMonthlyUnitLimit,
      budgetRemainingMicrousd: policy.defaultMonthlyBudgetMicrousd,
    };
  }

  if (
    decision.reason === "CONTROL_DISABLED_FOR_TEST" ||
    decision.reason === "NO_EXTERNAL_RUNTIME_CALL" ||
    (policy.defaultMonthlyUnitLimit === null && estimatedCostMicrousd === 0)
  ) {
    return {
      allowed: true,
      provider: input.provider,
      reason: decision.reason,
      fallback: policy.fallback,
      periodStart: null,
      unitsUsed: 0,
      costMicrousd: 0,
      unitsRemaining: policy.defaultMonthlyUnitLimit,
      budgetRemainingMicrousd: policy.defaultMonthlyBudgetMicrousd,
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
      p_budget_microusd: policy.defaultMonthlyBudgetMicrousd,
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
    unitsUsed: int(row.units_used),
    costMicrousd: int(row.cost_microusd),
    unitsRemaining:
      row.units_remaining === null || row.units_remaining === undefined
        ? null
        : int(row.units_remaining),
    budgetRemainingMicrousd: int(row.budget_remaining_microusd),
  };

  const unitRatio =
    policy.defaultMonthlyUnitLimit && policy.defaultMonthlyUnitLimit > 0
      ? result.unitsUsed / policy.defaultMonthlyUnitLimit
      : 0;
  const budgetRatio =
    policy.defaultMonthlyBudgetMicrousd > 0
      ? result.costMicrousd / policy.defaultMonthlyBudgetMicrousd
      : 0;

  if (!result.allowed || unitRatio >= 0.8 || budgetRatio >= 0.8) {
    console.warn(
      JSON.stringify({
        marker: result.allowed
          ? "KLYX_EXTERNAL_COST_ALERT"
          : "KLYX_EXTERNAL_COST_CIRCUIT_OPEN",
        provider: input.provider,
        action: input.action,
        reason: result.reason,
        unitsUsed: result.unitsUsed,
        costMicrousd: result.costMicrousd,
        unitRatio,
        budgetRatio,
        fallback: policy.fallback,
      })
    );
  }

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
