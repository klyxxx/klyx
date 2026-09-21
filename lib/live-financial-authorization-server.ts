import "server-only";

import { getKlyxBuildReleaseSha } from "@/lib/klyx-build-release";
import { getKlyxObservabilityFinancialMonitoringSnapshot } from "@/lib/observability-financial-monitoring-server";
import { getKlyxOpsCapabilityDecision } from "@/lib/ops-control-server";
import { inspectStripeRuntime } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const KLYX_LIVE_FINANCIAL_CONTROL_KEY = "stripe_platform_held";
export const KLYX_LIVE_FINANCIAL_NOT_AUTHORIZED =
  "KLYX_LIVE_FINANCIAL_NOT_AUTHORIZED";

const FINANCIAL_CAPABILITIES = [
  "payments",
  "settlement_release",
  "refunds",
] as const;

const OPERATIONAL_PROOF_MAX_AGE_MS: Record<string, number> = {
  durable_jobs_worker: 10 * 60 * 1000,
  critical_alerting: 10 * 60 * 1000,
  settlement_reconciliation: 15 * 60 * 1000,
};

type AuthorizationRow = {
  control_key: string;
  state: "disarmed" | "armed";
  certified_sha: string | null;
  reason_code: string;
  version: number | string;
  armed_at: string | null;
  disarmed_at: string | null;
  updated_at: string;
};

type OperationalProofRow = {
  proof_key: string;
  observed_at: string;
  source: string;
  details: Record<string, unknown> | null;
};

export type LiveFinancialCheck = {
  key: string;
  label: string;
  ok: boolean;
  severity: "blocking" | "warning";
  detail: string;
};

export type LiveFinancialAuthorizationReport = {
  ready: boolean;
  armed: boolean;
  authorized: boolean;
  buildReleaseSha: string | null;
  certifiedSha: string | null;
  controlVersion: number | null;
  controlState: "missing" | "disarmed" | "armed";
  checks: LiveFinancialCheck[];
  generatedAt: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envTrue(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function validSha(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{40}$/.test(value));
}

async function readAuthorization(): Promise<AuthorizationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("financial_live_authorizations")
    .select(
      "control_key, state, certified_sha, reason_code, version, armed_at, disarmed_at, updated_at"
    )
    .eq("control_key", KLYX_LIVE_FINANCIAL_CONTROL_KEY)
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_LIVE_FINANCIAL_CONTROL_READ_FAILED", {
      cause: error,
    });
  }

  return (data as AuthorizationRow | null) ?? null;
}

async function readOperationalProofs(): Promise<OperationalProofRow[]> {
  const { data, error } = await supabaseAdmin
    .from("financial_live_operational_proofs")
    .select("proof_key, observed_at, source, details");

  if (error) {
    throw new Error("KLYX_LIVE_FINANCIAL_PROOFS_READ_FAILED", {
      cause: error,
    });
  }

  return (data ?? []) as OperationalProofRow[];
}

async function countFinancialDlq(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("ops_durable_job_dlq")
    .select("id, payment_provider, capability")
    .limit(500);

  if (error) {
    throw new Error("KLYX_LIVE_FINANCIAL_DLQ_READ_FAILED", {
      cause: error,
    });
  }

  return (data ?? []).filter((row) => {
    const provider = String(row.payment_provider ?? "").toLowerCase();
    const capability = String(row.capability ?? "").toLowerCase();
    return (
      provider === "stripe" ||
      FINANCIAL_CAPABILITIES.includes(
        capability as (typeof FINANCIAL_CAPABILITIES)[number]
      )
    );
  }).length;
}

async function countUnresolvedFinancialReconciliation(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("financial_reconciliation_current")
    .select("id", { count: "exact", head: true })
    .in("state", ["reconciliation", "human_review"]);

  if (error) {
    throw new Error("KLYX_LIVE_FINANCIAL_RECONCILIATION_READ_FAILED", {
      cause: error,
    });
  }

  return count ?? 0;
}

async function countCanonicalStripeConflicts(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select("account_id", { count: "exact", head: true })
    .eq("identity_state", "conflict");

  if (error) {
    throw new Error("KLYX_LIVE_STRIPE_IDENTITY_AUDIT_FAILED", {
      cause: error,
    });
  }

  return count ?? 0;
}

async function canonicalAuthorityAccessible(): Promise<boolean> {
  const [ledger, eligibility] = await Promise.all([
    supabaseAdmin
      .from("financial_ledger_events")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("economic_settlement_eligibility_decisions")
      .select("id", { count: "exact", head: true }),
  ]);

  if (ledger.error || eligibility.error) {
    return false;
  }

  return true;
}

