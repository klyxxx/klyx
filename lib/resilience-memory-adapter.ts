import {
  KlyxResilienceConcurrentMutationError,
  type KlyxClaimJobsInput,
  type KlyxCreateJobInput,
  type KlyxCreateJobResult,
  type KlyxInboundEvent,
  type KlyxInboundEventPutResult,
  type KlyxResilienceAuditEvent,
  type KlyxResilienceClock,
  type KlyxResilienceJob,
  type KlyxResilienceJobStatus,
  type KlyxResilienceStore,
} from "./resilience-engine";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class ManualKlyxResilienceClock implements KlyxResilienceClock {
  private currentMs: number;

  constructor(initialMs: number) {
    if (!Number.isFinite(initialMs)) {
      throw new Error("KLYX_RESILIENCE_CLOCK_INVALID");
    }
    this.currentMs = initialMs;
  }

  nowMs(): number {
    return this.currentMs;
  }

  set(ms: number): void {
    if (!Number.isFinite(ms)) {
      throw new Error("KLYX_RESILIENCE_CLOCK_INVALID");
    }
    this.currentMs = ms;
  }

  advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error("KLYX_RESILIENCE_CLOCK_ADVANCE_INVALID");
    }
    this.currentMs += ms;
  }
}

export class InMemoryKlyxResilienceStore implements KlyxResilienceStore {
  private readonly jobs = new Map<string, KlyxResilienceJob>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly inboundEvents = new Map<string, KlyxInboundEvent>();
  private readonly auditEvents: KlyxResilienceAuditEvent[] = [];
  private jobSequence = 0;
  private leaseSequence = 0;
  private auditSequence = 0;
  private readonly concurrentMutationOnNextSave = new Map<
    string,
    (job: KlyxResilienceJob) => KlyxResilienceJob
  >();

  async createOrGetJob(input: KlyxCreateJobInput): Promise<KlyxCreateJobResult> {
    const indexKey = `${input.jobType}::${input.idempotencyKey}`;
    const existingId = this.idempotencyIndex.get(indexKey);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (!existing) {
        throw new Error("KLYX_RESILIENCE_MEMORY_INDEX_CORRUPT");
      }
      if (existing.requestFingerprint !== input.requestFingerprint) {
        return { kind: "conflict", job: clone(existing) };
      }
      return { kind: "existing", job: clone(existing) };
    }

