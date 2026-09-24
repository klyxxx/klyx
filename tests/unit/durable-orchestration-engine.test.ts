import { describe, expect, it } from "vitest";

import {
  KLYX_DEMANDER_STEPS,
  KLYX_GAGNER_STEPS,
  KlyxOrchestrationConcurrentMutationError,
  KlyxOrchestrationIdempotencyConflictError,
  type KlyxOrchestrationActionKind,
  type KlyxOrchestrationStep,
} from "@/lib/durable-orchestration-engine";
import {
  createFakeDurableOrchestrationRuntime,
  recreateFakeDurableOrchestrationRuntime,
  type FakeDurableOrchestrationRuntime,
} from "@/lib/durable-orchestration-fakes";

async function start(
  runtime: FakeDurableOrchestrationRuntime,
  mode: "DEMANDER" | "GAGNER",
  suffix = "1"
) {
  return runtime.orchestrator.startWorkflow({
    creationKey: `create:${mode}:${suffix}`,
    accountId: `account_${suffix}`,
    profileId: `profile_${suffix}`,
    mode,
    conversationId: `conversation_${suffix}`,
    browserSessionId: `browser_${suffix}`,
    llmModel: "model-a",
  });
}

async function advance(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  key: string,
  to: KlyxOrchestrationStep,
  factsPatch?: Record<string, string | number | boolean | null>
) {
  return runtime.orchestrator.dispatch({
    workflowId,
    idempotencyKey: key,
    command:
      factsPatch === undefined
        ? { kind: "advance", to }
        : { kind: "advance", to, factsPatch },
  });
}

async function action(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  key: string,
  kind: KlyxOrchestrationActionKind,
  payload: Record<string, string | number | boolean | null> = {}
) {
  const requested = await runtime.orchestrator.dispatch({
    workflowId,
    idempotencyKey: key,
    command: { kind: "request_action", action: kind, payload },
  });
  const actionId = requested.workflow.pendingAction?.actionId;
  expect(actionId).toBeTruthy();
  await runtime.orchestrator.runWorkerOnce({ workerId: `worker:${key}` });
  return {
    actionId: actionId!,
    workflow: await runtime.orchestrator.getWorkflow(workflowId),
  };
}

