import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxDurableJobScope = {
  accountId?: string | null;
  domainType?: string | null;
  domainResourceType?: string | null;
  domainResourceId?: string | null;
  failureDomainType?: string | null;
  failureDomainKey?: string | null;
  marketId?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  paymentProvider?: string | null;
  capability?: string | null;
  dependency?: string | null;
};

export type EnqueueKlyxDurableJobInput = KlyxDurableJobScope & {
  jobType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  availableAt?: string | null;
  maxAttempts?: number;
  backoffBaseSeconds?: number;
  backoffMaxSeconds?: number;
};

export type EnqueueKlyxDurableJobResult = {
  jobId: string;
  status: string;
  created: boolean;
  operationId: string;
  correlationId: string;
};

export type ClaimedKlyxDurableJob = {
  jobId: string;
  jobType: string;
  payload: Record<string, unknown>;
  attemptNo: number;
  maxAttempts: number;
  leaseToken: string;
  leaseExpiresAt: string;
  operationId: string;
  correlationId: string;
};

export type KlyxDurableJobTransitionResult = {
  status: string;
  attemptCount: number;
  nextAvailableAt?: string | null;
};

type EnqueueRow = {
  job_id: string;
  job_status: string;
  created: boolean;
  operation_id: string;
  correlation_id: string;
};

type ClaimRow = {
  job_id: string;
  job_type: string;
  payload: Record<string, unknown> | null;
  attempt_no: number | string;
  max_attempts: number | string;
  lease_token: string;
  lease_expires_at: string;
  operation_id: string;
  correlation_id: string;
};

type TransitionRow = {
  job_status: string;
  attempt_count: number | string;
  next_available_at?: string | null;
};

function firstRow<T>(data: unknown): T {
  const row = (Array.isArray(data) ? data[0] : data) as T | null | undefined;

  if (!row) {
    throw new Error("KLYX_DURABLE_JOB_RPC_EMPTY_RESULT");
  }

  return row;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeScope(scope: KlyxDurableJobScope) {
  return {
    p_account_id: optionalText(scope.accountId),
    p_domain_type: optionalText(scope.domainType),
    p_domain_resource_type: optionalText(scope.domainResourceType),
    p_domain_resource_id: optionalText(scope.domainResourceId),
    p_failure_domain_type:
      optionalText(scope.failureDomainType)?.toLowerCase() ?? "global",
    p_failure_domain_key: optionalText(scope.failureDomainKey) ?? "global",
    p_market_id: optionalText(scope.marketId),
    p_region_id: optionalText(scope.regionId),
    p_country_code: optionalText(scope.countryCode)?.toUpperCase() ?? null,
    p_currency: optionalText(scope.currency)?.toUpperCase() ?? null,
    p_payment_provider:
      optionalText(scope.paymentProvider)?.toLowerCase() ?? null,
    p_capability: optionalText(scope.capability)?.toLowerCase() ?? null,
    p_dependency: optionalText(scope.dependency)?.toLowerCase() ?? null,
  };
}

export async function enqueueKlyxDurableJob(
  input: EnqueueKlyxDurableJobInput
): Promise<EnqueueKlyxDurableJobResult> {
  const jobType = input.jobType.trim().toLowerCase();
  const idempotencyKey = input.idempotencyKey.trim();

  if (!jobType) {
    throw new Error("KLYX_DURABLE_JOB_TYPE_REQUIRED");
  }

  if (!idempotencyKey) {
    throw new Error("KLYX_DURABLE_JOB_IDEMPOTENCY_KEY_REQUIRED");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_enqueue_durable_job",
    {
      p_job_type: jobType,
      p_idempotency_key: idempotencyKey,
      p_payload: input.payload ?? {},
      ...normalizeScope(input),
      p_priority: input.priority ?? 100,
      p_available_at: optionalText(input.availableAt) ?? new Date().toISOString(),
      p_max_attempts: input.maxAttempts ?? 5,
      p_backoff_base_seconds: input.backoffBaseSeconds ?? 30,
      p_backoff_max_seconds: input.backoffMaxSeconds ?? 3600,
    }
  );

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_ENQUEUE_FAILED", { cause: error });
  }

  const row = firstRow<EnqueueRow>(data);

  if (
    !row.job_id ||
    !row.job_status ||
    typeof row.created !== "boolean" ||
    !row.operation_id ||
    !row.correlation_id
  ) {
    throw new Error("KLYX_DURABLE_JOB_ENQUEUE_INVALID_RESULT");
  }

  return {
    jobId: row.job_id,
    status: row.job_status,
    created: row.created,
    operationId: row.operation_id,
    correlationId: row.correlation_id,
  };
}

