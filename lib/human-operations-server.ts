import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxHumanOpsPriority = "low" | "normal" | "high" | "critical";

export type KlyxHumanOpsStatus =
  | "open"
  | "triage"
  | "in_review"
  | "waiting_external"
  | "resolved"
  | "closed";

export type KlyxHumanOpsScope = {
  accountId?: string | null;
  bookingId?: string | null;
  failureDomainType?: string | null;
  failureDomainKey?: string | null;
  marketId?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  paymentProvider?: string | null;
  capability?: string | null;
  dependency?: string | null;
};

export type OpenKlyxHumanOpsCaseInput = KlyxHumanOpsScope & {
  caseKey: string;
  caseType: string;
  queueKey: string;
  sourceType: string;
  sourceRef: string;
  reasonCode: string;
  title: string;
  summary: string;
  priority?: KlyxHumanOpsPriority;
  dueAt?: string | null;
};

export type KlyxHumanOpsCaseMutationResult = {
  caseId?: string;
  status: KlyxHumanOpsStatus;
  version: number;
  created?: boolean;
  operationId?: string;
  correlationId?: string;
};

type OpenCaseRow = {
  case_id: string;
  case_status: KlyxHumanOpsStatus;
  case_version: number | string;
  created: boolean;
  operation_id: string;
  correlation_id: string;
};

type CaseTransitionRow = {
  case_status: KlyxHumanOpsStatus;
  case_version: number | string;
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function required(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function firstRow<T>(data: unknown, code: string): T {
  const row = (Array.isArray(data) ? data[0] : data) as T | null | undefined;
  if (!row) throw new Error(code);
  return row;
}

function parseVersion(value: number | string, code: string): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(code);
  }
  return version;
}

function normalizeScope(scope: KlyxHumanOpsScope) {
  return {
    p_account_id: clean(scope.accountId),
    p_booking_id: clean(scope.bookingId),
    p_failure_domain_type:
      clean(scope.failureDomainType)?.toLowerCase() ?? "global",
    p_failure_domain_key: clean(scope.failureDomainKey) ?? "global",
    p_market_id: clean(scope.marketId),
    p_region_id: clean(scope.regionId),
    p_country_code: clean(scope.countryCode)?.toUpperCase() ?? null,
    p_currency: clean(scope.currency)?.toUpperCase() ?? null,
    p_payment_provider:
      clean(scope.paymentProvider)?.toLowerCase() ?? null,
    p_capability: clean(scope.capability)?.toLowerCase() ?? null,
    p_dependency: clean(scope.dependency)?.toLowerCase() ?? null,
  };
}

export async function openKlyxHumanOpsCase(
  input: OpenKlyxHumanOpsCaseInput
): Promise<KlyxHumanOpsCaseMutationResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_open_human_ops_case",
    {
      p_case_key: required(input.caseKey, "KLYX_HUMAN_OPS_CASE_KEY_REQUIRED"),
      p_case_type: required(
        input.caseType,
        "KLYX_HUMAN_OPS_CASE_TYPE_REQUIRED"
      ).toLowerCase(),
      p_queue_key: required(
        input.queueKey,
        "KLYX_HUMAN_OPS_QUEUE_REQUIRED"
      ).toLowerCase(),
      p_source_type: required(
        input.sourceType,
        "KLYX_HUMAN_OPS_SOURCE_TYPE_REQUIRED"
      ).toLowerCase(),
      p_source_ref: required(
        input.sourceRef,
        "KLYX_HUMAN_OPS_SOURCE_REF_REQUIRED"
      ),
      p_reason_code: required(
        input.reasonCode,
        "KLYX_HUMAN_OPS_REASON_REQUIRED"
      ).toUpperCase(),
      p_title: required(input.title, "KLYX_HUMAN_OPS_TITLE_REQUIRED"),
      p_summary: required(input.summary, "KLYX_HUMAN_OPS_SUMMARY_REQUIRED"),
      p_priority: input.priority ?? "normal",
      ...normalizeScope(input),
      p_due_at: clean(input.dueAt),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_OPEN_FAILED", { cause: error });
  }

  const row = firstRow<OpenCaseRow>(
    data,
    "KLYX_HUMAN_OPS_CASE_OPEN_INVALID_RESULT"
  );

  return {
    caseId: row.case_id,
    status: row.case_status,
    version: parseVersion(
      row.case_version,
      "KLYX_HUMAN_OPS_CASE_OPEN_INVALID_VERSION"
    ),
    created: row.created,
    operationId: row.operation_id,
    correlationId: row.correlation_id,
  };
}

