export type KlyxJsonPrimitive = string | number | boolean | null;
export type KlyxJsonValue = KlyxJsonPrimitive | KlyxJsonValue[] | { [key: string]: KlyxJsonValue };

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

export type KlyxResilienceReplayMode = "safe_idempotent_replay" | "prove_before_replay";

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
  | { kind: "conflict"; event: KlyxInboundEvent; existing: KlyxInboundEvent };

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
  saveJob(job: KlyxResilienceJob, expectedVersion: number): Promise<KlyxResilienceJob>;
  claimDueJobs(input: KlyxClaimJobsInput): Promise<KlyxResilienceJob[]>;
  listJobs(statuses?: KlyxResilienceJobStatus[]): Promise<KlyxResilienceJob[]>;
  putInboundEvent(event: KlyxInboundEvent): Promise<KlyxInboundEventPutResult>;
  appendAudit(event: Omit<KlyxResilienceAuditEvent, "id">): Promise<KlyxResilienceAuditEvent>;
  listAudit(jobId?: string): Promise<KlyxResilienceAuditEvent[]>;
}

export interface KlyxResilienceClock {
  nowMs(): number;
}

export type KlyxExecutionContext = { job: KlyxResilienceJob; signal: AbortSignal };
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

export type KlyxInboundEventContext = { event: KlyxInboundEvent; job: KlyxResilienceJob };
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
  recoveryHandlers?: Record<string, (ctx: KlyxRecoveryContext) => Promise<KlyxRecoveryDecision>>;
  inboundEventHandlers?: Record<string, (ctx: KlyxInboundEventContext) => Promise<KlyxInboundEventDecision>>;
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

export type KlyxEnqueueResult = { job: KlyxResilienceJob; created: boolean; duplicate: boolean };
export type KlyxExecutionOutcome = {
  job: KlyxResilienceJob;
  outcome: "succeeded" | "retry_scheduled" | "dead_lettered" | "human_review" | "replayed";
};

const DEFAULT_RETRY_POLICY: KlyxRetryPolicy = {
  maxAttempts: 5,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
};
const TERMINAL = new Set<KlyxResilienceJobStatus>(["succeeded", "dead_lettered", "human_review"]);
const systemClock: KlyxResilienceClock = { nowMs: () => Date.now() };

function requireText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function normalizeCode(value: string): string {
  return requireText(value, "KLYX_RESILIENCE_REASON_CODE_REQUIRED").toUpperCase();
}
function positiveInt(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}
function assertJson(value: unknown, path = "payload"): asserts value is KlyxJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`KLYX_RESILIENCE_JSON_NON_FINITE:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, i) => assertJson(entry, `${path}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) throw new Error(`KLYX_RESILIENCE_JSON_UNDEFINED:${path}.${key}`);
      assertJson(entry, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`KLYX_RESILIENCE_JSON_INVALID:${path}`);
}
function canonical(value: KlyxJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
export function klyxStableFingerprint(value: KlyxJsonValue): string {
  assertJson(value);
  return canonical(value);
}
export function computeKlyxExponentialBackoffMs(attemptCount: number, policy: KlyxRetryPolicy): number {
  positiveInt(attemptCount, "KLYX_RESILIENCE_ATTEMPT_INVALID");
  positiveInt(policy.maxAttempts, "KLYX_RESILIENCE_MAX_ATTEMPTS_INVALID");
  positiveInt(policy.backoffBaseMs, "KLYX_RESILIENCE_BACKOFF_BASE_INVALID");
  positiveInt(policy.backoffMaxMs, "KLYX_RESILIENCE_BACKOFF_MAX_INVALID");
  if (policy.backoffMaxMs < policy.backoffBaseMs) throw new Error("KLYX_RESILIENCE_BACKOFF_RANGE_INVALID");
  const raw = policy.backoffBaseMs * 2 ** Math.min(attemptCount - 1, 52);
  return Math.min(policy.backoffMaxMs, Number.isFinite(raw) ? raw : policy.backoffMaxMs);
}
function mergePolicy(base: KlyxRetryPolicy, input?: Partial<KlyxRetryPolicy>): KlyxRetryPolicy {
  const policy = {
    maxAttempts: input?.maxAttempts ?? base.maxAttempts,
    backoffBaseMs: input?.backoffBaseMs ?? base.backoffBaseMs,
    backoffMaxMs: input?.backoffMaxMs ?? base.backoffMaxMs,
  };
  computeKlyxExponentialBackoffMs(1, policy);
  return policy;
}
function cloneJob(job: KlyxResilienceJob): KlyxResilienceJob {
  return JSON.parse(JSON.stringify(job)) as KlyxResilienceJob;
}
function requestFingerprint(input: {
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
    retryPolicy: input.retryPolicy,
    replayMode: input.replayMode,
  });
}

