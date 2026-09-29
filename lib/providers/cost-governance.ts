import "server-only";

import { KLYX_PROVIDER_CATALOG } from "./catalog";
import type { KlyxExternalProviderName } from "./contracts";
import {
  createKlyxProviderControlPlaneRegistry,
} from "./control-plane-registry";

export type KlyxExternalCostMode = "zero_cash" | "guarded";

export type KlyxExternalCostDecision = {
  provider: KlyxExternalProviderName;
  mode: KlyxExternalCostMode;
  allowed: boolean;
  reasonCode:
    | "ZERO_CASH_FREE_PATH"
    | "ZERO_CASH_TEST_ONLY"
    | "ZERO_CASH_STATIC_ONLY"
    | "ZERO_CASH_PAID_PROVIDER_BLOCKED"
    | "ZERO_CASH_CONTROL_PLANE_ONLY"
    | "GUARDED_MODE";
  fallback: string | null;
};

const COST_GUARD_ALERTED = new Set<string>();

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getKlyxExternalCostMode(
  env: NodeJS.ProcessEnv = process.env
): KlyxExternalCostMode {
  const explicit = normalized(env.KLYX_EXTERNAL_COST_MODE);

  if (explicit === "guarded") {
    return "guarded";
  }

  if (explicit === "zero_cash") {
    return "zero_cash";
  }

  // Safest default: no paid external provider call. A future paid rollout must
  // explicitly opt into guarded mode and separately configure certified
  // provider budgets. Missing configuration can therefore never create spend.
  return "zero_cash";
}

function stripeIsTestOnly(env: NodeJS.ProcessEnv): boolean {
  if (normalized(env.KLYX_LIVE_PAYMENTS_ENABLED) === "true") {
    return false;
  }

  if (normalized(env.KLYX_STRIPE_MODE) === "test") {
    return true;
  }

  const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";

  return secret.startsWith("sk_test_") || publishable.startsWith("pk_test_");
}

export function getKlyxExternalCostDecision(
  provider: KlyxExternalProviderName,
  env: NodeJS.ProcessEnv = process.env
): KlyxExternalCostDecision {
  const mode = getKlyxExternalCostMode(env);
  const fallback = KLYX_PROVIDER_CATALOG[provider].freeFallback;

  if (mode === "guarded") {
    return {
      provider,
      mode,
      allowed: true,
      reasonCode: "GUARDED_MODE",
      fallback,
    };
  }

  switch (provider) {
    case "supabase":
    case "resend":
    case "cloudflare_turnstile":
      return {
        provider,
        mode,
        allowed: true,
        reasonCode: "ZERO_CASH_FREE_PATH",
        fallback,
      };

    case "stripe":
      return {
        provider,
        mode,
        allowed: stripeIsTestOnly(env),
        reasonCode: "ZERO_CASH_TEST_ONLY",
        fallback,
      };

    case "tolgee":
      return {
        provider,
        mode,
        allowed: false,
        reasonCode: "ZERO_CASH_STATIC_ONLY",
        fallback,
      };

    case "vercel":
    case "github":
      return {
        provider,
        mode,
        allowed: true,
        reasonCode: "ZERO_CASH_CONTROL_PLANE_ONLY",
        fallback,
      };

    case "openai":
    case "sumsub":
    case "twilio":
    case "elmah_io":
      return {
        provider,
        mode,
        allowed: false,
        reasonCode: "ZERO_CASH_PAID_PROVIDER_BLOCKED",
        fallback,
      };
  }
}

export function klyxExternalProviderAllowed(
  provider: KlyxExternalProviderName,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getKlyxExternalCostDecision(provider, env).allowed;
}

export class KlyxExternalCostBlockedError extends Error {
  readonly provider: KlyxExternalProviderName;
  readonly operation: string;
  readonly reasonCode: KlyxExternalCostDecision["reasonCode"];

  constructor(input: {
    provider: KlyxExternalProviderName;
    operation: string;
    reasonCode: KlyxExternalCostDecision["reasonCode"];
  }) {
    super(
      `KLYX external cost guard blocked ${input.provider}:${input.operation} (${input.reasonCode})`
    );
    this.name = "KlyxExternalCostBlockedError";
    this.provider = input.provider;
    this.operation = input.operation;
    this.reasonCode = input.reasonCode;
  }
}

function emitCostGuardAlert(
  provider: KlyxExternalProviderName,
  operation: string,
  reasonCode: KlyxExternalCostDecision["reasonCode"]
): void {
  const key = `${provider}:${operation}:${reasonCode}`;
  if (COST_GUARD_ALERTED.has(key)) {
    return;
  }
  COST_GUARD_ALERTED.add(key);

  console.warn(
    JSON.stringify({
      marker: "KLYX_EXTERNAL_COST_GUARD_BLOCKED",
      provider,
      operation,
      reasonCode,
    })
  );
}

export function assertKlyxExternalProviderAllowed(
  provider: KlyxExternalProviderName,
  operation: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  const decision = getKlyxExternalCostDecision(provider, env);

  if (decision.allowed) {
    return;
  }

  emitCostGuardAlert(provider, operation, decision.reasonCode);
  throw new KlyxExternalCostBlockedError({
    provider,
    operation,
    reasonCode: decision.reasonCode,
  });
}

export function createKlyxZeroCashControlPlaneOverrides() {
  const second = 1_000;
  const minute = 60 * second;
  const day = 24 * 60 * minute;

  return {
    openai: {
      enabled: false,
      timeoutMs: 8_000,
      circuitBreaker: {
        failureThreshold: 2,
        openMs: minute,
        halfOpenMaxCalls: 1,
      },
    },
    sumsub: {
      enabled: false,
      timeoutMs: 15_000,
    },
    twilio: {
      enabled: false,
      timeoutMs: 15_000,
    },
    elmah_io: {
      enabled: false,
      timeoutMs: 2_500,
    },
    resend: {
      enabled: true,
      quota: {
        // The connected Free plan exposes 100/day and 3,000/month. Capping at
        // 90/day leaves headroom and stays below 3,000 even across 31 days.
        max: 90,
        windowMs: day,
      },
      rateLimit: {
        // Connected account currently exposes 10 API requests/second.
        max: 8,
        windowMs: second,
      },
      timeoutMs: 5_000,
      circuitBreaker: {
        failureThreshold: 3,
        openMs: minute,
        halfOpenMaxCalls: 1,
      },
    },
  } as const;
}

export function createKlyxCostGovernedProviderControlPlaneRegistry(
  env: NodeJS.ProcessEnv = process.env
) {
  if (getKlyxExternalCostMode(env) === "zero_cash") {
    return createKlyxProviderControlPlaneRegistry(
      createKlyxZeroCashControlPlaneOverrides()
    );
  }

  return createKlyxProviderControlPlaneRegistry();
}
