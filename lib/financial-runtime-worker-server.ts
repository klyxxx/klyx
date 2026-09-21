import "server-only";

import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  claimKlyxDurableJobs,
  completeKlyxDurableJob,
  enqueueKlyxDurableJob,
  failKlyxDurableJob,
  type ClaimedKlyxDurableJob,
} from "@/lib/durable-jobs-server";
import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { reconcileCentralFinancialTruth } from "@/lib/financial-ledger-reconciliation-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SHA_RE = /^[0-9a-f]{40}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINANCIAL_RECONCILIATION_JOB =
  "financial_reconciliation";
const CRITICAL_ALERT_JOB =
  "critical_alert_delivery";

type SchedulerConfigRow = {
  enabled: boolean;
  token_sha256: string | null;
  alert_email: string | null;
};

type ReconciliationCaseRow = {
  id: string;
  booking_id: string;
  state_changed_at: string;
};

type OpsCriticalSignalRow = {
  signal_key: string;
  signal_type: string;
  source_type: string;
  source_ref: string;
  payment_provider: string | null;
  capability: string | null;
  country_code: string | null;
  currency: string | null;
  occurred_at: string;
};

type FinancialCriticalSignalRow = {
  signal_key: string;
  signal_type: string;
  source_type: string;
  source_ref: string;
  reason_code: string;
  dimension: string;
  booking_id: string | null;
  currency: string | null;
  occurred_at: string;
};

type TickCounters = {
  reconciliationEnqueued: number;
  alertsEnqueued: number;
  claimed: number;
  completed: number;
  failed: number;
  alertDeliveries: number;
  alertDeliveryFailures: number;
};

function deployedSha(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";

  if (!SHA_RE.test(sha)) {
    throw new Error("KLYX_FINANCIAL_WORKER_DEPLOYED_SHA_INVALID");
  }

  return sha;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(first: string, second: string): boolean {
  if (
    !/^[0-9a-f]{64}$/i.test(first) ||
    !/^[0-9a-f]{64}$/i.test(second)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(first, "hex"),
    Buffer.from(second, "hex")
  );
}

async function schedulerConfig(): Promise<SchedulerConfigRow> {
  const { data, error } = await supabaseAdmin
    .from("ops_financial_runtime_scheduler")
    .select("enabled, token_sha256, alert_email")
    .eq("scheduler_key", "financial_runtime_tick")
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_FINANCIAL_WORKER_CONFIG_READ_FAILED", {
      cause: error,
    });
  }

  if (!data) {
    throw new Error("KLYX_FINANCIAL_WORKER_CONFIG_MISSING");
  }

  return data as SchedulerConfigRow;
}

export async function authorizeFinancialRuntimeTick(
  bearerToken: string
): Promise<void> {
  const token = bearerToken.trim();

  if (!token || token.length < 32) {
    throw new Error("KLYX_FINANCIAL_WORKER_AUTH_INVALID");
  }

  const config = await schedulerConfig();

  if (!config.enabled) {
    throw new Error("KLYX_FINANCIAL_WORKER_DISABLED");
  }

  const expectedHash = config.token_sha256?.trim().toLowerCase() ?? "";
  const actualHash = sha256(token);

  if (!safeEqualHex(expectedHash, actualHash)) {
    throw new Error("KLYX_FINANCIAL_WORKER_AUTH_INVALID");
  }
}

async function recordRuntimeHeartbeat(input: {
  component: "financial_durable_worker" | "critical_alert_delivery";
  status: "healthy" | "degraded" | "stopped";
  sourceSha: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_record_ops_runtime_heartbeat",
    {
      p_component: input.component,
      p_status: input.status,
      p_source_sha: input.sourceSha,
      p_details: input.details,
    }
  );

  if (error || data !== true) {
    throw new Error("KLYX_FINANCIAL_WORKER_HEARTBEAT_WRITE_FAILED", {
      cause: error ?? undefined,
    });
  }
}

