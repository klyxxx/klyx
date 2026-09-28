import "server-only";

import { randomUUID } from "crypto";

import { logServerWarning } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  externalCostAlertLevel,
  getKlyxExternalMeterBudget,
  type KlyxExternalProviderMeter,
} from "./cost-control";

export type KlyxExternalProviderReservation = {
  allowed: boolean;
  deduplicated: boolean;
  reason: string;
  provider: string;
  meter: KlyxExternalProviderMeter;
  dayUnits: number;
  monthUnits: number;
  dayLimit: number;
  monthLimit: number;
  alertLevel: 0 | 50 | 80 | 100;
};

type RpcReservationRow = {
  allowed?: unknown;
  deduplicated?: unknown;
  reason?: unknown;
  day_units?: unknown;
  month_units?: unknown;
  day_limit?: unknown;
  month_limit?: unknown;
};

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
}

function denied(
  meter: KlyxExternalProviderMeter,
  reason: string
): KlyxExternalProviderReservation {
  const budget = getKlyxExternalMeterBudget(meter);
  return {
    allowed: false,
    deduplicated: false,
    reason,
    provider: budget.provider,
    meter,
    dayUnits: 0,
    monthUnits: 0,
    dayLimit: budget.dailyLimit,
    monthLimit: budget.monthlyLimit,
    alertLevel: budget.dailyLimit === 0 || budget.monthlyLimit === 0 ? 100 : 0,
  };
}

function warnIfNeeded(result: KlyxExternalProviderReservation): void {
  if (result.alertLevel < 50) return;

  logServerWarning({
    event: "external_provider_cost_threshold",
    code: `KLYX_COST_${result.provider.toUpperCase()}_${result.alertLevel}`,
  });
}

export async function reserveKlyxExternalProviderUsage(params: {
  meter: KlyxExternalProviderMeter;
  units?: number;
  idempotencyKey?: string;
}): Promise<KlyxExternalProviderReservation> {
  const budget = getKlyxExternalMeterBudget(params.meter);
  const units = Math.max(1, Math.floor(params.units ?? 1));

  if (budget.dailyLimit <= 0 || budget.monthlyLimit <= 0) {
    const result = denied(params.meter, "budget_disabled");
    warnIfNeeded(result);
    return result;
  }

  const idempotencyKey =
    params.idempotencyKey?.trim() || `cost:${randomUUID()}`;

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "klyx_reserve_external_provider_usage",
      {
        p_provider: budget.provider,
        p_metric: params.meter,
        p_units: units,
        p_daily_limit: budget.dailyLimit,
        p_monthly_limit: budget.monthlyLimit,
        p_idempotency_key: idempotencyKey.slice(0, 200),
      }
    );

    if (error) {
      const result = denied(params.meter, "usage_store_unavailable");
      logServerWarning({
        event: "external_provider_cost_store_failed",
        code: `KLYX_COST_${budget.provider.toUpperCase()}_STORE`,
      });
      return result;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | RpcReservationRow
      | null
      | undefined;

    if (!row) {
      return denied(params.meter, "usage_store_empty");
    }

    const dayUnits = numberValue(row.day_units);
    const monthUnits = numberValue(row.month_units);
    const dayLimit = numberValue(row.day_limit) || budget.dailyLimit;
    const monthLimit = numberValue(row.month_limit) || budget.monthlyLimit;
    const alertLevel = Math.max(
      externalCostAlertLevel(dayUnits, dayLimit),
      externalCostAlertLevel(monthUnits, monthLimit)
    ) as 0 | 50 | 80 | 100;

    const result: KlyxExternalProviderReservation = {
      allowed: row.allowed === true,
      deduplicated: row.deduplicated === true,
      reason: typeof row.reason === "string" ? row.reason : "unknown",
      provider: budget.provider,
      meter: params.meter,
      dayUnits,
      monthUnits,
      dayLimit,
      monthLimit,
      alertLevel,
    };

    warnIfNeeded(result);
    return result;
  } catch {
    const result = denied(params.meter, "usage_store_exception");
    logServerWarning({
      event: "external_provider_cost_store_exception",
      code: `KLYX_COST_${budget.provider.toUpperCase()}_STORE`,
    });
    return result;
  }
}

export async function requireKlyxExternalProviderUsage(params: {
  meter: KlyxExternalProviderMeter;
  units?: number;
  idempotencyKey?: string;
}): Promise<KlyxExternalProviderReservation> {
  const result = await reserveKlyxExternalProviderUsage(params);

  if (!result.allowed) {
    throw new Error(
      `KLYX_EXTERNAL_COST_BLOCKED:${result.provider}:${result.reason}`
    );
  }

  return result;
}
