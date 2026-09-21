import "server-only";

import {
  claimKlyxDurableJobs,
  completeKlyxDurableJob,
  enqueueKlyxDurableJob,
  failKlyxDurableJob,
} from "@/lib/durable-jobs-server";
import { reconcileCentralFinancialTruth } from "@/lib/financial-ledger-reconciliation-server";
import { recordKlyxOpsRuntimeHeartbeat } from "@/lib/ops-runtime-heartbeat-server";

const BOOKING_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const KLYX_FINANCIAL_RECONCILIATION_JOB =
  "financial_reconciliation_booking";

class FinancialWorkerPayloadError extends Error {}

function normalizedErrorCode(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : "KLYX_FINANCIAL_DURABLE_WORKER_UNKNOWN_FAILURE";

  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return normalized || "KLYX_FINANCIAL_DURABLE_WORKER_FAILURE";
}

function bookingIdFromPayload(payload: Record<string, unknown>): string {
  const bookingId =
    typeof payload.bookingId === "string" ? payload.bookingId.trim() : "";

  if (!BOOKING_UUID_RE.test(bookingId)) {
    throw new FinancialWorkerPayloadError(
      "KLYX_FINANCIAL_DURABLE_WORKER_BOOKING_ID_INVALID"
    );
  }

  return bookingId;
}

function workerId(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "unknown";

  return `financial-durable-worker:${sha.slice(0, 12)}`;
}

export async function enqueueKlyxFinancialReconciliationJob(input: {
  bookingId: string;
  requestKey: string;
}) {
  const bookingId = input.bookingId.trim();
  const requestKey = input.requestKey.trim();

  if (!BOOKING_UUID_RE.test(bookingId)) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_BOOKING_ID_INVALID");
  }

  if (
    requestKey.length < 3 ||
    requestKey.length > 128 ||
    !/^[A-Za-z0-9:_-]+$/.test(requestKey)
  ) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_REQUEST_KEY_INVALID");
  }

  return enqueueKlyxDurableJob({
    jobType: KLYX_FINANCIAL_RECONCILIATION_JOB,
    idempotencyKey: `financial-reconciliation:${bookingId}:${requestKey}`,
    payload: { bookingId },
    domainType: "finance",
    domainResourceType: "booking",
    domainResourceId: bookingId,
    failureDomainType: "payment_provider",
    failureDomainKey: "stripe",
    paymentProvider: "stripe",
    capability: "reconciliation",
    dependency: "stripe",
    priority: 40,
    maxAttempts: 5,
    backoffBaseSeconds: 30,
    backoffMaxSeconds: 900,
  });
}

export async function runKlyxFinancialDurableWorker(input?: {
  limit?: number;
}) {
  const limit = input?.limit ?? 5;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("KLYX_FINANCIAL_DURABLE_WORKER_LIMIT_INVALID");
  }

  const id = workerId();
  const jobs = await claimKlyxDurableJobs({
    workerId: id,
    jobTypes: [KLYX_FINANCIAL_RECONCILIATION_JOB],
    limit,
    leaseSeconds: 120,
  });

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const bookingId = bookingIdFromPayload(job.payload);

      await reconcileCentralFinancialTruth({ bookingId });

      await completeKlyxDurableJob({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        workerId: id,
        resultRef: `financial-reconciliation:${bookingId}`,
      });

      succeeded += 1;
    } catch (error) {
      await failKlyxDurableJob({
        jobId: job.jobId,
        leaseToken: job.leaseToken,
        workerId: id,
        errorCode: normalizedErrorCode(error),
        retryable: !(error instanceof FinancialWorkerPayloadError),
      });

      failed += 1;
    }
  }

  const status = failed > 0 ? "degraded" : "healthy";

  await recordKlyxOpsRuntimeHeartbeat({
    component: "financial_durable_worker",
    status,
    details: {
      claimed: jobs.length,
      succeeded,
      failed,
      jobType: KLYX_FINANCIAL_RECONCILIATION_JOB,
    },
  });

  return {
    status,
    claimed: jobs.length,
    succeeded,
    failed,
  };
}
