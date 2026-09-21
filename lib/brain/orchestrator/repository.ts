import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  allowedNextWorkflowSteps,
  assertWorkflowTransition,
  workflowActionPolicy,
  type WorkflowActionType,
  type WorkflowMode,
  type WorkflowStatus,
  type WorkflowStep,
} from "@/lib/brain/orchestrator/state-machine";

type RpcWorkflowRow = {
  workflow_id: string;
  mode: WorkflowMode;
  current_step: WorkflowStep;
  status: WorkflowStatus;
  version: number;
};

type WorkflowRow = {
  id: string;
  account_id: string;
  profile_id: string;
  conversation_id: string | null;
  mode: WorkflowMode;
  current_step: WorkflowStep;
  status: WorkflowStatus;
  version: number;
  context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowSnapshot = {
  id: string;
  mode: WorkflowMode;
  currentStep: WorkflowStep;
  status: WorkflowStatus;
  version: number;
  allowedNextSteps: readonly WorkflowStep[];
  automaticSensitiveExecutionAllowed: false;
};

function firstRpcRow(value: unknown): RpcWorkflowRow {
  const rows = Array.isArray(value) ? value : [];

  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    throw new Error("KLYX_WORKFLOW_RPC_INVALID_RESULT");
  }

  return rows[0] as RpcWorkflowRow;
}

function optionalRpcRow(value: unknown): RpcWorkflowRow | null {
  const rows = Array.isArray(value) ? value : [];

  if (rows.length === 0) return null;

  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    throw new Error("KLYX_WORKFLOW_RPC_INVALID_RESULT");
  }

  return rows[0] as RpcWorkflowRow;
}

function snapshotFromRow(row: RpcWorkflowRow | WorkflowRow): WorkflowSnapshot {
  const id = "workflow_id" in row ? row.workflow_id : row.id;
  const currentStep = row.current_step;

  return {
    id,
    mode: row.mode,
    currentStep,
    status: row.status,
    version: Number(row.version),
    allowedNextSteps: allowedNextWorkflowSteps(row.mode, currentStep),
    automaticSensitiveExecutionAllowed: false,
  };
}

async function findActiveWorkflowForConversation(params: {
  accountId: string;
  profileId: string;
  conversationId: string;
  mode?: WorkflowMode;
}): Promise<WorkflowSnapshot | null> {
  let query = supabaseAdmin
    .from("klyx_workflows")
    .select(
      "id, account_id, profile_id, conversation_id, mode, current_step, status, version, context, created_at, updated_at"
    )
    .eq("account_id", params.accountId)
    .eq("profile_id", params.profileId)
    .eq("conversation_id", params.conversationId)
    .in("status", ["active", "waiting", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (params.mode) {
    query = query.eq("mode", params.mode);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return snapshotFromRow(data as WorkflowRow);
}

async function resumeOrphanedWorkflow(params: {
  accountId: string;
  profileId: string;
  conversationId: string;
  mode?: WorkflowMode;
}): Promise<WorkflowSnapshot | null> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_resume_orphaned_workflow",
    {
      p_account_id: params.accountId,
      p_profile_id: params.profileId,
      p_conversation_id: params.conversationId,
      p_mode: params.mode ?? null,
    }
  );

  if (error) {
    // Rolling-deploy compatibility: Vercel may briefly serve this code before
    // the Mission 19 Supabase migration has exposed the new RPC.
    if (error.code === "PGRST202") return null;
    throw new Error(error.message);
  }

  const row = optionalRpcRow(data);
  return row ? snapshotFromRow(row) : null;
}

export async function createOrResumeWorkflow(params: {
  accountId: string;
  profileId: string;
  conversationId: string | null;
  mode: WorkflowMode;
  context?: Record<string, unknown>;
}): Promise<WorkflowSnapshot> {
  if (params.conversationId) {
    const current = await findActiveWorkflowForConversation({
      accountId: params.accountId,
      profileId: params.profileId,
      conversationId: params.conversationId,
      mode: params.mode,
    });

    if (!current) {
      await resumeOrphanedWorkflow({
        accountId: params.accountId,
        profileId: params.profileId,
        conversationId: params.conversationId,
        mode: params.mode,
      });
    }
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: params.accountId,
      p_profile_id: params.profileId,
      p_conversation_id: params.conversationId,
      p_mode: params.mode,
      p_context: params.context ?? {},
    }
  );

  if (error) throw new Error(error.message);

  return snapshotFromRow(firstRpcRow(data));
}

