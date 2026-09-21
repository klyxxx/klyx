import "server-only";

import { getKlyxObservabilityFinancialMonitoringSnapshot } from "@/lib/observability-financial-monitoring-server";
import { requireKlyxOpsCapabilityAvailable } from "@/lib/ops-control-server";
import {
  assertStripeObservationRuntimeConfigured,
  assertStripeRuntimeConfiguredForDiagnostics,
  assertStripeRuntimeReady,
} from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/;
const LIVE_HEARTBEAT_MAX_AGE_MS = 15 * 60 * 1000;

export type KlyxFinancialCapability =
  | "payments"
  | "settlement_release"
  | "refunds";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envTrue(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function exactSha(name: string): string {
  const value = env(name).toLowerCase();
  if (!SHA_RE.test(value)) {
    throw new Error(`KLYX_FINANCIAL_RUNTIME_${name}_INVALID`);
  }
  return value;
}

async function requireOpsCapability(
  capability: KlyxFinancialCapability
): Promise<void> {
  await requireKlyxOpsCapabilityAvailable({
    capability,
    paymentProvider: "stripe",
  });
}

function requireExactLiveShaBoundary(): {
  deployedSha: string;
  drCertifiedSha: string;
} {
  const deployedSha = exactSha("VERCEL_GIT_COMMIT_SHA");
  const drCertifiedSha = exactSha("KLYX_DR_CERTIFIED_SHA");

  if (deployedSha !== drCertifiedSha) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_DR_SHA_MISMATCH");
  }

  return { deployedSha, drCertifiedSha };
}

async function requireLiveRuntimeHeartbeats(
  deployedSha: string
): Promise<void> {
  const threshold = new Date(
    Date.now() - LIVE_HEARTBEAT_MAX_AGE_MS
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("ops_runtime_heartbeats")
    .select("component, status, source_sha, last_seen_at")
    .in("component", [
      "financial_durable_worker",
      "critical_alert_delivery",
    ]);

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_HEARTBEAT_READ_FAILED", {
      cause: error,
    });
  }

  const rows = (data ?? []) as Array<{
    component: string;
    status: string;
    source_sha: string;
    last_seen_at: string;
  }>;

  for (const component of [
    "financial_durable_worker",
    "critical_alert_delivery",
  ] as const) {
    const row = rows.find((candidate) => candidate.component === component);

    if (
      !row ||
      row.status !== "healthy" ||
      row.source_sha?.trim().toLowerCase() !== deployedSha ||
      !row.last_seen_at ||
      row.last_seen_at < threshold
    ) {
      throw new Error(
        `KLYX_FINANCIAL_RUNTIME_${component.toUpperCase()}_NOT_READY`
      );
    }
  }
}

async function requireCanonicalLedgerHealthy(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("financial_ledger_current")
    .select("booking_id", { count: "exact", head: true });

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_LEDGER_UNAVAILABLE", {
      cause: error,
    });
  }
}

async function requireNoOpenFinancialReconciliation(): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("financial_reconciliation_current")
    .select("id", { count: "exact", head: true })
    .in("state", ["reconciliation", "human_review"]);

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_UNAVAILABLE", {
      cause: error,
    });
  }

  if ((count ?? 0) > 0) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_OPEN");
  }
}

async function requireFinancialDlqEmpty(): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("ops_durable_job_dlq")
    .select("id", { count: "exact", head: true })
    .or(
      "payment_provider.eq.stripe,capability.in.(payments,settlement,settlement_release,refunds,payouts)"
    );

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_DLQ_UNAVAILABLE", {
      cause: error,
    });
  }

  if ((count ?? 0) > 0) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_DLQ_NOT_EMPTY");
  }
}

async function requireNoCriticalFinancialSignal(): Promise<void> {
  const monitoring =
    await getKlyxObservabilityFinancialMonitoringSnapshot({
      signalLimit: 250,
    });

  if (monitoring.severityCounts.critical > 0) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CRITICAL_SIGNAL_OPEN");
  }
}

async function requireLiveOperationalReadiness(input: {
  deployedSha: string;
  capability: KlyxFinancialCapability;
}): Promise<void> {
  await requireOpsCapability("payments");

  if (input.capability !== "payments") {
    await requireOpsCapability(input.capability);
  }

  await Promise.all([
    requireLiveRuntimeHeartbeats(input.deployedSha),
    requireCanonicalLedgerHealthy(),
    requireNoOpenFinancialReconciliation(),
    requireFinancialDlqEmpty(),
    requireNoCriticalFinancialSignal(),
  ]);
}

