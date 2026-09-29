import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxMeteredProvider =
  | "openai"
  | "sumsub"
  | "twilio"
  | "resend";

export type KlyxProviderCostClaim = {
  allowed: boolean;
  provider: KlyxMeteredProvider;
  operation: string;
  mode: "disabled" | "free" | "budgeted";
  reason: string;
  currency: string | null;
  reservedMinor: number;
  remainingMinor: number | null;
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
    reservedMinor: asSafeInteger(raw.reserved_minor),
    remainingMinor:
      raw.remaining_minor === null || raw.remaining_minor === undefined
        ? null
        : asSafeInteger(raw.remaining_minor),
  };

  if (!claim.allowed) {
    throw new Error(
      `KLYX_PROVIDER_COST_BLOCKED:${provider}:${claim.reason}`,
    );
  }

  return claim;
}
