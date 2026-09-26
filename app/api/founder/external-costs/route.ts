import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  KLYX_EXTERNAL_PROVIDER_POLICIES,
  getExternalCostPolicy,
  getGlobalPaidBudgetMicrousd,
} from "@/lib/external-cost-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/external-costs";

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function currentDayStart(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const periodStart = currentMonthStart();
    const dayStart = currentDayStart();
    const [monthlyResult, dailyResult] = await Promise.all([
      supabaseAdmin
        .from("external_provider_usage_monthly")
        .select(
          "provider, period_start, units_used, cost_microusd, last_action, updated_at"
        )
        .eq("period_start", periodStart)
        .order("provider", { ascending: true }),
      supabaseAdmin
        .from("external_provider_usage_daily")
        .select("provider, day_start, units_used, last_action, updated_at")
        .eq("day_start", dayStart)
        .order("provider", { ascending: true }),
    ]);

    if (monthlyResult.error) throw monthlyResult.error;
    if (dailyResult.error) throw dailyResult.error;

    const globalBudgetMicrousd = getGlobalPaidBudgetMicrousd();
    const providers = Object.keys(KLYX_EXTERNAL_PROVIDER_POLICIES).map(
      (provider) => {
        const typed = provider as keyof typeof KLYX_EXTERNAL_PROVIDER_POLICIES;
        const policy = getExternalCostPolicy(typed);
        const effectiveBudgetMicrousd = policy.paidRisk
          ? Math.min(policy.defaultMonthlyBudgetMicrousd, globalBudgetMicrousd)
          : policy.defaultMonthlyBudgetMicrousd;
        const monthlyUsage =
          (monthlyResult.data ?? []).find((row) => row.provider === provider) ?? null;
        const dailyUsage =
          (dailyResult.data ?? []).find((row) => row.provider === provider) ?? null;

        return {
          provider,
          paidRisk: policy.paidRisk,
          critical: policy.critical,
          fallback: policy.fallback,
          monthlyBudgetMicrousd: effectiveBudgetMicrousd,
          monthlyUnitLimit: policy.defaultMonthlyUnitLimit,
          dailyUnitLimit: policy.defaultDailyUnitLimit,
          fixedMonthlyCommitmentMicrousd: policy.fixedMonthlyCommitmentMicrousd,
          paidActivationEnv: policy.paidActivationEnv ?? null,
          monthlyUsage,
          dailyUsage,
        };
      }
    );

    return NextResponse.json({
      periodStart,
      dayStart,
      globalBudgetMicrousd,
      zeroBudgetMode: globalBudgetMicrousd === 0,
      alertThresholdsPct: [75, 90, 100],
      providers,
      authority: {
        costDecision: "external_cost_control",
        operationalBlocking: "ops_capability_controls",
        financialLive: "unchanged",
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_external_costs_read_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_FOUNDER_EXTERNAL_COSTS_READ_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
