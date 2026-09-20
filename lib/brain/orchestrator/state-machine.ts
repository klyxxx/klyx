export const REQUEST_WORKFLOW_STEPS = [
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
] as const;

export const EARN_WORKFLOW_STEPS = [
  "skill",
  "opportunities",
  "eligibility",
  "proposal",
  "acceptance",
  "mission",
  "settlement",
] as const;

export type WorkflowMode = "request" | "earn";
export type RequestWorkflowStep = (typeof REQUEST_WORKFLOW_STEPS)[number];
export type EarnWorkflowStep = (typeof EARN_WORKFLOW_STEPS)[number];
export type WorkflowStep = RequestWorkflowStep | EarnWorkflowStep;

export type WorkflowStatus =
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "cancelled";

const REQUEST_TRANSITIONS: Record<RequestWorkflowStep, readonly RequestWorkflowStep[]> = {
  intention: ["comprehension"],
  comprehension: ["plan", "intention"],
  plan: ["search", "comprehension"],
  search: ["matching", "plan"],
  matching: ["quote", "search"],
  quote: ["negotiation_confirmation", "matching"],
  negotiation_confirmation: ["booking", "quote", "matching"],
  booking: ["payment", "negotiation_confirmation"],
  payment: ["execution", "incident"],
  execution: ["tracking", "incident"],
  tracking: ["incident", "closure"],
  incident: ["refund_replacement", "tracking"],
  refund_replacement: ["tracking", "closure"],
  closure: [],
};

const EARN_TRANSITIONS: Record<EarnWorkflowStep, readonly EarnWorkflowStep[]> = {
  skill: ["opportunities"],
  opportunities: ["eligibility", "skill"],
  eligibility: ["proposal", "opportunities"],
  proposal: ["acceptance", "opportunities"],
  acceptance: ["mission", "proposal"],
  mission: ["settlement"],
  settlement: [],
};

export function initialWorkflowStep(mode: WorkflowMode): WorkflowStep {
  return mode === "request" ? "intention" : "skill";
}

export function isWorkflowStepForMode(
  mode: WorkflowMode,
  step: string
): step is WorkflowStep {
  return mode === "request"
    ? (REQUEST_WORKFLOW_STEPS as readonly string[]).includes(step)
    : (EARN_WORKFLOW_STEPS as readonly string[]).includes(step);
}

export function allowedNextWorkflowSteps(
  mode: WorkflowMode,
  step: WorkflowStep
): readonly WorkflowStep[] {
  if (!isWorkflowStepForMode(mode, step)) return [];

  return mode === "request"
    ? REQUEST_TRANSITIONS[step as RequestWorkflowStep]
    : EARN_TRANSITIONS[step as EarnWorkflowStep];
}

export function assertWorkflowTransition(params: {
  mode: WorkflowMode;
  from: WorkflowStep;
  to: WorkflowStep;
}): void {
  const allowed = allowedNextWorkflowSteps(params.mode, params.from);

  if (!allowed.includes(params.to)) {
    throw new Error(
      "KLYX_WORKFLOW_TRANSITION_INVALID:" + params.from + "->" + params.to
    );
  }
}

export type WorkflowMutationClass = "read" | "reversible" | "sensitive";

export type WorkflowActionType =
  | "search_market"
  | "compute_matching"
  | "generate_quote"
  | "request_negotiation"
  | "create_booking"
  | "capture_payment"
  | "accept_mission"
  | "mark_execution_state"
  | "open_incident"
  | "issue_refund"
  | "replace_provider"
  | "release_settlement";

export type WorkflowActionPolicy = {
  mutationClass: WorkflowMutationClass;
  requiresConfirmation: boolean;
  executor: "server" | "none";
};

export const WORKFLOW_ACTION_POLICIES: Record<
  WorkflowActionType,
  WorkflowActionPolicy
> = {
  search_market: {
    mutationClass: "read",
    requiresConfirmation: false,
    executor: "server",
  },
  compute_matching: {
    mutationClass: "read",
    requiresConfirmation: false,
    executor: "server",
  },
  generate_quote: {
    mutationClass: "read",
    requiresConfirmation: false,
    executor: "server",
  },
  request_negotiation: {
    mutationClass: "reversible",
    requiresConfirmation: true,
    executor: "server",
  },
  create_booking: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  capture_payment: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  accept_mission: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  mark_execution_state: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  open_incident: {
    mutationClass: "reversible",
    requiresConfirmation: true,
    executor: "server",
  },
  issue_refund: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  replace_provider: {
    mutationClass: "sensitive",
    requiresConfirmation: true,
    executor: "server",
  },
  release_settlement: {
    mutationClass: "sensitive",
    requiresConfirmation: false,
    executor: "server",
  },
};

export function workflowActionPolicy(
  actionType: WorkflowActionType
): WorkflowActionPolicy {
  return WORKFLOW_ACTION_POLICIES[actionType];
}

export function assistantMayExecuteActionDirectly(
  _actionType: WorkflowActionType
): false {
  return false;
}