export async function openKlyxDlqHumanOpsCase(input: {
  jobId: string;
  caseKey: string;
  queueKey?: string;
  priority?: KlyxHumanOpsPriority;
  dueAt?: string | null;
}): Promise<KlyxHumanOpsCaseMutationResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_open_dlq_human_ops_case",
    {
      p_job_id: required(input.jobId, "KLYX_HUMAN_OPS_JOB_REQUIRED"),
      p_case_key: required(
        input.caseKey,
        "KLYX_HUMAN_OPS_CASE_KEY_REQUIRED"
      ),
      p_queue_key: (clean(input.queueKey) ?? "operations").toLowerCase(),
      p_priority: input.priority ?? "high",
      p_due_at: clean(input.dueAt),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_DLQ_CASE_OPEN_FAILED", {
      cause: error,
    });
  }

  const row = firstRow<OpenCaseRow>(
    data,
    "KLYX_HUMAN_OPS_DLQ_CASE_OPEN_INVALID_RESULT"
  );

  return {
    caseId: row.case_id,
    status: row.case_status,
    version: parseVersion(
      row.case_version,
      "KLYX_HUMAN_OPS_DLQ_CASE_OPEN_INVALID_VERSION"
    ),
    created: row.created,
    operationId: row.operation_id,
    correlationId: row.correlation_id,
  };
}

export async function assignKlyxHumanOpsCase(input: {
  caseId: string;
  actorAuthUserId: string;
  assigneeAuthUserId: string;
  expectedVersion: number;
  reasonCode: string;
}): Promise<KlyxHumanOpsCaseMutationResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_assign_human_ops_case",
    {
      p_case_id: required(input.caseId, "KLYX_HUMAN_OPS_CASE_ID_REQUIRED"),
      p_actor_auth_user_id: required(
        input.actorAuthUserId,
        "KLYX_HUMAN_OPS_OPERATOR_REQUIRED"
      ),
      p_assignee_auth_user_id: required(
        input.assigneeAuthUserId,
        "KLYX_HUMAN_OPS_ASSIGNEE_REQUIRED"
      ),
      p_expected_version: input.expectedVersion,
      p_reason_code: required(
        input.reasonCode,
        "KLYX_HUMAN_OPS_REASON_REQUIRED"
      ).toUpperCase(),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_ASSIGN_FAILED", { cause: error });
  }

  const row = firstRow<CaseTransitionRow>(
    data,
    "KLYX_HUMAN_OPS_CASE_ASSIGN_INVALID_RESULT"
  );

  return {
    status: row.case_status,
    version: parseVersion(
      row.case_version,
      "KLYX_HUMAN_OPS_CASE_ASSIGN_INVALID_VERSION"
    ),
  };
}

export async function transitionKlyxHumanOpsCase(input: {
  caseId: string;
  operatorAuthUserId: string;
  expectedVersion: number;
  toStatus: Exclude<KlyxHumanOpsStatus, "open">;
  reasonCode: string;
  note?: string | null;
}): Promise<KlyxHumanOpsCaseMutationResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_transition_human_ops_case",
    {
      p_case_id: required(input.caseId, "KLYX_HUMAN_OPS_CASE_ID_REQUIRED"),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_HUMAN_OPS_OPERATOR_REQUIRED"
      ),
      p_expected_version: input.expectedVersion,
      p_to_status: input.toStatus,
      p_reason_code: required(
        input.reasonCode,
        "KLYX_HUMAN_OPS_REASON_REQUIRED"
      ).toUpperCase(),
      p_note: clean(input.note),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_TRANSITION_FAILED", {
      cause: error,
    });
  }

  const row = firstRow<CaseTransitionRow>(
    data,
    "KLYX_HUMAN_OPS_CASE_TRANSITION_INVALID_RESULT"
  );

  return {
    status: row.case_status,
    version: parseVersion(
      row.case_version,
      "KLYX_HUMAN_OPS_CASE_TRANSITION_INVALID_VERSION"
    ),
  };
}

export async function linkKlyxHumanOpsCase(input: {
  caseId: string;
  resourceType: string;
  resourceRef: string;
  relationType?: string;
  operatorAuthUserId: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_link_human_ops_case",
    {
      p_case_id: required(input.caseId, "KLYX_HUMAN_OPS_CASE_ID_REQUIRED"),
      p_resource_type: required(
        input.resourceType,
        "KLYX_HUMAN_OPS_RESOURCE_TYPE_REQUIRED"
      ).toLowerCase(),
      p_resource_ref: required(
        input.resourceRef,
        "KLYX_HUMAN_OPS_RESOURCE_REF_REQUIRED"
      ),
      p_relation_type: (
        clean(input.relationType) ?? "related"
      ).toLowerCase(),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_HUMAN_OPS_OPERATOR_REQUIRED"
      ),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_LINK_FAILED", { cause: error });
  }

  const linkId =
    typeof data === "string"
      ? data
      : Array.isArray(data) && typeof data[0] === "string"
        ? data[0]
        : null;

  if (!linkId) {
    throw new Error("KLYX_HUMAN_OPS_CASE_LINK_INVALID_RESULT");
  }

  return linkId;
}

