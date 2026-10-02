import { describe, expect, it } from "vitest";

import {
  KlyxResilienceEngine,
  type KlyxExecutionResult,
} from "@/lib/resilience-engine";
import {
  InMemoryKlyxResilienceStore,
  ManualKlyxResilienceClock,
} from "@/lib/resilience-memory-adapter";

async function claimOne(engine: KlyxResilienceEngine, workerId = "cert-worker") {
  const [job] = await engine.claim({ workerId, limit: 1 });
  expect(job).toBeDefined();
  expect(job?.lease).toBeTruthy();
  return job!;
}

function transientProviderHarness(provider: string) {
  const clock = new ManualKlyxResilienceClock(10_000);
  const store = new InMemoryKlyxResilienceStore();
  let calls = 0;
  const jobType = `provider.${provider}`;
  const executor = async (): Promise<KlyxExecutionResult> => {
    calls += 1;
    if (calls === 1) {
      return { kind: "retryable_failure", errorCode: `${provider}_unavailable` };
    }
    return { kind: "success", resultRef: `${provider}-receipt` };
  };
  const engine = new KlyxResilienceEngine({
    store,
    clock,
    defaultRetryPolicy: {
      maxAttempts: 3,
      backoffBaseMs: 1_000,
      backoffMaxMs: 4_000,
    },
    executors: { [jobType]: executor },
  });
  return { clock, engine, jobType, calls: () => calls };
}

describe("KLYX all-provider automatic recovery certification", () => {
  for (const provider of ["openai", "stripe", "twilio", "sumsub", "resend"] as const) {
    it(`automatically retries transient ${provider} outage before human escalation`, async () => {
      const harness = transientProviderHarness(provider);
      await harness.engine.enqueue({
        jobType: harness.jobType,
        idempotencyKey: `${provider}:transient:1`,
        replayMode: provider === "openai" ? "safe_idempotent_replay" : "prove_before_replay",
      });

      const first = await claimOne(harness.engine);
      const firstResult = await harness.engine.executeClaim({
        job: first,
        workerId: "cert-worker",
        leaseToken: first.lease!.token,
      });
      expect(firstResult.outcome).toBe("retry_scheduled");
      expect(firstResult.job.status).not.toBe("human_review");

      harness.clock.advance(1_000);
      const second = await claimOne(harness.engine);
      const secondResult = await harness.engine.executeClaim({
        job: second,
        workerId: "cert-worker",
        leaseToken: second.lease!.token,
      });
      expect(secondResult.outcome).toBe("succeeded");
      expect(harness.calls()).toBe(2);
      expect((await harness.engine.listHumanReview()).length).toBe(0);
    });
  }

  it("deduplicates double click and action replay", async () => {
    const clock = new ManualKlyxResilienceClock(20_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({ store, clock });

    const first = await engine.enqueue({
      jobType: "booking.confirm",
      idempotencyKey: "double-click:booking-1",
      payload: { bookingId: "booking-1" },
    });
    const replay = await engine.enqueue({
      jobType: "booking.confirm",
      idempotencyKey: "double-click:booking-1",
      payload: { bookingId: "booking-1" },
    });

    expect(first.created).toBe(true);
    expect(replay.duplicate).toBe(true);
    expect(replay.job.id).toBe(first.job.id);
  });

  it("recovers worker crash automatically from an expired lease", async () => {
    const clock = new ManualKlyxResilienceClock(30_000);
    const store = new InMemoryKlyxResilienceStore();
    const before = new KlyxResilienceEngine({ store, clock, defaultLeaseMs: 100 });
    await before.enqueue({
      jobType: "provider.openai",
      idempotencyKey: "worker-crash:1",
      replayMode: "safe_idempotent_replay",
    });
    await claimOne(before, "worker-before-crash");

    clock.advance(101);
    const after = new KlyxResilienceEngine({ store, clock, defaultLeaseMs: 100 });
    const recovered = await after.recoverExpiredClaims();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.outcome).toBe("retry_scheduled");
    expect((await after.listHumanReview()).length).toBe(0);
  });

  it("accepts delayed webhooks once and rejects conflicting duplicates fail-closed", async () => {
    const clock = new ManualKlyxResilienceClock(40_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      inboundEventHandlers: {
        "provider.completed": async () => ({
          kind: "proved_succeeded",
          reasonCode: "provider_webhook_proves_success",
          resultRef: "provider-operation-1",
        }),
      },
    });
    const queued = await engine.enqueue({
      jobType: "provider.webhook",
      idempotencyKey: "delayed-webhook:1",
    });
    const event = {
      source: "provider",
      eventId: "evt-cert-1",
      eventType: "provider.completed",
      jobId: queued.job.id,
      occurredAtMs: 1_000,
      payload: { state: "done" } as const,
    };

    const first = await engine.ingestInboundEvent(event);
    const duplicate = await engine.ingestInboundEvent(event);
    const conflict = await engine.ingestInboundEvent({
      ...event,
      payload: { state: "different" },
    });

    expect(first.disposition).toBe("applied");
    expect(duplicate.disposition).toBe("duplicate");
    expect(conflict.disposition).toBe("human_review");
  });

  it("recovers an absent webhook automatically when external evidence proves no operation", async () => {
    const clock = new ManualKlyxResilienceClock(50_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      recoveryHandlers: {
        "provider.waiting": async ({ trigger }) => {
          expect(trigger).toBe("webhook_absent");
          return {
            kind: "proved_not_applied",
            reasonCode: "external_operation_absent",
          };
        },
      },
    });
    const queued = await engine.enqueue({
      jobType: "provider.waiting",
      idempotencyKey: "missing-webhook:1",
    });
    clock.advance(101);
    const result = await engine.recoverMissingWebhook({
      jobId: queued.job.id,
      expectedByMs: 50_100,
    });
    expect(result.outcome).toBe("retry_scheduled");
  });

  it("uses human review only when an ambiguous external state cannot be proven safely", async () => {
    const clock = new ManualKlyxResilienceClock(60_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      executors: {
        "provider.financial": async () => ({
          kind: "unknown_external_state",
          errorCode: "network_cut_after_send",
        }),
      },
      recoveryHandlers: {
        "provider.financial": async () => ({
          kind: "unknown",
          reasonCode: "external_state_unprovable",
        }),
      },
    });
    await engine.enqueue({
      jobType: "provider.financial",
      idempotencyKey: "ambiguous-financial:1",
      replayMode: "prove_before_replay",
    });
    const job = await claimOne(engine);
    const result = await engine.executeClaim({
      job,
      workerId: "cert-worker",
      leaseToken: job.lease!.token,
    });
    expect(result.outcome).toBe("human_review");
    expect(result.job.lastErrorCode).toBe("EXTERNAL_STATE_UNPROVABLE");
  });
});
