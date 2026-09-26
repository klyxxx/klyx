import {
  KlyxResilienceEngine,
  klyxStableFingerprint,
  type KlyxExecutionResult,
  type KlyxJsonValue,
  type KlyxRecoveryDecision,
  type KlyxResilienceClock,
  type KlyxResilienceJob,
  type KlyxResilienceStore,
} from "./resilience-engine";

export const KLYX_DEMANDER_STEPS = [
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
] as const;

export const KLYX_GAGNER_STEPS = [
  "skill",
  "opportunities",
  "eligibility",
  "proposal",
  "acceptance",
  "mission",
  "completion",
  "settlement",
] as const;

export type KlyxOrchestrationMode = "DEMANDER" | "GAGNER";
export type KlyxDemanderStep = (typeof KLYX_DEMANDER_STEPS)[number];
export type KlyxGagnerStep = (typeof KLYX_GAGNER_STEPS)[number];
export type KlyxOrchestrationStep = KlyxDemanderStep | KlyxGagnerStep;
export type KlyxOrchestrationStatus =
  | "active"
  | "waiting_action"
  | "human_review"
  | "completed"
  | "cancelled";

export type KlyxOrchestrationActionKind =
  | "market_search"
  | "matching_compute"
  | "quote_generate"
  | "booking_create"
  | "payment_capture"
  | "mission_start"
  | "tracking_start"
  | "incident_open"
  | "refund_issue"
  | "replacement_create"
  | "opportunity_discover"
  | "eligibility_check"
  | "proposal_create"
  | "mission_accept"
  | "mission_complete"
  | "settlement_release";

export type KlyxInterfaceContext = {
  conversationId: string | null;
  browserSessionId: string | null;
  llmModel: string | null;
};

export type KlyxPendingAction = {
  actionId: string;
  kind: KlyxOrchestrationActionKind;
  fromStep: KlyxOrchestrationStep;
  successStep: KlyxOrchestrationStep;
  resultFactKey: string;
  payload: KlyxJsonValue;
  requestedAtMs: number;
};

