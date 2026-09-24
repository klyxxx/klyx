import { describe, expect, it } from "vitest";

import {
  KlyxResilienceEngine,
  computeKlyxExponentialBackoffMs,
  type KlyxResilienceEngineOptions,
} from "@/lib/resilience-engine";
import {
  InMemoryKlyxResilienceStore,
  ManualKlyxResilienceClock,
} from "@/lib/resilience-memory-adapter";

function setup(
  extra: Partial<Omit<KlyxResilienceEngineOptions, "store" | "clock">> = {}
) {
  const clock = new ManualKlyxResilienceClock(1_000_000);
  const store = new InMemoryKlyxResilienceStore();
  const engine = new KlyxResilienceEngine({
    store,
    clock,
    defaultRetryPolicy: {
      maxAttempts: 3,
      backoffBaseMs: 1_000,
      backoffMaxMs: 8_000,
    },
    defaultLeaseMs: 100,
    defaultExecutionTimeoutMs: 5,
    ...extra,
  });
  return { clock, store, engine };
}

async function claimOne(
  engine: KlyxResilienceEngine,
  workerId = "worker-1"
) {
  const [job] = await engine.claim({ workerId });
  expect(job).toBeDefined();
  if (!job?.lease) throw new Error("test claim missing lease");
  return job;
}

