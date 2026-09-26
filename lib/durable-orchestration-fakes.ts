import {
  KlyxDurableOrchestrator,
  KlyxOrchestrationConcurrentMutationError,
  createKlyxOrchestrationResilienceEngine,
  type KlyxApplyCommandInput,
  type KlyxApplyCommandResult,
  type KlyxEffectExecutionDecision,
  type KlyxEffectReceipt,
  type KlyxOrchestrationActionKind,
  type KlyxOrchestrationCommandRecord,
  type KlyxOrchestrationEffectAdapter,
  type KlyxOrchestrationEvent,
  type KlyxOrchestrationIds,
  type KlyxOrchestrationStatus,
  type KlyxOrchestrationStore,
  type KlyxOrchestrationWorkflow,
  type KlyxWorkflowCreateInput,
  type KlyxWorkflowCreateResult,
} from "./durable-orchestration-engine";
import { InMemoryKlyxResilienceStore, ManualKlyxResilienceClock } from "./resilience-memory-adapter";
import type { KlyxJsonValue } from "./resilience-engine";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class DeterministicKlyxIds implements KlyxOrchestrationIds {
  private readonly counters = new Map<string, number>();

  next(prefix: string): string {
    const key = prefix.trim().toLowerCase();
    if (!key) throw new Error("KLYX_ORCHESTRATION_ID_PREFIX_REQUIRED");
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return `${key}_${String(next).padStart(6, "0")}`;
  }
}

type CreationIndexRow = {
  fingerprint: string;
  workflowId: string;
};

export class FakeSupabaseAdapter implements KlyxOrchestrationStore {
  readonly kind = "fake-supabase";
  private readonly workflows = new Map<string, KlyxOrchestrationWorkflow>();
  private readonly creationIndex = new Map<string, CreationIndexRow>();
  private readonly commands = new Map<string, KlyxOrchestrationCommandRecord>();
  private readonly events: KlyxOrchestrationEvent[] = [];
  private eventSequence = 0;
  private readonly effectReceipts = new Map<string, KlyxEffectReceipt>();
  private readonly effectAttemptCounts = new Map<string, number>();
  private readonly effectMutationCounts = new Map<string, number>();
  private readonly faults = new Map<KlyxOrchestrationActionKind, FakeEffectFault[]>();
  private nextEligibilityState: "allowed" | "blocked" = "allowed";
  private forcedVersionConflictWorkflowId: string | null = null;

  async createOrGetWorkflow(input: KlyxWorkflowCreateInput): Promise<KlyxWorkflowCreateResult> {
    const existingIndex = this.creationIndex.get(input.creationKey);
    if (existingIndex) {
      const workflow = this.workflows.get(existingIndex.workflowId);
      if (!workflow) throw new Error("KLYX_FAKE_SUPABASE_CREATION_INDEX_CORRUPT");
      if (existingIndex.fingerprint !== input.fingerprint) {
        return { kind: "conflict", workflow: clone(workflow) };
      }
      return { kind: "existing", workflow: clone(workflow) };
    }
    const workflow = clone(input.workflow);
    this.workflows.set(workflow.id, workflow);
    this.creationIndex.set(input.creationKey, {
      fingerprint: input.fingerprint,
      workflowId: workflow.id,
    });
    return { kind: "created", workflow: clone(workflow) };
  }

  async getWorkflow(workflowId: string): Promise<KlyxOrchestrationWorkflow | null> {
    const workflow = this.workflows.get(workflowId);
    return workflow ? clone(workflow) : null;
  }

  async listWorkflows(statuses?: KlyxOrchestrationStatus[]): Promise<KlyxOrchestrationWorkflow[]> {
    const allowed = statuses ? new Set(statuses) : null;
    return [...this.workflows.values()]
      .filter((workflow) => !allowed || allowed.has(workflow.status))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(clone);
  }

  async getCommand(
    workflowId: string,
    idempotencyKey: string
  ): Promise<KlyxOrchestrationCommandRecord | null> {
    const record = this.commands.get(`${workflowId}::${idempotencyKey}`);
    return record ? clone(record) : null;
  }

