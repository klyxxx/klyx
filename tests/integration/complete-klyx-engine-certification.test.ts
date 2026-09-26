import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EARN_WORKFLOW_STEPS,
  REQUEST_WORKFLOW_STEPS,
  WORKFLOW_ACTION_POLICIES,
  allowedNextWorkflowSteps,
  assistantMayExecuteActionDirectly,
  type WorkflowActionType,
} from "@/lib/brain/orchestrator/state-machine";
import {
  KlyxResilienceEngine,
} from "@/lib/resilience-engine";
import {
  InMemoryKlyxResilienceStore,
  ManualKlyxResilienceClock,
} from "@/lib/resilience-memory-adapter";
import {
  buildPostBookingIncidentMessage,
  evaluatePostBookingIncidentPolicy,
} from "@/lib/post-booking-incidents";

const root = process.cwd();
const repositorySource = fs.readFileSync(
  path.join(root, "lib/brain/orchestrator/repository.ts"),
  "utf8"
);

describe("complete KLYX engine certification composition", () => {
  it("keeps DEMANDER and GAGNER on the canonical deterministic state machines", () => {
    expect(REQUEST_WORKFLOW_STEPS).toEqual([
      "intention",
      "comprehension",
      "plan",
      "search",
      "matching",
      "quote",
      "negotiation_confirmation",
      "booking",
      "payment",
      "execution",
      "tracking",
      "incident",
      "refund_replacement",
      "closure",
    ]);

    expect(EARN_WORKFLOW_STEPS).toEqual([
      "skill",
      "opportunities",
      "eligibility",
      "proposal",
      "acceptance",
      "mission",
      "settlement",
    ]);

    for (const steps of [REQUEST_WORKFLOW_STEPS, EARN_WORKFLOW_STEPS]) {
      for (let index = 0; index < steps.length - 1; index += 1) {
        const from = steps[index]!;
        const to = steps[index + 1]!;
        expect(allowedNextWorkflowSteps(
          steps === REQUEST_WORKFLOW_STEPS ? "request" : "earn",
          from
        )).toContain(to);
      }
    }

    expect(repositorySource).toContain("completeSettlementWorkflow");
    expect(repositorySource).toContain('params.workflow.currentStep !== "settlement"');
    expect(repositorySource).toContain('actorType: "server" | "system" | "operator"');
  });

  it("never lets the LLM become direct mutation authority", () => {
    for (const actionType of Object.keys(
      WORKFLOW_ACTION_POLICIES
    ) as WorkflowActionType[]) {
      expect(assistantMayExecuteActionDirectly(actionType)).toBe(false);
    }

    for (const actionType of [
      "create_booking",
      "capture_payment",
      "accept_mission",
      "mark_execution_state",
      "issue_refund",
      "replace_provider",
      "release_settlement",
    ] as const) {
      expect(WORKFLOW_ACTION_POLICIES[actionType].executor).toBe("server");
    }
  });

  it("recovers an absent webhook through evidence instead of blind retry", async () => {
    const clock = new ManualKlyxResilienceClock(10_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      recoveryHandlers: {
        "cert.payment.waiting": async ({ trigger }) => {
          expect(trigger).toBe("webhook_absent");
          return {
            kind: "proved_not_applied",
            reasonCode: "provider_has_no_operation",
          };
        },
      },
    });

    const queued = await engine.enqueue({
      jobType: "cert.payment.waiting",
      idempotencyKey: "complete-cert:webhook-absent",
    });

    expect(
      await engine.recoverMissingWebhook({
        jobId: queued.job.id,
        expectedByMs: 10_100,
      })
    ).toMatchObject({ outcome: "not_due" });

    clock.advance(101);
    const recovered = await engine.recoverMissingWebhook({
      jobId: queued.job.id,
      expectedByMs: 10_100,
    });

    expect(recovered.outcome).toBe("retry_scheduled");
    expect(recovered.job.lastErrorCode).toBe("PROVIDER_HAS_NO_OPERATION");
  });

  it("keeps incident replacement policy deterministic and outside LLM authority", () => {
    const decision = evaluatePostBookingIncidentPolicy({
      incidentType: "provider_no_show",
      reporterRole: "client",
      paymentStatus: "paid",
      afterStart: true,
    });

    expect(decision.replacementEligible).toBe(true);
    expect(decision.humanReviewRequired).toBe(true);
    expect(decision.refundHandling).toBe("human_review");
    expect(decision.llmDecisionAllowed).toBe(false);
    expect(decision.automaticSanctionAllowed).toBe(false);

    expect(
      buildPostBookingIncidentMessage({
        incidentType: "provider_no_show",
        replacementCandidateCount: 2,
        humanReviewRequired: decision.humanReviewRequired,
        refundHandling: decision.refundHandling,
      })
    ).toContain("2");
  });
});
