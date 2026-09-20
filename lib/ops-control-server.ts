import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxOpsCapabilityScope = {
  capability: string;
  marketId?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  paymentProvider?: string | null;
  dependency?: string | null;
};

export type KlyxOpsCapabilityDecision = {
  allowed: boolean;
  blockingControlId: string | null;
  reasonCode: string | null;
  controlVersion: number | null;
};

type DecisionRow = {
  allowed: boolean;
  blocking_control_id: string | null;
  reason_code: string | null;
  control_version: number | string | null;
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export async function getKlyxOpsCapabilityDecision(
  input: KlyxOpsCapabilityScope
): Promise<KlyxOpsCapabilityDecision> {
  const capability = clean(input.capability)?.toLowerCase();

  if (!capability) {
    throw new Error("KLYX_OPS_CAPABILITY_REQUIRED");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_ops_capability_decision",
    {
      p_capability: capability,
      p_market_id: clean(input.marketId),
      p_region_id: clean(input.regionId),
      p_country_code: clean(input.countryCode)?.toUpperCase() ?? null,
      p_currency: clean(input.currency)?.toUpperCase() ?? null,
      p_payment_provider:
        clean(input.paymentProvider)?.toLowerCase() ?? null,
      p_dependency: clean(input.dependency)?.toLowerCase() ?? null,
    }
  );

  if (error) {
    throw new Error("KLYX_OPS_CONTROL_PLANE_UNAVAILABLE", {
      cause: error,
    });
  }

  const row = (
    Array.isArray(data) ? data[0] : data
  ) as DecisionRow | null | undefined;

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("KLYX_OPS_CONTROL_PLANE_INVALID_DECISION");
  }

  return {
    allowed: row.allowed,
    blockingControlId: row.blocking_control_id ?? null,
    reasonCode: row.reason_code ?? null,
    controlVersion:
      row.control_version === null ||
      row.control_version === undefined
        ? null
        : Number(row.control_version),
  };
}

export async function requireKlyxOpsCapabilityAvailable(
  input: KlyxOpsCapabilityScope
): Promise<KlyxOpsCapabilityDecision> {
  const decision = await getKlyxOpsCapabilityDecision(input);

  if (!decision.allowed) {
    const reason = decision.reasonCode ?? "OPS_CONTROL_DISABLED";
    throw new Error(`KLYX_OPS_CAPABILITY_DISABLED:${reason}`);
  }

  return decision;
}
