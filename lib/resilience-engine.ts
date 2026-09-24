export type KlyxJsonPrimitive = string | number | boolean | null;
export type KlyxJsonValue =
  | KlyxJsonPrimitive
  | KlyxJsonValue[]
  | { [key: string]: KlyxJsonValue };

export type KlyxResilienceJobStatus =
  | "queued"
  | "running"
  | "retry_wait"
  | "succeeded"
  | "dead_lettered"
  | "human_review";

export type KlyxResilienceRecoveryTrigger =
  | "timeout"
  | "worker_crash"
  | "worker_restart"
  | "webhook_absent"
  | "unknown_external_state"
  | "stale_claim"
  | "concurrent_mutation"
  | "manual_recovery";

export type KlyxResilienceFailureKind =
  | "retryable"
  | "timeout"
  | "unknown_external_state"
  | "poison_job"
  | "permanent";

export type KlyxResilienceReplayMode =
  | "safe_idempotent_replay"
  | "prove_before_replay";

export type KlyxRetryPolicy = {
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
};

export type KlyxResilienceLease = {
  token: string;
  workerId: string;
  expiresAtMs: number;
  generation: number;
};

export type KlyxResilienceAck = {
  kind: "complete" | "fail" | "recovery";
  fingerprint: string;
  atMs: number;
};

export type KlyxResilienceJob = {
  id: string;
  jobType: string;
  idempotencyKey: string;
  requestFingerprint: string;
  payload: KlyxJsonValue;
  status: KlyxResilienceJobStatus;
  priority: number;
  availableAtMs: number;
  attemptCount: number;
  retryPolicy: KlyxRetryPolicy;
  replayMode: KlyxResilienceReplayMode;
  lease: KlyxResilienceLease | null;
  lastErrorCode: string | null;
  resultRef: string | null;
  lastAck: KlyxResilienceAck | null;
  parentJobId: string | null;
  redriveReasonCode: string | null;
  version: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type KlyxResilienceAuditEvent = {
  id: string;
  jobId: string;
  eventType:
    | "job.enqueued"
    | "job.duplicate_enqueue"
    | "job.claimed"
    | "job.lease_extended"
    | "job.retry_scheduled"
    | "job.succeeded"
    | "job.dead_lettered"
    | "job.human_review"
    | "job.recovered"
    | "job.redriven"
    | "event.received"
    | "event.duplicate"
    | "event.conflict";
  reasonCode: string | null;
  previousStatus: KlyxResilienceJobStatus | null;
  newStatus: KlyxResilienceJobStatus | null;
  atMs: number;
  details?: Record<string, KlyxJsonValue>;
};

export type KlyxInboundEvent = {
  source: string;
  eventId: string;
  eventType: string;
  jobId: string;
  occurredAtMs: number;
  receivedAtMs: number;
  payload: KlyxJsonValue;
  fingerprint: string;
};

export type KlyxInboundEventPutResult =
  | { kind: "created"; event: KlyxInboundEvent }
  | { kind: "duplicate"; event: KlyxInboundEvent }
  | {
      kind: "conflict";
      event: KlyxInboundEvent;
      existing: KlyxInboundEvent;
    };

export type KlyxCreateJobInput = {
  jobType: string;
  idempotencyKey: string;
  requestFingerprint: string;
  payload: KlyxJsonValue;
  priority: number;
  availableAtMs: number;
  retryPolicy: KlyxRetryPolicy;
  replayMode: KlyxResilienceReplayMode;
  parentJobId?: string | null;
  redriveReasonCode?: string | null;
};

export type KlyxCreateJobResult =
  | { kind: "created"; job: KlyxResilienceJob }
  | { kind: "existing"; job: KlyxResilienceJob }
  | { kind: "conflict"; job: KlyxResilienceJob };

export type KlyxClaimJobsInput = {
  workerId: string;
  nowMs: number;
  leaseMs: number;
  limit: number;
  jobTypes?: string[] | null;
};

export class KlyxResilienceConcurrentMutationError extends Error {
  constructor(message = "KLYX_RESILIENCE_CONCURRENT_MUTATION") {
    super(message);
    this.name = "KlyxResilienceConcurrentMutationError";
  }
}

export interface KlyxResilienceStore {
  createOrGetJob(input: KlyxCreateJobInput): Promise<KlyxCreateJobResult>;
  getJob(jobId: string): Promise<KlyxResilienceJob | null>;
  saveJob(
    job: KlyxResilienceJob,
    expectedVersion: number
  ): Promise<KlyxResilienceJob>;
  claimDueJobs(input: KlyxClaimJobsInput): Promise<KlyxResilienceJob[]>;
  listJobs(statuses?: KlyxResilienceJobStatus[]): Promise<KlyxResilienceJob[]>;
  putInboundEvent(event: KlyxInboundEvent): Promise<KlyxInboundEventPutResult>;
  appendAudit(
    event: Omit<KlyxResilienceAuditEvent, "id">
  ): Promise<KlyxResilienceAuditEvent>;
  listAudit(jobId?: string): Promise<KlyxResilienceAuditEvent[]>;
}

export interface KlyxResilienceClock {
  nowMs(): number;
}

export type KlyxExecutionContext = {
  job: KlyxResilienceJob;
  signal: AbortSignal;
};

export type KlyxExecutionResult =
  | { kind: "success"; resultRef?: string | null }
  | { kind: "retryable_failure"; errorCode: string }
  | { kind: "unknown_external_state"; errorCode: string }
  | { kind: "poison_job"; errorCode: string }
  | { kind: "permanent_failure"; errorCode: string };

export type KlyxRecoveryContext = {
  job: KlyxResilienceJob;
  trigger: KlyxResilienceRecoveryTrigger;
  reasonCode: string;
};

export type KlyxRecoveryDecision =
  | { kind: "proved_succeeded"; resultRef?: string | null; reasonCode: string }
  | { kind: "proved_not_applied"; reasonCode: string }
  | { kind: "retry"; reasonCode: string }
  | { kind: "unknown"; reasonCode: string }
  | { kind: "human_review"; reasonCode: string };

export type KlyxInboundEventContext = {
  event: KlyxInboundEvent;
  job: KlyxResilienceJob;
};

export type KlyxInboundEventDecision =
  | { kind: "ignore"; reasonCode: string }
  | { kind: "proved_succeeded"; resultRef?: string | null; reasonCode: string }
  | { kind: "retry"; reasonCode: string }
  | { kind: "unknown"; reasonCode: string }
  | { kind: "human_review"; reasonCode: string };

export type KlyxResilienceEngineOptions = {
  store: KlyxResilienceStore;
  clock?: KlyxResilienceClock;
  defaultRetryPolicy?: KlyxRetryPolicy;
  defaultLeaseMs?: number;
  defaultExecutionTimeoutMs?: number;
  executors?: Record<string, (ctx: KlyxExecutionContext) => Promise<KlyxExecutionResult>>;
  recoveryHandlers?: Record<
    string,
    (ctx: KlyxRecoveryContext) => Promise<KlyxRecoveryDecision>
  >;
  inboundEventHandlers?: Record<
    string,
    (ctx: KlyxInboundEventContext) => Promise<KlyxInboundEventDecision>
  >;
};

export type EnqueueKlyxResilienceJobInput = {
  jobType: string;
  idempotencyKey: string;
  payload?: KlyxJsonValue;
  priority?: number;
  availableAtMs?: number;
  retryPolicy?: Partial<KlyxRetryPolicy>;
  replayMode?: KlyxResilienceReplayMode;
};

export type KlyxEnqueueResult = {
  job: KlyxResilienceJob;
  created: boolean;
  duplicate: boolean;
};

export type KlyxExecutionOutcome = {
  job: KlyxResilienceJob;
  outcome:
    | "succeeded"
    | "retry_scheduled"
    | "dead_lettered"
    | "human_review"
    | "replayed";
};

const TERMINAL_STATUSES = new Set<KlyxResilienceJobStatus>([
  "succeeded",
  "dead_lettered",
  "human_review",
]);

const DEFAULT_RETRY_POLICY: KlyxRetryPolicy = {
  maxAttempts: 5,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
};

const systemClock: KlyxResilienceClock = {
  nowMs: () => Date.now(),
};

function requireText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}

