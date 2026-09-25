import { describe, expect, it } from "vitest";

import { KlyxResilienceEngine } from "@/lib/resilience-engine";
import {
  InMemoryKlyxResilienceStore,
  ManualKlyxResilienceClock,
} from "@/lib/resilience-memory-adapter";

async function claimOne(engine: KlyxResilienceEngine) {
  const [job] = await engine.claim({ workerId: "worker-1", leaseMs: 10 });
  if (!job?.lease) throw new Error("missing lease");
  return job;
}

describe("KLYX resilience fail-closed boundaries", () => {
  it("never lets an expired worker execute or fail work blindly", async () => {
    const clock = new ManualKlyxResilienceClock(10_000);
    const store = new InMemoryKlyxResilienceStore();
    let executorCalls = 0;
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      executors: {
        "mock.stale": async () => {
          executorCalls += 1;
          return { kind: "success", resultRef: "should-not-run" };
        },
      },
      recoveryHandlers: {
        "mock.stale": async ({ trigger }) => ({
          kind: "unknown",
          reasonCode: `unprovable_${trigger}`,
        }),
      },
    });

    await engine.enqueue({
      jobType: "mock.stale",
      idempotencyKey: "stale-execution",
    });
    const staleExecution = await claimOne(engine);
    clock.advance(11);
    const execution = await engine.executeClaim({
      job: staleExecution,
      workerId: "worker-1",
      leaseToken: staleExecution.lease!.token,
    });
    expect(executorCalls).toBe(0);
    expect(execution.outcome).toBe("human_review");
    expect(execution.job.lastErrorCode).toBe("UNPROVABLE_STALE_CLAIM");

    await engine.enqueue({
      jobType: "mock.stale",
      idempotencyKey: "stale-failure",
    });
    const staleFailure = await claimOne(engine);
    clock.advance(11);
    const failure = await engine.fail(
      staleFailure.id,
      "worker-1",
      staleFailure.lease!.token,
      "transient_error",
      "retryable"
    );
    expect(failure.outcome).toBe("human_review");
    expect(failure.job.status).toBe("human_review");
  });

  it("treats executor throws as unknown external state, never automatic retry", async () => {
    const clock = new ManualKlyxResilienceClock(20_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      executors: {
        "mock.throw": async () => {
          throw new Error("connection lost after send");
        },
      },
      recoveryHandlers: {
        "mock.throw": async ({ trigger, reasonCode }) => {
          expect(trigger).toBe("unknown_external_state");
          expect(reasonCode).toBe("EXECUTOR_THROW_UNKNOWN_STATE");
          return {
            kind: "unknown",
            reasonCode: "external_side_effect_unprovable",
          };
        },
      },
    });

    await engine.enqueue({
      jobType: "mock.throw",
      idempotencyKey: "throw-1",
    });
    const job = await claimOne(engine);
    const result = await engine.executeClaim({
      job,
      workerId: "worker-1",
      leaseToken: job.lease!.token,
    });

    expect(result.outcome).toBe("human_review");
    expect(result.job.status).toBe("human_review");
    expect(result.job.lastErrorCode).toBe("EXTERNAL_SIDE_EFFECT_UNPROVABLE");
  });
});