function proofCheck(
  proofs: OperationalProofRow[],
  key: keyof typeof OPERATIONAL_PROOF_MAX_AGE_MS,
  nowMs: number
): LiveFinancialCheck {
  const proof = proofs.find((row) => row.proof_key === key);
  const observedMs = proof ? Date.parse(proof.observed_at) : Number.NaN;
  const ageMs = Number.isFinite(observedMs) ? Math.max(0, nowMs - observedMs) : Infinity;
  const maxAgeMs = OPERATIONAL_PROOF_MAX_AGE_MS[key];
  const ok = ageMs <= maxAgeMs;

  return {
    key: `proof_${key}`,
    label: key,
    ok,
    severity: "blocking",
    detail: ok
      ? `${proof?.source ?? "unknown"} observed ${Math.round(ageMs / 1000)}s ago`
      : proof
        ? `Operational proof stale: ${Math.round(ageMs / 1000)}s old (max ${Math.round(maxAgeMs / 1000)}s).`
        : "Operational proof missing.",
  };
}

export async function inspectLiveFinancialAuthorization(input?: {
  requireArmed?: boolean;
  candidateCertifiedSha?: string | null;
}): Promise<LiveFinancialAuthorizationReport> {
  const requireArmed = input?.requireArmed ?? true;
  const now = Date.now();
  const checks: LiveFinancialCheck[] = [];
  const buildReleaseSha = getKlyxBuildReleaseSha();

  let stripeReady = false;
  let stripeMode = "invalid";
  try {
    const stripe = inspectStripeRuntime();
    stripeMode = stripe.mode;
    stripeReady = stripe.ready;
  } catch {
    stripeReady = false;
  }

  checks.push(
    {
      key: "stripe_runtime_live",
      label: "Stripe LIVE runtime",
      ok: stripeMode === "live" && stripeReady,
      severity: "blocking",
      detail:
        stripeMode === "live" && stripeReady
          ? "Stripe LIVE configuration and explicit live switch are valid."
          : "Stripe runtime is not fully LIVE-ready.",
    },
    {
      key: "settlement_mode",
      label: "Platform-held settlement",
      ok: env("KLYX_STRIPE_SETTLEMENT_MODE").toLowerCase() === "platform_held",
      severity: "blocking",
      detail: `KLYX_STRIPE_SETTLEMENT_MODE=${env("KLYX_STRIPE_SETTLEMENT_MODE") || "absent"}`,
    },
    {
      key: "settlement_live_capability",
      label: "LIVE settlement capability",
      ok: envTrue("KLYX_SETTLEMENT_CONTROL_LIVE_READY"),
      severity: "blocking",
      detail: envTrue("KLYX_SETTLEMENT_CONTROL_LIVE_READY")
        ? "LIVE settlement code path explicitly enabled."
        : "KLYX_SETTLEMENT_CONTROL_LIVE_READY is not true.",
    },
    {
      key: "build_release_sha",
      label: "Immutable build SHA",
      ok: Boolean(buildReleaseSha),
      severity: "blocking",
      detail: buildReleaseSha ?? "KLYX build is not bound to a valid release SHA.",
    }
  );

  const [
    authorization,
    proofs,
    monitoring,
    dlqCount,
    reconciliationCount,
    identityConflictCount,
    authoritiesAccessible,
    ...opsDecisions
  ] = await Promise.all([
    readAuthorization(),
    readOperationalProofs(),
    getKlyxObservabilityFinancialMonitoringSnapshot(),
    countFinancialDlq(),
    countUnresolvedFinancialReconciliation(),
    countCanonicalStripeConflicts(),
    canonicalAuthorityAccessible(),
    ...FINANCIAL_CAPABILITIES.map((capability) =>
      getKlyxOpsCapabilityDecision({
        capability,
        paymentProvider: "stripe",
      })
    ),
  ]);

  for (let index = 0; index < FINANCIAL_CAPABILITIES.length; index += 1) {
    const capability = FINANCIAL_CAPABILITIES[index];
    const decision = opsDecisions[index];
    checks.push({
      key: `ops_${capability}`,
      label: `Operations ${capability}`,
      ok: decision.allowed,
      severity: "blocking",
      detail: decision.allowed
        ? "No active circuit breaker blocks this capability."
        : `Blocked by control ${decision.blockingControlId ?? "unknown"} (${decision.reasonCode ?? "unknown"}).`,
    });
  }

  checks.push(
    {
      key: "critical_monitoring",
      label: "Critical monitoring",
      ok: monitoring.severityCounts.critical === 0,
      severity: "blocking",
      detail: `${monitoring.severityCounts.critical} critical signal(s).`,
    },
    {
      key: "financial_dlq",
      label: "Financial DLQ",
      ok: dlqCount === 0,
      severity: "blocking",
      detail: `${dlqCount} financial dead-letter job(s).`,
    },
    {
      key: "financial_reconciliation",
      label: "Financial reconciliation",
      ok: reconciliationCount === 0,
      severity: "blocking",
      detail: `${reconciliationCount} unresolved financial reconciliation case(s).`,
    },
    {
      key: "canonical_authorities",
      label: "Canonical ledger + Economic Eligibility",
      ok: authoritiesAccessible,
      severity: "blocking",
      detail: authoritiesAccessible
        ? "Canonical financial ledger and Economic Eligibility authority are accessible."
        : "Canonical ledger or Economic Eligibility authority is unavailable.",
    },
    {
      key: "canonical_stripe_conflicts",
      label: "Canonical Stripe identity conflicts",
      ok: identityConflictCount === 0,
      severity: "warning",
      detail:
        identityConflictCount === 0
          ? "No canonical Stripe identity conflict."
          : `${identityConflictCount} account(s) remain conflict/human-review; those accounts must stay transaction-blocked.`,
    }
  );

  checks.push(
    proofCheck(proofs, "durable_jobs_worker", now),
    proofCheck(proofs, "critical_alerting", now),
    proofCheck(proofs, "settlement_reconciliation", now)
  );

  const controlState = authorization?.state ?? "missing";
  const persistedCertifiedSha =
    authorization?.certified_sha?.toLowerCase() ?? null;
  const candidateCertifiedSha =
    input?.candidateCertifiedSha?.trim().toLowerCase() ?? null;
  const certifiedSha = validSha(candidateCertifiedSha)
    ? candidateCertifiedSha
    : persistedCertifiedSha;
  const armed = controlState === "armed";

  checks.push({
    key: "certified_sha_matches_build",
    label: "Certified SHA == deployed build SHA",
    ok:
      Boolean(buildReleaseSha) &&
      Boolean(certifiedSha) &&
      buildReleaseSha === certifiedSha,
    severity: "blocking",
    detail:
      buildReleaseSha && certifiedSha
        ? `build=${buildReleaseSha} certified=${certifiedSha}`
        : "Build or certified SHA missing.",
  });

  if (requireArmed) {
    checks.push({
      key: "explicit_authorization",
      label: "Explicit financial LIVE authorization",
      ok: armed,
      severity: "blocking",
      detail: armed
        ? `Control armed at version ${Number(authorization?.version ?? 0)}.`
        : "Financial LIVE control is disarmed.",
    });
  }

  const ready = checks
    .filter(
      (check) =>
        check.severity === "blocking" &&
        (requireArmed || check.key !== "explicit_authorization")
    )
    .every((check) => check.ok);

  return {
    ready,
    armed,
    authorized: ready && armed,
    buildReleaseSha,
    certifiedSha,
    controlVersion: authorization ? Number(authorization.version) : null,
    controlState,
    checks,
    generatedAt: new Date(now).toISOString(),
  };
}

