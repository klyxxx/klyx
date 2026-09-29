import "server-only";

import type { KlyxExternalProviderName } from "./contracts";
import { KlyxProviderControlPlane } from "./control-plane";
import type {
  KlyxProviderFallbackAction,
  KlyxProviderOperation,
} from "./control-plane-contracts";
import {
  createKlyxCostAwareProviderRegistry,
  KLYX_ZERO_BUDGET_RESEND_ENVELOPE,
  type KlyxExternalCostMode,
} from "./cost-policy";

export type KlyxExternalUsageSnapshot = {
  minute?: number;
  day?: number;
  month?: number;
};

export type KlyxExternalCostDecision = {
  provider: KlyxExternalProviderName;
  allowed: boolean;
  action: "allow" | KlyxProviderFallbackAction;
  circuitOpen: boolean;
  warning: boolean;
  reason: string;
};

let runtime:
  | { key: string; controlPlane: KlyxProviderControlPlane }
  | null = null;
const warned = new Set<string>();

function warnOnce(decision: KlyxExternalCostDecision): void {
  if (!decision.warning && !decision.circuitOpen) return;

  const key = `${decision.provider}:${decision.reason}`;
  if (warned.has(key)) return;
  warned.add(key);

  console.warn(
    JSON.stringify({
      marker: "KLYX_EXTERNAL_COST_ALERT",
      provider: decision.provider,
      reason: decision.reason,
      circuitOpen: decision.circuitOpen,
      action: decision.action,
    })
  );
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  return process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() ===
    "guarded_paid"
    ? "guarded_paid"
    : "zero_budget";
}

export function getKlyxProviderRuntimeMode(
  provider: KlyxExternalProviderName
): string | null {
  switch (provider) {
    case "stripe":
      return process.env.KLYX_STRIPE_MODE?.trim() || null;
    case "sumsub":
      return process.env.KLYX_SUMSUB_MODE?.trim() || null;
    case "twilio":
      return process.env.KLYX_TWILIO_MODE?.trim() || null;
    case "tolgee":
      return "static_snapshot";
    case "github":
      return "public_standard_runners";
    case "vercel":
      return "free_tier_control_plane";
    default:
      return null;
  }
}

function runtimeKey(): string {
  return JSON.stringify({
    costMode: getKlyxExternalCostMode(),
    stripe: getKlyxProviderRuntimeMode("stripe"),
    sumsub: getKlyxProviderRuntimeMode("sumsub"),
    twilio: getKlyxProviderRuntimeMode("twilio"),
    livePaymentsEnabled:
      process.env.KLYX_LIVE_PAYMENTS_ENABLED?.trim().toLowerCase() === "true",
  });
}

function getControlPlane(): KlyxProviderControlPlane {
  const key = runtimeKey();
  if (runtime?.key === key) return runtime.controlPlane;

  const controlPlane = new KlyxProviderControlPlane(
    createKlyxCostAwareProviderRegistry({
      mode: getKlyxExternalCostMode(),
      providerModes: {
        stripe: getKlyxProviderRuntimeMode("stripe"),
        sumsub: getKlyxProviderRuntimeMode("sumsub"),
        twilio: getKlyxProviderRuntimeMode("twilio"),
        livePaymentsEnabled:
          process.env.KLYX_LIVE_PAYMENTS_ENABLED?.trim().toLowerCase() === "true",
      },
    })
  );

  runtime = { key, controlPlane };
  return controlPlane;
}

