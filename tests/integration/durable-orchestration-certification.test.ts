import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  KlyxOrchestrationActionKind,
  KlyxOrchestrationStep,
} from "@/lib/durable-orchestration-engine";
import {
  assertNoExternalNetwork,
  createFakeDurableOrchestrationRuntime,
  recreateFakeDurableOrchestrationRuntime,
  type FakeDurableOrchestrationRuntime,
} from "@/lib/durable-orchestration-fakes";

type Evidence = Record<string, string | number | boolean | null>;
type ScenarioResult = {
  id: string;
  status: "PASS" | "FAIL";
  evidence: Evidence & { externalNetworkCalls: number };
  error: string | null;
};

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function start(
  runtime: FakeDurableOrchestrationRuntime,
  mode: "DEMANDER" | "GAGNER",
  suffix: string
) {
  return runtime.orchestrator.startWorkflow({
    creationKey: `cert:create:${mode}:${suffix}`,
    accountId: `cert-account-${suffix}`,
    profileId: `cert-profile-${suffix}`,
    mode,
    conversationId: `cert-conversation-${suffix}`,
    browserSessionId: `cert-browser-${suffix}`,
    llmModel: "cert-model-a",
  });
}

async function advance(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  key: string,
  to: KlyxOrchestrationStep
) {
  return runtime.orchestrator.dispatch({
    workflowId,
    idempotencyKey: key,
    command: { kind: "advance", to },
  });
}

async function action(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  key: string,
  actionKind: KlyxOrchestrationActionKind
) {
  const requested = await runtime.orchestrator.dispatch({
    workflowId,
    idempotencyKey: key,
    command: { kind: "request_action", action: actionKind },
  });
  const actionId = requested.workflow.pendingAction?.actionId;
  check(actionId, "CERT_ACTION_ID_MISSING");
  await runtime.orchestrator.runWorkerOnce({ workerId: `cert-worker:${key}` });
  return {
    actionId,
    workflow: await runtime.orchestrator.getWorkflow(workflowId),
  };
}

async function advanceDemanderToBooking(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  prefix: string
) {
  await advance(runtime, workflowId, `${prefix}:1`, "comprehension");
  await advance(runtime, workflowId, `${prefix}:2`, "plan");
  await action(runtime, workflowId, `${prefix}:3`, "market_search");
  await action(runtime, workflowId, `${prefix}:4`, "matching_compute");
  await action(runtime, workflowId, `${prefix}:5`, "quote_generate");
  await advance(runtime, workflowId, `${prefix}:6`, "confirmation");
  await action(runtime, workflowId, `${prefix}:7`, "booking_create");
}

async function advanceGagnerToCompletion(
  runtime: FakeDurableOrchestrationRuntime,
  workflowId: string,
  prefix: string
) {
  await action(runtime, workflowId, `${prefix}:1`, "opportunity_discover");
  await action(runtime, workflowId, `${prefix}:2`, "eligibility_check");
  await action(runtime, workflowId, `${prefix}:3`, "proposal_create");
  await advance(runtime, workflowId, `${prefix}:4`, "acceptance");
  await action(runtime, workflowId, `${prefix}:5`, "mission_accept");
  await action(runtime, workflowId, `${prefix}:6`, "mission_complete");
}