describe("KLYX pure resilience engine", () => {
  it("deduplicates double click/action replay and rejects conflicting idempotency reuse", async () => {
    const { engine } = setup();
    const first = await engine.enqueue({
      jobType: "booking.confirm",
      idempotencyKey: "click:123",
      payload: { bookingId: "b1" },
    });
    const second = await engine.enqueue({
      jobType: "booking.confirm",
      idempotencyKey: "click:123",
      payload: { bookingId: "b1" },
    });

    expect(first.created).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.job.id).toBe(first.job.id);

    await expect(
      engine.enqueue({
        jobType: "booking.confirm",
        idempotencyKey: "click:123",
        payload: { bookingId: "b2" },
      })
    ).rejects.toThrow("KLYX_RESILIENCE_IDEMPOTENCY_CONFLICT");
  });

  it("uses deterministic exponential backoff, bounded retries, poison DLQ and explicit redrive", async () => {
    expect(
      computeKlyxExponentialBackoffMs(4, {
        maxAttempts: 10,
        backoffBaseMs: 1_000,
        backoffMaxMs: 5_000,
      })
    ).toBe(5_000);

    const { clock, engine } = setup();
    await engine.enqueue({
      jobType: "mock.transient",
      idempotencyKey: "retry-1",
      retryPolicy: { maxAttempts: 2 },
    });
    const first = await claimOne(engine);
    const retry = await engine.fail(
      first.id,
      "worker-1",
      first.lease!.token,
      "temporary_failure"
    );
    expect(retry.outcome).toBe("retry_scheduled");
    expect(retry.job.availableAtMs).toBe(1_001_000);

    clock.advance(1_000);
    const second = await claimOne(engine);
    const exhausted = await engine.fail(
      second.id,
      "worker-1",
      second.lease!.token,
      "temporary_failure"
    );
    expect(exhausted.outcome).toBe("dead_lettered");

    await engine.enqueue({
      jobType: "mock.poison",
      idempotencyKey: "poison-1",
    });
    const poison = await claimOne(engine);
    const poisonResult = await engine.fail(
      poison.id,
      "worker-1",
      poison.lease!.token,
      "malformed_payload",
      "poison_job"
    );
    expect(poisonResult.outcome).toBe("dead_lettered");

    const redrive = await engine.redriveDeadLetter({
      jobId: poison.id,
      newIdempotencyKey: "poison-redrive-1",
      reasonCode: "fixture_corrected",
    });
    expect(redrive.created).toBe(true);
    expect(redrive.job.parentJobId).toBe(poison.id);
    expect(redrive.job.redriveReasonCode).toBe("FIXTURE_CORRECTED");
    expect((await engine.listDeadLetters()).length).toBeGreaterThanOrEqual(2);
  });

  it("recovers worker crash/restart and fences stale claims", async () => {
    const clock = new ManualKlyxResilienceClock(1_000_000);
    const store = new InMemoryKlyxResilienceStore();
    const beforeCrash = new KlyxResilienceEngine({
      store,
      clock,
      defaultLeaseMs: 100,
    });
    await beforeCrash.enqueue({
      jobType: "mock.safe",
      idempotencyKey: "crash-1",
      replayMode: "safe_idempotent_replay",
    });
    const stale = await claimOne(beforeCrash, "worker-before-crash");

    clock.advance(101);
    const afterRestart = new KlyxResilienceEngine({
      store,
      clock,
      defaultLeaseMs: 100,
    });
    const recovered = await afterRestart.recoverExpiredClaims();
    expect(recovered[0]?.outcome).toBe("retry_scheduled");

    await expect(
      afterRestart.extendLease({
        jobId: stale.id,
        workerId: "worker-before-crash",
        leaseToken: stale.lease!.token,
      })
    ).rejects.toThrow();

    clock.advance(1_000);
    const [reclaimed] = await afterRestart.claim({ workerId: "worker-after-restart" });
    expect(reclaimed.lease?.workerId).toBe("worker-after-restart");
    expect(reclaimed.attemptCount).toBe(2);
  });

  it("never blindly retries timeout or unknown external state", async () => {
    const { engine } = setup({
      executors: {
        "mock.timeout": async () => new Promise(() => undefined),
      },
      recoveryHandlers: {
        "mock.timeout": async () => ({
          kind: "unknown",
          reasonCode: "external_state_unprovable",
        }),
      },
    });
    await engine.enqueue({
      jobType: "mock.timeout",
      idempotencyKey: "timeout-1",
    });
    const job = await claimOne(engine);
    const result = await engine.executeClaim({
      job,
      workerId: "worker-1",
      leaseToken: job.lease!.token,
      timeoutMs: 2,
    });

    expect(result.outcome).toBe("human_review");
    expect(result.job.lastErrorCode).toBe("EXTERNAL_STATE_UNPROVABLE");
  });

  it("accepts delayed webhook once, deduplicates repeats, detects conflicts, and recovers absence", async () => {
    const clock = new ManualKlyxResilienceClock(2_000_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      inboundEventHandlers: {
        "mock.completed": async () => ({
          kind: "proved_succeeded",
          reasonCode: "webhook_proves_completion",
          resultRef: "external-42",
        }),
      },
      recoveryHandlers: {
        "mock.waiting": async ({ trigger }) => {
          expect(trigger).toBe("webhook_absent");
          return {
            kind: "proved_not_applied",
            reasonCode: "provider_has_no_operation",
          };
        },
      },
    });

    const delayed = await engine.enqueue({
      jobType: "mock.webhook",
      idempotencyKey: "webhook-1",
    });
    const event = {
      source: "mock-provider",
      eventId: "evt-1",
      eventType: "mock.completed",
      jobId: delayed.job.id,
      occurredAtMs: 1_000_000,
      payload: { status: "done" } as const,
    };
    const first = await engine.ingestInboundEvent(event);
    const duplicate = await engine.ingestInboundEvent(event);
    expect(first.job.status).toBe("succeeded");
    expect(duplicate.disposition).toBe("duplicate");

    const conflict = await engine.ingestInboundEvent({
      ...event,
      payload: { status: "failed" },
    });
    expect(conflict.disposition).toBe("human_review");

    const waiting = await engine.enqueue({
      jobType: "mock.waiting",
      idempotencyKey: "missing-webhook",
    });
    const notDue = await engine.recoverMissingWebhook({
      jobId: waiting.job.id,
      expectedByMs: 2_000_100,
    });
    expect(notDue.outcome).toBe("not_due");
    clock.advance(101);
    const absent = await engine.recoverMissingWebhook({
      jobId: waiting.job.id,
      expectedByMs: 2_000_100,
    });
    expect(absent.outcome).toBe("retry_scheduled");
  });

  it("reconciles ambiguous external execution when evidence proves success", async () => {
    let executions = 0;
    const { engine } = setup({
      executors: {
        "mock.ambiguous": async () => {
          executions += 1;
          return {
            kind: "unknown_external_state",
            errorCode: "connection_lost_after_send",
          };
        },
      },
      recoveryHandlers: {
        "mock.ambiguous": async () => ({
          kind: "proved_succeeded",
          reasonCode: "external_lookup_found_operation",
          resultRef: "operation-1",
        }),
      },
    });
    await engine.enqueue({
      jobType: "mock.ambiguous",
      idempotencyKey: "ambiguous-1",
    });
    const job = await claimOne(engine);
    const result = await engine.executeClaim({
      job,
      workerId: "worker-1",
      leaseToken: job.lease!.token,
    });
    expect(executions).toBe(1);
    expect(result.outcome).toBe("succeeded");
    expect(result.job.resultRef).toBe("operation-1");
  });

  it("escalates concurrent mutation to human_review and makes identical completion replay idempotent", async () => {
    const { engine, store } = setup();
    await engine.enqueue({
      jobType: "mock.concurrent",
      idempotencyKey: "concurrent-1",
    });
    const concurrent = await claimOne(engine);
    store.injectConcurrentMutationOnNextSave(concurrent.id, (current) => ({
      ...current,
      lastErrorCode: "OTHER_WORKER_TOUCHED_STATE",
    }));
    const conflict = await engine.complete(
      concurrent.id,
      "worker-1",
      concurrent.lease!.token,
      "result-1"
    );
    expect(conflict.outcome).toBe("human_review");
    expect(conflict.job.lastErrorCode).toBe("COMPLETE_CONCURRENT_MUTATION");

    await engine.enqueue({
      jobType: "mock.replay",
      idempotencyKey: "ack-1",
    });
    const replayable = await claimOne(engine);
    const first = await engine.complete(
      replayable.id,
      "worker-1",
      replayable.lease!.token,
      "result-2"
    );
    const replay = await engine.complete(
      replayable.id,
      "worker-1",
      replayable.lease!.token,
      "result-2"
    );
    expect(first.outcome).toBe("succeeded");
    expect(replay.outcome).toBe("replayed");
  });
});