function operationFor(provider: KlyxExternalProviderName): KlyxProviderOperation {
  const common = {
    provider,
    kind: "read" as const,
    retrySafety: "read_only" as const,
  };

  switch (provider) {
    case "openai":
      return { ...common, capability: "llm", operation: "generate" };
    case "supabase":
      return { ...common, capability: "database", operation: "query" };
    case "stripe":
      return { ...common, capability: "payments", operation: "test_only" };
    case "sumsub":
      return {
        ...common,
        capability: "identity_verification",
        operation: "sandbox_only",
      };
    case "twilio":
      return { ...common, capability: "phone_otp", operation: "trial_only" };
    case "resend":
      return {
        ...common,
        capability: "transactional_email",
        operation: "send",
      };
    case "tolgee":
      return {
        ...common,
        capability: "translation_management",
        operation: "runtime_external",
      };
    case "cloudflare_turnstile":
      return { ...common, capability: "bot_challenge", operation: "verify" };
    case "elmah_io":
      return { ...common, capability: "error_reporting", operation: "report" };
    case "vercel":
      return { ...common, capability: "hosting", operation: "control_plane" };
    case "github":
      return { ...common, capability: "ci", operation: "control_plane" };
  }
}

function resendDurableDecision(
  usage: KlyxExternalUsageSnapshot | undefined
): KlyxExternalCostDecision | null {
  if (!usage) return null;

  const ratios = [
    (usage.minute ?? 0) / KLYX_ZERO_BUDGET_RESEND_ENVELOPE.perMinute,
    (usage.day ?? 0) / KLYX_ZERO_BUDGET_RESEND_ENVELOPE.perDay,
    (usage.month ?? 0) / KLYX_ZERO_BUDGET_RESEND_ENVELOPE.perMonth,
  ];
  const exhausted = ratios.some((ratio) => ratio >= 1);
  const warning = Math.max(...ratios) >= KLYX_ZERO_BUDGET_RESEND_ENVELOPE.warnAtRatio;

  if (!exhausted) {
    return warning
      ? {
          provider: "resend",
          allowed: true,
          action: "allow",
          circuitOpen: false,
          warning: true,
          reason: "KLYX_RESEND_ZERO_COST_QUOTA_WARNING",
        }
      : null;
  }

  return {
    provider: "resend",
    allowed: false,
    action: "degrade",
    circuitOpen: true,
    warning: true,
    reason: "KLYX_RESEND_ZERO_COST_QUOTA_EXHAUSTED",
  };
}

export function getKlyxExternalProviderCostDecision(
  provider: KlyxExternalProviderName,
  usage?: KlyxExternalUsageSnapshot
): KlyxExternalCostDecision {
  if (provider === "resend") {
    const durable = resendDurableDecision(usage);
    if (durable && !durable.allowed) {
      warnOnce(durable);
      return durable;
    }
  }

  const controlPlane = getControlPlane();
  const admission = controlPlane.admit(operationFor(provider));

  if (!admission.allowed) {
    const decision: KlyxExternalCostDecision = {
      provider,
      allowed: false,
      action: admission.fallback.action,
      circuitOpen: true,
      warning: true,
      reason: `KLYX_EXTERNAL_COST_${admission.reason}`,
    };
    warnOnce(decision);
    return decision;
  }

  controlPlane.recordAttempt(admission.permit, {
    ok: true,
    code: "KLYX_EXTERNAL_COST_PREFLIGHT_ALLOWED",
    actualCostMinor: 0,
    costCurrency: "USD",
  });

  const durable = provider === "resend" ? resendDurableDecision(usage) : null;
  const decision: KlyxExternalCostDecision = {
    provider,
    allowed: true,
    action: "allow",
    circuitOpen: false,
    warning: durable?.warning ?? false,
    reason:
      durable?.reason ??
      (provider === "stripe"
        ? "KLYX_STRIPE_TEST_ZERO_COST_ALLOWED"
        : "KLYX_EXTERNAL_ZERO_COST_ALLOWED"),
  };
  warnOnce(decision);
  return decision;
}

export function assertKlyxExternalProviderCostAllowed(
  provider: KlyxExternalProviderName,
  usage?: KlyxExternalUsageSnapshot
): void {
  const decision = getKlyxExternalProviderCostDecision(provider, usage);
  if (!decision.allowed) throw new Error(decision.reason);
}

export function resetKlyxExternalCostRuntimeForTests(): void {
  runtime = null;
  warned.clear();
}