async function enqueueFinancialReconciliationJobs(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("financial_reconciliation_current")
    .select("id, booking_id, state_changed_at")
    .eq("state", "reconciliation")
    .order("state_changed_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(
      "KLYX_FINANCIAL_WORKER_RECONCILIATION_SCAN_FAILED",
      { cause: error }
    );
  }

  const cases = (data ?? []) as ReconciliationCaseRow[];
  const seenBookings = new Set<string>();
  let enqueued = 0;

  for (const row of cases) {
    if (
      !UUID_RE.test(row.id) ||
      !UUID_RE.test(row.booking_id) ||
      seenBookings.has(row.booking_id)
    ) {
      continue;
    }

    seenBookings.add(row.booking_id);

    const result = await enqueueKlyxDurableJob({
      jobType: FINANCIAL_RECONCILIATION_JOB,
      idempotencyKey:
        `financial-reconciliation:${row.id}:${row.state_changed_at}`,
      payload: {
        bookingId: row.booking_id,
        reconciliationCaseId: row.id,
      },
      domainType: "finance",
      domainResourceType: "booking",
      domainResourceId: row.booking_id,
      failureDomainType: "booking",
      failureDomainKey: row.booking_id,
      paymentProvider: "stripe",
      capability: "reconciliation",
      priority: 20,
      maxAttempts: 5,
      backoffBaseSeconds: 60,
      backoffMaxSeconds: 900,
    });

    if (result.created) {
      enqueued += 1;
    }
  }

  return enqueued;
}

function criticalAlertPayload(input: {
  signalKey: string;
  signalType: string;
  sourceType: string;
  reasonCode?: string | null;
  dimension?: string | null;
  occurredAt: string;
}): {
  deduplicationKey: string;
  signalType: string;
  sourceType: string;
  reasonCode: string | null;
  dimension: string | null;
  occurredAt: string;
} {
  const fingerprint = sha256(
    [
      input.signalKey,
      input.signalType,
      input.sourceType,
      input.reasonCode ?? "",
      input.dimension ?? "",
      input.occurredAt,
    ].join("|")
  );

  return {
    deduplicationKey: `klyx-critical-alert:${fingerprint}`,
    signalType: input.signalType.slice(0, 120),
    sourceType: input.sourceType.slice(0, 120),
    reasonCode: input.reasonCode?.slice(0, 160) ?? null,
    dimension: input.dimension?.slice(0, 120) ?? null,
    occurredAt: input.occurredAt,
  };
}

async function enqueueCriticalAlertJobs(): Promise<number> {
  const [opsResult, financialResult] = await Promise.all([
    supabaseAdmin
      .from("ops_observability_signals_current")
      .select(
        "signal_key, signal_type, source_type, source_ref, payment_provider, capability, country_code, currency, occurred_at"
      )
      .eq("severity", "critical")
      .order("occurred_at", { ascending: true })
      .limit(100),
    supabaseAdmin
      .from("financial_monitoring_signals_current")
      .select(
        "signal_key, signal_type, source_type, source_ref, reason_code, dimension, booking_id, currency, occurred_at"
      )
      .eq("severity", "critical")
      .order("occurred_at", { ascending: true })
      .limit(100),
  ]);

  if (opsResult.error) {
    throw new Error("KLYX_FINANCIAL_WORKER_OPS_SIGNAL_SCAN_FAILED", {
      cause: opsResult.error,
    });
  }

  if (financialResult.error) {
    throw new Error(
      "KLYX_FINANCIAL_WORKER_FINANCIAL_SIGNAL_SCAN_FAILED",
      { cause: financialResult.error }
    );
  }

  let enqueued = 0;

  for (const signal of (opsResult.data ?? []) as OpsCriticalSignalRow[]) {
    const payload = criticalAlertPayload({
      signalKey: signal.signal_key,
      signalType: signal.signal_type,
      sourceType: signal.source_type,
      occurredAt: signal.occurred_at,
    });

    const result = await enqueueKlyxDurableJob({
      jobType: CRITICAL_ALERT_JOB,
      idempotencyKey: payload.deduplicationKey,
      payload,
      domainType: "operations",
      domainResourceType: signal.source_type,
      domainResourceId: sha256(signal.source_ref),
      failureDomainType: "global",
      failureDomainKey: "critical-alerts",
      countryCode: signal.country_code,
      currency: signal.currency,
      paymentProvider: signal.payment_provider,
      capability: signal.capability ?? "alerts",
      dependency: "resend",
      priority: 5,
      maxAttempts: 8,
      backoffBaseSeconds: 60,
      backoffMaxSeconds: 3600,
    });

    if (result.created) {
      enqueued += 1;
    }
  }

  for (const signal of (financialResult.data ??
    []) as FinancialCriticalSignalRow[]) {
    const payload = criticalAlertPayload({
      signalKey: signal.signal_key,
      signalType: signal.signal_type,
      sourceType: signal.source_type,
      reasonCode: signal.reason_code,
      dimension: signal.dimension,
      occurredAt: signal.occurred_at,
    });

    const result = await enqueueKlyxDurableJob({
      jobType: CRITICAL_ALERT_JOB,
      idempotencyKey: payload.deduplicationKey,
      payload,
      domainType: "finance",
      domainResourceType: signal.source_type,
      domainResourceId: signal.booking_id ?? sha256(signal.source_ref),
      failureDomainType: signal.booking_id ? "booking" : "global",
      failureDomainKey: signal.booking_id ?? "critical-finance",
      currency: signal.currency,
      paymentProvider: "stripe",
      capability: "alerts",
      dependency: "resend",
      priority: 1,
      maxAttempts: 8,
      backoffBaseSeconds: 60,
      backoffMaxSeconds: 3600,
    });

    if (result.created) {
      enqueued += 1;
    }
  }

  return enqueued;
}

