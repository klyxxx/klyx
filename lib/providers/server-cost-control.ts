import "server-only";

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { KlyxExternalProviderName } from "./contracts";

export type KlyxProviderCostAudience =
  | "INTERNAL"
  | "TEST"
  | "PILOT"
  | "LIMITED"
  | "GENERAL";

export type KlyxProviderCostEnvironment =
  | "test"
  | "production";

type ProviderCostRpcRow = {
  allowed: boolean;
  reason_code: string;
  reservation_id: string;
  reserved_cost_minor: number | string;
  currency_code: string | null;
  policy_version: number | string | null;
  window_started_at: string | null;
  calls_used: number | string;
  reserved_cost_used: number | string;
};

export type KlyxProviderBudgetReservation = {
  allowed: true;
  reasonCode: "ALLOWED";
  reservationId: string;
  provider: KlyxExternalProviderName;
  operation: string;
  environment: KlyxProviderCostEnvironment;
  audience: KlyxProviderCostAudience;
  requestKey: string;
  reservedCostMinor: number;
  currencyCode: string | null;
  policyVersion: number | null;
  windowStartedAt: string | null;
  callsUsed: number;
  reservedCostUsed: number;
};

const AUDIENCES = new Set<KlyxProviderCostAudience>([
  "INTERNAL",
  "TEST",
  "PILOT",
  "LIMITED",
  "GENERAL",
]);

function runtimeAudience(): KlyxProviderCostAudience {
  const value = process.env.KLYX_PROVIDER_COST_AUDIENCE
    ?.trim()
    .toUpperCase() as KlyxProviderCostAudience | undefined;

  if (!value || !AUDIENCES.has(value)) {
    throw new Error(
      "KLYX_PROVIDER_COST_AUDIENCE_MISSING_OR_INVALID"
    );
  }

  return value;
}

function runtimeEnvironment(): KlyxProviderCostEnvironment {
  const explicit = process.env.KLYX_PROVIDER_COST_ENV
    ?.trim()
    .toLowerCase();

  if (explicit === "test" || explicit === "production") {
    return explicit;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  return "test";
}

function safeInteger(value: number | string | null): number {
  const parsed = Number(value ?? 0);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("KLYX_PROVIDER_COST_GATE_INVALID_NUMBER");
  }

  return parsed;
}

export class KlyxProviderCostDeniedError extends Error {
  readonly reasonCode: string;

  constructor(reasonCode: string) {
    super(`KLYX_PROVIDER_COST_BLOCKED:${reasonCode}`);
    this.name = "KlyxProviderCostDeniedError";
    this.reasonCode = reasonCode;
  }
}

export async function reserveKlyxProviderBudget(input: {
  provider: KlyxExternalProviderName;
  operation: string;
  requestKey?: string | null;
  audience?: KlyxProviderCostAudience;
  environment?: KlyxProviderCostEnvironment;
}): Promise<KlyxProviderBudgetReservation> {
  const operation = input.operation.trim().toLowerCase();

  if (!operation) {
    throw new Error("KLYX_PROVIDER_COST_OPERATION_REQUIRED");
  }

  const audience = input.audience ?? runtimeAudience();
  const environment = input.environment ?? runtimeEnvironment();
  const requestKey = input.requestKey?.trim() || randomUUID();

  const { data, error } = await supabaseAdmin.rpc(
    "reserve_provider_cost_budget",
    {
      p_provider: input.provider,
      p_operation: operation,
      p_environment: environment,
      p_request_key: requestKey,
      p_audience: audience,
    }
  );

  if (error) {
    throw new Error("KLYX_PROVIDER_COST_GATE_UNAVAILABLE", {
      cause: error,
    });
  }

  const row = Array.isArray(data)
    ? (data[0] as ProviderCostRpcRow | undefined)
    : (data as ProviderCostRpcRow | null | undefined);

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("KLYX_PROVIDER_COST_GATE_INVALID_RESPONSE");
  }

  if (!row.allowed) {
    throw new KlyxProviderCostDeniedError(
      row.reason_code || "UNKNOWN"
    );
  }

  return {
    allowed: true,
    reasonCode: "ALLOWED",
    reservationId: row.reservation_id,
    provider: input.provider,
    operation,
    environment,
    audience,
    requestKey,
    reservedCostMinor: safeInteger(row.reserved_cost_minor),
    currencyCode: row.currency_code,
    policyVersion:
      row.policy_version === null
        ? null
        : safeInteger(row.policy_version),
    windowStartedAt: row.window_started_at,
    callsUsed: safeInteger(row.calls_used),
    reservedCostUsed: safeInteger(row.reserved_cost_used),
  };
}
