import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxMeteredProvider =
  | "openai"
  | "sumsub"
  | "twilio"
  | "resend";

export type KlyxProviderCostAlertLevel = 0 | 75 | 90 | 100;

export type KlyxProviderCostClaim = {
  allowed: boolean;
  provider: KlyxMeteredProvider;
  operation: string;
  mode: "disabled" | "free" | "budgeted";
  reason: string;
  currency: string | null;
  reservedMinor: number;
  remainingMinor: number | null;
  alertLevel: KlyxProviderCostAlertLevel;
};

type RawClaim = {
  allowed?: unknown;
  provider?: unknown;
  operation?: unknown;
  mode?: unknown;
  reason?: unknown;
  currency?: unknown;
  reserved_minor?: unknown;
  remaining_minor?: unknown;
};

function asSafeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function costAlertLevel(input: {
  allowed: boolean;
  reservedMinor: number;
  remainingMinor: number | null;
}): KlyxProviderCostAlertLevel {
  if (!input.allowed) {
    return 100;
  }

  if (input.remainingMinor === null) {
    return 0;
  }

  const total = input.reservedMinor + input.remainingMinor;
  if (total <= 0) {
    return 0;
  }

  const utilization = input.reservedMinor / total;
  if (utilization >= 1) return 100;
  if (utilization >= 0.9) return 90;
  if (utilization >= 0.75) return 75;
  return 0;
}

function emitCostAlert(claim: KlyxProviderCostClaim): void {
  if (claim.alertLevel === 0) {
    return;
  }

  console.warn(
    JSON.stringify({
      marker:
        claim.alertLevel === 100
          ? "KLYX_EXTERNAL_COST_CIRCUIT_OPEN"
          : "KLYX_EXTERNAL_COST_ALERT",
      provider: claim.provider,
      operation: claim.operation,
      mode: claim.mode,
      reason: claim.reason,
      currency: claim.currency,
      reservedMinor: claim.reservedMinor,
      remainingMinor: claim.remainingMinor,
      thresholdPct: claim.alertLevel,
    }),
  );
}

export async function claimExternalProviderCost(
  provider: KlyxMeteredProvider,
  operation: string,
  idempotencyKey?: string | null,
): Promise<KlyxProviderCostClaim> {
  const normalizedOperation = operation.trim();

  if (!normalizedOperation) {
    throw new Error("KLYX_PROVIDER_COST_OPERATION_REQUIRED");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "claim_external_provider_cost",
    {
      p_provider: provider,
      p_operation: normalizedOperation,
      p_idempotency_key: idempotencyKey?.trim() || null,
    },
  );

  if (error) {
    throw new Error(
      `KLYX_PROVIDER_COST_CONTROL_UNAVAILABLE:${provider}:${error.message}`,
    );
  }

  const raw = (data ?? null) as RawClaim | null;

  if (!raw || typeof raw.allowed !== "boolean") {
    throw new Error(
      `KLYX_PROVIDER_COST_CONTROL_INVALID_RESPONSE:${provider}`,
    );
  }

  const reservedMinor = asSafeInteger(raw.reserved_minor);
  const remainingMinor =
    raw.remaining_minor === null || raw.remaining_minor === undefined
      ? null
      : asSafeInteger(raw.remaining_minor);

  const claim: KlyxProviderCostClaim = {
    allowed: raw.allowed,
    provider,
    operation: normalizedOperation,
    mode:
      raw.mode === "free" || raw.mode === "budgeted"
        ? raw.mode
        : "disabled",
    reason:
      typeof raw.reason === "string"
        ? raw.reason
        : "UNKNOWN",
    currency:
      typeof raw.currency === "string"
        ? raw.currency
        : null,
    reservedMinor,
    remainingMinor,
    alertLevel: costAlertLevel({
      allowed: raw.allowed,
      reservedMinor,
      remainingMinor,
    }),
  };

  emitCostAlert(claim);

  if (!claim.allowed) {
    throw new Error(
      `KLYX_PROVIDER_COST_BLOCKED:${provider}:${claim.reason}`,
    );
  }

  return claim;
}