  async applyCommand(input: KlyxApplyCommandInput): Promise<KlyxApplyCommandResult> {
    const commandKey = `${input.workflowId}::${input.idempotencyKey}`;
    const existingCommand = this.commands.get(commandKey);
    if (existingCommand) {
      if (existingCommand.fingerprint !== input.fingerprint) {
        return { kind: "conflict", workflow: clone(existingCommand.result) };
      }
      return { kind: "duplicate", workflow: clone(existingCommand.result) };
    }

    const current = this.workflows.get(input.workflowId);
    if (!current) throw new Error("KLYX_ORCHESTRATION_WORKFLOW_NOT_FOUND");
    if (this.forcedVersionConflictWorkflowId === input.workflowId) {
      this.forcedVersionConflictWorkflowId = null;
      const changed = clone(current);
      changed.version += 1;
      changed.updatedAtMs += 1;
      this.workflows.set(changed.id, changed);
      return { kind: "version_conflict", workflow: clone(changed) };
    }
    if (current.version !== input.expectedVersion) {
      return { kind: "version_conflict", workflow: clone(current) };
    }
    if (input.nextWorkflow.version !== input.expectedVersion + 1) {
      throw new Error("KLYX_FAKE_SUPABASE_VERSION_INCREMENT_INVALID");
    }
    const saved = clone(input.nextWorkflow);
    this.workflows.set(saved.id, saved);
    this.commands.set(commandKey, {
      workflowId: input.workflowId,
      idempotencyKey: input.idempotencyKey,
      fingerprint: input.fingerprint,
      result: clone(saved),
      createdAtMs: input.atMs,
    });
    await this.appendEvent(input.event);
    return { kind: "applied", workflow: clone(saved) };
  }

  async appendEvent(
    event: Omit<KlyxOrchestrationEvent, "id">
  ): Promise<KlyxOrchestrationEvent> {
    this.eventSequence += 1;
    const saved: KlyxOrchestrationEvent = {
      ...clone(event),
      id: `orchestration_event_${String(this.eventSequence).padStart(6, "0")}`,
    };
    this.events.push(saved);
    return clone(saved);
  }

  async listEvents(workflowId?: string): Promise<KlyxOrchestrationEvent[]> {
    return this.events
      .filter((event) => !workflowId || event.workflowId === workflowId)
      .map(clone);
  }

  injectVersionConflict(workflowId: string): void {
    this.forcedVersionConflictWorkflowId = workflowId;
  }

  failNext(action: KlyxOrchestrationActionKind, fault: FakeEffectFault): void {
    const queue = this.faults.get(action) ?? [];
    queue.push(fault);
    this.faults.set(action, queue);
  }

  setNextEligibility(state: "allowed" | "blocked"): void {
    this.nextEligibilityState = state;
  }

  async executeDomainEffect(input: {
    workflowId: string;
    actionId: string;
    action: KlyxOrchestrationActionKind;
    payload: KlyxJsonValue;
  }): Promise<KlyxEffectExecutionDecision> {
    const existing = this.effectReceipts.get(input.actionId);
    this.effectAttemptCounts.set(
      input.actionId,
      (this.effectAttemptCounts.get(input.actionId) ?? 0) + 1
    );
    if (existing) return { kind: "success", receipt: clone(existing) };
    const fault = this.consumeFault(input.action);
    if (fault === "retryable_before_apply") {
      return { kind: "retryable_failure", errorCode: "FAKE_SUPABASE_TRANSIENT" };
    }
    if (fault === "permanent_before_apply") {
      return { kind: "permanent_failure", errorCode: "FAKE_SUPABASE_PERMANENT" };
    }
    const result = this.domainResult(input);
    const receipt: KlyxEffectReceipt = {
      ref: `fake-supabase:${input.actionId}`,
      actionId: input.actionId,
      action: input.action,
      provider: "fake-supabase",
      result,
    };
    this.effectReceipts.set(input.actionId, clone(receipt));
    this.effectMutationCounts.set(
      input.actionId,
      (this.effectMutationCounts.get(input.actionId) ?? 0) + 1
    );
    if (fault === "apply_then_unknown") {
      return {
        kind: "unknown_external_state",
        errorCode: "FAKE_SUPABASE_AFTER_APPLY_CRASH",
      };
    }
    return { kind: "success", receipt: clone(receipt) };
  }

  async getEffectReceipt(actionId: string): Promise<KlyxEffectReceipt | null> {
    const receipt = this.effectReceipts.get(actionId);
    return receipt ? clone(receipt) : null;
  }