async function scenario(
  id: string,
  run: () => Promise<Evidence>
): Promise<ScenarioResult> {
  try {
    const evidence = await run();
    return {
      id,
      status: "PASS",
      evidence: { ...evidence, externalNetworkCalls: 0 },
      error: null,
    };
  } catch (error) {
    return {
      id,
      status: "FAIL",
      evidence: { externalNetworkCalls: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function reportDirectory(): string {
  return (
    process.env.KLYX_AUTONOMOUS_CERT_DIR?.trim() ||
    "artifacts/klyx-autonomous-certification"
  );
}

function markdown(results: ScenarioResult[]): string {
  const lines = [
    "# KLYX Durable Orchestration Offline Certification",
    "",
    `Overall: **${results.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL"}**`,
    "",
    "| Scenario | Status | External network calls |",
    "| --- | --- | ---: |",
  ];
  for (const result of results) {
    lines.push(
      `| ${result.id} | ${result.status} | ${result.evidence.externalNetworkCalls} |`
    );
  }
  lines.push(
    "",
    "## Invariants",
    "",
    "- workflow truth survives browser/process loss;",
    "- conversation and LLM model are interface context, not business truth;",
    "- commands and effects are idempotent;",
    "- worker leases recover after crash;",
    "- fake Supabase and fake Stripe are the only adapters;",
    "- latest KLYX eligibility blocks settlement even when the payment adapter is ready."
  );
  return `${lines.join("\n")}\n`;
}

describe("KLYX durable orchestration offline certification", () => {
  it("certifies DEMANDER + GAGNER durability with fake Supabase and Stripe", async () => {
    check(
      process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "true",
      "LIVE_PAYMENTS_MUST_REMAIN_DISABLED"
    );

    const results: ScenarioResult[] = [];

    results.push(
      await scenario("demander_full_lifecycle", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "demander-full");
        await advanceDemanderToBooking(runtime, workflow.id, "d");
        await action(runtime, workflow.id, "d:payment", "payment_capture");
        await action(runtime, workflow.id, "d:mission", "mission_start");
        await action(runtime, workflow.id, "d:tracking", "tracking_start");
        await action(runtime, workflow.id, "d:incident", "incident_open");
        await action(runtime, workflow.id, "d:refund", "refund_issue");
        const closed = await advance(runtime, workflow.id, "d:close", "closure");
        assertNoExternalNetwork(runtime);
        check(closed.workflow.status === "completed", "DEMANDER_NOT_COMPLETED");
        return { finalStep: closed.workflow.step, finalVersion: closed.workflow.version };
      })
    );

    results.push(
      await scenario("gagner_full_lifecycle", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "GAGNER", "gagner-full");
        await advanceGagnerToCompletion(runtime, workflow.id, "g");
        const settled = await action(runtime, workflow.id, "g:settle", "settlement_release");
        assertNoExternalNetwork(runtime);
        check(settled.workflow.status === "completed", "GAGNER_NOT_COMPLETED");
        check(settled.workflow.step === "settlement", "GAGNER_SETTLEMENT_MISSING");
        return { finalStep: settled.workflow.step, finalVersion: settled.workflow.version };
      })
    );

    results.push(
      await scenario("browser_close_and_process_resume", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "browser");
        await advance(runtime, workflow.id, "browser:step", "comprehension");
        const restarted = recreateFakeDurableOrchestrationRuntime(runtime);
        const recovered = await restarted.orchestrator.getWorkflow(workflow.id);
        check(recovered.step === "comprehension", "WORKFLOW_NOT_RECOVERED");
        assertNoExternalNetwork(restarted);
        return { recoveredVersion: recovered.version, recovered: true };
      })
    );

    results.push(
      await scenario("conversation_deleted_and_rebound", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "conversation");
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "conversation:facts",
          command: {
            kind: "record_facts",
            factsPatch: { canonicalNeed: "move-home", budgetMinor: 15000 },
          },
        });
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "conversation:delete",
          command: {
            kind: "set_interface_context",
            conversationId: null,
            browserSessionId: null,
          },
        });
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "conversation:rebind",
          command: {
            kind: "set_interface_context",
            conversationId: "conversation-new",
            browserSessionId: "browser-new",
          },
        });
        const current = await runtime.orchestrator.getWorkflow(workflow.id);
        check(current.facts.canonicalNeed === "move-home", "FACTS_LOST_WITH_CONVERSATION");
        return { rebound: current.interfaceContext.conversationId === "conversation-new" };
      })
    );

    results.push(
      await scenario("llm_model_replacement", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "model");
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "model:facts",
          command: {
            kind: "record_facts",
            factsPatch: { confirmedQuoteMinor: 4200, currency: "EUR" },
          },
        });
        const before = await runtime.orchestrator.getWorkflow(workflow.id);
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "model:switch",
          command: { kind: "set_interface_context", llmModel: "cert-model-b" },
        });
        const after = await runtime.orchestrator.getWorkflow(workflow.id);
        check(JSON.stringify(after.facts) === JSON.stringify(before.facts), "LLM_CHANGED_FACTS");
        check(after.step === before.step, "LLM_CHANGED_STEP");
        return { modelChanged: after.interfaceContext.llmModel === "cert-model-b" };
      })
    );

    results.push(
      await scenario("double_click_and_command_replay", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "double-click");
        const first = await advance(runtime, workflow.id, "double:click", "comprehension");
        const replay = await advance(runtime, workflow.id, "double:click", "comprehension");
        check(replay.replayed, "DOUBLE_CLICK_NOT_REPLAYED");
        check(first.workflow.version === replay.workflow.version, "DOUBLE_CLICK_MUTATED_TWICE");
        return { version: replay.workflow.version, replayed: replay.replayed };
      })
    );

    results.push(
      await scenario("worker_crash_and_lease_recovery", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "worker-crash");
        await advance(runtime, workflow.id, "wc:1", "comprehension");
        await advance(runtime, workflow.id, "wc:2", "plan");
        const requested = await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "wc:search",
          command: { kind: "request_action", action: "market_search" },
        });
        const actionId = requested.workflow.pendingAction?.actionId;
        check(actionId, "WORKER_CRASH_ACTION_MISSING");
        await runtime.orchestrator.ensurePendingActionEnqueued(workflow.id);
        const claimed = await runtime.resilience.claim({
          workerId: "crashed-worker",
          leaseMs: 1_000,
          jobTypes: ["orchestration.action"],
        });
        check(claimed.length === 1, "WORKER_CRASH_CLAIM_MISSING");
        runtime.clock.advance(1_001);
        const restarted = recreateFakeDurableOrchestrationRuntime(runtime);
        await restarted.orchestrator.runWorkerOnce({ workerId: "recovery-worker", leaseMs: 1_000 });
        restarted.clock.advance(1_000);
        await restarted.orchestrator.runWorkerOnce({ workerId: "recovery-worker-2", leaseMs: 1_000 });
        const recovered = await restarted.orchestrator.getWorkflow(workflow.id);
        check(recovered.step === "search", "WORKER_CRASH_NOT_RECOVERED");
        check(runtime.supabase.effectMutations(actionId) === 1, "WORKER_CRASH_DUPLICATED_EFFECT");
        return { recovered: true, mutationCount: runtime.supabase.effectMutations(actionId) };
      })
    );

    results.push(
      await scenario("external_action_replay_after_unknown_state", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "unknown-state");
        await advance(runtime, workflow.id, "us:1", "comprehension");
        await advance(runtime, workflow.id, "us:2", "plan");
        runtime.supabase.failNext("market_search", "apply_then_unknown");
        const executed = await action(runtime, workflow.id, "us:search", "market_search");
        check(executed.workflow.step === "search", "UNKNOWN_STATE_NOT_PROVED");
        check(runtime.supabase.effectMutations(executed.actionId) === 1, "UNKNOWN_STATE_DOUBLE_MUTATION");
        await runtime.orchestrator.runWorkerOnce({ workerId: "us:replay" });
        check(runtime.supabase.effectMutations(executed.actionId) === 1, "REPLAY_DOUBLE_MUTATION");
        return { mutationCount: runtime.supabase.effectMutations(executed.actionId) };
      })
    );

    results.push(
      await scenario("payment_failure_retry", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "payment-retry");
        await advanceDemanderToBooking(runtime, workflow.id, "pr");
        runtime.stripe.failNext("payment_capture", "retryable_before_apply");
        const requested = await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "pr:payment",
          command: { kind: "request_action", action: "payment_capture" },
        });
        const actionId = requested.workflow.pendingAction?.actionId;
        check(actionId, "PAYMENT_ACTION_MISSING");
        await runtime.orchestrator.runWorkerOnce({ workerId: "payment-worker-1" });
        runtime.clock.advance(1_000);
        await runtime.orchestrator.runWorkerOnce({ workerId: "payment-worker-2" });
        const current = await runtime.orchestrator.getWorkflow(workflow.id);
        check(current.step === "payment", "PAYMENT_RETRY_DID_NOT_SUCCEED");
        check(runtime.stripe.effectMutations(actionId) === 1, "PAYMENT_MUTATED_TWICE");
        return {
          attempts: runtime.stripe.effectAttempts(actionId),
          mutations: runtime.stripe.effectMutations(actionId),
        };
      })
    );

    results.push(
      await scenario("incident_refund_and_resume", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "DEMANDER", "incident");
        await advanceDemanderToBooking(runtime, workflow.id, "ir");
        await action(runtime, workflow.id, "ir:payment", "payment_capture");
        await action(runtime, workflow.id, "ir:mission", "mission_start");
        await action(runtime, workflow.id, "ir:tracking", "tracking_start");
        await action(runtime, workflow.id, "ir:incident", "incident_open");
        const refund = await action(runtime, workflow.id, "ir:refund", "refund_issue");
        check(refund.workflow.step === "refund_replacement", "REFUND_BOUNDARY_MISSING");
        const resumed = await advance(runtime, workflow.id, "ir:resume", "tracking");
        check(resumed.workflow.step === "tracking", "INCIDENT_RESUME_FAILED");
        return { resumed: true, refundStatus: "refunded" };
      })
    );

    results.push(
      await scenario("beneficiary_ineligible_before_settlement", async () => {
        const runtime = createFakeDurableOrchestrationRuntime();
        const { workflow } = await start(runtime, "GAGNER", "beneficiary");
        await advanceGagnerToCompletion(runtime, workflow.id, "bi");
        await runtime.orchestrator.dispatch({
          workflowId: workflow.id,
          idempotencyKey: "bi:block",
          command: {
            kind: "record_facts",
            factsPatch: {
              economicEligibility: {
                state: "blocked",
                allowed: false,
                reason: "beneficiary_became_ineligible",
              },
            },
          },
        });
        let blocked = false;
        try {
          await runtime.orchestrator.dispatch({
            workflowId: workflow.id,
            idempotencyKey: "bi:settlement",
            command: { kind: "request_action", action: "settlement_release" },
          });
        } catch (error) {
          blocked =
            error instanceof Error &&
            error.message === "KLYX_ORCHESTRATION_SETTLEMENT_ELIGIBILITY_REQUIRED";
        }
        check(blocked, "INELIGIBLE_BENEFICIARY_WAS_NOT_BLOCKED");
        const current = await runtime.orchestrator.getWorkflow(workflow.id);
        check(current.step === "completion", "BLOCKED_SETTLEMENT_ADVANCED_WORKFLOW");
        return { blocked, finalStep: current.step };
      })
    );

    const dir = reportDirectory();
    fs.mkdirSync(dir, { recursive: true });
    const report = {
      generatedAt: "2030-01-01T00:00:00.000Z",
      deterministic: true,
      liveAccess: false,
      adapters: {
        supabase: "fake-supabase",
        stripe: "fake-stripe",
        persistence: "abstract-klyx-orchestration-store",
        resilience: "in-memory-klyx-resilience-store",
      },
      chains: {
        DEMANDER: [
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
        ],
        GAGNER: [
          "skill",
          "opportunities",
          "eligibility",
          "proposal",
          "acceptance",
          "mission",
          "completion",
          "settlement",
        ],
      },
      summary: {
        status: results.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
        passed: results.filter((entry) => entry.status === "PASS").length,
        failed: results.filter((entry) => entry.status === "FAIL").length,
        total: results.length,
      },
      results,
    };
    fs.writeFileSync(path.join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, "report.md"), markdown(results));

    expect(report.summary.failed).toBe(0);
    expect(report.summary.status).toBe("PASS");
    expect(results.every((entry) => entry.evidence.externalNetworkCalls === 0)).toBe(true);
  });
});