function payloadText(
  payload: Record<string, unknown>,
  key: string
): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

async function emailAlreadySent(
  deduplicationKey: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("transactional_email_deliveries")
    .select("status")
    .eq("deduplication_key", deduplicationKey)
    .maybeSingle();

  if (error) {
    throw new Error("KLYX_FINANCIAL_WORKER_ALERT_REGISTRY_READ_FAILED", {
      cause: error,
    });
  }

  return data?.status === "sent";
}

async function processCriticalAlertJob(
  job: ClaimedKlyxDurableJob,
  alertEmail: string
): Promise<void> {
  const deduplicationKey = payloadText(
    job.payload,
    "deduplicationKey"
  );
  const signalType = payloadText(job.payload, "signalType");
  const sourceType = payloadText(job.payload, "sourceType");
  const reasonCode = payloadText(job.payload, "reasonCode");
  const dimension = payloadText(job.payload, "dimension");
  const occurredAt = payloadText(job.payload, "occurredAt");

  if (
    !deduplicationKey ||
    !signalType ||
    !sourceType ||
    !occurredAt ||
    !alertEmail
  ) {
    throw new Error("KLYX_FINANCIAL_WORKER_ALERT_PAYLOAD_INVALID");
  }

  const subject = `[KLYX CRITICAL] ${signalType}`;
  const text = [
    "Une alerte critique KLYX est ouverte.",
    "",
    `Type: ${signalType}`,
    `Source: ${sourceType}`,
    ...(dimension ? [`Dimension: ${dimension}`] : []),
    ...(reasonCode ? [`Reason: ${reasonCode}`] : []),
    `Occurred at: ${occurredAt}`,
    "",
    "Ouvrir Founder Operations pour le détail et la résolution.",
    "Aucune donnée utilisateur ni identifiant financier n'est inclus dans cet email.",
  ].join("\n");

  const result = await sendKlyxDeduplicatedEmail({
    deduplicationKey,
    templateKey: "critical_operational_alert",
    to: alertEmail,
    subject,
    text,
  });

  if (result.ok && result.status === "sent") {
    return;
  }

  if (
    result.status === "skipped" &&
    (await emailAlreadySent(deduplicationKey))
  ) {
    return;
  }

  throw new Error("KLYX_FINANCIAL_WORKER_ALERT_DELIVERY_FAILED");
}

async function processReconciliationJob(
  job: ClaimedKlyxDurableJob
): Promise<string> {
  const bookingId = payloadText(job.payload, "bookingId");

  if (!UUID_RE.test(bookingId)) {
    throw new Error(
      "KLYX_FINANCIAL_WORKER_RECONCILIATION_PAYLOAD_INVALID"
    );
  }

  const result = await reconcileCentralFinancialTruth({ bookingId });

  if (result.status === "reconciliation") {
    throw new Error(
      "KLYX_FINANCIAL_WORKER_RECONCILIATION_STILL_OPEN"
    );
  }

  return `financial-reconciliation:${result.status}`;
}

