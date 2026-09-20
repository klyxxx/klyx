import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxDurableJobStatus =
  | "queued"
  | "leased"
  | "retry_wait"
  | "succeeded"
  | "dead_letter";

export type KlyxDurableJobClaim = {
  id: string;
  opsOperationId: string;
  correlationId: string;
  jobType: string;
  payload: Record<string, unknown>;
  domainType: string | null;
  domainResourceType: string | null;
  domainResourceId: string | null;
  attemptCount: number;
  maxAttempts: number;
  leaseToken: string;
  leaseExpiresAt: string;
};

export type KlyxDurableJobResult = {
  id: string;
  status: KlyxDurableJobStatus;
  attemptCount: number;
  nextAvailableAt?: string | null;
};

type RpcRow = Record<string, unknown>;

function firstRow(data: unknown): RpcRow {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("KLYX_DURABLE_JOB_RPC_EMPTY");
  }

  return row as RpcRow;
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(code);
  }

  return value;
}

function integer(value: unknown, code: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(code);
  }

  return parsed;
}

function status(value: unknown): KlyxDurableJobStatus {
  if (
    value === "queued" ||
    value === "leased" ||
    value === "retry_wait" ||
    value === "succeeded" ||
    value === "dead_letter"
  ) {
    return value;
  }

  throw new Error("KLYX_DURABLE_JOB_STATUS_INVALID");
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export async function enqueueKlyxDurableJob(input: {
  queue: string;
  jobType: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  availableAt?: string;
  maxAttempts?: number;
  baseBackoffSeconds?: number;
  maxBackoffSeconds?: number;
  domainType?: string | null;
  domainResourceType?: string | null;
  domainResourceId?: string | null;
  correlationId?: string | null;
}): Promise<{
  id: string;
  created: boolean;
  status: KlyxDurableJobStatus;
  attemptCount: number;
}> {
  const { data, error } = await supabaseAdmin.rpc("klyx_enqueue_ops_job", {
    p_queue: input.queue,
    p_job_type: input.jobType,
    p_idempotency_key: input.idempotencyKey,
    p_payload: input.payload ?? {},
    p_priority: input.priority ?? 100,
    p_available_at: input.availableAt ?? new Date().toISOString(),
    p_max_attempts: input.maxAttempts ?? 5,
    p_base_backoff_seconds: input.baseBackoffSeconds ?? 30,
    p_max_backoff_seconds: input.maxBackoffSeconds ?? 3600,
    p_domain_type: input.domainType ?? null,
    p_domain_resource_type: input.domainResourceType ?? null,
    p_domain_resource_id: input.domainResourceId ?? null,
    p_correlation_id: input.correlationId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data);

  return {
    id: text(row.job_id, "KLYX_DURABLE_JOB_ID_INVALID"),
    created: row.created === true,
    status: status(row.status),
    attemptCount: integer(
      row.attempt_count,
      "KLYX_DURABLE_JOB_ATTEMPT_INVALID"
    ),
  };
}

export async function claimKlyxDurableJobs(input: {
  queue: string;
  workerId: string;
  limit?: number;
  leaseSeconds?: number;
}): Promise<KlyxDurableJobClaim[]> {
  const { data, error } = await supabaseAdmin.rpc("klyx_claim_ops_jobs", {
    p_queue: input.queue,
    p_worker_id: input.workerId,
    p_limit: input.limit ?? 1,
    p_lease_seconds: input.leaseSeconds ?? 300,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    if (data == null) return [];
    throw new Error("KLYX_DURABLE_JOB_CLAIM_INVALID");
  }

  return data.map((value) => {
    const row = value as RpcRow;
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    return {
      id: text(row.job_id, "KLYX_DURABLE_JOB_ID_INVALID"),
      opsOperationId: text(
        row.ops_operation_id,
        "KLYX_DURABLE_JOB_OPERATION_ID_INVALID"
      ),
      correlationId: text(
        row.correlation_id,
        "KLYX_DURABLE_JOB_CORRELATION_ID_INVALID"
      ),
      jobType: text(row.job_type, "KLYX_DURABLE_JOB_TYPE_INVALID"),
      payload,
      domainType: nullableText(row.domain_type),
      domainResourceType: nullableText(row.domain_resource_type),
      domainResourceId: nullableText(row.domain_resource_id),
      attemptCount: integer(
        row.attempt_count,
        "KLYX_DURABLE_JOB_ATTEMPT_INVALID"
      ),
      maxAttempts: integer(
        row.max_attempts,
        "KLYX_DURABLE_JOB_MAX_ATTEMPTS_INVALID"
      ),
      leaseToken: text(
        row.lease_token,
        "KLYX_DURABLE_JOB_LEASE_TOKEN_INVALID"
      ),
      leaseExpiresAt: text(
        row.lease_expires_at,
        "KLYX_DURABLE_JOB_LEASE_EXPIRY_INVALID"
      ),
    };
  });
}

export async function completeKlyxDurableJob(input: {
  jobId: string;
  workerId: string;
  leaseToken: string;
}): Promise<KlyxDurableJobResult> {
  const { data, error } = await supabaseAdmin.rpc("klyx_complete_ops_job", {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data);

  return {
    id: text(row.job_id, "KLYX_DURABLE_JOB_ID_INVALID"),
    status: status(row.status),
    attemptCount: integer(
      row.attempt_count,
      "KLYX_DURABLE_JOB_ATTEMPT_INVALID"
    ),
  };
}

export async function failKlyxDurableJob(input: {
  jobId: string;
  workerId: string;
  leaseToken: string;
  errorCode: string;
  errorMessage?: string | null;
}): Promise<KlyxDurableJobResult> {
  const { data, error } = await supabaseAdmin.rpc("klyx_fail_ops_job", {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_lease_token: input.leaseToken,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data);

  return {
    id: text(row.job_id, "KLYX_DURABLE_JOB_ID_INVALID"),
    status: status(row.status),
    attemptCount: integer(
      row.attempt_count,
      "KLYX_DURABLE_JOB_ATTEMPT_INVALID"
    ),
    nextAvailableAt: nullableText(row.next_available_at),
  };
}

export async function listKlyxDeadLetterJobs(input?: {
  queue?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    queue: string;
    jobType: string;
    domainType: string | null;
    domainResourceType: string | null;
    domainResourceId: string | null;
    attemptCount: number;
    maxAttempts: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    deadLetteredAt: string;
  }>
> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);

  let query = supabaseAdmin
    .from("ops_jobs")
    .select(
      "id, queue, job_type, domain_type, domain_resource_type, domain_resource_id, attempt_count, max_attempts, last_error_code, last_error_message, dead_lettered_at"
    )
    .eq("status", "dead_letter")
    .order("dead_lettered_at", { ascending: false })
    .limit(limit);

  if (input?.queue?.trim()) {
    query = query.eq("queue", input.queue.trim().toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: text(row.id, "KLYX_DURABLE_JOB_ID_INVALID"),
    queue: text(row.queue, "KLYX_DURABLE_JOB_QUEUE_INVALID"),
    jobType: text(row.job_type, "KLYX_DURABLE_JOB_TYPE_INVALID"),
    domainType: nullableText(row.domain_type),
    domainResourceType: nullableText(row.domain_resource_type),
    domainResourceId: nullableText(row.domain_resource_id),
    attemptCount: integer(
      row.attempt_count,
      "KLYX_DURABLE_JOB_ATTEMPT_INVALID"
    ),
    maxAttempts: integer(
      row.max_attempts,
      "KLYX_DURABLE_JOB_MAX_ATTEMPTS_INVALID"
    ),
    lastErrorCode: nullableText(row.last_error_code),
    lastErrorMessage: nullableText(row.last_error_message),
    deadLetteredAt: text(
      row.dead_lettered_at,
      "KLYX_DURABLE_JOB_DEAD_LETTER_TIME_INVALID"
    ),
  }));
}
