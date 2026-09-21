import "server-only";

import {
  getKlyxObservabilityFinancialMonitoringSnapshot,
} from "@/lib/observability-financial-monitoring-server";
import {
  requireKlyxOpsCapabilityAvailable,
  type KlyxOpsCapabilityScope,
} from "@/lib/ops-control-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const KLYX_LIVE_FINANCIAL_NOT_ARMED =
  "KLYX_LIVE_FINANCIAL_NOT_ARMED";
export const KLYX_LIVE_FINANCIAL_SHA_MISMATCH =
  "KLYX_LIVE_FINANCIAL_SHA_MISMATCH";
export const KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY =
  "KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY";
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

export type LiveFinancialEnvironment = {
  KLYX_STRIPE_MODE?: string;
  KLYX_LIVE_PAYMENTS_ENABLED?: string;
  KLYX_LIVE_FINANCIAL_STATE?: string;
  KLYX_LIVE_CERTIFIED_SHA?: string;
  KLYX_DEPLOYED_SHA?: string;
  KLYX_LIVE_WEBHOOKS_READY?: string;
  KLYX_LIVE_CONNECT_READY?: string;
  KLYX_LIVE_CRITICAL_ALERTS_READY?: string;
  KLYX_LIVE_DURABLE_JOBS_READY?: string;
  KLYX_LIVE_LEDGER_READY?: string;
  KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED?: string;
  KLYX_LIVE_RECONCILIATION_READY?: string;
  KLYX_SETTLEMENT_CONTROL_LIVE_READY?: string;
};

export type LiveFinancialStaticGateCheck = {
  key: string;
  ok: boolean;
  detail: string;
};

export type LiveFinancialStaticGateReport = {
  mode: "test" | "live" | "invalid";
  armed: boolean;
  certifiedSha: string | null;
  deployedSha: string | null;
  checks: LiveFinancialStaticGateCheck[];
  ready: boolean;
};

function envTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value);
}

function runtimeEnvironment(): LiveFinancialEnvironment {
  return {
    KLYX_STRIPE_MODE: process.env.KLYX_STRIPE_MODE,
    KLYX_LIVE_PAYMENTS_ENABLED: process.env.KLYX_LIVE_PAYMENTS_ENABLED,
    KLYX_LIVE_FINANCIAL_STATE: process.env.KLYX_LIVE_FINANCIAL_STATE,
    KLYX_LIVE_CERTIFIED_SHA: process.env.KLYX_LIVE_CERTIFIED_SHA,
    KLYX_DEPLOYED_SHA: process.env.KLYX_DEPLOYED_SHA,
    KLYX_LIVE_WEBHOOKS_READY: process.env.KLYX_LIVE_WEBHOOKS_READY,
    KLYX_LIVE_CONNECT_READY: process.env.KLYX_LIVE_CONNECT_READY,
    KLYX_LIVE_CRITICAL_ALERTS_READY:
      process.env.KLYX_LIVE_CRITICAL_ALERTS_READY,
    KLYX_LIVE_DURABLE_JOBS_READY:
      process.env.KLYX_LIVE_DURABLE_JOBS_READY,
    KLYX_LIVE_LEDGER_READY: process.env.KLYX_LIVE_LEDGER_READY,
    KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED:
      process.env.KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED,
    KLYX_LIVE_RECONCILIATION_READY:
      process.env.KLYX_LIVE_RECONCILIATION_READY,
    KLYX_SETTLEMENT_CONTROL_LIVE_READY:
      process.env.KLYX_SETTLEMENT_CONTROL_LIVE_READY,
  };
}

