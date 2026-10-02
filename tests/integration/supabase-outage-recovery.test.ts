import { describe, expect, it } from "vitest";

import { createFakeDurableOrchestrationRuntime } from "@/lib/durable-orchestration-fakes";

describe("KLYX Supabase outage recovery", () => {
  it("retries a transient Supabase outage and applies the domain effect exactly once", async () => {
    const runtime = createFakeDurableOrchestrationRuntime();
    const { workflow } = await runtime.orchestrator.startWorkflow({
      creationKey: "supabase-outage:create",
      accountId: "supabase-outage-account",
      profileId: "supabase-outage-profile",
      mode: "DEMANDER",
      conversationId: "supabase-outage-conversation",
      browserSessionId: "supabase-outage-browser",
      llmModel: "cert-model",
    });

    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "supabase-outage:comprehension",
      command: { kind: "advance", to: "comprehension" },
    });
    await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "supabase-outage:plan",
      command: { kind: "advance", to: "plan" },
    });

    runtime.supabase.failNext("market_search", "retryable_before_apply");

    const requested = await runtime.orchestrator.dispatch({
      workflowId: workflow.id,
      idempotencyKey: "supabase-outage:search",
      command: { kind: "request_action", action: "market_search" },
    });
    const actionId = requested.workflow.pendingAction?.actionId;
    expect(actionId).toBeTruthy();

    await runtime.orchestrator.runWorkerOnce({ workerId: "supabase-outage-worker-1" });
    expect(runtime.supabase.effectMutations(actionId!)).toBe(0);

    runtime.clock.advance(1_000);
    await runtime.orchestrator.runWorkerOnce({ workerId: "supabase-outage-worker-2" });

    const recovered = await runtime.orchestrator.getWorkflow(workflow.id);
    expect(recovered.step).toBe("search");
    expect(runtime.supabase.effectAttempts(actionId!)).toBe(2);
    expect(runtime.supabase.effectMutations(actionId!)).toBe(1);
  });
});