  effectAttempts(actionId: string): number {
    return this.effectAttemptCounts.get(actionId) ?? 0;
  }

  effectMutations(actionId: string): number {
    return this.effectMutationCounts.get(actionId) ?? 0;
  }

  private consumeFault(action: KlyxOrchestrationActionKind): FakeEffectFault | null {
    const queue = this.faults.get(action) ?? [];
    const fault = queue.shift() ?? null;
    this.faults.set(action, queue);
    return fault;
  }

  private domainResult(input: {
    workflowId: string;
    actionId: string;
    action: KlyxOrchestrationActionKind;
    payload: KlyxJsonValue;
  }): KlyxJsonValue {
    if (input.action === "eligibility_check") {
      const state = this.nextEligibilityState;
      this.nextEligibilityState = "allowed";
      return {
        state,
        allowed: state === "allowed",
        evidence: "fake-klyx-economic-eligibility",
      };
    }
    return {
      status: "ok",
      provider: "fake-supabase",
      action: input.action,
      workflowId: input.workflowId,
      actionId: input.actionId,
      input: clone(input.payload),
    };
  }
}

export type FakeEffectFault =
  | "retryable_before_apply"
  | "apply_then_unknown"
  | "permanent_before_apply";

const FINANCIAL_ACTIONS = new Set<KlyxOrchestrationActionKind>([
  "payment_capture",
  "refund_issue",
  "settlement_release",
]);

export class FakeStripeAdapter {
  readonly kind = "fake-stripe";
  private readonly receipts = new Map<string, KlyxEffectReceipt>();
  private readonly attempts = new Map<string, number>();
  private readonly mutations = new Map<string, number>();
  private readonly faults = new Map<KlyxOrchestrationActionKind, FakeEffectFault[]>();

  failNext(action: KlyxOrchestrationActionKind, fault: FakeEffectFault): void {
    if (!FINANCIAL_ACTIONS.has(action)) {
      throw new Error("KLYX_FAKE_STRIPE_ACTION_UNSUPPORTED");
    }
    const queue = this.faults.get(action) ?? [];
    queue.push(fault);
    this.faults.set(action, queue);
  }

  async execute(input: {
    workflowId: string;
    actionId: string;
    action: KlyxOrchestrationActionKind;
    payload: KlyxJsonValue;
  }): Promise<KlyxEffectExecutionDecision> {
    if (!FINANCIAL_ACTIONS.has(input.action)) {
      return {
        kind: "permanent_failure",
        errorCode: "FAKE_STRIPE_ACTION_UNSUPPORTED",
      };
    }
    this.attempts.set(input.actionId, (this.attempts.get(input.actionId) ?? 0) + 1);
    const existing = this.receipts.get(input.actionId);
    if (existing) return { kind: "success", receipt: clone(existing) };
    const queue = this.faults.get(input.action) ?? [];
    const fault = queue.shift() ?? null;
    this.faults.set(input.action, queue);
    if (fault === "retryable_before_apply") {
      return { kind: "retryable_failure", errorCode: "FAKE_STRIPE_TRANSIENT" };
    }
    if (fault === "permanent_before_apply") {
      return { kind: "permanent_failure", errorCode: "FAKE_STRIPE_PERMANENT" };
    }
    const ordinal = [...this.receipts.values()].filter(
      (receipt) => receipt.action === input.action
    ).length + 1;
    const result: Record<string, KlyxJsonValue> = {
      status:
        input.action === "payment_capture"
          ? "succeeded"
          : input.action === "refund_issue"
            ? "refunded"
            : "released",
      action: input.action,
      ordinal,
    };
    if (input.action === "payment_capture") result.paymentId = `pi_fake_${ordinal}`;
    if (input.action === "refund_issue") result.refundId = `re_fake_${ordinal}`;
    if (input.action === "settlement_release") result.transferId = `tr_fake_${ordinal}`;
    const receipt: KlyxEffectReceipt = {
      ref: `fake-stripe:${input.actionId}`,
      actionId: input.actionId,
      action: input.action,
      provider: "fake-stripe",
      result,
    };
    this.receipts.set(input.actionId, clone(receipt));
    this.mutations.set(input.actionId, (this.mutations.get(input.actionId) ?? 0) + 1);
    if (fault === "apply_then_unknown") {
      return {
        kind: "unknown_external_state",
        errorCode: "FAKE_STRIPE_AFTER_APPLY_CRASH",
      };
    }
    return { kind: "success", receipt: clone(receipt) };
  }

