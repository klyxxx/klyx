import type { KlyxExternalProviderName } from "./contracts";
import type { KlyxProviderControlPlanePolicy } from "./control-plane-contracts";

export type KlyxExternalCostMode = "zero" | "guarded";

export type KlyxExternalCostDecision = {
  readonly provider: KlyxExternalProviderName;
  readonly mode: KlyxExternalCostMode;
  readonly allowed: boolean;
  readonly reason:
    | "FREE_OR_LOCAL"
    | "ZERO_COST_BLOCK"
    | "PROVIDER_NOT_ENABLED"
    | "PROVIDER_SPEND_CAP_NOT_CONFIRMED"
    | "PROVIDER_BUDGET_NOT_CONFIGURED";
  readonly budgetMinor: number | null;
  readonly currency: "USD";
};

const GUARDED_RUNTIME_PROVIDERS = new Set<KlyxExternalProviderName>([
  "openai",
  "sumsub",
  "twilio",
  "resend",
  "elmah_io",
]);

const PROVIDER_ENV_PREFIX: Record<KlyxExternalProviderName, string> = {
  openai: "OPENAI",
  supabase: "SUPABASE",
  stripe: "STRIPE",
  sumsub: "SUMSUB",
  twilio: "TWILIO",
  resend: "RESEND",
  tolgee: "TOLGEE",
  cloudflare_turnstile: "CLOUDFLARE_TURNSTILE",
  elmah_io: "ELMAH_IO",
  vercel: "VERCEL",
  github: "GITHUB",
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const MONTH_MS = 31 * DAY_MS;

const GUARDED_LOCAL_POLICY: Partial<
  Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
> = {
  openai: {
    quota: { max: 500, windowMs: DAY_MS },
    rateLimit: { max: 30, windowMs: 60_000 },
    timeoutMs: 15_000,
    circuitBreaker: {
      failureThreshold: 3,
      openMs: 60_000,
      halfOpenMaxCalls: 1,
    },
  },
  sumsub: {
    quota: { max: 100, windowMs: DAY_MS },
    rateLimit: { max: 5, windowMs: 60_000 },
    timeoutMs: 15_000,
    circuitBreaker: {
      failureThreshold: 3,
      openMs: 120_000,
      halfOpenMaxCalls: 1,
    },
  },
  twilio: {
    quota: { max: 50, windowMs: DAY_MS },
    rateLimit: { max: 3, windowMs: 60_000 },
    timeoutMs: 15_000,
    circuitBreaker: {
      failureThreshold: 3,
      openMs: 120_000,
      halfOpenMaxCalls: 1,
    },
  },
  resend: {
    quota: { max: 100, windowMs: DAY_MS },
    rateLimit: { max: 10, windowMs: 60_000 },
    timeoutMs: 10_000,
    circuitBreaker: {
      failureThreshold: 4,
      openMs: 60_000,
      halfOpenMaxCalls: 1,
    },
  },
  elmah_io: {
    quota: { max: 1_000, windowMs: DAY_MS },
    rateLimit: { max: 30, windowMs: 60_000 },
    timeoutMs: 2_500,
    circuitBreaker: {
      failureThreshold: 5,
      openMs: 60_000,
      halfOpenMaxCalls: 1,
    },
  },
};

function normalizedEnvFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readPositiveInteger(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function providerEnvName(
  provider: KlyxExternalProviderName,
  suffix: string
): string {
  return `KLYX_PROVIDER_${PROVIDER_ENV_PREFIX[provider]}_${suffix}`;
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  const configured = process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase();
  return configured === "guarded" ? "guarded" : "zero";
}

export function getKlyxExternalCostDecision(
  provider: KlyxExternalProviderName
): KlyxExternalCostDecision {
  const mode = getKlyxExternalCostMode();

  if (!GUARDED_RUNTIME_PROVIDERS.has(provider)) {
    return {
      provider,
      mode,
      allowed: true,
      reason: "FREE_OR_LOCAL",
      budgetMinor: null,
      currency: "USD",
    };
  }

  if (mode === "zero") {
    return {
      provider,
      mode,
      allowed: false,
      reason: "ZERO_COST_BLOCK",
      budgetMinor: 0,
      currency: "USD",
    };
  }

  if (!normalizedEnvFlag(providerEnvName(provider, "ENABLED"))) {
    return {
      provider,
      mode,
      allowed: false,
      reason: "PROVIDER_NOT_ENABLED",
      budgetMinor: null,
      currency: "USD",
    };
  }

  if (!normalizedEnvFlag(providerEnvName(provider, "SPEND_CAP_CONFIRMED"))) {
    return {
      provider,
      mode,
      allowed: false,
      reason: "PROVIDER_SPEND_CAP_NOT_CONFIRMED",
      budgetMinor: null,
      currency: "USD",
    };
  }

  const budgetMinor = readPositiveInteger(
    providerEnvName(provider, "MONTHLY_BUDGET_MINOR")
  );

  if (budgetMinor === null) {
    return {
      provider,
      mode,
      allowed: false,
      reason: "PROVIDER_BUDGET_NOT_CONFIGURED",
      budgetMinor: null,
      currency: "USD",
    };
  }

  if (provider === "openai" && !normalizedEnvFlag("KLYX_OPENAI_ENABLED")) {
    return {
      provider,
      mode,
      allowed: false,
      reason: "PROVIDER_NOT_ENABLED",
      budgetMinor,
      currency: "USD",
    };
  }

  return {
    provider,
    mode,
    allowed: true,
    reason: "FREE_OR_LOCAL",
    budgetMinor,
    currency: "USD",
  };
}

export function isKlyxExternalProviderSpendAllowed(
  provider: KlyxExternalProviderName
): boolean {
  return getKlyxExternalCostDecision(provider).allowed;
}

export function assertKlyxExternalProviderSpendAllowed(
  provider: KlyxExternalProviderName
): void {
  const decision = getKlyxExternalCostDecision(provider);

  if (decision.allowed) return;

  throw new Error(
    `KLYX_EXTERNAL_COST_BLOCKED:${provider}:${decision.reason}`
  );
}

export function getKlyxCostControlPolicyOverrides(): Partial<
  Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
> {
  const overrides: Partial<
    Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
  > = {};

  for (const provider of GUARDED_RUNTIME_PROVIDERS) {
    const decision = getKlyxExternalCostDecision(provider);
    const localPolicy = GUARDED_LOCAL_POLICY[provider] ?? {};

    overrides[provider] = {
      ...localPolicy,
      enabled: decision.allowed,
      budget:
        decision.allowed && decision.budgetMinor !== null
          ? {
              currency: decision.currency,
              maxMinor: decision.budgetMinor,
              windowMs: MONTH_MS,
              warnAtBps: 8_000,
            }
          : null,
    };
  }

  return overrides;
}

export const KLYX_ZERO_COST_RUNTIME_PROVIDERS = Object.freeze([
  "openai",
  "sumsub",
  "twilio",
  "resend",
  "elmah_io",
] as const);