export async function transitionWorkflow(params: {
  accountId: string;
  workflow: WorkflowSnapshot;
  toStep: WorkflowStep;
  eventType: string;
  actorType: "assistant" | "user" | "server" | "system" | "operator";
  payload?: Record<string, unknown>;
}): Promise<WorkflowSnapshot> {
  assertWorkflowTransition({
    mode: params.workflow.mode,
    from: params.workflow.currentStep,
    to: params.toStep,
  });

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_transition_workflow",
    {
      p_workflow_id: params.workflow.id,
      p_account_id: params.accountId,
      p_expected_version: params.workflow.version,
      p_to_step: params.toStep,
      p_event_type: params.eventType,
      p_actor_type: params.actorType,
      p_payload: params.payload ?? {},
    }
  );

  if (error) throw new Error(error.message);

  return snapshotFromRow(firstRpcRow(data));
}

export async function completeSettlementWorkflow(params: {
  accountId: string;
  workflow: WorkflowSnapshot;
  eventType?: string;
  actorType: "server" | "system" | "operator";
  payload?: Record<string, unknown>;
}): Promise<WorkflowSnapshot> {
  if (
    params.workflow.mode !== "earn" ||
    params.workflow.currentStep !== "settlement"
  ) {
    throw new Error("KLYX_WORKFLOW_SETTLEMENT_COMPLETION_INVALID");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_complete_settlement_workflow",
    {
      p_workflow_id: params.workflow.id,
      p_account_id: params.accountId,
      p_expected_version: params.workflow.version,
      p_event_type: params.eventType ?? "settlement_completed",
      p_actor_type: params.actorType,
      p_payload: params.payload ?? {},
    }
  );

  if (error) throw new Error(error.message);

  return snapshotFromRow(firstRpcRow(data));
}

export async function findLatestActiveWorkflow(params: {
  accountId: string;
  profileId: string;
  conversationId?: string | null;
}): Promise<WorkflowSnapshot | null> {
  if (params.conversationId) {
    const current = await findActiveWorkflowForConversation({
      accountId: params.accountId,
      profileId: params.profileId,
      conversationId: params.conversationId,
    });

    if (current) return current;

    return resumeOrphanedWorkflow({
      accountId: params.accountId,
      profileId: params.profileId,
      conversationId: params.conversationId,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("klyx_workflows")
    .select(
      "id, account_id, profile_id, conversation_id, mode, current_step, status, version, context, created_at, updated_at"
    )
    .eq("account_id", params.accountId)
    .eq("profile_id", params.profileId)
    .in("status", ["active", "waiting", "blocked"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return snapshotFromRow(data as WorkflowRow);
}

export async function proposeWorkflowAction(params: {
  accountId: string;
  workflow: WorkflowSnapshot;
  actionType: WorkflowActionType;
  idempotencyKey: string;
  input?: Record<string, unknown>;
}): Promise<{
  id: string;
  status: "proposed" | "awaiting_confirmation";
  mutationClass: "read" | "reversible" | "sensitive";
  requiresConfirmation: boolean;
  automaticExecutionAllowed: false;
}> {
  const policy = workflowActionPolicy(params.actionType);
  const status = policy.requiresConfirmation
    ? "awaiting_confirmation"
    : "proposed";

  const { data, error } = await supabaseAdmin
    .from("klyx_workflow_actions")
    .insert({
      workflow_id: params.workflow.id,
      account_id: params.accountId,
      action_type: params.actionType,
      mutation_class: policy.mutationClass,
      requires_confirmation: policy.requiresConfirmation,
      proposed_by: "assistant",
      executor: policy.executor,
      status,
      idempotency_key: params.idempotencyKey,
      input: params.input ?? {},
      authorization_context: {},
      result: {},
    })
    .select("id, status, mutation_class, requires_confirmation")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("klyx_workflow_actions")
        .select("id, status, mutation_class, requires_confirmation")
        .eq("workflow_id", params.workflow.id)
        .eq("idempotency_key", params.idempotencyKey)
        .single();

      if (existingError) throw new Error(existingError.message);

      return {
        id: String(existing.id),
        status:
          existing.status === "awaiting_confirmation"
            ? "awaiting_confirmation"
            : "proposed",
        mutationClass: existing.mutation_class,
        requiresConfirmation: Boolean(existing.requires_confirmation),
        automaticExecutionAllowed: false,
      };
    }

    throw new Error(error.message);
  }

  return {
    id: String(data.id),
    status:
      data.status === "awaiting_confirmation"
        ? "awaiting_confirmation"
        : "proposed",
    mutationClass: data.mutation_class,
    requiresConfirmation: Boolean(data.requires_confirmation),
    automaticExecutionAllowed: false,
  };
}