  async getReceipt(actionId: string): Promise<KlyxEffectReceipt | null> {
    const receipt = this.receipts.get(actionId);
    return receipt ? clone(receipt) : null;
  }

  effectAttempts(actionId: string): number {
    return this.attempts.get(actionId) ?? 0;
  }

  effectMutations(actionId: string): number {
    return this.mutations.get(actionId) ?? 0;
  }
}

export class FakeKlyxEffectRouter implements KlyxOrchestrationEffectAdapter {
  readonly kind = "fake-router";
  constructor(
    readonly supabase: FakeSupabaseAdapter,
    readonly stripe: FakeStripeAdapter
  ) {}

  async execute(input: {
    workflowId: string;
    actionId: string;
    action: KlyxOrchestrationActionKind;
    payload: KlyxJsonValue;
  }): Promise<KlyxEffectExecutionDecision> {
    return FINANCIAL_ACTIONS.has(input.action)
      ? this.stripe.execute(input)
      : this.supabase.executeDomainEffect(input);
  }

  async getReceipt(actionId: string): Promise<KlyxEffectReceipt | null> {
    return (
      (await this.stripe.getReceipt(actionId)) ??
      (await this.supabase.getEffectReceipt(actionId))
    );
  }

  externalNetworkCalls(): number {
    return 0;
  }
}

export type FakeDurableOrchestrationRuntime = {
  orchestrator: KlyxDurableOrchestrator;
  resilience: ReturnType<typeof createKlyxOrchestrationResilienceEngine>;
  resilienceStore: InMemoryKlyxResilienceStore;
  supabase: FakeSupabaseAdapter;
  stripe: FakeStripeAdapter;
  effects: FakeKlyxEffectRouter;
  clock: ManualKlyxResilienceClock;
  ids: DeterministicKlyxIds;
};

export function createFakeDurableOrchestrationRuntime(input?: {
  startMs?: number;
  supabase?: FakeSupabaseAdapter;
  stripe?: FakeStripeAdapter;
  resilienceStore?: InMemoryKlyxResilienceStore;
  clock?: ManualKlyxResilienceClock;
  ids?: DeterministicKlyxIds;
}): FakeDurableOrchestrationRuntime {
  const clock =
    input?.clock ?? new ManualKlyxResilienceClock(input?.startMs ?? 1_900_000_000_000);
  const ids = input?.ids ?? new DeterministicKlyxIds();
  const supabase = input?.supabase ?? new FakeSupabaseAdapter();
  const stripe = input?.stripe ?? new FakeStripeAdapter();
  const resilienceStore = input?.resilienceStore ?? new InMemoryKlyxResilienceStore();
  const effects = new FakeKlyxEffectRouter(supabase, stripe);
  const resilience = createKlyxOrchestrationResilienceEngine({
    store: resilienceStore,
    clock,
    effectAdapter: effects,
  });
  const orchestrator = new KlyxDurableOrchestrator({
    store: supabase,
    resilience,
    effectAdapter: effects,
    clock,
    ids,
  });
  return {
    orchestrator,
    resilience,
    resilienceStore,
    supabase,
    stripe,
    effects,
    clock,
    ids,
  };
}

export function recreateFakeDurableOrchestrationRuntime(
  previous: FakeDurableOrchestrationRuntime
): FakeDurableOrchestrationRuntime {
  return createFakeDurableOrchestrationRuntime({
    supabase: previous.supabase,
    stripe: previous.stripe,
    resilienceStore: previous.resilienceStore,
    clock: previous.clock,
    ids: previous.ids,
  });
}

export function assertNoExternalNetwork(runtime: FakeDurableOrchestrationRuntime): void {
  if (runtime.effects.externalNetworkCalls() !== 0) {
    throw new Error("KLYX_OFFLINE_CERTIFICATION_EXTERNAL_NETWORK_DETECTED");
  }
}

export function assertConcurrentMutation(error: unknown): boolean {
  return error instanceof KlyxOrchestrationConcurrentMutationError;
}
