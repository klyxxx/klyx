import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxOpsIncidentSeverity = "warning" | "error" | "critical";
export type KlyxOpsIncidentStatus =
  | "open"
  | "acknowledged"
  | "mitigating"
  | "resolved"
  | "closed";

export type KlyxOpsIncidentScope = {
  marketId?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  paymentProvider?: string | null;
  capability?: string | null;
  dependency?: string | null;
};

type IncidentMutationRow = {
  incident_id: string;
  status?: KlyxOpsIncidentStatus;
  version: number | string;
  operation_id?: string;
};

type BreakerMutationRow = {
  incident_id: string;
  control_id: string;
  control_version: number | string;
  incident_version: number | string;
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function required(value: string | null | undefined, code: string): string {
  const normalized = clean(value);
  if (!normalized) throw new Error(code);
  return normalized;
}

function integer(value: number | string | null | undefined, code: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(code);
  }
  return parsed;
}

function mutationRow(data: unknown): IncidentMutationRow | null {
  return (Array.isArray(data) ? data[0] : data) as
    | IncidentMutationRow
    | null
    | undefined ?? null;
}

function breakerRow(data: unknown): BreakerMutationRow | null {
  return (Array.isArray(data) ? data[0] : data) as
    | BreakerMutationRow
    | null
    | undefined ?? null;
}

export async function openKlyxOpsIncident(input: {
  incidentKey: string;
  sourceType: string;
  sourceRef: string;
  severity: KlyxOpsIncidentSeverity;
  reasonCode: string;
  title: string;
  summary: string;
  operatorAuthUserId: string;
  scope?: KlyxOpsIncidentScope;
}) {
  const { data, error } = await supabaseAdmin.rpc("klyx_open_ops_incident", {
    p_incident_key: required(
      input.incidentKey,
      "KLYX_OPS_INCIDENT_KEY_REQUIRED"
    ),
    p_source_type: required(
      input.sourceType,
      "KLYX_OPS_INCIDENT_SOURCE_TYPE_REQUIRED"
    ).toLowerCase(),
    p_source_ref: required(
      input.sourceRef,
      "KLYX_OPS_INCIDENT_SOURCE_REF_REQUIRED"
    ),
    p_severity: input.severity,
    p_reason_code: required(
      input.reasonCode,
      "KLYX_OPS_INCIDENT_REASON_REQUIRED"
    ).toUpperCase(),
    p_title: required(input.title, "KLYX_OPS_INCIDENT_TITLE_REQUIRED"),
    p_summary: required(input.summary, "KLYX_OPS_INCIDENT_SUMMARY_REQUIRED"),
    p_operator_auth_user_id: required(
      input.operatorAuthUserId,
      "KLYX_OPS_INCIDENT_OPERATOR_REQUIRED"
    ),
    p_market_id: clean(input.scope?.marketId),
    p_region_id: clean(input.scope?.regionId),
    p_country_code: clean(input.scope?.countryCode)?.toUpperCase() ?? null,
    p_currency: clean(input.scope?.currency)?.toUpperCase() ?? null,
    p_payment_provider:
      clean(input.scope?.paymentProvider)?.toLowerCase() ?? null,
    p_capability: clean(input.scope?.capability)?.toLowerCase() ?? null,
    p_dependency: clean(input.scope?.dependency)?.toLowerCase() ?? null,
  });

  if (error) {
    throw new Error("KLYX_OPS_INCIDENT_OPEN_FAILED", { cause: error });
  }

  const row = mutationRow(data);
  if (!row?.incident_id) {
    throw new Error("KLYX_OPS_INCIDENT_OPEN_INVALID_RESULT");
  }

  return {
    incidentId: row.incident_id,
    version: integer(row.version, "KLYX_OPS_INCIDENT_VERSION_INVALID"),
    operationId: row.operation_id ?? null,
  };
}

export async function transitionKlyxOpsIncident(input: {
  incidentId: string;
  operatorAuthUserId: string;
  expectedVersion: number;
  toStatus: Exclude<KlyxOpsIncidentStatus, "open">;
  reasonCode: string;
  note?: string | null;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_transition_ops_incident",
    {
      p_incident_id: required(
        input.incidentId,
        "KLYX_OPS_INCIDENT_ID_REQUIRED"
      ),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_OPS_INCIDENT_OPERATOR_REQUIRED"
      ),
      p_expected_version: integer(
        input.expectedVersion,
        "KLYX_OPS_INCIDENT_VERSION_REQUIRED"
      ),
      p_to_status: input.toStatus,
      p_reason_code: required(
        input.reasonCode,
        "KLYX_OPS_INCIDENT_REASON_REQUIRED"
      ).toUpperCase(),
      p_note: clean(input.note),
    }
  );

  if (error) {
    throw new Error("KLYX_OPS_INCIDENT_TRANSITION_FAILED", { cause: error });
  }

  const row = mutationRow(data);
  if (!row?.incident_id || !row.status) {
    throw new Error("KLYX_OPS_INCIDENT_TRANSITION_INVALID_RESULT");
  }

  return {
    incidentId: row.incident_id,
    status: row.status,
    version: integer(row.version, "KLYX_OPS_INCIDENT_VERSION_INVALID"),
  };
}