export type KlyxOrchestrationWorkflow = {
  id: string;
  creationKey: string;
  accountId: string;
  profileId: string;
  mode: KlyxOrchestrationMode;
  step: KlyxOrchestrationStep;
  status: KlyxOrchestrationStatus;
  version: number;
  interfaceContext: KlyxInterfaceContext;
  facts: Record<string, KlyxJsonValue>;
  pendingAction: KlyxPendingAction | null;
  humanReviewReason: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type KlyxOrchestrationCommand =
  | {
      kind: "advance";
      to: KlyxOrchestrationStep;
      factsPatch?: Record<string, KlyxJsonValue>;
    }
  | {
      kind: "record_facts";
      factsPatch: Record<string, KlyxJsonValue>;
    }
  | {
      kind: "set_interface_context";
      conversationId?: string | null;
      browserSessionId?: string | null;
      llmModel?: string | null;
    }
  | {
      kind: "request_action";
      action: KlyxOrchestrationActionKind;
      payload?: KlyxJsonValue;
      resultFactKey?: string;
    }
  | {
      kind: "cancel";
      reasonCode: string;
    }
  | {
      kind: "apply_action_result";
      actionId: string;
      receipt: KlyxEffectReceipt;
    }
  | {
      kind: "action_human_review";
      actionId: string;
      reasonCode: string;
    };

export type KlyxOrchestrationCommandRecord = {
  workflowId: string;
  idempotencyKey: string;
  fingerprint: string;
  result: KlyxOrchestrationWorkflow;
  createdAtMs: number;
};

export type KlyxOrchestrationEvent = {
  id: string;
  workflowId: string;
  eventType:
    | "workflow.created"
    | "workflow.transitioned"
    | "workflow.facts_recorded"
    | "workflow.interface_context_changed"
    | "workflow.action_requested"
    | "workflow.action_completed"
    | "workflow.human_review"
    | "workflow.cancelled"
    | "workflow.command_replayed";
  atMs: number;
  version: number;
  details: Record<string, KlyxJsonValue>;
};

export type KlyxWorkflowCreateInput = {
  creationKey: string;
  fingerprint: string;
  workflow: KlyxOrchestrationWorkflow;
};

export type KlyxWorkflowCreateResult =
  | { kind: "created"; workflow: KlyxOrchestrationWorkflow }
  | { kind: "existing"; workflow: KlyxOrchestrationWorkflow }
  | { kind: "conflict"; workflow: KlyxOrchestrationWorkflow };

export type KlyxApplyCommandInput = {
  workflowId: string;
  expectedVersion: number;
  idempotencyKey: string;
  fingerprint: string;
  nextWorkflow: KlyxOrchestrationWorkflow;
  event: Omit<KlyxOrchestrationEvent, "id">;
  atMs: number;
};

export type KlyxApplyCommandResult =
  | { kind: "applied"; workflow: KlyxOrchestrationWorkflow }
  | { kind: "duplicate"; workflow: KlyxOrchestrationWorkflow }
  | { kind: "conflict"; workflow: KlyxOrchestrationWorkflow }
  | { kind: "version_conflict"; workflow: KlyxOrchestrationWorkflow };

export interface KlyxOrchestrationStore {
  createOrGetWorkflow(input: KlyxWorkflowCreateInput): Promise<KlyxWorkflowCreateResult>;
  getWorkflow(workflowId: string): Promise<KlyxOrchestrationWorkflow | null>;
  listWorkflows(statuses?: KlyxOrchestrationStatus[]): Promise<KlyxOrchestrationWorkflow[]>;
  getCommand(
    workflowId: string,
    idempotencyKey: string
  ): Promise<KlyxOrchestrationCommandRecord | null>;
  applyCommand(input: KlyxApplyCommandInput): Promise<KlyxApplyCommandResult>;
  appendEvent(
    event: Omit<KlyxOrchestrationEvent, "id">
  ): Promise<KlyxOrchestrationEvent>;
  listEvents(workflowId?: string): Promise<KlyxOrchestrationEvent[]>;
}

export interface KlyxOrchestrationIds {
  next(prefix: string): string;
}

export type KlyxEffectReceipt = {
  ref: string;
  actionId: string;
  action: KlyxOrchestrationActionKind;
  provider: "fake-supabase" | "fake-stripe" | "internal";
  result: KlyxJsonValue;
};

export type KlyxEffectExecutionDecision =
  | { kind: "success"; receipt: KlyxEffectReceipt }
  | { kind: "retryable_failure"; errorCode: string }
  | { kind: "unknown_external_state"; errorCode: string }
  | { kind: "permanent_failure"; errorCode: string };

export interface KlyxOrchestrationEffectAdapter {
  execute(input: {
    workflowId: string;
    actionId: string;
    action: KlyxOrchestrationActionKind;
    payload: KlyxJsonValue;
  }): Promise<KlyxEffectExecutionDecision>;
  getReceipt(actionId: string): Promise<KlyxEffectReceipt | null>;
  externalNetworkCalls(): number;
}

export class KlyxOrchestrationConcurrentMutationError extends Error {
  constructor() {
    super("KLYX_ORCHESTRATION_CONCURRENT_MUTATION");
    this.name = "KlyxOrchestrationConcurrentMutationError";
  }
}

export class KlyxOrchestrationIdempotencyConflictError extends Error {
  constructor() {
    super("KLYX_ORCHESTRATION_IDEMPOTENCY_CONFLICT");
    this.name = "KlyxOrchestrationIdempotencyConflictError";
  }
}

type ActionRoute = {
  mode: KlyxOrchestrationMode;
  from: KlyxOrchestrationStep;
  to: KlyxOrchestrationStep;
  defaultResultFactKey: string;
  replayMode: "safe_idempotent_replay" | "prove_before_replay";
};

const ACTION_ROUTES: Record<KlyxOrchestrationActionKind, ActionRoute> = {
  market_search: {
    mode: "DEMANDER",
    from: "plan",
    to: "search",
    defaultResultFactKey: "search",
    replayMode: "safe_idempotent_replay",
  },
  matching_compute: {
    mode: "DEMANDER",
    from: "search",
    to: "matching",
    defaultResultFactKey: "matching",
    replayMode: "safe_idempotent_replay",
  },
  quote_generate: {
    mode: "DEMANDER",
    from: "matching",
    to: "quote",
    defaultResultFactKey: "quote",
    replayMode: "safe_idempotent_replay",
  },
  booking_create: {
    mode: "DEMANDER",
    from: "confirmation",
    to: "booking",
    defaultResultFactKey: "booking",
    replayMode: "prove_before_replay",
  },
  payment_capture: {
    mode: "DEMANDER",
    from: "booking",
    to: "payment",
    defaultResultFactKey: "payment",
    replayMode: "prove_before_replay",
  },
  mission_start: {
    mode: "DEMANDER",
    from: "payment",
    to: "mission",
    defaultResultFactKey: "mission",
    replayMode: "prove_before_replay",
  },
  tracking_start: {
    mode: "DEMANDER",
    from: "mission",
    to: "tracking",
    defaultResultFactKey: "tracking",
    replayMode: "safe_idempotent_replay",
  },
  incident_open: {
    mode: "DEMANDER",
    from: "tracking",
    to: "incident",
    defaultResultFactKey: "incident",
    replayMode: "safe_idempotent_replay",
  },
  refund_issue: {
    mode: "DEMANDER",
    from: "incident",
    to: "refund_replacement",
    defaultResultFactKey: "refund",
    replayMode: "prove_before_replay",
  },
  replacement_create: {
    mode: "DEMANDER",
    from: "incident",
    to: "refund_replacement",
    defaultResultFactKey: "replacement",
    replayMode: "prove_before_replay",
  },
  opportunity_discover: {
    mode: "GAGNER",
    from: "skill",
    to: "opportunities",
    defaultResultFactKey: "opportunities",
    replayMode: "safe_idempotent_replay",
  },
  eligibility_check: {
    mode: "GAGNER",
    from: "opportunities",
    to: "eligibility",
    defaultResultFactKey: "economicEligibility",
    replayMode: "safe_idempotent_replay",
  },
  proposal_create: {
    mode: "GAGNER",
    from: "eligibility",
    to: "proposal",
    defaultResultFactKey: "proposal",
    replayMode: "prove_before_replay",
  },
  mission_accept: {
    mode: "GAGNER",
    from: "acceptance",
    to: "mission",
    defaultResultFactKey: "mission",
    replayMode: "prove_before_replay",
  },
  mission_complete: {
    mode: "GAGNER",
    from: "mission",
    to: "completion",
    defaultResultFactKey: "completion",
    replayMode: "prove_before_replay",
  },
  settlement_release: {
    mode: "GAGNER",
    from: "completion",
    to: "settlement",
    defaultResultFactKey: "settlement",
    replayMode: "prove_before_replay",
  },
};

const DIRECT_TRANSITIONS: Record<KlyxOrchestrationMode, ReadonlySet<string>> = {
  DEMANDER: new Set([
    "intention->comprehension",
    "comprehension->plan",
    "quote->confirmation",
    "tracking->closure",
    "refund_replacement->tracking",
    "refund_replacement->closure",
  ]),
  GAGNER: new Set(["proposal->acceptance"]),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function isObject(value: KlyxJsonValue | undefined): value is Record<string, KlyxJsonValue> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTerminalStep(mode: KlyxOrchestrationMode, step: KlyxOrchestrationStep): boolean {
  return (mode === "DEMANDER" && step === "closure") ||
    (mode === "GAGNER" && step === "settlement");
}

function assertStepForMode(mode: KlyxOrchestrationMode, step: KlyxOrchestrationStep): void {
  const allowed = mode === "DEMANDER" ? KLYX_DEMANDER_STEPS : KLYX_GAGNER_STEPS;
  if (!(allowed as readonly string[]).includes(step)) {
    throw new Error(`KLYX_ORCHESTRATION_STEP_INVALID:${mode}:${step}`);
  }
}

function commandFingerprint(command: KlyxOrchestrationCommand): string {
  return klyxStableFingerprint(command as unknown as KlyxJsonValue);
}

function creationFingerprint(input: {
  accountId: string;
  profileId: string;
  mode: KlyxOrchestrationMode;
}): string {
  return klyxStableFingerprint(input as unknown as KlyxJsonValue);
}

function eventTypeFor(command: KlyxOrchestrationCommand): KlyxOrchestrationEvent["eventType"] {
  if (command.kind === "advance") return "workflow.transitioned";
  if (command.kind === "record_facts") return "workflow.facts_recorded";
  if (command.kind === "set_interface_context") return "workflow.interface_context_changed";
  if (command.kind === "request_action") return "workflow.action_requested";
  if (command.kind === "apply_action_result") return "workflow.action_completed";
  if (command.kind === "action_human_review") return "workflow.human_review";
  return "workflow.cancelled";
}

function canonicalEligibilityAllowed(workflow: KlyxOrchestrationWorkflow): boolean {
  const eligibility = workflow.facts.economicEligibility;
  if (!isObject(eligibility)) return false;
  return eligibility.allowed === true || eligibility.state === "allowed";
}

function applyFacts(
  current: Record<string, KlyxJsonValue>,
  patch: Record<string, KlyxJsonValue>
): Record<string, KlyxJsonValue> {
  return { ...clone(current), ...clone(patch) };
}

function reduceCommand(
  current: KlyxOrchestrationWorkflow,
  command: KlyxOrchestrationCommand,
  nowMs: number,
  ids: KlyxOrchestrationIds
): KlyxOrchestrationWorkflow {
  if (current.status === "cancelled" || current.status === "completed") {
    throw new Error("KLYX_ORCHESTRATION_WORKFLOW_TERMINAL");
  }

  if (command.kind === "set_interface_context") {
    return {
      ...clone(current),
      interfaceContext: {
        conversationId:
          command.conversationId === undefined
            ? current.interfaceContext.conversationId
            : command.conversationId,
        browserSessionId:
          command.browserSessionId === undefined
            ? current.interfaceContext.browserSessionId
            : command.browserSessionId,
        llmModel:
          command.llmModel === undefined
            ? current.interfaceContext.llmModel
            : command.llmModel,
      },
      updatedAtMs: nowMs,
    };
  }

  if (command.kind === "record_facts") {
    if (current.status !== "active") {
      throw new Error("KLYX_ORCHESTRATION_FACTS_REQUIRE_ACTIVE");
    }
    return {
      ...clone(current),
      facts: applyFacts(current.facts, command.factsPatch),
      updatedAtMs: nowMs,
    };
  }

  if (command.kind === "advance") {
    if (current.status !== "active" || current.pendingAction) {
      throw new Error("KLYX_ORCHESTRATION_ADVANCE_BLOCKED");
    }
    assertStepForMode(current.mode, command.to);
    const key = `${current.step}->${command.to}`;
    if (!DIRECT_TRANSITIONS[current.mode].has(key)) {
      throw new Error(`KLYX_ORCHESTRATION_DIRECT_TRANSITION_FORBIDDEN:${key}`);
    }
    const terminal = isTerminalStep(current.mode, command.to);
    return {
      ...clone(current),
      step: command.to,
      status: terminal ? "completed" : "active",
      facts: applyFacts(current.facts, command.factsPatch ?? {}),
      updatedAtMs: nowMs,
    };
  }

  if (command.kind === "request_action") {
    if (current.status !== "active" || current.pendingAction) {
      throw new Error("KLYX_ORCHESTRATION_ACTION_ALREADY_PENDING");
    }
    const route = ACTION_ROUTES[command.action];
    if (route.mode !== current.mode || route.from !== current.step) {
      throw new Error(
        `KLYX_ORCHESTRATION_ACTION_ROUTE_INVALID:${command.action}:${current.step}`
      );
    }
    if (command.action === "settlement_release" && !canonicalEligibilityAllowed(current)) {
      throw new Error("KLYX_ORCHESTRATION_SETTLEMENT_ELIGIBILITY_REQUIRED");
    }
    const pendingAction: KlyxPendingAction = {
      actionId: ids.next("action"),
      kind: command.action,
      fromStep: current.step,
      successStep: route.to,
      resultFactKey: command.resultFactKey?.trim() || route.defaultResultFactKey,
      payload: clone(command.payload ?? {}),
      requestedAtMs: nowMs,
    };
    return {
      ...clone(current),
      status: "waiting_action",
      pendingAction,
      updatedAtMs: nowMs,
    };
  }

  if (command.kind === "apply_action_result") {
    const pending = current.pendingAction;
    if (
      current.status !== "waiting_action" ||
      !pending ||
      pending.actionId !== command.actionId
    ) {
      throw new Error("KLYX_ORCHESTRATION_ACTION_RESULT_NOT_PENDING");
    }
    if (command.receipt.actionId !== pending.actionId || command.receipt.action !== pending.kind) {
      throw new Error("KLYX_ORCHESTRATION_ACTION_RECEIPT_MISMATCH");
    }
    const terminal = isTerminalStep(current.mode, pending.successStep);
    return {
      ...clone(current),
      step: pending.successStep,
      status: terminal ? "completed" : "active",
      pendingAction: null,
      facts: applyFacts(current.facts, {
        [pending.resultFactKey]: clone(command.receipt.result),
      }),
      updatedAtMs: nowMs,
    };
  }

  if (command.kind === "action_human_review") {
    if (
      !current.pendingAction ||
      current.pendingAction.actionId !== command.actionId
    ) {
      throw new Error("KLYX_ORCHESTRATION_ACTION_REVIEW_NOT_PENDING");
    }
    return {
      ...clone(current),
      status: "human_review",
      humanReviewReason: requireText(
        command.reasonCode,
        "KLYX_ORCHESTRATION_REVIEW_REASON_REQUIRED"
      ).toUpperCase(),
      updatedAtMs: nowMs,
    };
  }

  return {
    ...clone(current),
    status: "cancelled",
    humanReviewReason: requireText(
      command.reasonCode,
      "KLYX_ORCHESTRATION_CANCEL_REASON_REQUIRED"
    ).toUpperCase(),
    updatedAtMs: nowMs,
  };
}

export type KlyxDurableOrchestratorOptions = {
  store: KlyxOrchestrationStore;
  resilience: KlyxResilienceEngine;
  effectAdapter: KlyxOrchestrationEffectAdapter;
  clock: KlyxResilienceClock;
  ids: KlyxOrchestrationIds;
};

export type KlyxDispatchResult = {
  workflow: KlyxOrchestrationWorkflow;
  replayed: boolean;
};

export class KlyxDurableOrchestrator {
  private readonly store: KlyxOrchestrationStore;
  private readonly resilience: KlyxResilienceEngine;
  private readonly effectAdapter: KlyxOrchestrationEffectAdapter;
  private readonly clock: KlyxResilienceClock;
  private readonly ids: KlyxOrchestrationIds;

  constructor(options: KlyxDurableOrchestratorOptions) {
    this.store = options.store;
    this.resilience = options.resilience;
    this.effectAdapter = options.effectAdapter;
    this.clock = options.clock;
    this.ids = options.ids;
  }

  async startWorkflow(input: {
    creationKey: string;
    accountId: string;
    profileId: string;
    mode: KlyxOrchestrationMode;
    conversationId?: string | null;
    browserSessionId?: string | null;
    llmModel?: string | null;
  }): Promise<{ workflow: KlyxOrchestrationWorkflow; created: boolean }> {
    const creationKey = requireText(
      input.creationKey,
      "KLYX_ORCHESTRATION_CREATION_KEY_REQUIRED"
    );
    const accountId = requireText(input.accountId, "KLYX_ORCHESTRATION_ACCOUNT_REQUIRED");
    const profileId = requireText(input.profileId, "KLYX_ORCHESTRATION_PROFILE_REQUIRED");
    const fingerprint = creationFingerprint({ accountId, profileId, mode: input.mode });
    const now = this.clock.nowMs();
    const step: KlyxOrchestrationStep = input.mode === "DEMANDER" ? "intention" : "skill";
    const workflow: KlyxOrchestrationWorkflow = {
      id: this.ids.next("workflow"),
      creationKey,
      accountId,
      profileId,
      mode: input.mode,
      step,
      status: "active",
      version: 1,
      interfaceContext: {
        conversationId: input.conversationId ?? null,
        browserSessionId: input.browserSessionId ?? null,
        llmModel: input.llmModel ?? null,
      },
      facts: {},
      pendingAction: null,
      humanReviewReason: null,
      createdAtMs: now,
      updatedAtMs: now,
    };
    const result = await this.store.createOrGetWorkflow({
      creationKey,
      fingerprint,
      workflow,
    });
    if (result.kind === "conflict") {
      throw new KlyxOrchestrationIdempotencyConflictError();
    }
    if (result.kind === "created") {
      await this.store.appendEvent({
        workflowId: result.workflow.id,
        eventType: "workflow.created",
        atMs: now,
        version: result.workflow.version,
        details: { mode: input.mode, step },
      });
    }
    return {
      workflow: result.workflow,
      created: result.kind === "created",
    };
  }

  async getWorkflow(workflowId: string): Promise<KlyxOrchestrationWorkflow> {
    const workflow = await this.store.getWorkflow(workflowId);
    if (!workflow) throw new Error("KLYX_ORCHESTRATION_WORKFLOW_NOT_FOUND");
    return workflow;
  }

  async dispatch(input: {
    workflowId: string;
    idempotencyKey: string;
    command: KlyxOrchestrationCommand;
    expectedVersion?: number;
  }): Promise<KlyxDispatchResult> {
    const workflowId = requireText(
      input.workflowId,
      "KLYX_ORCHESTRATION_WORKFLOW_ID_REQUIRED"
    );
    const idempotencyKey = requireText(
      input.idempotencyKey,
      "KLYX_ORCHESTRATION_IDEMPOTENCY_KEY_REQUIRED"
    );
    const fingerprint = commandFingerprint(input.command);
    const existing = await this.store.getCommand(workflowId, idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new KlyxOrchestrationIdempotencyConflictError();
      }
      await this.store.appendEvent({
        workflowId,
        eventType: "workflow.command_replayed",
        atMs: this.clock.nowMs(),
        version: existing.result.version,
        details: { idempotencyKey },
      });
      return { workflow: existing.result, replayed: true };
    }

    const current = await this.getWorkflow(workflowId);
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== current.version
    ) {
      throw new KlyxOrchestrationConcurrentMutationError();
    }
    const now = this.clock.nowMs();
    const reduced = reduceCommand(current, input.command, now, this.ids);
    const next: KlyxOrchestrationWorkflow = {
      ...reduced,
      version: current.version + 1,
    };
    const result = await this.store.applyCommand({
      workflowId,
      expectedVersion: current.version,
      idempotencyKey,
      fingerprint,
      nextWorkflow: next,
      atMs: now,
      event: {
        workflowId,
        eventType: eventTypeFor(input.command),
        atMs: now,
        version: next.version,
        details: {
          command: input.command.kind,
          fromStep: current.step,
          toStep: next.step,
          status: next.status,
        },
      },
    });
    if (result.kind === "conflict") {
      throw new KlyxOrchestrationIdempotencyConflictError();
    }
    if (result.kind === "version_conflict") {
      throw new KlyxOrchestrationConcurrentMutationError();
    }
    return {
      workflow: result.workflow,
      replayed: result.kind === "duplicate",
    };
  }

  async ensurePendingActionEnqueued(
    workflowId: string
  ): Promise<KlyxResilienceJob | null> {
    const workflow = await this.getWorkflow(workflowId);
    const pending = workflow.pendingAction;
    if (!pending || workflow.status !== "waiting_action") return null;
    const route = ACTION_ROUTES[pending.kind];
    const enqueue = await this.resilience.enqueue({
      jobType: "orchestration.action",
      idempotencyKey: `${workflow.id}:${pending.actionId}`,
      payload: {
        workflowId: workflow.id,
        actionId: pending.actionId,
        action: pending.kind,
        payload: pending.payload,
      },
      priority: 50,
      replayMode: route.replayMode,
      retryPolicy: {
        maxAttempts: 5,
        backoffBaseMs: 1_000,
        backoffMaxMs: 60_000,
      },
    });
    return enqueue.job;
  }

  async resumePendingActions(): Promise<KlyxResilienceJob[]> {
    const workflows = await this.store.listWorkflows(["waiting_action"]);
    const jobs: KlyxResilienceJob[] = [];
    for (const workflow of workflows) {
      const job = await this.ensurePendingActionEnqueued(workflow.id);
      if (job) jobs.push(job);
    }
    return jobs;
  }

  async runWorkerOnce(input: {
    workerId: string;
    limit?: number;
    leaseMs?: number;
  }): Promise<{
    claimed: number;
    completed: number;
    recovered: number;
    reviewed: number;
  }> {
    await this.resumePendingActions();
    const recovered = await this.resilience.recoverExpiredClaims();
    const claimed = await this.resilience.claim({
      workerId: input.workerId,
      limit: input.limit ?? 20,
      leaseMs: input.leaseMs,
      jobTypes: ["orchestration.action"],
    });
    let completed = 0;
    let reviewed = recovered.filter((entry) => entry.outcome === "human_review").length;
    for (const job of claimed) {
      if (!job.lease) continue;
      const outcome = await this.resilience.executeClaim({
        job,
        workerId: input.workerId,
        leaseToken: job.lease.token,
      });
      if (outcome.outcome === "succeeded" || outcome.outcome === "replayed") {
        completed += 1;
      }
      if (outcome.outcome === "human_review" || outcome.outcome === "dead_lettered") {
        reviewed += 1;
      }
    }
    await this.reconcilePendingActions();
    return {
      claimed: claimed.length,
      completed,
      recovered: recovered.length,
      reviewed,
    };
  }

  async reconcilePendingActions(): Promise<void> {
    const workflows = await this.store.listWorkflows(["waiting_action"]);
    for (const workflow of workflows) {
      const pending = workflow.pendingAction;
      if (!pending) continue;
      const job = await this.ensurePendingActionEnqueued(workflow.id);
      if (!job) continue;
      const latest = await this.resilience.getJob(job.id);
      if (!latest) continue;
      if (latest.status === "succeeded") {
        const receipt = await this.effectAdapter.getReceipt(pending.actionId);
        if (!receipt) {
          await this.dispatch({
            workflowId: workflow.id,
            idempotencyKey: `action-review:${pending.actionId}`,
            command: {
              kind: "action_human_review",
              actionId: pending.actionId,
              reasonCode: "ACTION_SUCCEEDED_WITHOUT_RECEIPT",
            },
          });
          continue;
        }
        await this.dispatch({
          workflowId: workflow.id,
          idempotencyKey: `action-complete:${pending.actionId}`,
          command: {
            kind: "apply_action_result",
            actionId: pending.actionId,
            receipt,
          },
        });
      } else if (
        latest.status === "human_review" ||
        latest.status === "dead_lettered"
      ) {
        await this.dispatch({
          workflowId: workflow.id,
          idempotencyKey: `action-review:${pending.actionId}`,
          command: {
            kind: "action_human_review",
            actionId: pending.actionId,
            reasonCode:
              latest.lastErrorCode ??
              (latest.status === "dead_lettered"
                ? "ACTION_DEAD_LETTERED"
                : "ACTION_HUMAN_REVIEW"),
          },
        });
      }
    }
  }

  async listEvents(workflowId?: string): Promise<KlyxOrchestrationEvent[]> {
    return this.store.listEvents(workflowId);
  }
}