export async function claimKlyxDurableJobs(input: {
  workerId: string;
  jobTypes?: string[] | null;
  limit?: number;
  leaseSeconds?: number;
}): Promise<ClaimedKlyxDurableJob[]> {
  const workerId = input.workerId.trim();

  if (!workerId) {
    throw new Error("KLYX_DURABLE_JOB_WORKER_ID_REQUIRED");
  }

  const jobTypes =
    input.jobTypes
      ?.map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? null;

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_claim_durable_jobs",
    {
      p_worker_id: workerId,
      p_job_types: jobTypes,
      p_limit: input.limit ?? 1,
      p_lease_seconds: input.leaseSeconds ?? 60,
    }
  );

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_CLAIM_FAILED", { cause: error });
  }

  if (!Array.isArray(data)) {
    throw new Error("KLYX_DURABLE_JOB_CLAIM_INVALID_RESULT");
  }

  return (data as ClaimRow[]).map((row) => {
    const attemptNo = Number(row.attempt_no);
    const maxAttempts = Number(row.max_attempts);

    if (
      !row.job_id ||
      !row.job_type ||
      !row.lease_token ||
      !row.lease_expires_at ||
      !row.operation_id ||
      !row.correlation_id ||
      !Number.isSafeInteger(attemptNo) ||
      !Number.isSafeInteger(maxAttempts)
    ) {
      throw new Error("KLYX_DURABLE_JOB_CLAIM_INVALID_RESULT");
    }

    return {
      jobId: row.job_id,
      jobType: row.job_type,
      payload: row.payload ?? {},
      attemptNo,
      maxAttempts,
      leaseToken: row.lease_token,
      leaseExpiresAt: row.lease_expires_at,
      operationId: row.operation_id,
      correlationId: row.correlation_id,
    };
  });
}

export async function extendKlyxDurableJobLease(input: {
  jobId: string;
  leaseToken: string;
  workerId: string;
  leaseSeconds?: number;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_extend_durable_job_lease",
    {
      p_job_id: input.jobId,
      p_lease_token: input.leaseToken,
      p_worker_id: input.workerId.trim(),
      p_lease_seconds: input.leaseSeconds ?? 60,
    }
  );

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_LEASE_EXTEND_FAILED", {
      cause: error,
    });
  }

  const expiresAt =
    typeof data === "string"
      ? data
      : Array.isArray(data) && typeof data[0] === "string"
        ? data[0]
        : null;

  if (!expiresAt) {
    throw new Error("KLYX_DURABLE_JOB_LEASE_EXTEND_INVALID_RESULT");
  }

  return expiresAt;
}

export async function completeKlyxDurableJob(input: {
  jobId: string;
  leaseToken: string;
  workerId: string;
  resultRef?: string | null;
}): Promise<KlyxDurableJobTransitionResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_complete_durable_job",
    {
      p_job_id: input.jobId,
      p_lease_token: input.leaseToken,
      p_worker_id: input.workerId.trim(),
      p_result_ref: optionalText(input.resultRef),
    }
  );

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_COMPLETE_FAILED", { cause: error });
  }

  const row = firstRow<TransitionRow>(data);
  const attemptCount = Number(row.attempt_count);

  if (!row.job_status || !Number.isSafeInteger(attemptCount)) {
    throw new Error("KLYX_DURABLE_JOB_COMPLETE_INVALID_RESULT");
  }

  return {
    status: row.job_status,
    attemptCount,
  };
}

export async function failKlyxDurableJob(input: {
  jobId: string;
  leaseToken: string;
  workerId: string;
  errorCode: string;
  retryable?: boolean;
}): Promise<KlyxDurableJobTransitionResult> {
  const errorCode = input.errorCode.trim().toUpperCase();

  if (!errorCode) {
    throw new Error("KLYX_DURABLE_JOB_ERROR_CODE_REQUIRED");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_fail_durable_job",
    {
      p_job_id: input.jobId,
      p_lease_token: input.leaseToken,
      p_worker_id: input.workerId.trim(),
      p_error_code: errorCode,
      p_retryable: input.retryable ?? true,
    }
  );

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_FAIL_FAILED", { cause: error });
  }

  const row = firstRow<TransitionRow>(data);
  const attemptCount = Number(row.attempt_count);

  if (!row.job_status || !Number.isSafeInteger(attemptCount)) {
    throw new Error("KLYX_DURABLE_JOB_FAIL_INVALID_RESULT");
  }

  return {
    status: row.job_status,
    attemptCount,
    nextAvailableAt: row.next_available_at ?? null,
  };
}

export async function listKlyxDeadLetterJobs(limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("KLYX_DURABLE_JOB_DLQ_LIMIT_INVALID");
  }

  const { data, error } = await supabaseAdmin
    .from("ops_durable_job_dlq")
    .select(
      "id, operation_id, correlation_id, account_id, domain_type, domain_resource_type, domain_resource_id, failure_domain_type, failure_domain_key, market_id, region_id, country_code, currency, payment_provider, capability, dependency, job_type, idempotency_key, priority, attempt_count, max_attempts, last_error_code, result_ref, dead_lettered_at, created_at, updated_at"
    )
    .order("dead_lettered_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("KLYX_DURABLE_JOB_DLQ_READ_FAILED", { cause: error });
  }

  return data ?? [];
}