function normalizeCode(value: string): string {
  return requireText(value, "KLYX_RESILIENCE_REASON_CODE_REQUIRED")
    .trim()
    .toUpperCase();
}

function positiveInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(code);
  }
  return value;
}

function assertJsonValue(value: unknown, path = "payload"): asserts value is KlyxJsonValue {
  if (value === null) return;
  if (["string", "boolean"].includes(typeof value)) return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`KLYX_RESILIENCE_JSON_NON_FINITE:${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) {
        throw new Error(`KLYX_RESILIENCE_JSON_UNDEFINED:${path}.${key}`);
      }
      assertJsonValue(entry, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`KLYX_RESILIENCE_JSON_INVALID:${path}`);
}

function canonicalize(value: KlyxJsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

export function klyxStableFingerprint(value: KlyxJsonValue): string {
  assertJsonValue(value);
  return canonicalize(value);
}

export function computeKlyxExponentialBackoffMs(
  attemptCount: number,
  policy: KlyxRetryPolicy
): number {
  positiveInteger(attemptCount, "KLYX_RESILIENCE_ATTEMPT_INVALID");
  positiveInteger(policy.maxAttempts, "KLYX_RESILIENCE_MAX_ATTEMPTS_INVALID");
  positiveInteger(policy.backoffBaseMs, "KLYX_RESILIENCE_BACKOFF_BASE_INVALID");
  positiveInteger(policy.backoffMaxMs, "KLYX_RESILIENCE_BACKOFF_MAX_INVALID");

  if (policy.backoffMaxMs < policy.backoffBaseMs) {
    throw new Error("KLYX_RESILIENCE_BACKOFF_RANGE_INVALID");
  }

  const exponent = Math.min(attemptCount - 1, 52);
  const raw = policy.backoffBaseMs * 2 ** exponent;
  return Math.min(policy.backoffMaxMs, Number.isFinite(raw) ? raw : policy.backoffMaxMs);
}

function mergeRetryPolicy(
  base: KlyxRetryPolicy,
  input?: Partial<KlyxRetryPolicy>
): KlyxRetryPolicy {
  const policy: KlyxRetryPolicy = {
    maxAttempts: input?.maxAttempts ?? base.maxAttempts,
    backoffBaseMs: input?.backoffBaseMs ?? base.backoffBaseMs,
    backoffMaxMs: input?.backoffMaxMs ?? base.backoffMaxMs,
  };
  computeKlyxExponentialBackoffMs(1, policy);
  return policy;
}

function makeRequestFingerprint(input: {
  jobType: string;
  payload: KlyxJsonValue;
  priority: number;
  retryPolicy: KlyxRetryPolicy;
  replayMode: KlyxResilienceReplayMode;
}): string {
  return klyxStableFingerprint({
    jobType: input.jobType,
    payload: input.payload,
    priority: input.priority,
    retryPolicy: {
      maxAttempts: input.retryPolicy.maxAttempts,
      backoffBaseMs: input.retryPolicy.backoffBaseMs,
      backoffMaxMs: input.retryPolicy.backoffMaxMs,
    },
    replayMode: input.replayMode,
  });
}

function cloneJob(job: KlyxResilienceJob): KlyxResilienceJob {
  return {
    ...job,
    payload: JSON.parse(JSON.stringify(job.payload)) as KlyxJsonValue,
    retryPolicy: { ...job.retryPolicy },
    lease: job.lease ? { ...job.lease } : null,
    lastAck: job.lastAck ? { ...job.lastAck } : null,
  };
}

export class KlyxResilienceEngine {
  private readonly store: KlyxResilienceStore;
  private readonly clock: KlyxResilienceClock;
  private readonly defaultRetryPolicy: KlyxRetryPolicy;
  private readonly defaultLeaseMs: number;
  private readonly defaultExecutionTimeoutMs: number;
  private readonly executors: Map<
    string,
    (ctx: KlyxExecutionContext) => Promise<KlyxExecutionResult>
  >;
  private readonly recoveryHandlers: Map<
    string,
    (ctx: KlyxRecoveryContext) => Promise<KlyxRecoveryDecision>
  >;
  private readonly inboundEventHandlers: Map<
    string,
    (ctx: KlyxInboundEventContext) => Promise<KlyxInboundEventDecision>
  >;

  constructor(options: KlyxResilienceEngineOptions) {
    this.store = options.store;
    this.clock = options.clock ?? systemClock;
    this.defaultRetryPolicy = mergeRetryPolicy(
      DEFAULT_RETRY_POLICY,
      options.defaultRetryPolicy
    );
    this.defaultLeaseMs = positiveInteger(
      options.defaultLeaseMs ?? 60_000,
      "KLYX_RESILIENCE_LEASE_INVALID"
    );
    this.defaultExecutionTimeoutMs = positiveInteger(
      options.defaultExecutionTimeoutMs ?? 30_000,
      "KLYX_RESILIENCE_TIMEOUT_INVALID"
    );
    this.executors = new Map(
      Object.entries(options.executors ?? {}).map(([key, value]) => [
        key.trim().toLowerCase(),
        value,
      ])
    );
    this.recoveryHandlers = new Map(
      Object.entries(options.recoveryHandlers ?? {}).map(([key, value]) => [
        key.trim().toLowerCase(),
        value,
      ])
    );
    this.inboundEventHandlers = new Map(
      Object.entries(options.inboundEventHandlers ?? {}).map(([key, value]) => [
        key.trim().toLowerCase(),
        value,
      ])
    );
  }

  async enqueue(input: EnqueueKlyxResilienceJobInput): Promise<KlyxEnqueueResult> {
    const jobType = requireText(
      input.jobType,
      "KLYX_RESILIENCE_JOB_TYPE_REQUIRED"
    ).toLowerCase();
    const idempotencyKey = requireText(
      input.idempotencyKey,
      "KLYX_RESILIENCE_IDEMPOTENCY_KEY_REQUIRED"
    );
    const payload = input.payload ?? {};
    assertJsonValue(payload);
    const retryPolicy = mergeRetryPolicy(
      this.defaultRetryPolicy,
      input.retryPolicy
    );
    const priority = Number.isSafeInteger(input.priority ?? 100)
      ? (input.priority ?? 100)
      : NaN;
    if (!Number.isSafeInteger(priority)) {
      throw new Error("KLYX_RESILIENCE_PRIORITY_INVALID");
    }
    const replayMode = input.replayMode ?? "prove_before_replay";
    const availableAtMs = input.availableAtMs ?? this.clock.nowMs();
    if (!Number.isFinite(availableAtMs)) {
      throw new Error("KLYX_RESILIENCE_AVAILABLE_AT_INVALID");
    }
    const requestFingerprint = makeRequestFingerprint({
      jobType,
      payload,
      priority,
      retryPolicy,
      replayMode,
    });

    const created = await this.store.createOrGetJob({
      jobType,
      idempotencyKey,
      requestFingerprint,
      payload,
      priority,
      availableAtMs,
      retryPolicy,
      replayMode,
    });

    if (created.kind === "conflict") {
      throw new Error("KLYX_RESILIENCE_IDEMPOTENCY_CONFLICT");
    }

    await this.store.appendAudit({
      jobId: created.job.id,
      eventType:
        created.kind === "created" ? "job.enqueued" : "job.duplicate_enqueue",
      reasonCode: created.kind === "created" ? null : "DUPLICATE_IDEMPOTENT_ENQUEUE",
      previousStatus: null,
      newStatus: created.job.status,
      atMs: this.clock.nowMs(),
      details: {
        jobType,
        idempotencyKey,
      },
    });

    return {
      job: created.job,
      created: created.kind === "created",
      duplicate: created.kind === "existing",
    };
  }

  async claim(input: {
    workerId: string;
    limit?: number;
    leaseMs?: number;
    jobTypes?: string[] | null;
  }): Promise<KlyxResilienceJob[]> {
    const workerId = requireText(
      input.workerId,
      "KLYX_RESILIENCE_WORKER_ID_REQUIRED"
    );
    const limit = positiveInteger(
      input.limit ?? 1,
      "KLYX_RESILIENCE_CLAIM_LIMIT_INVALID"
    );
    const leaseMs = positiveInteger(
      input.leaseMs ?? this.defaultLeaseMs,
      "KLYX_RESILIENCE_LEASE_INVALID"
    );
    const jobTypes =
      input.jobTypes?.map((value) => value.trim().toLowerCase()).filter(Boolean) ??
      null;

    const jobs = await this.store.claimDueJobs({
      workerId,
      nowMs: this.clock.nowMs(),
      leaseMs,
      limit,
      jobTypes,
    });

    for (const job of jobs) {
      await this.store.appendAudit({
        jobId: job.id,
        eventType: "job.claimed",
        reasonCode: null,
        previousStatus:
          job.attemptCount === 1 ? "queued" : "retry_wait",
        newStatus: "running",
        atMs: this.clock.nowMs(),
        details: {
          workerId,
          attemptCount: job.attemptCount,
          leaseGeneration: job.lease?.generation ?? 0,
        },
      });
    }

    return jobs;
  }

  async extendLease(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    leaseMs?: number;
  }): Promise<KlyxResilienceJob> {
    const job = await this.requireJob(input.jobId);
    this.assertActiveLease(job, input.workerId, input.leaseToken);
    const now = this.clock.nowMs();
    if (!job.lease || job.lease.expiresAtMs <= now) {
      throw new Error("KLYX_RESILIENCE_STALE_CLAIM");
    }
    const next = cloneJob(job);
    next.lease = {
      ...job.lease,
      expiresAtMs:
        now +
        positiveInteger(
          input.leaseMs ?? this.defaultLeaseMs,
          "KLYX_RESILIENCE_LEASE_INVALID"
        ),
    };
    next.updatedAtMs = now;
    const saved = await this.saveWithEscalation(job, next, "LEASE_EXTEND_CONFLICT");
    await this.store.appendAudit({
      jobId: saved.id,
      eventType: "job.lease_extended",
      reasonCode: null,
      previousStatus: "running",
      newStatus: "running",
      atMs: now,
    });
    return saved;
  }

  async executeClaim(input: {
    job: KlyxResilienceJob;
    workerId: string;
    leaseToken: string;
    timeoutMs?: number;
  }): Promise<KlyxExecutionOutcome> {
    const current = await this.requireJob(input.job.id);
    this.assertActiveLease(current, input.workerId, input.leaseToken);
    const executor = this.executors.get(current.jobType);
    if (!executor) {
      return this.deadLetter(
        current,
        input.workerId,
        input.leaseToken,
        "EXECUTOR_MISSING"
      );
    }

    const timeoutMs = positiveInteger(
      input.timeoutMs ?? this.defaultExecutionTimeoutMs,
      "KLYX_RESILIENCE_TIMEOUT_INVALID"
    );
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const timeout = new Promise<KlyxExecutionResult>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ kind: "unknown_external_state", errorCode: "EXECUTION_TIMEOUT" });
      }, timeoutMs);
    });

    let result: KlyxExecutionResult;
    try {
      result = await Promise.race([
        executor({ job: current, signal: controller.signal }),
        timeout,
      ]);
    } catch {
      result = { kind: "retryable_failure", errorCode: "EXECUTOR_THROW" };
    } finally {
      if (timer) clearTimeout(timer);
    }

    switch (result.kind) {
      case "success":
        return this.complete(
          current.id,
          input.workerId,
          input.leaseToken,
          result.resultRef ?? null
        );
      case "retryable_failure":
        return this.fail(
          current.id,
          input.workerId,
          input.leaseToken,
          result.errorCode,
          "retryable"
        );
      case "poison_job":
        return this.fail(
          current.id,
          input.workerId,
          input.leaseToken,
          result.errorCode,
          "poison_job"
        );
      case "permanent_failure":
        return this.fail(
          current.id,
          input.workerId,
          input.leaseToken,
          result.errorCode,
          "permanent"
        );
      case "unknown_external_state":
        return this.recover(current.id, {
          trigger:
            normalizeCode(result.errorCode) === "EXECUTION_TIMEOUT"
              ? "timeout"
              : "unknown_external_state",
          reasonCode: result.errorCode,
          workerId: input.workerId,
          leaseToken: input.leaseToken,
        });
    }
  }

  async complete(
    jobId: string,
    workerId: string,
    leaseToken: string,
    resultRef: string | null = null
  ): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    const ackFingerprint = klyxStableFingerprint({
      kind: "complete",
      resultRef,
      leaseToken,
      workerId,
    });

    if (job.status === "succeeded") {
      if (job.lastAck?.fingerprint === ackFingerprint) {
        return { job, outcome: "replayed" };
      }
      return this.markHumanReview(job, "CONFLICTING_COMPLETION_REPLAY");
    }

    this.assertActiveLease(job, workerId, leaseToken);
    const now = this.clock.nowMs();
    if (!job.lease || job.lease.expiresAtMs <= now) {
      return this.recover(job.id, {
        trigger: "stale_claim",
        reasonCode: "STALE_CLAIM_COMPLETION",
        workerId,
        leaseToken,
      });
    }

    const next = cloneJob(job);
    next.status = "succeeded";
    next.resultRef = resultRef;
    next.lastErrorCode = null;
    next.lease = null;
    next.lastAck = { kind: "complete", fingerprint: ackFingerprint, atMs: now };
    next.updatedAtMs = now;
    const saved = await this.saveWithEscalation(
      job,
      next,
      "COMPLETE_CONCURRENT_MUTATION"
    );
    if (saved.status === "human_review") {
      return { job: saved, outcome: "human_review" };
    }
    await this.store.appendAudit({
      jobId: saved.id,
      eventType: "job.succeeded",
      reasonCode: null,
      previousStatus: job.status,
      newStatus: saved.status,
      atMs: now,
      details: resultRef ? { resultRef } : undefined,
    });
    return { job: saved, outcome: "succeeded" };
  }

  async fail(
    jobId: string,
    workerId: string,
    leaseToken: string,
    errorCode: string,
    kind: KlyxResilienceFailureKind = "retryable"
  ): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    this.assertActiveLease(job, workerId, leaseToken);
    const normalizedError = normalizeCode(errorCode);

    if (kind === "timeout" || kind === "unknown_external_state") {
      return this.recover(job.id, {
        trigger: kind === "timeout" ? "timeout" : "unknown_external_state",
        reasonCode: normalizedError,
        workerId,
        leaseToken,
      });
    }

    if (kind === "poison_job" || kind === "permanent") {
      return this.deadLetter(job, workerId, leaseToken, normalizedError);
    }

    return this.scheduleRetry(job, normalizedError, "job.retry_scheduled");
  }

  async recover(
    jobId: string,
    input: {
      trigger: KlyxResilienceRecoveryTrigger;
      reasonCode: string;
      workerId?: string | null;
      leaseToken?: string | null;
    }
  ): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    if (job.status === "succeeded") {
      return { job, outcome: "replayed" };
    }
    if (job.status === "dead_lettered") {
      return { job, outcome: "dead_lettered" };
    }
    if (job.status === "human_review") {
      return { job, outcome: "human_review" };
    }

    const handler = this.recoveryHandlers.get(job.jobType);
    if (!handler) {
      if (
        job.replayMode === "safe_idempotent_replay" &&
        ["worker_crash", "worker_restart", "stale_claim"].includes(input.trigger)
      ) {
        return this.scheduleRetry(job, input.reasonCode, "job.recovered");
      }
      return this.markHumanReview(
        job,
        `RECOVERY_HANDLER_MISSING:${normalizeCode(input.reasonCode)}`
      );
    }

    let decision: KlyxRecoveryDecision;
    try {
      decision = await handler({
        job,
        trigger: input.trigger,
        reasonCode: normalizeCode(input.reasonCode),
      });
    } catch {
      return this.markHumanReview(job, "RECOVERY_HANDLER_THROW");
    }

    switch (decision.kind) {
      case "proved_succeeded":
        return this.recoverySucceed(job, decision.reasonCode, decision.resultRef ?? null);
      case "proved_not_applied":
      case "retry":
        return this.scheduleRetry(job, decision.reasonCode, "job.recovered");
      case "unknown":
      case "human_review":
        return this.markHumanReview(job, decision.reasonCode);
    }
  }

  async recoverExpiredClaims(): Promise<KlyxExecutionOutcome[]> {
    const now = this.clock.nowMs();
    const running = await this.store.listJobs(["running"]);
    const expired = running.filter(
      (job) => job.lease !== null && job.lease.expiresAtMs <= now
    );
    const results: KlyxExecutionOutcome[] = [];
    for (const job of expired) {
      results.push(
        await this.recover(job.id, {
          trigger: "worker_crash",
          reasonCode: "LEASE_EXPIRED_WORKER_CRASH",
        })
      );
    }
    return results;
  }

  async recoverMissingWebhook(input: {
    jobId: string;
    expectedByMs: number;
    reasonCode?: string;
  }): Promise<KlyxExecutionOutcome | { outcome: "not_due"; job: KlyxResilienceJob }> {
    const job = await this.requireJob(input.jobId);
    if (this.clock.nowMs() < input.expectedByMs) {
      return { outcome: "not_due", job };
    }
    return this.recover(job.id, {
      trigger: "webhook_absent",
      reasonCode: input.reasonCode ?? "WEBHOOK_ABSENT",
    });
  }

  async ingestInboundEvent(input: {
    source: string;
    eventId: string;
    eventType: string;
    jobId: string;
    occurredAtMs: number;
    payload?: KlyxJsonValue;
  }): Promise<{
    disposition: "applied" | "duplicate" | "ignored" | "human_review";
    job: KlyxResilienceJob;
  }> {
    const source = requireText(input.source, "KLYX_RESILIENCE_EVENT_SOURCE_REQUIRED")
      .trim()
      .toLowerCase();
    const eventId = requireText(
      input.eventId,
      "KLYX_RESILIENCE_EVENT_ID_REQUIRED"
    );
    const eventType = requireText(
      input.eventType,
      "KLYX_RESILIENCE_EVENT_TYPE_REQUIRED"
    )
      .trim()
      .toLowerCase();
    const job = await this.requireJob(input.jobId);
    const payload = input.payload ?? {};
    assertJsonValue(payload);
    const receivedAtMs = this.clock.nowMs();
    const fingerprint = klyxStableFingerprint({
      source,
      eventId,
      eventType,
      jobId: job.id,
      occurredAtMs: input.occurredAtMs,
      payload,
    });
    const event: KlyxInboundEvent = {
      source,
      eventId,
      eventType,
      jobId: job.id,
      occurredAtMs: input.occurredAtMs,
      receivedAtMs,
      payload,
      fingerprint,
    };
    const put = await this.store.putInboundEvent(event);

    if (put.kind === "duplicate") {
      await this.store.appendAudit({
        jobId: job.id,
        eventType: "event.duplicate",
        reasonCode: "DUPLICATE_EVENT",
        previousStatus: job.status,
        newStatus: job.status,
        atMs: receivedAtMs,
        details: { source, eventId, eventType },
      });
      return { disposition: "duplicate", job };
    }

    if (put.kind === "conflict") {
      await this.store.appendAudit({
        jobId: job.id,
        eventType: "event.conflict",
        reasonCode: "DUPLICATE_EVENT_PAYLOAD_CONFLICT",
        previousStatus: job.status,
        newStatus: "human_review",
        atMs: receivedAtMs,
        details: { source, eventId, eventType },
      });
      const review = await this.markHumanReview(
        job,
        "DUPLICATE_EVENT_PAYLOAD_CONFLICT"
      );
      return { disposition: "human_review", job: review.job };
    }

    await this.store.appendAudit({
      jobId: job.id,
      eventType: "event.received",
      reasonCode: null,
      previousStatus: job.status,
      newStatus: job.status,
      atMs: receivedAtMs,
      details: {
        source,
        eventId,
        eventType,
        delayed: input.occurredAtMs < receivedAtMs,
      },
    });

    const handler = this.inboundEventHandlers.get(eventType);
    if (!handler) {
      return { disposition: "ignored", job };
    }

    let decision: KlyxInboundEventDecision;
    try {
      decision = await handler({ event, job });
    } catch {
      const review = await this.markHumanReview(job, "INBOUND_EVENT_HANDLER_THROW");
      return { disposition: "human_review", job: review.job };
    }

    switch (decision.kind) {
      case "ignore":
        return { disposition: "ignored", job };
      case "proved_succeeded": {
        const result = await this.recoverySucceed(
          job,
          decision.reasonCode,
          decision.resultRef ?? null
        );
        return { disposition: "applied", job: result.job };
      }
      case "retry": {
        const result = await this.scheduleRetry(
          job,
          decision.reasonCode,
          "job.recovered"
        );
        return { disposition: "applied", job: result.job };
      }
      case "unknown":
      case "human_review": {
        const review = await this.markHumanReview(job, decision.reasonCode);
        return { disposition: "human_review", job: review.job };
      }
    }
  }

  async redriveDeadLetter(input: {
    jobId: string;
    newIdempotencyKey: string;
    reasonCode: string;
    availableAtMs?: number;
  }): Promise<KlyxEnqueueResult> {
    const original = await this.requireJob(input.jobId);
    if (original.status !== "dead_lettered") {
      throw new Error("KLYX_RESILIENCE_REDRIVE_REQUIRES_DLQ");
    }
    const reasonCode = normalizeCode(input.reasonCode);
    const idempotencyKey = requireText(
      input.newIdempotencyKey,
      "KLYX_RESILIENCE_IDEMPOTENCY_KEY_REQUIRED"
    );
    const requestFingerprint = makeRequestFingerprint({
      jobType: original.jobType,
      payload: original.payload,
      priority: original.priority,
      retryPolicy: original.retryPolicy,
      replayMode: original.replayMode,
    });
    const result = await this.store.createOrGetJob({
      jobType: original.jobType,
      idempotencyKey,
      requestFingerprint,
      payload: original.payload,
      priority: original.priority,
      availableAtMs: input.availableAtMs ?? this.clock.nowMs(),
      retryPolicy: original.retryPolicy,
      replayMode: original.replayMode,
      parentJobId: original.id,
      redriveReasonCode: reasonCode,
    });
    if (result.kind === "conflict") {
      throw new Error("KLYX_RESILIENCE_IDEMPOTENCY_CONFLICT");
    }
    if (result.kind === "created") {
      await this.store.appendAudit({
        jobId: result.job.id,
        eventType: "job.redriven",
        reasonCode,
        previousStatus: null,
        newStatus: result.job.status,
        atMs: this.clock.nowMs(),
        details: { parentJobId: original.id },
      });
    }
    return {
      job: result.job,
      created: result.kind === "created",
      duplicate: result.kind === "existing",
    };
  }

  async listDeadLetters(): Promise<KlyxResilienceJob[]> {
    return this.store.listJobs(["dead_lettered"]);
  }

  async listHumanReview(): Promise<KlyxResilienceJob[]> {
    return this.store.listJobs(["human_review"]);
  }

  async getJob(jobId: string): Promise<KlyxResilienceJob | null> {
    return this.store.getJob(jobId);
  }

  async listAudit(jobId?: string): Promise<KlyxResilienceAuditEvent[]> {
    return this.store.listAudit(jobId);
  }

  private async scheduleRetry(
    job: KlyxResilienceJob,
    reasonCode: string,
    auditType: "job.retry_scheduled" | "job.recovered"
  ): Promise<KlyxExecutionOutcome> {
    const normalizedReason = normalizeCode(reasonCode);
    if (job.attemptCount >= job.retryPolicy.maxAttempts) {
      return this.deadLetterWithoutLease(job, `ATTEMPTS_EXHAUSTED:${normalizedReason}`);
    }
    const now = this.clock.nowMs();
    const next = cloneJob(job);
    next.status = "retry_wait";
    next.availableAtMs =
      now + computeKlyxExponentialBackoffMs(Math.max(job.attemptCount, 1), job.retryPolicy);
    next.lastErrorCode = normalizedReason;
    next.lease = null;
    next.lastAck = {
      kind: auditType === "job.recovered" ? "recovery" : "fail",
      fingerprint: klyxStableFingerprint({
        kind: auditType,
        reasonCode: normalizedReason,
        attemptCount: job.attemptCount,
      }),
      atMs: now,
    };
    next.updatedAtMs = now;
    const saved = await this.saveWithEscalation(
      job,
      next,
      "RETRY_CONCURRENT_MUTATION"
    );
    if (saved.status === "human_review") {
      return { job: saved, outcome: "human_review" };
    }
    await this.store.appendAudit({
      jobId: saved.id,
      eventType: auditType,
      reasonCode: normalizedReason,
      previousStatus: job.status,
      newStatus: saved.status,
      atMs: now,
      details: { availableAtMs: saved.availableAtMs },
    });
    return { job: saved, outcome: "retry_scheduled" };
  }

  private async deadLetter(
    job: KlyxResilienceJob,
    workerId: string,
    leaseToken: string,
    reasonCode: string
  ): Promise<KlyxExecutionOutcome> {
    this.assertActiveLease(job, workerId, leaseToken);
    return this.deadLetterWithoutLease(job, reasonCode);
  }

  private async deadLetterWithoutLease(
    job: KlyxResilienceJob,
    reasonCode: string
  ): Promise<KlyxExecutionOutcome> {
    const now = this.clock.nowMs();
    const next = cloneJob(job);
    next.status = "dead_lettered";
    next.lastErrorCode = normalizeCode(reasonCode);
    next.lease = null;
    next.updatedAtMs = now;
    const saved = await this.saveWithEscalation(
      job,
      next,
      "DLQ_CONCURRENT_MUTATION"
    );
    if (saved.status === "human_review") {
      return { job: saved, outcome: "human_review" };
    }
    await this.store.appendAudit({
      jobId: saved.id,
      eventType: "job.dead_lettered",
      reasonCode: saved.lastErrorCode,
      previousStatus: job.status,
      newStatus: saved.status,
      atMs: now,
    });
    return { job: saved, outcome: "dead_lettered" };
  }

  private async recoverySucceed(
    job: KlyxResilienceJob,
    reasonCode: string,
    resultRef: string | null
  ): Promise<KlyxExecutionOutcome> {
    if (job.status === "succeeded") {
      return { job, outcome: "replayed" };
    }
    const now = this.clock.nowMs();
    const normalizedReason = normalizeCode(reasonCode);
    const next = cloneJob(job);
    next.status = "succeeded";
    next.resultRef = resultRef;
    next.lastErrorCode = null;
    next.lease = null;
    next.lastAck = {
      kind: "recovery",
      fingerprint: klyxStableFingerprint({
        kind: "recovery_success",
        reasonCode: normalizedReason,
        resultRef,
      }),
      atMs: now,
    };
    next.updatedAtMs = now;
    const saved = await this.saveWithEscalation(
      job,
      next,
      "RECOVERY_SUCCESS_CONCURRENT_MUTATION"
    );
    if (saved.status === "human_review") {
      return { job: saved, outcome: "human_review" };
    }
    await this.store.appendAudit({
      jobId: saved.id,
      eventType: "job.recovered",
      reasonCode: normalizedReason,
      previousStatus: job.status,
      newStatus: saved.status,
      atMs: now,
      details: resultRef ? { resultRef } : undefined,
    });
    return { job: saved, outcome: "succeeded" };
  }

  private async markHumanReview(
    job: KlyxResilienceJob,
    reasonCode: string
  ): Promise<KlyxExecutionOutcome> {
    const normalizedReason = normalizeCode(reasonCode);
    let current = job;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (current.status === "human_review") {
        return { job: current, outcome: "human_review" };
      }
      const now = this.clock.nowMs();
      const next = cloneJob(current);
      next.status = "human_review";
      next.lastErrorCode = normalizedReason;
      next.lease = null;
      next.updatedAtMs = now;
      try {
        const saved = await this.store.saveJob(next, current.version);
        await this.store.appendAudit({
          jobId: saved.id,
          eventType: "job.human_review",
          reasonCode: normalizedReason,
          previousStatus: current.status,
          newStatus: saved.status,
          atMs: now,
        });
        return { job: saved, outcome: "human_review" };
      } catch (error) {
        if (!(error instanceof KlyxResilienceConcurrentMutationError)) {
          throw error;
        }
        const reloaded = await this.store.getJob(current.id);
        if (!reloaded) throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
        current = reloaded;
      }
    }
    throw new Error("KLYX_RESILIENCE_HUMAN_REVIEW_ESCALATION_FAILED");
  }

  private async saveWithEscalation(
    previous: KlyxResilienceJob,
    next: KlyxResilienceJob,
    conflictReasonCode: string
  ): Promise<KlyxResilienceJob> {
    try {
      return await this.store.saveJob(next, previous.version);
    } catch (error) {
      if (!(error instanceof KlyxResilienceConcurrentMutationError)) {
        throw error;
      }
      const current = await this.requireJob(previous.id);
      const review = await this.markHumanReview(current, conflictReasonCode);
      return review.job;
    }
  }

  private assertActiveLease(
    job: KlyxResilienceJob,
    workerId: string,
    leaseToken: string
  ): void {
    if (job.status !== "running" || !job.lease) {
      throw new Error("KLYX_RESILIENCE_JOB_NOT_RUNNING");
    }
    if (
      job.lease.workerId !== workerId.trim() ||
      job.lease.token !== leaseToken.trim()
    ) {
      throw new Error("KLYX_RESILIENCE_STALE_CLAIM");
    }
  }

  private async requireJob(jobId: string): Promise<KlyxResilienceJob> {
    const id = requireText(jobId, "KLYX_RESILIENCE_JOB_ID_REQUIRED");
    const job = await this.store.getJob(id);
    if (!job) throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
    return job;
  }
}

export function isKlyxResilienceTerminalStatus(
  status: KlyxResilienceJobStatus
): boolean {
  return TERMINAL_STATUSES.has(status);
}
