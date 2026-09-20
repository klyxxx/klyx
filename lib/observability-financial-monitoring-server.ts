import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxMonitoringSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

type OpsSignalRow = {
  signal_key: string;
  signal_type: string;
  severity: KlyxMonitoringSeverity;
  source_type: string;
  source_ref: string;
  operation_id: string | null;
  correlation_id: string | null;
  failure_domain_type: string | null;
  failure_domain_key: string | null;
  market_id: string | null;
  region_id: string | null;
  country_code: string | null;
  currency: string | null;
  payment_provider: string | null;
  capability: string | null;
  dependency: string | null;
  occurred_at: string;
  age_seconds: number | string;
  financial_impact_minor: number | string | null;
  financial_currency: string | null;
};

type FinancialSignalRow = {
  signal_key: string;
  signal_type: string;
  severity: KlyxMonitoringSeverity;
  source_type: string;
  source_ref: string;
  booking_id: string | null;
  currency: string | null;
  dimension: string;
  reason_code: string;
  state: string;
  occurred_at: string;
  age_seconds: number | string;
};

type FinancialFlowRow = {
  currency: string;
  movement_type: string;
  movement_count: number | string;
  amount_minor_total: number | string;
  earliest_occurred_at: string | null;
  latest_occurred_at: string | null;
};

function safeInteger(
  value: number | string | null | undefined,
  fallback = 0
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function monitoringHealth(counts: Record<KlyxMonitoringSeverity, number>) {
  if (counts.critical > 0) return "critical" as const;
  if (counts.error > 0 || counts.warning > 0) return "degraded" as const;
  return "healthy" as const;
}

export async function getKlyxObservabilityFinancialMonitoringSnapshot(input?: {
  signalLimit?: number;
  staleReleaseSeconds?: number;
}) {
  const signalLimit = input?.signalLimit ?? 250;
  const staleReleaseSeconds = input?.staleReleaseSeconds ?? 900;

  if (
    !Number.isSafeInteger(signalLimit) ||
    signalLimit < 1 ||
    signalLimit > 500
  ) {
    throw new Error("KLYX_MONITORING_SIGNAL_LIMIT_INVALID");
  }

  if (
    !Number.isSafeInteger(staleReleaseSeconds) ||
    staleReleaseSeconds < 60 ||
    staleReleaseSeconds > 86400
  ) {
    throw new Error("KLYX_MONITORING_STALE_RELEASE_SECONDS_INVALID");
  }

  const [opsResult, financialResult, flowResult] = await Promise.all([
    supabaseAdmin
      .from("ops_observability_signals_current")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(signalLimit),
    supabaseAdmin
      .from("financial_monitoring_signals_current")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(signalLimit),
    supabaseAdmin
      .from("financial_monitoring_flow_24h")
      .select(
        "currency, movement_type, movement_count, amount_minor_total, earliest_occurred_at, latest_occurred_at"
      )
      .order("currency", { ascending: true })
      .order("movement_type", { ascending: true }),
  ]);

  if (opsResult.error) {
    throw new Error("KLYX_MONITORING_OPS_SIGNALS_READ_FAILED", {
      cause: opsResult.error,
    });
  }

  if (financialResult.error) {
    throw new Error("KLYX_MONITORING_FINANCIAL_SIGNALS_READ_FAILED", {
      cause: financialResult.error,
    });
  }

  if (flowResult.error) {
    throw new Error("KLYX_MONITORING_FINANCIAL_FLOW_READ_FAILED", {
      cause: flowResult.error,
    });
  }

  const operationalSignals = ((opsResult.data ?? []) as OpsSignalRow[]).map(
    (row) => ({
      signalKey: row.signal_key,
      signalType: row.signal_type,
      severity: row.severity,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      operationId: row.operation_id,
      correlationId: row.correlation_id,
      failureDomainType: row.failure_domain_type,
      failureDomainKey: row.failure_domain_key,
      marketId: row.market_id,
      regionId: row.region_id,
      countryCode: row.country_code,
      currency: row.currency,
      paymentProvider: row.payment_provider,
      capability: row.capability,
      dependency: row.dependency,
      occurredAt: row.occurred_at,
      ageSeconds: safeInteger(row.age_seconds),
      financialImpactMinor:
        row.financial_impact_minor === null
          ? null
          : String(row.financial_impact_minor),
      financialCurrency: row.financial_currency,
    })
  );

  const financialSignals = (
    (financialResult.data ?? []) as FinancialSignalRow[]
  ).map((row) => {
    const ageSeconds = safeInteger(row.age_seconds);
    const staleRelease =
      row.signal_type === "settlement_release_claimed" &&
      ageSeconds >= staleReleaseSeconds;

    return {
      signalKey: row.signal_key,
      signalType: row.signal_type,
      severity: staleRelease ? ("warning" as const) : row.severity,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      bookingId: row.booking_id,
      currency: row.currency,
      dimension: row.dimension,
      reasonCode: staleRelease
        ? "SETTLEMENT_RELEASE_CLAIM_STALE"
        : row.reason_code,
      state: row.state,
      occurredAt: row.occurred_at,
      ageSeconds,
      staleRelease,
    };
  });

  const severityCounts: Record<KlyxMonitoringSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };

  for (const signal of [...operationalSignals, ...financialSignals]) {
    severityCounts[signal.severity] += 1;
  }

  const financialFlow24h = ((flowResult.data ?? []) as FinancialFlowRow[]).map(
    (row) => ({
      currency: row.currency,
      movementType: row.movement_type,
      movementCount: safeInteger(row.movement_count),
      amountMinorTotal: String(row.amount_minor_total ?? "0"),
      earliestOccurredAt: row.earliest_occurred_at,
      latestOccurredAt: row.latest_occurred_at,
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    health: monitoringHealth(severityCounts),
    severityCounts,
    operationalSignals,
    financialSignals,
    financialFlow24h,
    policy: {
      staleReleaseSeconds,
      signalLimit,
    },
    authority: {
      monitoringIsDerived: true,
      ledgerRemainsCanonical: true,
      settlementRemainsCanonical: true,
      reconciliationRemainsCanonical: true,
      durableJobsRemainCanonical: true,
      humanOperationsRemainCanonical: true,
      automaticIncidentMutation: false,
    },
  };
}