async function processClaimedJob(input: {
  job: ClaimedKlyxDurableJob;
  workerId: string;
  alertEmail: string;
}): Promise<{
  completed: boolean;
  alertDelivered: boolean;
  alertFailed: boolean;
}> {
  const { job, workerId, alertEmail } = input;

  try {
    let resultRef = `job:${job.jobType}:completed`;
    let alertDelivered = false;

    if (job.jobType === FINANCIAL_RECONCILIATION_JOB) {
      resultRef = await processReconciliationJob(job);
    } else if (job.jobType === CRITICAL_ALERT_JOB) {
      await processCriticalAlertJob(job, alertEmail);
      alertDelivered = true;
      resultRef = "critical-alert:delivered";
    } else {
      throw new Error("KLYX_FINANCIAL_WORKER_JOB_TYPE_UNSUPPORTED");
    }

    await completeKlyxDurableJob({
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      workerId,
      resultRef,
    });

    return {
      completed: true,
      alertDelivered,
      alertFailed: false,
    };
  } catch (error) {
    const code =
      error instanceof Error && error.message
        ? error.message.slice(0, 120).toUpperCase()
        : "KLYX_FINANCIAL_WORKER_JOB_FAILED";

    const permanent =
      code.includes("PAYLOAD_INVALID") ||
      code.includes("JOB_TYPE_UNSUPPORTED");

    await failKlyxDurableJob({
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      workerId,
      errorCode: code,
      retryable: !permanent,
    });

    return {
      completed: false,
      alertDelivered: false,
      alertFailed: job.jobType === CRITICAL_ALERT_JOB,
    };
  }
}

export async function runFinancialRuntimeTick(): Promise<{
  sourceSha: string;
  counters: TickCounters;
}> {
  const sourceSha = deployedSha();
  const config = await schedulerConfig();
  const alertEmail = config.alert_email?.trim() ?? "";

  const counters: TickCounters = {
    reconciliationEnqueued: 0,
    alertsEnqueued: 0,
    claimed: 0,
    completed: 0,
    failed: 0,
    alertDeliveries: 0,
    alertDeliveryFailures: 0,
  };

  counters.reconciliationEnqueued =
    await enqueueFinancialReconciliationJobs();
  counters.alertsEnqueued = await enqueueCriticalAlertJobs();

  const workerId =
    `financial-worker:${sourceSha}:${randomUUID()}`;
  const jobs = await claimKlyxDurableJobs({
    workerId,
    jobTypes: [
      FINANCIAL_RECONCILIATION_JOB,
      CRITICAL_ALERT_JOB,
    ],
    limit: 20,
    leaseSeconds: 240,
  });

  counters.claimed = jobs.length;

  for (const job of jobs) {
    const result = await processClaimedJob({
      job,
      workerId,
      alertEmail,
    });

    if (result.completed) {
      counters.completed += 1;
    } else {
      counters.failed += 1;
    }

    if (result.alertDelivered) {
      counters.alertDeliveries += 1;
    }

    if (result.alertFailed) {
      counters.alertDeliveryFailures += 1;
    }
  }

  await recordRuntimeHeartbeat({
    component: "financial_durable_worker",
    status: "healthy",
    sourceSha,
    details: {
      claimed: counters.claimed,
      completed: counters.completed,
      failed: counters.failed,
      reconciliationEnqueued:
        counters.reconciliationEnqueued,
      alertsEnqueued: counters.alertsEnqueued,
    },
  });

  const alertConfigured =
    Boolean(alertEmail) &&
    Boolean(process.env.RESEND_API_KEY?.trim());
  const alertStatus =
    alertConfigured && counters.alertDeliveryFailures === 0
      ? "healthy"
      : "degraded";

  await recordRuntimeHeartbeat({
    component: "critical_alert_delivery",
    status: alertStatus,
    sourceSha,
    details: {
      configured: alertConfigured,
      delivered: counters.alertDeliveries,
      failures: counters.alertDeliveryFailures,
      queued: counters.alertsEnqueued,
    },
  });

  return {
    sourceSha,
    counters,
  };
}
