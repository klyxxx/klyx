import type { KlyxExternalProviderName } from "./contracts";

export type KlyxExternalCostMode = "zero" | "bounded";

export type KlyxExternalProviderBillingKind =
  | "unmetered_free"
  | "free_quota"
  | "paid_usage"
  | "transaction_linked"
  | "fixed_subscription"
  | "control_plane";

export type KlyxExternalProviderMeter =
  | "openai_request"
  | "sumsub_verification_session"
  | "twilio_verification_start"
  | "resend_email"
  | "elmah_message";

export type KlyxExternalProviderCostPolicy = {
  provider: KlyxExternalProviderName;
  billingKind: KlyxExternalProviderBillingKind;
  zeroBudgetBehavior: "allow" | "degrade" | "block" | "test_only";
  freeFallback: string | null;
  replaceable: boolean;
};

export type KlyxExternalMeterBudget = {
  meter: KlyxExternalProviderMeter;
  provider: KlyxExternalProviderName;
  dailyLimit: number;
  monthlyLimit: number;
  critical: boolean;
  automaticDisableAtLimit: boolean;
};

const MAX_CONFIGURED_LIMIT = 1_000_000_000;

export const KLYX_EXTERNAL_PROVIDER_COST_POLICIES = {
  openai: {
    provider: "openai",
    billingKind: "paid_usage",
    zeroBudgetBehavior: "degrade",
    freeFallback: "deterministic KLYX assistant replies and existing engines",
    replaceable: true,
  },
  supabase: {
    provider: "supabase",
    billingKind: "free_quota",
    zeroBudgetBehavior: "allow",
    freeFallback: "local Supabase for development and deterministic fixtures for pure engines",
    replaceable: true,
  },
  stripe: {
    provider: "stripe",
    billingKind: "transaction_linked",
    zeroBudgetBehavior: "test_only",
    freeFallback: "Stripe TEST adapters and pure-finance fixtures; no real-money fallback",
    replaceable: true,
  },
  sumsub: {
    provider: "sumsub",
    billingKind: "paid_usage",
    zeroBudgetBehavior: "block",
    freeFallback: "local KYC fixtures in development/test only; never fake verified production identity",
    replaceable: true,
  },
  twilio: {
    provider: "twilio",
    billingKind: "paid_usage",
    zeroBudgetBehavior: "block",
    freeFallback: "local OTP fixtures in development/test or another policy-approved verification channel",
    replaceable: true,
  },
  resend: {
    provider: "resend",
    billingKind: "free_quota",
    zeroBudgetBehavior: "allow",
    freeFallback: "durable in-app notification/outbox",
    replaceable: true,
  },
  tolgee: {
    provider: "tolgee",
    billingKind: "free_quota",
    zeroBudgetBehavior: "allow",
    freeFallback: "committed static locale catalogs",
    replaceable: true,
  },
  cloudflare_turnstile: {
    provider: "cloudflare_turnstile",
    billingKind: "unmetered_free",
    zeroBudgetBehavior: "allow",
    freeFallback: "server-side rate limiting only where policy explicitly permits degradation",
    replaceable: true,
  },
  elmah_io: {
    provider: "elmah_io",
    billingKind: "fixed_subscription",
    zeroBudgetBehavior: "degrade",
    freeFallback: "Vercel/runtime logs and KLYX internal telemetry",
    replaceable: true,
  },
  vercel: {
    provider: "vercel",
    billingKind: "control_plane",
    zeroBudgetBehavior: "allow",
    freeFallback: "local build/test and portable build artifacts",
    replaceable: true,
  },
  github: {
    provider: "github",
    billingKind: "control_plane",
    zeroBudgetBehavior: "allow",
    freeFallback: "local Git plus local certification commands",
    replaceable: true,
  },
} as const satisfies Record<
  KlyxExternalProviderName,
  KlyxExternalProviderCostPolicy
>;