export type KlyxFinancialStripeRuntime = {
  key: string;
  mode:
    | "test"
    | "live_observation"
    | "controlled_live_certification"
    | "certified_live";
  deployedSha: string | null;
};

export function requireKlyxFinancialStripeObservationRuntime(): KlyxFinancialStripeRuntime {
  const key = env("STRIPE_SECRET_KEY");
  const stripeMode = env("KLYX_STRIPE_MODE").toLowerCase();

  if (key.startsWith("sk_test_")) {
    if (stripeMode !== "test") {
      throw new Error("KLYX_FINANCIAL_RUNTIME_TEST_MODE_MISMATCH");
    }

    assertStripeObservationRuntimeConfigured();

    return {
      key,
      mode: "test",
      deployedSha: null,
    };
  }

  if (!key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_STRIPE_KEY_INVALID");
  }

  if (stripeMode !== "live") {
    throw new Error("KLYX_FINANCIAL_RUNTIME_LIVE_MODE_MISMATCH");
  }

  // Observation/reconciliation must survive kill-switches, canary shutdown and
  // later deployments. Signed Stripe truth for already-created objects must
  // always remain ingestible. This path performs no new Stripe money movement.
  assertStripeObservationRuntimeConfigured();

  const deployedSha = env("VERCEL_GIT_COMMIT_SHA").toLowerCase();

  return {
    key,
    mode: "live_observation",
    deployedSha: SHA_RE.test(deployedSha) ? deployedSha : null,
  };
}

export async function requireKlyxFinancialStripeRuntime(input: {
  clientProfileId: string;
  capability?: KlyxFinancialCapability;
}): Promise<KlyxFinancialStripeRuntime> {
  const key = env("STRIPE_SECRET_KEY");
  const stripeMode = env("KLYX_STRIPE_MODE").toLowerCase();
  const capability = input.capability ?? "payments";

  if (!UUID_RE.test(input.clientProfileId)) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CLIENT_PROFILE_INVALID");
  }

  if (key.startsWith("sk_test_")) {
    if (stripeMode !== "test") {
      throw new Error("KLYX_FINANCIAL_RUNTIME_TEST_MODE_MISMATCH");
    }

    assertStripeRuntimeReady();

    return {
      key,
      mode: "test",
      deployedSha: null,
    };
  }

  if (!key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_STRIPE_KEY_INVALID");
  }

  if (stripeMode !== "live") {
    throw new Error("KLYX_FINANCIAL_RUNTIME_LIVE_MODE_MISMATCH");
  }

  assertStripeRuntimeConfiguredForDiagnostics();

  const { deployedSha } = requireExactLiveShaBoundary();

  if (envTrue("KLYX_LIVE_PAYMENTS_ENABLED")) {
    assertStripeRuntimeReady();

    const certifiedSha = exactSha(
      "KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA"
    );

    if (certifiedSha !== deployedSha) {
      throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFIED_SHA_MISMATCH");
    }

    await requireLiveOperationalReadiness({
      deployedSha,
      capability,
    });

    return {
      key,
      mode: "certified_live",
      deployedSha,
    };
  }

  if (!envTrue("KLYX_LIVE_CERTIFICATION_ENABLED")) {
    throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
  }

  const certificationSha = exactSha("KLYX_LIVE_CERTIFICATION_SHA");
  if (certificationSha !== deployedSha) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFICATION_SHA_MISMATCH");
  }

  const certificationProfileId =
    env("KLYX_LIVE_CERTIFICATION_PROFILE_ID").toLowerCase();

  if (
    !UUID_RE.test(certificationProfileId) ||
    certificationProfileId !== input.clientProfileId.toLowerCase()
  ) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CERTIFICATION_PROFILE_BLOCKED");
  }

  await requireLiveOperationalReadiness({
    deployedSha,
    capability,
  });

  return {
    key,
    mode: "controlled_live_certification",
    deployedSha,
  };
}

export async function requireKlyxFinancialStripeRuntimeForBooking(
  bookingId: string,
  options?: { capability?: KlyxFinancialCapability }
): Promise<KlyxFinancialStripeRuntime> {
  if (!UUID_RE.test(bookingId)) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_ID_INVALID");
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("parent_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_OWNER_READ_FAILED", {
      cause: error,
    });
  }

  const clientProfileId =
    typeof data?.parent_id === "string" ? data.parent_id : "";

  if (!clientProfileId) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_BOOKING_OWNER_MISSING");
  }

  return requireKlyxFinancialStripeRuntime({
    clientProfileId,
    capability: options?.capability,
  });
}
