import "server-only";

import {
  assertLiveFinancialStaticGate,
  KLYX_LIVE_FINANCIAL_SHA_MISMATCH,
} from "@/lib/live-financial-runtime-policy";
import {
  getKlyxObservabilityFinancialMonitoringSnapshot,
} from "@/lib/observability-financial-monitoring-server";
import {
  requireKlyxOpsCapabilityAvailable,
  type KlyxOpsCapabilityScope,
} from "@/lib/ops-control-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export {
  assertLiveFinancialStaticGate,
  inspectLiveFinancialStaticGate,
  KLYX_LIVE_FINANCIAL_NOT_ARMED,
  KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY,
  KLYX_LIVE_FINANCIAL_SHA_MISMATCH,
  liveFinancialRuntimeEnvironment,
  type LiveFinancialEnvironment,
  type LiveFinancialStaticGateCheck,
  type LiveFinancialStaticGateReport,
} from "@/lib/live-financial-runtime-policy";

export const KLYX_LIVE_FINANCIAL_CRITICAL_SIGNAL =
  "KLYX_LIVE_FINANCIAL_CRITICAL_SIGNAL";
export const KLYX_LIVE_FINANCIAL_DLQ_NOT_EMPTY =
  "KLYX_LIVE_FINANCIAL_DLQ_NOT_EMPTY";
export const KLYX_LIVE_FINANCIAL_RECONCILIATION_OPEN =
  "KLYX_LIVE_FINANCIAL_RECONCILIATION_OPEN";
export const KLYX_LIVE_FINANCIAL_LEDGER_UNAVAILABLE =
  "KLYX_LIVE_FINANCIAL_LEDGER_UNAVAILABLE";

export type LiveFinancialMutation =
  | "checkout"
  | "transfer"
  | "transfer_reversal"
  | "refund";

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function mutationCapability(
  mutation: LiveFinancialMutation
): "payments" | "settlement_release" | "refunds" {
  if (mutation === "checkout") return "payments";
  if (mutation === "transfer") return "settlement_release";
  return "refunds";
}

async function assertCanonicalLedgerAvailable(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("financial_ledger_current")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(KLYX_LIVE_FINANCIAL_LEDGER_UNAVAILABLE, {
      cause: error,
    });
  }
}

async function assertNoOpenFinancialReconciliation(): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("financial_reconciliation_current")
    .select("id", { count: "exact", head: true })
    .in("state", ["reconciliation", "human_review"]);

  if (error) {
    throw new Error(KLYX_LIVE_FINANCIAL_RECONCILIATION_OPEN, {
      cause: error,
    });
  }

  if ((count ?? 0) > 0) {
    throw new Error(KLYX_LIVE_FINANCIAL_RECONCILIATION_OPEN);
  }
}

async function assertFinancialDlqEmpty(): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("ops_durable_job_dlq")
    .select("id", { count: "exact", head: true })
    .or(
      "payment_provider.eq.stripe,capability.in.(payments,settlement,settlement_release,refunds,payouts)"
    );

  if (error) {
    throw new Error(KLYX_LIVE_FINANCIAL_DLQ_NOT_EMPTY, {
      cause: error,
    });
  }

  if ((count ?? 0) > 0) {
    throw new Error(KLYX_LIVE_FINANCIAL_DLQ_NOT_EMPTY);
  }
}

async function assertNoCriticalMonitoringSignal(): Promise<void> {
  const snapshot =
    await getKlyxObservabilityFinancialMonitoringSnapshot({
      signalLimit: 250,
    });

  if (snapshot.severityCounts.critical > 0) {
    throw new Error(KLYX_LIVE_FINANCIAL_CRITICAL_SIGNAL);
  }
}

export async function requireLiveFinancialMutationAuthorized(input: {
  mutation: LiveFinancialMutation;
  scope?: Omit<KlyxOpsCapabilityScope, "capability">;
}): Promise<{
  certifiedSha: string;
  deployedSha: string;
  mutation: LiveFinancialMutation;
}> {
  const mode = clean(process.env.KLYX_STRIPE_MODE).toLowerCase();

  if (mode !== "live") {
    return {
      certifiedSha: "test",
      deployedSha: "test",
      mutation: input.mutation,
    };
  }

  const report = assertLiveFinancialStaticGate();
  const scope = input.scope ?? {};

  await requireKlyxOpsCapabilityAvailable({
    ...scope,
    capability: "payments",
    paymentProvider: scope.paymentProvider ?? "stripe",
  });

  const specificCapability = mutationCapability(input.mutation);
  if (specificCapability !== "payments") {
    await requireKlyxOpsCapabilityAvailable({
      ...scope,
      capability: specificCapability,
      paymentProvider: scope.paymentProvider ?? "stripe",
    });
  }

  await Promise.all([
    assertCanonicalLedgerAvailable(),
    assertNoOpenFinancialReconciliation(),
    assertFinancialDlqEmpty(),
    assertNoCriticalMonitoringSignal(),
  ]);

  if (!report.certifiedSha || !report.deployedSha) {
    throw new Error(KLYX_LIVE_FINANCIAL_SHA_MISMATCH);
  }

  return {
    certifiedSha: report.certifiedSha,
    deployedSha: report.deployedSha,
    mutation: input.mutation,
  };
}