function parseActionJob(job: KlyxResilienceJob): {
  workflowId: string;
  actionId: string;
  action: KlyxOrchestrationActionKind;
  payload: KlyxJsonValue;
} {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    throw new Error("KLYX_ORCHESTRATION_ACTION_JOB_PAYLOAD_INVALID");
  }
  const row = job.payload as Record<string, KlyxJsonValue>;
  const workflowId = typeof row.workflowId === "string" ? row.workflowId : "";
  const actionId = typeof row.actionId === "string" ? row.actionId : "";
  const action = typeof row.action === "string" ? row.action : "";
  if (!workflowId || !actionId || !(action in ACTION_ROUTES)) {
    throw new Error("KLYX_ORCHESTRATION_ACTION_JOB_PAYLOAD_INVALID");
  }
  return {
    workflowId,
    actionId,
    action: action as KlyxOrchestrationActionKind,
    payload: row.payload ?? {},
  };
}

export function createKlyxOrchestrationResilienceEngine(input: {
  store: KlyxResilienceStore;
  clock: KlyxResilienceClock;
  effectAdapter: KlyxOrchestrationEffectAdapter;
}): KlyxResilienceEngine {
  const execute = async (job: KlyxResilienceJob): Promise<KlyxExecutionResult> => {
    let payload: ReturnType<typeof parseActionJob>;
    try {
      payload = parseActionJob(job);
    } catch {
      return {
        kind: "permanent_failure",
        errorCode: "ORCHESTRATION_ACTION_PAYLOAD_INVALID",
      };
    }
    const decision = await input.effectAdapter.execute(payload);
    if (decision.kind === "success") {
      return { kind: "success", resultRef: decision.receipt.ref };
    }
    if (decision.kind === "retryable_failure") {
      return { kind: "retryable_failure", errorCode: decision.errorCode };
    }
    if (decision.kind === "permanent_failure") {
      return { kind: "permanent_failure", errorCode: decision.errorCode };
    }
    return { kind: "unknown_external_state", errorCode: decision.errorCode };
  };

  const recover = async (job: KlyxResilienceJob): Promise<KlyxRecoveryDecision> => {
    let payload: ReturnType<typeof parseActionJob>;
    try {
      payload = parseActionJob(job);
    } catch {
      return {
        kind: "human_review",
        reasonCode: "ORCHESTRATION_ACTION_PAYLOAD_INVALID",
      };
    }
    const receipt = await input.effectAdapter.getReceipt(payload.actionId);
    if (receipt) {
      return {
        kind: "proved_succeeded",
        resultRef: receipt.ref,
        reasonCode: "ORCHESTRATION_EFFECT_RECEIPT_FOUND",
      };
    }
    return {
      kind: "proved_not_applied",
      reasonCode: "ORCHESTRATION_EFFECT_NOT_APPLIED",
    };
  };

  return new KlyxResilienceEngine({
    store: input.store,
    clock: input.clock,
    executors: {
      "orchestration.action": async ({ job }) => execute(job),
    },
    recoveryHandlers: {
      "orchestration.action": async ({ job }) => recover(job),
    },
    defaultRetryPolicy: {
      maxAttempts: 5,
      backoffBaseMs: 1_000,
      backoffMaxMs: 60_000,
    },
    defaultLeaseMs: 30_000,
    defaultExecutionTimeoutMs: 5_000,
  });
}

export function klyxActionRoute(
  action: KlyxOrchestrationActionKind
): Readonly<ActionRoute> {
  return ACTION_ROUTES[action];
}
