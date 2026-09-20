import { describe, expect, it } from "vitest";

import {
  allowedNextWorkflowSteps,
  assistantMayExecuteActionDirectly,
  assertWorkflowTransition,
  initialWorkflowStep,
  workflowActionPolicy,
  type WorkflowActionType,
} from "@/lib/brain/orchestrator/state-machine";

describe("KLYX orchestrator state machine", () => {
  it("starts request and earn workflows at their canonical first step", () => {
    expect(initialWorkflowStep("request")).toBe("intention");
    expect(initialWorkflowStep("earn")).toBe("skill");
  });

  it("encodes the demander lifecycle in order with controlled recovery loops", () => {
    expect(allowedNextWorkflowSteps("request", "intention")).toEqual([
      "comprehension",
    ]);
    expect(allowedNextWorkflowSteps("request", "payment")).toEqual([
      "execution",
      "incident",
    ]);
    expect(allowedNextWorkflowSteps("request", "incident")).toEqual([
      "refund_replacement",
      "tracking",
    ]);
  });

  it("encodes the gagner lifecycle and settlement terminal", () => {
    expect(allowedNextWorkflowSteps("earn", "skill")).toEqual([
      "opportunities",
    ]);
    expect(allowedNextWorkflowSteps("earn", "mission")).toEqual([
      "settlement",
    ]);
    expect(allowedNextWorkflowSteps("earn", "settlement")).toEqual([]);
  });

  it("rejects cross-mode and skipped transitions", () => {
    expect(() =>
      assertWorkflowTransition({
        mode: "request",
        from: "comprehension",
        to: "payment",
      })
    ).toThrow("KLYX_WORKFLOW_TRANSITION_INVALID");

    expect(() =>
      assertWorkflowTransition({
        mode: "earn",
        from: "skill",
        to: "settlement",
      })
    ).toThrow("KLYX_WORKFLOW_TRANSITION_INVALID");
  });

  it("never allows direct assistant execution of domain actions", () => {
    const actions: WorkflowActionType[] = [
      "search_market",
      "compute_matching",
      "generate_quote",
      "request_negotiation",
      "create_booking",
      "capture_payment",
      "accept_mission",
      "mark_execution_state",
      "open_incident",
      "issue_refund",
      "replace_provider",
      "release_settlement",
    ];

    for (const action of actions) {
      expect(assistantMayExecuteActionDirectly(action)).toBe(false);
    }
  });

  it("keeps financial and irreversible mutations server-controlled", () => {
    expect(workflowActionPolicy("capture_payment")).toEqual({
      mutationClass: "sensitive",
      requiresConfirmation: true,
      executor: "server",
    });
    expect(workflowActionPolicy("issue_refund")).toEqual({
      mutationClass: "sensitive",
      requiresConfirmation: true,
      executor: "server",
    });
    expect(workflowActionPolicy("release_settlement")).toEqual({
      mutationClass: "sensitive",
      requiresConfirmation: false,
      executor: "server",
    });
  });
});
