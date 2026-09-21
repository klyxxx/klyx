import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

const SHA_RE = /^[0-9a-f]{40}$/;

export type KlyxOpsRuntimeHeartbeatComponent =
  | "financial_durable_worker"
  | "critical_alert_delivery";

export type KlyxOpsRuntimeHeartbeatStatus =
  | "healthy"
  | "degraded"
  | "stopped";

function deployedSha(): string {
  const value =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";

  if (!SHA_RE.test(value)) {
    throw new Error("KLYX_OPS_RUNTIME_HEARTBEAT_DEPLOYED_SHA_INVALID");
  }

  return value;
}

export async function recordKlyxOpsRuntimeHeartbeat(input: {
  component: KlyxOpsRuntimeHeartbeatComponent;
  status: KlyxOpsRuntimeHeartbeatStatus;
  details?: Record<string, unknown>;
}) {
  const sourceSha = deployedSha();
  const details = input.details ?? {};
  const encoded = JSON.stringify(details);

  if (encoded.length > 4000) {
    throw new Error("KLYX_OPS_RUNTIME_HEARTBEAT_DETAILS_TOO_LARGE");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_record_ops_runtime_heartbeat",
    {
      p_component: input.component,
      p_status: input.status,
      p_source_sha: sourceSha,
      p_details: details,
    }
  );

  if (error) {
    throw new Error("KLYX_OPS_RUNTIME_HEARTBEAT_WRITE_FAILED", {
      cause: error,
    });
  }

  if (data !== true) {
    throw new Error("KLYX_OPS_RUNTIME_HEARTBEAT_WRITE_INVALID_RESULT");
  }

  return {
    component: input.component,
    status: input.status,
    sourceSha,
  };
}