export class KlyxResilienceEngine {
  private readonly store: KlyxResilienceStore;
  private readonly clock: KlyxResilienceClock;
  private readonly defaultRetryPolicy: KlyxRetryPolicy;
  private readonly defaultLeaseMs: number;
  private readonly defaultExecutionTimeoutMs: number;
  private readonly executors: Map<string, (ctx: KlyxExecutionContext) => Promise<KlyxExecutionResult>>;
  private readonly recoveryHandlers: Map<string, (ctx: KlyxRecoveryContext) => Promise<KlyxRecoveryDecision>>;
  private readonly inboundHandlers: Map<string, (ctx: KlyxInboundEventContext) => Promise<KlyxInboundEventDecision>>;

  constructor(options: KlyxResilienceEngineOptions) {
    this.store = options.store;
    this.clock = options.clock ?? systemClock;
    this.defaultRetryPolicy = mergePolicy(DEFAULT_RETRY_POLICY, options.defaultRetryPolicy);
    this.defaultLeaseMs = positiveInt(options.defaultLeaseMs ?? 60_000, "KLYX_RESILIENCE_LEASE_INVALID");
    this.defaultExecutionTimeoutMs = positiveInt(options.defaultExecutionTimeoutMs ?? 30_000, "KLYX_RESILIENCE_TIMEOUT_INVALID");
    this.executors = new Map(Object.entries(options.executors ?? {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
    this.recoveryHandlers = new Map(Object.entries(options.recoveryHandlers ?? {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
    this.inboundHandlers = new Map(Object.entries(options.inboundEventHandlers ?? {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
  }

  async enqueue(input: EnqueueKlyxResilienceJobInput): Promise<KlyxEnqueueResult> {
    const jobType = requireText(input.jobType, "KLYX_RESILIENCE_JOB_TYPE_REQUIRED").toLowerCase();
    const idempotencyKey = requireText(input.idempotencyKey, "KLYX_RESILIENCE_IDEMPOTENCY_KEY_REQUIRED");
    const payload = input.payload ?? {};
    assertJson(payload);
    const priority = input.priority ?? 100;
    if (!Number.isSafeInteger(priority)) throw new Error("KLYX_RESILIENCE_PRIORITY_INVALID");
    const retryPolicy = mergePolicy(this.defaultRetryPolicy, input.retryPolicy);
    const replayMode = input.replayMode ?? "prove_before_replay";
    const availableAtMs = input.availableAtMs ?? this.clock.nowMs();
    if (!Number.isFinite(availableAtMs)) throw new Error("KLYX_RESILIENCE_AVAILABLE_AT_INVALID");
    const fingerprint = requestFingerprint({ jobType, payload, priority, retryPolicy, replayMode });
    const result = await this.store.createOrGetJob({
      jobType,
      idempotencyKey,
      requestFingerprint: fingerprint,
      payload,
      priority,
      availableAtMs,
      retryPolicy,
      replayMode,
    });
    if (result.kind === "conflict") throw new Error("KLYX_RESILIENCE_IDEMPOTENCY_CONFLICT");
    await this.audit(result.job, result.kind === "created" ? "job.enqueued" : "job.duplicate_enqueue", result.kind === "created" ? null : "DUPLICATE_IDEMPOTENT_ENQUEUE", null, result.job.status);
    return { job: result.job, created: result.kind === "created", duplicate: result.kind === "existing" };
  }

  async claim(input: { workerId: string; limit?: number; leaseMs?: number; jobTypes?: string[] | null }): Promise<KlyxResilienceJob[]> {
    const workerId = requireText(input.workerId, "KLYX_RESILIENCE_WORKER_ID_REQUIRED");
    const nowMs = this.clock.nowMs();
    const jobs = await this.store.claimDueJobs({
      workerId,
      nowMs,
      leaseMs: positiveInt(input.leaseMs ?? this.defaultLeaseMs, "KLYX_RESILIENCE_LEASE_INVALID"),
      limit: positiveInt(input.limit ?? 1, "KLYX_RESILIENCE_CLAIM_LIMIT_INVALID"),
      jobTypes: input.jobTypes?.map((v) => v.trim().toLowerCase()).filter(Boolean) ?? null,
    });
    for (const job of jobs) await this.audit(job, "job.claimed", null, job.attemptCount === 1 ? "queued" : "retry_wait", "running");
    return jobs;
  }

  async extendLease(input: { jobId: string; workerId: string; leaseToken: string; leaseMs?: number }): Promise<KlyxResilienceJob> {
    const job = await this.requireJob(input.jobId);
    this.assertLeaseOwner(job, input.workerId, input.leaseToken);
    const now = this.clock.nowMs();
    if (!job.lease || job.lease.expiresAtMs <= now) throw new Error("KLYX_RESILIENCE_STALE_CLAIM");
    const next = cloneJob(job);
    next.lease!.expiresAtMs = now + positiveInt(input.leaseMs ?? this.defaultLeaseMs, "KLYX_RESILIENCE_LEASE_INVALID");
    next.updatedAtMs = now;
    const saved = await this.saveOrReview(job, next, "LEASE_EXTEND_CONCURRENT_MUTATION");
    if (saved.status !== "human_review") await this.audit(saved, "job.lease_extended", null, "running", "running");
    return saved;
  }

  async executeClaim(input: { job: KlyxResilienceJob; workerId: string; leaseToken: string; timeoutMs?: number }): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(input.job.id);
    this.assertLeaseOwner(job, input.workerId, input.leaseToken);
    if (!job.lease || job.lease.expiresAtMs <= this.clock.nowMs()) {
      return this.recover(job.id, { trigger: "stale_claim", reasonCode: "STALE_CLAIM_EXECUTION" });
    }
    const executor = this.executors.get(job.jobType);
    if (!executor) return this.deadLetter(job, "EXECUTOR_MISSING");
    const timeoutMs = positiveInt(input.timeoutMs ?? this.defaultExecutionTimeoutMs, "KLYX_RESILIENCE_TIMEOUT_INVALID");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<KlyxExecutionResult>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ kind: "unknown_external_state", errorCode: "EXECUTION_TIMEOUT" });
      }, timeoutMs);
    });
    let result: KlyxExecutionResult;
    try {
      result = await Promise.race([executor({ job, signal: controller.signal }), timeout]);
    } catch {
      result = { kind: "unknown_external_state", errorCode: "EXECUTOR_THROW_UNKNOWN_STATE" };
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (result.kind === "success") return this.complete(job.id, input.workerId, input.leaseToken, result.resultRef ?? null);
    if (result.kind === "retryable_failure") return this.fail(job.id, input.workerId, input.leaseToken, result.errorCode, "retryable");
    if (result.kind === "poison_job") return this.fail(job.id, input.workerId, input.leaseToken, result.errorCode, "poison_job");
    if (result.kind === "permanent_failure") return this.fail(job.id, input.workerId, input.leaseToken, result.errorCode, "permanent");
    return this.recover(job.id, {
      trigger: normalizeCode(result.errorCode) === "EXECUTION_TIMEOUT" ? "timeout" : "unknown_external_state",
      reasonCode: result.errorCode,
    });
  }

  async complete(jobId: string, workerId: string, leaseToken: string, resultRef: string | null = null): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    const ack = klyxStableFingerprint({ kind: "complete", workerId, leaseToken, resultRef });
    if (job.status === "succeeded") {
      if (job.lastAck?.fingerprint === ack) return { job, outcome: "replayed" };
      return this.humanReview(job, "CONFLICTING_COMPLETION_REPLAY");
    }
    this.assertLeaseOwner(job, workerId, leaseToken);
    if (!job.lease || job.lease.expiresAtMs <= this.clock.nowMs()) return this.recover(job.id, { trigger: "stale_claim", reasonCode: "STALE_CLAIM_COMPLETION" });
    const now = this.clock.nowMs();
    const next = cloneJob(job);
    next.status = "succeeded";
    next.resultRef = resultRef;
    next.lastErrorCode = null;
    next.lease = null;
    next.lastAck = { kind: "complete", fingerprint: ack, atMs: now };
    next.updatedAtMs = now;
    const saved = await this.saveOrReview(job, next, "COMPLETE_CONCURRENT_MUTATION");
    if (saved.status === "human_review") return { job: saved, outcome: "human_review" };
    await this.audit(saved, "job.succeeded", null, job.status, "succeeded");
    return { job: saved, outcome: "succeeded" };
  }

  async fail(jobId: string, workerId: string, leaseToken: string, errorCode: string, kind: KlyxResilienceFailureKind = "retryable"): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    this.assertLeaseOwner(job, workerId, leaseToken);
    const code = normalizeCode(errorCode);
    if (!job.lease || job.lease.expiresAtMs <= this.clock.nowMs()) return this.recover(job.id, { trigger: "stale_claim", reasonCode: `STALE_CLAIM_FAILURE:${code}` });
    if (kind === "timeout" || kind === "unknown_external_state") return this.recover(job.id, { trigger: kind === "timeout" ? "timeout" : "unknown_external_state", reasonCode: code });
    if (kind === "poison_job" || kind === "permanent") return this.deadLetter(job, code);
    return this.scheduleRetry(job, code, "job.retry_scheduled");
  }

  async recover(jobId: string, input: { trigger: KlyxResilienceRecoveryTrigger; reasonCode: string; workerId?: string | null; leaseToken?: string | null }): Promise<KlyxExecutionOutcome> {
    const job = await this.requireJob(jobId);
    if (job.status === "succeeded") return { job, outcome: "replayed" };
    if (job.status === "dead_lettered") return { job, outcome: "dead_lettered" };
    if (job.status === "human_review") return { job, outcome: "human_review" };
    const handler = this.recoveryHandlers.get(job.jobType);
    if (!handler) {
      if (job.replayMode === "safe_idempotent_replay" && ["worker_crash", "worker_restart", "stale_claim"].includes(input.trigger)) {
        return this.scheduleRetry(job, input.reasonCode, "job.recovered");
      }
      return this.humanReview(job, `RECOVERY_HANDLER_MISSING:${normalizeCode(input.reasonCode)}`);
    }
    let decision: KlyxRecoveryDecision;
    try {
      decision = await handler({ job, trigger: input.trigger, reasonCode: normalizeCode(input.reasonCode) });
    } catch {
      return this.humanReview(job, "RECOVERY_HANDLER_THROW");
    }
    if (decision.kind === "proved_succeeded") return this.recoverySuccess(job, decision.reasonCode, decision.resultRef ?? null);
    if (decision.kind === "proved_not_applied" || decision.kind === "retry") return this.scheduleRetry(job, decision.reasonCode, "job.recovered");
    return this.humanReview(job, decision.reasonCode);
  }

  async recoverExpiredClaims(): Promise<KlyxExecutionOutcome[]> {
    const now = this.clock.nowMs();
    const running = await this.store.listJobs(["running"]);
    const results: KlyxExecutionOutcome[] = [];
    for (const job of running) {
      if (job.lease && job.lease.expiresAtMs <= now) {
        results.push(await this.recover(job.id, { trigger: "worker_crash", reasonCode: "LEASE_EXPIRED_WORKER_CRASH" }));
      }
    }
    return results;
  }

  async recoverMissingWebhook(input: { jobId: string; expectedByMs: number; reasonCode?: string }): Promise<KlyxExecutionOutcome | { outcome: "not_due"; job: KlyxResilienceJob }> {
    const job = await this.requireJob(input.jobId);
    if (this.clock.nowMs() < input.expectedByMs) return { outcome: "not_due", job };
    return this.recover(job.id, { trigger: "webhook_absent", reasonCode: input.reasonCode ?? "WEBHOOK_ABSENT" });
  }

  async ingestInboundEvent(input: { source: string; eventId: string; eventType: string; jobId: string; occurredAtMs: number; payload?: KlyxJsonValue }): Promise<{ disposition: "applied" | "duplicate" | "ignored" | "human_review"; job: KlyxResilienceJob }> {
    const source = requireText(input.source, "KLYX_RESILIENCE_EVENT_SOURCE_REQUIRED").toLowerCase();
    const eventId = requireText(input.eventId, "KLYX_RESILIENCE_EVENT_ID_REQUIRED");
    const eventType = requireText(input.eventType, "KLYX_RESILIENCE_EVENT_TYPE_REQUIRED").toLowerCase();
    const job = await this.requireJob(input.jobId);
    const payload = input.payload ?? {};
    assertJson(payload);
    const receivedAtMs = this.clock.nowMs();
    const fingerprint = klyxStableFingerprint({ source, eventId, eventType, jobId: job.id, occurredAtMs: input.occurredAtMs, payload });
    const event: KlyxInboundEvent = { source, eventId, eventType, jobId: job.id, occurredAtMs: input.occurredAtMs, receivedAtMs, payload, fingerprint };
    const put = await this.store.putInboundEvent(event);
    if (put.kind === "duplicate") {
      await this.audit(job, "event.duplicate", "DUPLICATE_EVENT", job.status, job.status);
      return { disposition: "duplicate", job };
    }
    if (put.kind === "conflict") {
      await this.audit(job, "event.conflict", "DUPLICATE_EVENT_PAYLOAD_CONFLICT", job.status, "human_review");
      const review = await this.humanReview(job, "DUPLICATE_EVENT_PAYLOAD_CONFLICT");
      return { disposition: "human_review", job: review.job };
    }
    await this.audit(job, "event.received", null, job.status, job.status, { source, eventId, eventType, delayed: input.occurredAtMs < receivedAtMs });
    const handler = this.inboundHandlers.get(eventType);
    if (!handler) return { disposition: "ignored", job };
    let decision: KlyxInboundEventDecision;
    try {
      decision = await handler({ event, job });
    } catch {
      const review = await this.humanReview(job, "INBOUND_EVENT_HANDLER_THROW");
      return { disposition: "human_review", job: review.job };
    }
    if (decision.kind === "ignore") return { disposition: "ignored", job };
    if (decision.kind === "proved_succeeded") {
      const result = await this.recoverySuccess(job, decision.reasonCode, decision.resultRef ?? null);
      return { disposition: "applied", job: result.job };
    }
    if (decision.kind === "retry") {
      const result = await this.scheduleRetry(job, decision.reasonCode, "job.recovered");
      return { disposition: "applied", job: result.job };
    }
    const review = await this.humanReview(job, decision.reasonCode);
    return { disposition: "human_review", job: review.job };
  }

  async redriveDeadLetter(input: { jobId: string; newIdempotencyKey: string; reasonCode: string; availableAtMs?: number }): Promise<KlyxEnqueueResult> {
    const original = await this.requireJob(input.jobId);
    if (original.status !== "dead_lettered") throw new Error("KLYX_RESILIENCE_REDRIVE_REQUIRES_DLQ");
    const reasonCode = normalizeCode(input.reasonCode);
    const idempotencyKey = requireText(input.newIdempotencyKey, "KLYX_RESILIENCE_IDEMPOTENCY_KEY_REQUIRED");
    const result = await this.store.createOrGetJob({
      jobType: original.jobType,
      idempotencyKey,
      requestFingerprint: requestFingerprint({ jobType: original.jobType, payload: original.payload, priority: original.priority, retryPolicy: original.retryPolicy, replayMode: original.replayMode }),
      payload: original.payload,
      priority: original.priority,
      availableAtMs: input.availableAtMs ?? this.clock.nowMs(),
      retryPolicy: original.retryPolicy,
      replayMode: original.replayMode,
      parentJobId: original.id,
      redriveReasonCode: reasonCode,
    });
    if (result.kind === "conflict") throw new Error("KLYX_RESILIENCE_IDEMPOTENCY_CONFLICT");
    if (result.kind === "created") await this.audit(result.job, "job.redriven", reasonCode, null, result.job.status, { parentJobId: original.id });
    return { job: result.job, created: result.kind === "created", duplicate: result.kind === "existing" };
  }

  async listDeadLetters(): Promise<KlyxResilienceJob[]> { return this.store.listJobs(["dead_lettered"]); }
  async listHumanReview(): Promise<KlyxResilienceJob[]> { return this.store.listJobs(["human_review"]); }
  async getJob(jobId: string): Promise<KlyxResilienceJob | null> { return this.store.getJob(jobId); }
  async listAudit(jobId?: string): Promise<KlyxResilienceAuditEvent[]> { return this.store.listAudit(jobId); }

  private async scheduleRetry(job: KlyxResilienceJob, reasonCode: string, auditType: "job.retry_scheduled" | "job.recovered"): Promise<KlyxExecutionOutcome> {
    const code = normalizeCode(reasonCode);
    if (job.attemptCount >= job.retryPolicy.maxAttempts) return this.deadLetter(job, `ATTEMPTS_EXHAUSTED:${code}`);
    const now = this.clock.nowMs();
    const next = cloneJob(job);
    next.status = "retry_wait";
    next.availableAtMs = now + computeKlyxExponentialBackoffMs(Math.max(job.attemptCount, 1), job.retryPolicy);
    next.lastErrorCode = code;
    next.lease = null;
    next.lastAck = { kind: auditType === "job.recovered" ? "recovery" : "fail", fingerprint: klyxStableFingerprint({ kind: auditType, reasonCode: code, attemptCount: job.attemptCount }), atMs: now };
    next.updatedAtMs = now;
    const saved = await this.saveOrReview(job, next, "RETRY_CONCURRENT_MUTATION");
    if (saved.status === "human_review") return { job: saved, outcome: "human_review" };
    await this.audit(saved, auditType, code, job.status, saved.status, { availableAtMs: saved.availableAtMs });
    return { job: saved, outcome: "retry_scheduled" };
  }

  private async deadLetter(job: KlyxResilienceJob, reasonCode: string): Promise<KlyxExecutionOutcome> {
    const now = this.clock.nowMs();
    const next = cloneJob(job);
    next.status = "dead_lettered";
    next.lastErrorCode = normalizeCode(reasonCode);
    next.lease = null;
    next.updatedAtMs = now;
    const saved = await this.saveOrReview(job, next, "DLQ_CONCURRENT_MUTATION");
    if (saved.status === "human_review") return { job: saved, outcome: "human_review" };
    await this.audit(saved, "job.dead_lettered", saved.lastErrorCode, job.status, saved.status);
    return { job: saved, outcome: "dead_lettered" };
  }

  private async recoverySuccess(job: KlyxResilienceJob, reasonCode: string, resultRef: string | null): Promise<KlyxExecutionOutcome> {
    if (job.status === "succeeded") return { job, outcome: "replayed" };
    const now = this.clock.nowMs();
    const code = normalizeCode(reasonCode);
    const next = cloneJob(job);
    next.status = "succeeded";
    next.resultRef = resultRef;
    next.lastErrorCode = null;
    next.lease = null;
    next.lastAck = { kind: "recovery", fingerprint: klyxStableFingerprint({ kind: "recovery_success", reasonCode: code, resultRef }), atMs: now };
    next.updatedAtMs = now;
    const saved = await this.saveOrReview(job, next, "RECOVERY_SUCCESS_CONCURRENT_MUTATION");
    if (saved.status === "human_review") return { job: saved, outcome: "human_review" };
    await this.audit(saved, "job.recovered", code, job.status, saved.status, resultRef ? { resultRef } : undefined);
    return { job: saved, outcome: "succeeded" };
  }

  private async humanReview(job: KlyxResilienceJob, reasonCode: string): Promise<KlyxExecutionOutcome> {
    const code = normalizeCode(reasonCode);
    let current = job;
    for (let i = 0; i < 3; i += 1) {
      if (current.status === "human_review") return { job: current, outcome: "human_review" };
      const next = cloneJob(current);
      next.status = "human_review";
      next.lastErrorCode = code;
      next.lease = null;
      next.updatedAtMs = this.clock.nowMs();
      try {
        const saved = await this.store.saveJob(next, current.version);
        await this.audit(saved, "job.human_review", code, current.status, "human_review");
        return { job: saved, outcome: "human_review" };
      } catch (error) {
        if (!(error instanceof KlyxResilienceConcurrentMutationError)) throw error;
        const reloaded = await this.store.getJob(current.id);
        if (!reloaded) throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
        current = reloaded;
      }
    }
    throw new Error("KLYX_RESILIENCE_HUMAN_REVIEW_ESCALATION_FAILED");
  }

  private async saveOrReview(previous: KlyxResilienceJob, next: KlyxResilienceJob, reason: string): Promise<KlyxResilienceJob> {
    try {
      return await this.store.saveJob(next, previous.version);
    } catch (error) {
      if (!(error instanceof KlyxResilienceConcurrentMutationError)) throw error;
      const current = await this.requireJob(previous.id);
      return (await this.humanReview(current, reason)).job;
    }
  }

  private assertLeaseOwner(job: KlyxResilienceJob, workerId: string, leaseToken: string): void {
    if (job.status !== "running" || !job.lease) throw new Error("KLYX_RESILIENCE_JOB_NOT_RUNNING");
    if (job.lease.workerId !== workerId.trim() || job.lease.token !== leaseToken.trim()) throw new Error("KLYX_RESILIENCE_STALE_CLAIM");
  }

  private async requireJob(jobId: string): Promise<KlyxResilienceJob> {
    const id = requireText(jobId, "KLYX_RESILIENCE_JOB_ID_REQUIRED");
    const job = await this.store.getJob(id);
    if (!job) throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
    return job;
  }

  private async audit(
    job: KlyxResilienceJob,
    eventType: Omit<KlyxResilienceAuditEvent, "id">["eventType"],
    reasonCode: string | null,
    previousStatus: KlyxResilienceJobStatus | null,
    newStatus: KlyxResilienceJobStatus | null,
    details?: Record<string, KlyxJsonValue>
  ): Promise<void> {
    await this.store.appendAudit({ jobId: job.id, eventType, reasonCode, previousStatus, newStatus, atMs: this.clock.nowMs(), details });
  }
}

export function isKlyxResilienceTerminalStatus(status: KlyxResilienceJobStatus): boolean {
  return TERMINAL.has(status);
}