export async function assertLiveFinancialMutationAuthorized(input: {
  capability: "payments" | "settlement_release" | "refunds";
  countryCode?: string | null;
  currency?: string | null;
}): Promise<LiveFinancialAuthorizationReport> {
  const report = await inspectLiveFinancialAuthorization({
    requireArmed: true,
  });

  const scopedDecision = await getKlyxOpsCapabilityDecision({
    capability: input.capability,
    paymentProvider: "stripe",
    countryCode: input.countryCode,
    currency: input.currency,
  });

  if (!report.authorized || !scopedDecision.allowed) {
    const failed = report.checks
      .filter((check) => check.severity === "blocking" && !check.ok)
      .map((check) => check.key);

    if (!scopedDecision.allowed) {
      failed.push(`ops_scope_${input.capability}`);
    }

    throw new Error(
      `${KLYX_LIVE_FINANCIAL_NOT_AUTHORIZED}:${failed.join(",") || "unknown"}`
    );
  }

  return report;
}

export async function recordLiveOperationalProof(input: {
  proofKey:
    | "durable_jobs_worker"
    | "critical_alerting"
    | "settlement_reconciliation";
  source: string;
  details?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_record_financial_live_operational_proof",
    {
      p_proof_key: input.proofKey,
      p_source: input.source,
      p_details: input.details ?? {},
    }
  );

  if (error) {
    throw new Error("KLYX_LIVE_FINANCIAL_PROOF_WRITE_FAILED", {
      cause: error,
    });
  }

  if (typeof data !== "string" || !data) {
    throw new Error("KLYX_LIVE_FINANCIAL_PROOF_WRITE_INVALID");
  }

  return data;
}