export function inspectLiveFinancialStaticGate(
  env: LiveFinancialEnvironment = runtimeEnvironment()
): LiveFinancialStaticGateReport {
  const rawMode = clean(env.KLYX_STRIPE_MODE).toLowerCase();
  const mode =
    rawMode === "test" || rawMode === "live" ? rawMode : "invalid";
  const certifiedSha = clean(env.KLYX_LIVE_CERTIFIED_SHA);
  const deployedSha = clean(env.KLYX_DEPLOYED_SHA);
  const armed =
    clean(env.KLYX_LIVE_FINANCIAL_STATE).toLowerCase() === "armed";

  if (mode !== "live") {
    return {
      mode,
      armed: false,
      certifiedSha: certifiedSha || null,
      deployedSha: deployedSha || null,
      checks: [],
      ready: mode === "test",
    };
  }

  const checks: LiveFinancialStaticGateCheck[] = [
    {
      key: "master_state",
      ok: armed,
      detail:
        "KLYX_LIVE_FINANCIAL_STATE doit etre exactement armed.",
    },
    {
      key: "payments_switch",
      ok: envTrue(env.KLYX_LIVE_PAYMENTS_ENABLED),
      detail: "KLYX_LIVE_PAYMENTS_ENABLED doit etre true.",
    },
    {
      key: "certified_sha",
      ok: isSha(certifiedSha),
      detail: "KLYX_LIVE_CERTIFIED_SHA doit etre un SHA Git complet.",
    },
    {
      key: "deployed_sha",
      ok: isSha(deployedSha),
      detail: "KLYX_DEPLOYED_SHA doit etre un SHA Git complet.",
    },
    {
      key: "sha_equality",
      ok:
        isSha(certifiedSha) &&
        isSha(deployedSha) &&
        certifiedSha.toLowerCase() === deployedSha.toLowerCase(),
      detail:
        "Le SHA deploye doit etre strictement identique au SHA certifie.",
    },
    {
      key: "webhooks",
      ok: envTrue(env.KLYX_LIVE_WEBHOOKS_READY),
      detail: "Les webhooks LIVE doivent etre explicitement certifies.",
    },
    {
      key: "connect",
      ok: envTrue(env.KLYX_LIVE_CONNECT_READY),
      detail: "Stripe Connect LIVE doit etre explicitement certifie.",
    },
    {
      key: "critical_alerts",
      ok: envTrue(env.KLYX_LIVE_CRITICAL_ALERTS_READY),
      detail: "Les alertes critiques doivent etre explicitement certifiees.",
    },
    {
      key: "durable_jobs",
      ok: envTrue(env.KLYX_LIVE_DURABLE_JOBS_READY),
      detail: "Les durable jobs LIVE doivent etre explicitement certifies.",
    },
    {
      key: "ledger",
      ok: envTrue(env.KLYX_LIVE_LEDGER_READY),
      detail: "Le ledger canonique LIVE doit etre explicitement certifie.",
    },
    {
      key: "economic_eligibility",
      ok: envTrue(env.KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED),
      detail:
        "Economic Eligibility doit rester obligatoire avant Settlement.",
    },
    {
      key: "reconciliation",
      ok: envTrue(env.KLYX_LIVE_RECONCILIATION_READY),
      detail: "La reconciliation LIVE doit etre explicitement certifiee.",
    },
    {
      key: "settlement_control",
      ok: envTrue(env.KLYX_SETTLEMENT_CONTROL_LIVE_READY),
      detail:
        "Le moteur Platform-Held LIVE doit etre explicitement certifie.",
    },
  ];

  return {
    mode,
    armed,
    certifiedSha: certifiedSha || null,
    deployedSha: deployedSha || null,
    checks,
    ready: checks.every((check) => check.ok),
  };
}

export function assertLiveFinancialStaticGate(
  env: LiveFinancialEnvironment = runtimeEnvironment()
): LiveFinancialStaticGateReport {
  const report = inspectLiveFinancialStaticGate(env);

  if (report.mode !== "live") {
    throw new Error(KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY);
  }

  if (!report.armed) {
    throw new Error(KLYX_LIVE_FINANCIAL_NOT_ARMED);
  }

  const shaCheck = report.checks.find((check) => check.key === "sha_equality");
  if (!shaCheck?.ok) {
    throw new Error(KLYX_LIVE_FINANCIAL_SHA_MISMATCH);
  }

  if (!report.ready) {
    throw new Error(KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY);
  }

  return report;
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
