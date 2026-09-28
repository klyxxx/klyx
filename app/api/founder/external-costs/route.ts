import "server-only";

import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import {
  KLYX_EXTERNAL_PROVIDER_COST_POLICIES,
  getKlyxExternalCostMode,
  getKlyxExternalMeterBudget,
  type KlyxExternalProviderMeter,
} from "@/lib/providers/cost-control";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/founder/external-costs";

const METERS: KlyxExternalProviderMeter[] = [
  "openai_request",
  "sumsub_verification_session",
  "twilio_verification_start",
  "resend_email",
  "elmah_message",
];

function utcDayStart(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const dayStart = utcDayStart();
    const monthStart = utcMonthStart();

    const [dayResult, monthResult] = await Promise.all([
      supabaseAdmin
        .from("klyx_external_provider_usage_windows")
        .select("provider, metric, window_kind, window_start, units, updated_at")
        .eq("window_kind", "day")
        .eq("window_start", dayStart)
        .order("provider", { ascending: true })
        .order("metric", { ascending: true }),
      supabaseAdmin
        .from("klyx_external_provider_usage_windows")
        .select("provider, metric, window_kind, window_start, units, updated_at")
        .eq("window_kind", "month")
        .eq("window_start", monthStart)
        .order("provider", { ascending: true })
        .order("metric", { ascending: true }),
    ]);

    if (dayResult.error) throw dayResult.error;
    if (monthResult.error) throw monthResult.error;

    const dayRows = dayResult.data ?? [];
    const monthRows = monthResult.data ?? [];

    const meters = METERS.map((meter) => {
      const budget = getKlyxExternalMeterBudget(meter);
      const dailyUsage =
        dayRows.find(
          (row) => row.provider === budget.provider && row.metric === meter
        ) ?? null;
      const monthlyUsage =
        monthRows.find(
          (row) => row.provider === budget.provider && row.metric === meter
        ) ?? null;

      return {
        meter,
        provider: budget.provider,
        dailyLimit: budget.dailyLimit,
        monthlyLimit: budget.monthlyLimit,
        critical: budget.critical,
        automaticDisableAtLimit: budget.automaticDisableAtLimit,
        dailyUsage,
        monthlyUsage,
      };
    });

    const providers = Object.values(KLYX_EXTERNAL_PROVIDER_COST_POLICIES).map(
      (policy) => ({
        provider: policy.provider,
        billingKind: policy.billingKind,
        zeroBudgetBehavior: policy.zeroBudgetBehavior,
        freeFallback: policy.freeFallback,
        replaceable: policy.replaceable,
      })
    );

    return NextResponse.json({
      telemetryKind: "internal_quota_usage",
      invoiceData: false,
      note:
        "These counters are KLYX internal quota reservations. They are not provider invoices, charges, balances, or billed-cost truth.",
      mode: getKlyxExternalCostMode(),
      dayStart,
      monthStart,
      providers,
      meters,
      authority: {
        costGuard: "klyx_external_cost_control",
        providerBillingTruth: "external_provider_account",
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