export async function redriveKlyxDeadLetterJob(input: {
  caseId: string;
  originalJobId: string;
  operatorAuthUserId: string;
  redriveKey: string;
  reasonCode: string;
  availableAt?: string | null;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_redrive_dead_lettered_job",
    {
      p_case_id: required(input.caseId, "KLYX_HUMAN_OPS_CASE_ID_REQUIRED"),
      p_original_job_id: required(
        input.originalJobId,
        "KLYX_HUMAN_OPS_JOB_REQUIRED"
      ),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_HUMAN_OPS_OPERATOR_REQUIRED"
      ),
      p_redrive_key: required(
        input.redriveKey,
        "KLYX_HUMAN_OPS_REDRIVE_KEY_REQUIRED"
      ),
      p_reason_code: required(
        input.reasonCode,
        "KLYX_HUMAN_OPS_REASON_REQUIRED"
      ).toUpperCase(),
      p_available_at: clean(input.availableAt),
    }
  );

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_REDRIVE_FAILED", { cause: error });
  }

  const jobId =
    typeof data === "string"
      ? data
      : Array.isArray(data) && typeof data[0] === "string"
        ? data[0]
        : null;

  if (!jobId) {
    throw new Error("KLYX_HUMAN_OPS_REDRIVE_INVALID_RESULT");
  }

  return jobId;
}

export async function listKlyxHumanOpsCases(input?: {
  statuses?: KlyxHumanOpsStatus[];
  queueKey?: string | null;
  assigneeAuthUserId?: string | null;
  limit?: number;
}) {
  const limit = input?.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("KLYX_HUMAN_OPS_CASE_LIMIT_INVALID");
  }

  let query = supabaseAdmin
    .from("ops_human_cases")
    .select(
      "id, case_key, operation_id, correlation_id, case_type, queue_key, source_type, source_ref, account_id, booking_id, failure_domain_type, failure_domain_key, market_id, region_id, country_code, currency, payment_provider, capability, dependency, priority, status, reason_code, title, summary, assigned_to_auth_user_id, due_at, claimed_at, resolved_at, closed_at, version, opened_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input?.statuses?.length) {
    query = query.in("status", input.statuses);
  }

  const queueKey = clean(input?.queueKey);
  if (queueKey) {
    query = query.eq("queue_key", queueKey.toLowerCase());
  }

  const assignee = clean(input?.assigneeAuthUserId);
  if (assignee) {
    query = query.eq("assigned_to_auth_user_id", assignee);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_LIST_FAILED", { cause: error });
  }

  return data ?? [];
}

export async function getKlyxHumanOpsCase(caseId: string) {
  const id = required(caseId, "KLYX_HUMAN_OPS_CASE_ID_REQUIRED");

  const [caseResult, linksResult, redrivesResult, eventsResult] =
    await Promise.all([
      supabaseAdmin
        .from("ops_human_cases")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("ops_human_case_links")
        .select(
          "id, resource_type, resource_ref, relation_type, metadata, created_at"
        )
        .eq("case_id", id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("ops_durable_job_redrives")
        .select(
          "id, original_job_id, new_job_id, redrive_key, operator_auth_user_id, reason_code, created_at"
        )
        .eq("case_id", id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("ops_human_cases")
        .select("operation_id")
        .eq("id", id)
        .maybeSingle(),
    ]);

  if (caseResult.error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_READ_FAILED", {
      cause: caseResult.error,
    });
  }
  if (!caseResult.data) return null;
  if (linksResult.error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_LINKS_READ_FAILED", {
      cause: linksResult.error,
    });
  }
  if (redrivesResult.error) {
    throw new Error("KLYX_HUMAN_OPS_REDRIVES_READ_FAILED", {
      cause: redrivesResult.error,
    });
  }
  if (eventsResult.error) {
    throw new Error("KLYX_HUMAN_OPS_CASE_OPERATION_READ_FAILED", {
      cause: eventsResult.error,
    });
  }

  const operationId = eventsResult.data?.operation_id ?? null;
  let events: unknown[] = [];

  if (operationId) {
    const { data, error } = await supabaseAdmin
      .from("ops_events")
      .select(
        "id, event_type, severity, domain_event_id, metadata, created_at"
      )
      .eq("operation_id", operationId)
      .eq("domain_resource_type", "human_case")
      .eq("domain_resource_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error("KLYX_HUMAN_OPS_CASE_EVENTS_READ_FAILED", {
        cause: error,
      });
    }

    events = data ?? [];
  }

  return {
    case: caseResult.data,
    links: linksResult.data ?? [],
    redrives: redrivesResult.data ?? [],
    events,
  };
}