const METER_CONFIG = {
  openai_request: {
    provider: "openai",
    dailyEnv: "KLYX_COST_OPENAI_DAILY_LIMIT",
    monthlyEnv: "KLYX_COST_OPENAI_MONTHLY_LIMIT",
    zeroDaily: 0,
    zeroMonthly: 0,
    boundedDefaultDaily: 0,
    boundedDefaultMonthly: 0,
    critical: false,
  },
  sumsub_verification_session: {
    provider: "sumsub",
    dailyEnv: "KLYX_COST_SUMSUB_DAILY_LIMIT",
    monthlyEnv: "KLYX_COST_SUMSUB_MONTHLY_LIMIT",
    zeroDaily: 0,
    zeroMonthly: 0,
    boundedDefaultDaily: 0,
    boundedDefaultMonthly: 0,
    critical: true,
  },
  twilio_verification_start: {
    provider: "twilio",
    dailyEnv: "KLYX_COST_TWILIO_DAILY_LIMIT",
    monthlyEnv: "KLYX_COST_TWILIO_MONTHLY_LIMIT",
    zeroDaily: 0,
    zeroMonthly: 0,
    boundedDefaultDaily: 0,
    boundedDefaultMonthly: 0,
    critical: true,
  },
  resend_email: {
    provider: "resend",
    dailyEnv: "KLYX_COST_RESEND_DAILY_LIMIT",
    monthlyEnv: "KLYX_COST_RESEND_MONTHLY_LIMIT",
    zeroDaily: 90,
    zeroMonthly: 2700,
    boundedDefaultDaily: 90,
    boundedDefaultMonthly: 2700,
    critical: false,
  },
  elmah_message: {
    provider: "elmah_io",
    dailyEnv: "KLYX_COST_ELMAH_DAILY_LIMIT",
    monthlyEnv: "KLYX_COST_ELMAH_MONTHLY_LIMIT",
    zeroDaily: 0,
    zeroMonthly: 0,
    boundedDefaultDaily: 0,
    boundedDefaultMonthly: 0,
    critical: false,
  },
} as const satisfies Record<
  KlyxExternalProviderMeter,
  {
    provider: KlyxExternalProviderName;
    dailyEnv: string;
    monthlyEnv: string;
    zeroDaily: number;
    zeroMonthly: number;
    boundedDefaultDaily: number;
    boundedDefaultMonthly: number;
    critical: boolean;
  }
>;

function configuredNonNegativeInteger(
  envName: string,
  fallback: number
): number {
  const raw = process.env[envName]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) return fallback;

  return Math.min(value, MAX_CONFIGURED_LIMIT);
}

export function getKlyxExternalCostMode(): KlyxExternalCostMode {
  return process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() === "bounded"
    ? "bounded"
    : "zero";
}

export function getKlyxExternalMeterBudget(
  meter: KlyxExternalProviderMeter
): KlyxExternalMeterBudget {
  const config = METER_CONFIG[meter];
  const mode = getKlyxExternalCostMode();

  if (mode === "zero") {
    return {
      meter,
      provider: config.provider,
      dailyLimit: config.zeroDaily,
      monthlyLimit: config.zeroMonthly,
      critical: config.critical,
      automaticDisableAtLimit: !config.critical,
    };
  }

  return {
    meter,
    provider: config.provider,
    dailyLimit: configuredNonNegativeInteger(
      config.dailyEnv,
      config.boundedDefaultDaily
    ),
    monthlyLimit: configuredNonNegativeInteger(
      config.monthlyEnv,
      config.boundedDefaultMonthly
    ),
    critical: config.critical,
    automaticDisableAtLimit: !config.critical,
  };
}

export function isKlyxExternalMeterArmed(
  meter: KlyxExternalProviderMeter
): boolean {
  const budget = getKlyxExternalMeterBudget(meter);
  return budget.dailyLimit > 0 && budget.monthlyLimit > 0;
}

export function isKlyxElmahIoCostEnabled(): boolean {
  return isKlyxExternalMeterArmed("elmah_message");
}

export function externalCostAlertLevel(
  used: number,
  limit: number
): 0 | 50 | 80 | 100 {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return limit === 0 && used > 0 ? 100 : 0;
  }

  const ratio = used / limit;
  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return 80;
  if (ratio >= 0.5) return 50;
  return 0;
}