describe("durable KLYX orchestration engine", () => {
  it("uses the exact deterministic DEMANDER and GAGNER lifecycle boundaries", () => {
    expect(KLYX_DEMANDER_STEPS).toEqual([
      "intention",
      "comprehension",
      "plan",
      "search",
      "matching",
      "quote",
      "confirmation",
      "booking",
      "payment",
      "mission",
      "tracking",
      "incident",
      "refund_replacement",
      "closure",
    ]);
    expect(KLYX_GAGNER_STEPS).toEqual([
      "skill",
      "opportunities",
      "eligibility",
      "proposal",
      "acceptance",
      "mission",
      "completion",
      "settlement",
    ]);
  });

  it("prevents direct bypass of action-controlled boundaries", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "a1", "comprehension");
    await advance(runtime, workflow.id, "a2", "plan");

    await expect(
      advance(runtime, workflow.id, "illegal", "search")
    ).rejects.toThrow("KLYX_ORCHESTRATION_DIRECT_TRANSITION_FORBIDDEN");

    const searched = await action(
      runtime,
      workflow.id,
      "search",
      "market_search"
    );
    expect(searched.workflow.step).toBe("search");
  });

  it("keeps workflow truth after browser close and process recreation", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "a1", "comprehension", {
      normalizedNeed: "move-home",
    });
    const restarted = recreateFakeDurableOrchestrationRuntime(runtime);
    const recovered = await restarted.orchestrator.getWorkflow(workflow.id);

    expect(recovered.step).toBe("comprehension");
    expect(recovered.facts.normalizedNeed).toBe("move-home");
    expect(recovered.interfaceContext.browserSessionId).toBe("browser_1");
  });

  it("allows conversation deletion/rebind without deleting workflow truth", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "facts",
      command: {
        kind: "record_facts",
        factsPatch: { confirmedBudgetMinor: 12000, currency: "EUR" },
      },
    });
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "conversation-delete",
      command: {
        kind: "set_interface_context",
        conversationId: null,
        browserSessionId: null,
      },
    });
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "conversation-rebind",
      command: {
        kind: "set_interface_context",
        conversationId: "conversation_rebound",
        browserSessionId: "browser_new",
      },
    });
    const current = await runtime.orchestrator.getWorkflow(workflow.id);
    expect(current.interfaceContext.conversationId).toBe("conversation_rebound");
    expect(current.facts.confirmedBudgetMinor).toBe(12000);
    expect(current.facts.currency).toBe("EUR");
  });

  it("changes LLM model without changing canonical business facts or step", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "facts",
      command: {
        kind: "record_facts",
        factsPatch: { quoteSnapshot: { amountMinor: 9900, currency: "EUR" } },
      },
    });
    const before = await runtime.orchestrator.getWorkflow(workflow.id);
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "model-switch",
      command: { kind: "set_interface_context", llmModel: "model-b" },
    });
    const after = await runtime.orchestrator.getWorkflow(workflow.id);

    expect(after.interfaceContext.llmModel).toBe("model-b");
    expect(after.step).toBe(before.step);
    expect(after.facts).toEqual(before.facts);
  });

  it("replays an identical command without a second mutation", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    const first = await advance(runtime, workflow.id, "same-click", "comprehension");
    const second = await advance(runtime, workflow.id, "same-click", "comprehension");

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.workflow.version).toBe(first.workflow.version);
    const current = await runtime.orchestrator.getWorkflow(workflow.id);
    expect(current.version).toBe(first.workflow.version);
  });

  it("rejects the same idempotency key with a different command", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "same-key", "comprehension");
    await expect(
      runtime.orchestrator.dispatch({
        workflowId: workflow.id,
        idempotencyKey: "same-key",
        command: { kind: "record_facts", factsPatch: { x: 1 } },
      })
    ).rejects.toBeInstanceOf(KlyxOrchestrationIdempotencyConflictError);
  });

  it("fences concurrent workflow mutations by version", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    runtime.supabase.injectVersionConflict(workflow.id);
    await expect(
      runtime.orchestrator.dispatch({
        workflowId: workflow.id,
        idempotencyKey: "concurrent",
        expectedVersion: workflow.version,
        command: { kind: "advance", to: "comprehension" },
      })
    ).rejects.toBeInstanceOf(KlyxOrchestrationConcurrentMutationError);
  });

  it("recovers a worker crash after lease expiry without losing the pending action", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "a1", "comprehension");
    await advance(runtime, workflow.id, "a2", "plan");
    const request = await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "search-request",
      command: { kind: "request_action", action: "market_search" },
    });
    const actionId = request.workflow.pendingAction!.actionId;
    await runtime.orchestrator.ensurePendingActionEnqueued(workflow.id);
    const claimed = await runtime.resilience.claim({
      workerId: "worker-that-crashes",
      leaseMs: 1_000,
      jobTypes: ["orchestration.action"],
    });
    expect(claimed).toHaveLength(1);

    runtime.clock.advance(1_001);
    const restarted = recreateFakeDurableOrchestrationRuntime(runtime);
    const recovery = await restarted.orchestrator.runWorkerOnce({
      workerId: "worker-after-restart",
      leaseMs: 1_000,
    });
    expect(recovery.recovered).toBe(1);

    restarted.clock.advance(1_000);
    await restarted.orchestrator.runWorkerOnce({
      workerId: "worker-after-backoff",
      leaseMs: 1_000,
    });
    const current = await restarted.orchestrator.getWorkflow(workflow.id);
    expect(current.step).toBe("search");
    expect(runtime.supabase.effectMutations(actionId)).toBe(1);
  });

  it("proves an applied external effect after unknown state and never mutates twice", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "a1", "comprehension");
    await advance(runtime, workflow.id, "a2", "plan");
    runtime.supabase.failNext("market_search", "apply_then_unknown");
    const result = await action(
      runtime,
      workflow.id,
      "search-request",
      "market_search"
    );
    expect(result.workflow.step).toBe("search");
    expect(runtime.supabase.effectMutations(result.actionId)).toBe(1);
    await runtime.orchestrator.runWorkerOnce({ workerId: "replay-worker" });
    expect(runtime.supabase.effectMutations(result.actionId)).toBe(1);
  });

  it("retries a failed fake Stripe payment and captures it only once", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "a1", "comprehension");
    await advance(runtime, workflow.id, "a2", "plan");
    await action(runtime, workflow.id, "search", "market_search");
    await action(runtime, workflow.id, "matching", "matching_compute");
    await action(runtime, workflow.id, "quote", "quote_generate");
    await advance(runtime, workflow.id, "confirm", "confirmation");
    await action(runtime, workflow.id, "booking", "booking_create");

    runtime.stripe.failNext("payment_capture", "retryable_before_apply");
    const requested = await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "payment",
      command: { kind: "request_action", action: "payment_capture" },
    });
    const actionId = requested.workflow.pendingAction!.actionId;
    await runtime.orchestrator.runWorkerOnce({ workerId: "pay-worker-1" });
    expect((await runtime.orchestrator.getWorkflow(workflow.id)).step).toBe("booking");
    runtime.clock.advance(1_000);
    await runtime.orchestrator.runWorkerOnce({ workerId: "pay-worker-2" });

    const current = await runtime.orchestrator.getWorkflow(workflow.id);
    expect(current.step).toBe("payment");
    expect(runtime.stripe.effectAttempts(actionId)).toBe(2);
    expect(runtime.stripe.effectMutations(actionId)).toBe(1);
  });

  it("blocks beneficiary settlement when latest canonical eligibility becomes blocked", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "GAGNER");
    await action(runtime, workflow.id, "opp", "opportunity_discover");
    await action(runtime, workflow.id, "eligibility", "eligibility_check");
    await action(runtime, workflow.id, "proposal", "proposal_create");
    await advance(runtime, workflow.id, "accept", "acceptance");
    await action(runtime, workflow.id, "mission", "mission_accept");
    await action(runtime, workflow.id, "complete", "mission_complete");
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "eligibility-changed",
      command: {
        kind: "record_facts",
        factsPatch: {
          economicEligibility: {
            state: "blocked",
            allowed: false,
            reason: "beneficiary_ineligible",
          },
        },
      },
    });

    await expect(
      runtime.orchestrator.dispatch({
        workflowId: workflow.id,
        idempotencyKey: "settle",
        command: { kind: "request_action", action: "settlement_release" },
      })
    ).rejects.toThrow("KLYX_ORCHESTRATION_SETTLEMENT_ELIGIBILITY_REQUIRED");
    expect(runtime.stripe.effectMutations("settlement_release")).toBe(0);
    expect((await runtime.orchestrator.getWorkflow(workflow.id)).step).toBe(
      "completion"
    );
  });

  it("completes the full DEMANDER incident/refund/replacement-capable lifecycle", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "DEMANDER");
    await advance(runtime, workflow.id, "d1", "comprehension");
    await advance(runtime, workflow.id, "d2", "plan");
    await action(runtime, workflow.id, "d3", "market_search");
    await action(runtime, workflow.id, "d4", "matching_compute");
    await action(runtime, workflow.id, "d5", "quote_generate");
    await advance(runtime, workflow.id, "d6", "confirmation");
    await action(runtime, workflow.id, "d7", "booking_create");
    await action(runtime, workflow.id, "d8", "payment_capture");
    await action(runtime, workflow.id, "d9", "mission_start");
    await action(runtime, workflow.id, "d10", "tracking_start");
    await action(runtime, workflow.id, "d11", "incident_open");
    await action(runtime, workflow.id, "d12", "refund_issue");
    const closed = await advance(runtime, workflow.id, "d13", "closure");

    expect(closed.workflow.step).toBe("closure");
    expect(closed.workflow.status).toBe("completed");
    expect(closed.workflow.facts.payment).toMatchObject({ status: "succeeded" });
    expect(closed.workflow.facts.refund).toMatchObject({ status: "refunded" });
  });

  it("completes the full GAGNER lifecycle including explicit completion before settlement", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await start(runtime, "GAGNER");
    await action(runtime, workflow.id, "g1", "opportunity_discover");
    await action(runtime, workflow.id, "g2", "eligibility_check");
    await action(runtime, workflow.id, "g3", "proposal_create");
    await advance(runtime, workflow.id, "g4", "acceptance");
    await action(runtime, workflow.id, "g5", "mission_accept");
    const completed = await action(runtime, workflow.id, "g6", "mission_complete");
    expect(completed.workflow.step).toBe("completion");
    const settled = await action(runtime, workflow.id, "g7", "settlement_release");

    expect(settled.workflow.step).toBe("settlement");
    expect(settled.workflow.status).toBe("completed");
    expect(settled.workflow.facts.settlement).toMatchObject({ status: "released" });
  });
});