export async function openKlyxIncidentCircuitBreaker(input: {
  incidentId: string;
  operatorAuthUserId: string;
  expectedVersion: number;
  reasonCode: string;
  expiresAt?: string | null;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_open_incident_circuit_breaker",
    {
      p_incident_id: required(
        input.incidentId,
        "KLYX_OPS_INCIDENT_ID_REQUIRED"
      ),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_OPS_INCIDENT_OPERATOR_REQUIRED"
      ),
      p_expected_version: integer(
        input.expectedVersion,
        "KLYX_OPS_INCIDENT_VERSION_REQUIRED"
      ),
      p_reason_code: required(
        input.reasonCode,
        "KLYX_OPS_INCIDENT_REASON_REQUIRED"
      ).toUpperCase(),
      p_expires_at: clean(input.expiresAt),
    }
  );

  if (error) {
    throw new Error("KLYX_OPS_INCIDENT_BREAKER_OPEN_FAILED", { cause: error });
  }

  const row = breakerRow(data);
  if (!row?.incident_id || !row.control_id) {
    throw new Error("KLYX_OPS_INCIDENT_BREAKER_OPEN_INVALID_RESULT");
  }

  return {
    incidentId: row.incident_id,
    controlId: row.control_id,
    controlVersion: integer(
      row.control_version,
      "KLYX_OPS_INCIDENT_CONTROL_VERSION_INVALID"
    ),
    incidentVersion: integer(
      row.incident_version,
      "KLYX_OPS_INCIDENT_VERSION_INVALID"
    ),
  };
}

export async function closeKlyxIncidentCircuitBreaker(input: {
  incidentId: string;
  operatorAuthUserId: string;
  expectedVersion: number;
  reasonCode: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_close_incident_circuit_breaker",
    {
      p_incident_id: required(
        input.incidentId,
        "KLYX_OPS_INCIDENT_ID_REQUIRED"
      ),
      p_operator_auth_user_id: required(
        input.operatorAuthUserId,
        "KLYX_OPS_INCIDENT_OPERATOR_REQUIRED"
      ),
      p_expected_version: integer(
        input.expectedVersion,
        "KLYX_OPS_INCIDENT_VERSION_REQUIRED"
      ),
      p_reason_code: required(
        input.reasonCode,
        "KLYX_OPS_INCIDENT_REASON_REQUIRED"
      ).toUpperCase(),
    }
  );

  if (error) {
    throw new Error("KLYX_OPS_INCIDENT_BREAKER_CLOSE_FAILED", { cause: error });
  }

  const row = breakerRow(data);
  if (!row?.incident_id || !row.control_id) {
    throw new Error("KLYX_OPS_INCIDENT_BREAKER_CLOSE_INVALID_RESULT");
  }

  return {
    incidentId: row.incident_id,
    controlId: row.control_id,
    controlVersion: integer(
      row.control_version,
      "KLYX_OPS_INCIDENT_CONTROL_VERSION_INVALID"
    ),
    incidentVersion: integer(
      row.incident_version,
      "KLYX_OPS_INCIDENT_VERSION_INVALID"
    ),
  };
}

export async function listKlyxOpsIncidents(input?: {
  statuses?: KlyxOpsIncidentStatus[];
  severity?: KlyxOpsIncidentSeverity | null;
  limit?: number;
}) {
  const limit = input?.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("KLYX_OPS_INCIDENT_LIMIT_INVALID");
  }

  let query = supabaseAdmin
    .from("ops_incidents_current")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input?.statuses?.length) {
    query = query.in("status", input.statuses);
  }
  if (input?.severity) {
    query = query.eq("severity", input.severity);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("KLYX_OPS_INCIDENT_LIST_FAILED", { cause: error });
  }

  return data ?? [];
}

export async function getKlyxOpsIncident(incidentId: string) {
  const id = required(incidentId, "KLYX_OPS_INCIDENT_ID_REQUIRED");

  const [incidentResult, eventsResult, controlsResult] = await Promise.all([
    supabaseAdmin
      .from("ops_incidents_current")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("ops_incident_events")
      .select(
        "id, event_key, event_type, actor_auth_user_id, reason_code, note, details, created_at"
      )
      .eq("incident_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("ops_incident_controls")
      .select(
        "id, control_id, opened_by_auth_user_id, opened_at, closed_by_auth_user_id, closed_at"
      )
      .eq("incident_id", id)
      .order("opened_at", { ascending: true }),
  ]);

  if (incidentResult.error) {
    throw new Error("KLYX_OPS_INCIDENT_READ_FAILED", {
      cause: incidentResult.error,
    });
  }
  if (!incidentResult.data) return null;

  if (eventsResult.error) {
    throw new Error("KLYX_OPS_INCIDENT_EVENTS_READ_FAILED", {
      cause: eventsResult.error,
    });
  }
  if (controlsResult.error) {
    throw new Error("KLYX_OPS_INCIDENT_CONTROLS_READ_FAILED", {
      cause: controlsResult.error,
    });
  }

  return {
    incident: incidentResult.data,
    events: eventsResult.data ?? [],
    controls: controlsResult.data ?? [],
  };
}
