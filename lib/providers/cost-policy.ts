import { KLYX_EXTERNAL_PROVIDER_NAMES, type KlyxExternalProviderName } from "./contracts";
import type { KlyxProviderControlPlanePolicy } from "./control-plane-contracts";
import { createKlyxProviderControlPlaneRegistry } from "./control-plane-registry";

export type KlyxExternalCostMode = "zero_budget" | "guarded_paid";

export type KlyxProviderRuntimeModes = {
  stripe?: string | null;
  sumsub?: string | null;
  twilio?: string | null;
  livePaymentsEnabled?: boolean;
};

export const KLYX_ZERO_BUDGET_RESEND_ENVELOPE = {
  perMinute: 5,
  perDay: 50,
  perMonth: 1_500,
  warnAtRatio: 0.75,
} as const;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

const NO_RETRY = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  retryableCodes: [] as const,
};

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function allDisabledOverrides(): Partial<
  Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
> {
  return Object.fromEntries(
    KLYX_EXTERNAL_PROVIDER_NAMES.map((provider) => [provider, { enabled: false }])
  );
}

export function createKlyxZeroBudgetProviderOverrides(
  modes: KlyxProviderRuntimeModes = {}
): Partial<
  Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
> {
  const stripeTestOnly =
    normalized(modes.stripe) === "test" && modes.livePaymentsEnabled !== true;
  const sumsubSandboxOnly = normalized(modes.sumsub) === "sandbox";
  const twilioTrialOnly = normalized(modes.twilio) === "trial";

  return {
    openai: {
      enabled: false,
      retry: NO_RETRY,
    },
    supabase: {
      enabled: true,
      retry: NO_RETRY,
    },
    stripe: {
      enabled: stripeTestOnly,
      retry: NO_RETRY,
    },
    sumsub: {
      enabled: sumsubSandboxOnly,
      retry: NO_RETRY,
    },
    twilio: {
      enabled: twilioTrialOnly,
      retry: NO_RETRY,
    },
    resend: {
      enabled: true,
      rateLimit: {
        max: KLYX_ZERO_BUDGET_RESEND_ENVELOPE.perMinute,
        windowMs: MINUTE_MS,
      },
      quota: {
        max: KLYX_ZERO_BUDGET_RESEND_ENVELOPE.perDay,
        windowMs: DAY_MS,
      },
      timeoutMs: 8_000,
      retry: NO_RETRY,
      circuitBreaker: {
        failureThreshold: 3,
        openMs: 5 * MINUTE_MS,
        halfOpenMaxCalls: 1,
      },
    },
    tolgee: {
      enabled: false,
      retry: NO_RETRY,
    },
    cloudflare_turnstile: {
      enabled: true,
      timeoutMs: 5_000,
      retry: NO_RETRY,
    },
    elmah_io: {
      enabled: false,
      retry: NO_RETRY,
    },
    vercel: {
      enabled: true,
      retry: NO_RETRY,
    },
    github: {
      enabled: true,
      retry: NO_RETRY,
    },
  };
}

export function createKlyxCostAwareProviderRegistry(input: {
  mode: KlyxExternalCostMode;
  providerModes?: KlyxProviderRuntimeModes;
}) {
  const overrides =
    input.mode === "zero_budget"
      ? createKlyxZeroBudgetProviderOverrides(input.providerModes)
      : allDisabledOverrides();

  return createKlyxProviderControlPlaneRegistry(overrides);
}