    this.jobSequence += 1;
    const id = `job_${this.jobSequence}`;
    const job: KlyxResilienceJob = {
      id,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      payload: clone(input.payload),
      status: "queued",
      priority: input.priority,
      availableAtMs: input.availableAtMs,
      attemptCount: 0,
      retryPolicy: { ...input.retryPolicy },
      replayMode: input.replayMode,
      lease: null,
      lastErrorCode: null,
      resultRef: null,
      lastAck: null,
      parentJobId: input.parentJobId ?? null,
      redriveReasonCode: input.redriveReasonCode ?? null,
      version: 1,
      createdAtMs: input.availableAtMs,
      updatedAtMs: input.availableAtMs,
    };
    this.jobs.set(id, clone(job));
    this.idempotencyIndex.set(indexKey, id);
    return { kind: "created", job: clone(job) };
  }

  async getJob(jobId: string): Promise<KlyxResilienceJob | null> {
    const job = this.jobs.get(jobId);
    return job ? clone(job) : null;
  }

  async saveJob(
    job: KlyxResilienceJob,
    expectedVersion: number
  ): Promise<KlyxResilienceJob> {
    let current = this.jobs.get(job.id);
    if (!current) {
      throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
    }
    const injected = this.concurrentMutationOnNextSave.get(job.id);
    if (injected) {
      this.concurrentMutationOnNextSave.delete(job.id);
      const changed = injected(clone(current));
      current = {
        ...clone(changed),
        id: current.id,
        jobType: current.jobType,
        idempotencyKey: current.idempotencyKey,
        requestFingerprint: current.requestFingerprint,
        version: current.version + 1,
      };
      this.jobs.set(job.id, clone(current));
      throw new KlyxResilienceConcurrentMutationError();
    }
    if (current.version !== expectedVersion) {
      throw new KlyxResilienceConcurrentMutationError();
    }
    const saved: KlyxResilienceJob = {
      ...clone(job),
      version: expectedVersion + 1,
    };
    this.jobs.set(saved.id, clone(saved));
    return clone(saved);
  }

  async claimDueJobs(input: KlyxClaimJobsInput): Promise<KlyxResilienceJob[]> {
    const allowedTypes = input.jobTypes ? new Set(input.jobTypes) : null;
    const candidates = [...this.jobs.values()]
      .filter(
        (job) =>
          (job.status === "queued" || job.status === "retry_wait") &&
          job.availableAtMs <= input.nowMs &&
          (!allowedTypes || allowedTypes.has(job.jobType))
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.availableAtMs !== b.availableAtMs) {
          return a.availableAtMs - b.availableAtMs;
        }
        return a.id.localeCompare(b.id);
      })
      .slice(0, input.limit);

    const claimed: KlyxResilienceJob[] = [];
    for (const candidate of candidates) {
      const current = this.jobs.get(candidate.id);
      if (
        !current ||
        (current.status !== "queued" && current.status !== "retry_wait") ||
        current.availableAtMs > input.nowMs
      ) {
        continue;
      }
      this.leaseSequence += 1;
      const next: KlyxResilienceJob = {
        ...clone(current),
        status: "running",
        attemptCount: current.attemptCount + 1,
        lease: {
          token: `lease_${this.leaseSequence}`,
          workerId: input.workerId,
          expiresAtMs: input.nowMs + input.leaseMs,
          generation: (current.lease?.generation ?? 0) + 1,
        },
        version: current.version + 1,
        updatedAtMs: input.nowMs,
      };
      this.jobs.set(next.id, clone(next));
      claimed.push(clone(next));
    }
    return claimed;
  }

  async listJobs(statuses?: KlyxResilienceJobStatus[]): Promise<KlyxResilienceJob[]> {
    const allowed = statuses ? new Set(statuses) : null;
    return [...this.jobs.values()]
      .filter((job) => !allowed || allowed.has(job.status))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(clone);
  }

  async putInboundEvent(
    event: KlyxInboundEvent
  ): Promise<KlyxInboundEventPutResult> {
    const key = `${event.source}::${event.eventId}`;
    const existing = this.inboundEvents.get(key);
    if (!existing) {
      this.inboundEvents.set(key, clone(event));
      return { kind: "created", event: clone(event) };
    }
    if (existing.fingerprint === event.fingerprint) {
      return { kind: "duplicate", event: clone(existing) };
    }
    return {
      kind: "conflict",
      event: clone(event),
      existing: clone(existing),
    };
  }

  async appendAudit(
    event: Omit<KlyxResilienceAuditEvent, "id">
  ): Promise<KlyxResilienceAuditEvent> {
    this.auditSequence += 1;
    const saved: KlyxResilienceAuditEvent = {
      ...clone(event),
      id: `audit_${this.auditSequence}`,
    };
    this.auditEvents.push(saved);
    return clone(saved);
  }

  async listAudit(jobId?: string): Promise<KlyxResilienceAuditEvent[]> {
    return this.auditEvents
      .filter((event) => !jobId || event.jobId === jobId)
      .map(clone);
  }

  injectConcurrentMutationOnNextSave(
    jobId: string,
    mutate: (job: KlyxResilienceJob) => KlyxResilienceJob
  ): void {
    this.concurrentMutationOnNextSave.set(jobId, mutate);
  }

  async simulateConcurrentMutation(
    jobId: string,
    mutate: (job: KlyxResilienceJob) => KlyxResilienceJob
  ): Promise<KlyxResilienceJob> {
    const current = this.jobs.get(jobId);
    if (!current) throw new Error("KLYX_RESILIENCE_JOB_NOT_FOUND");
    const changed = mutate(clone(current));
    const saved: KlyxResilienceJob = {
      ...clone(changed),
      id: current.id,
      jobType: current.jobType,
      idempotencyKey: current.idempotencyKey,
      requestFingerprint: current.requestFingerprint,
      version: current.version + 1,
    };
    this.jobs.set(jobId, clone(saved));
    return clone(saved);
  }

  async listInboundEvents(): Promise<KlyxInboundEvent[]> {
    return [...this.inboundEvents.values()].map(clone);
  }
}
