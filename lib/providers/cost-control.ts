import type { KlyxExternalProviderName } from "./contracts";

export type KlyxExternalCostMode = "zero" | "guarded";

export type KlyxExternalBillingKind =
  | "free_tier"
  | "metered"
  | "subscription"
  | "transactional";

export type KlyxExternalCostPolicy = {
  provider: KlyxExternalProviderName;
  billingKind: KlyxExternalBillingKind;
  zeroModeAllowed: boolean;
  automaticDisableWhenExhausted: boolean;
  defaultDailyCalls: number | null;
  defaultRolling30DayCalls: number | null;
  fallback: string;
};

export type KlyxExternalCostDecisionReason =
  | "allowed"
  | "zero_budget_paid_provider"
  | "provider_not_explicitly_enabled"
  | "provider_budget_missing"
  | "global_budget_missing"
  | "global_budget_overcommitted"
  | "daily_quota_exhausted"
  | "rolling_30d_quota_exhausted"
  | "quota_authority_unavailable";

export type KlyxExternalCostDecision = {
  allowed: boolean;
  provider: KlyxExternalProviderName;
  mode: KlyxExternalCostMode;
  reason: KlyxExternalCostDecisionReason;
  circuitOpen: boolean;
  degraded: boolean;
  fallback: string;
};

export const KLYX_EXTERNAL_COST_POLICIES = {
  openai: {
    provider: "openai",
    billingKind: "metered",
    zeroModeAllowed: false,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: 30,
    defaultRolling30DayCalls: 300,
    fallback: "deterministic KLYX assistant",
  },
  supabase: {
    provider: "supabase",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: false,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "local Supabase for development; production authority stays fail-closed",
  },
  stripe: {
    provider: "stripe",
    billingKind: "transactional",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: false,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "Stripe TEST/fakes only; existing KLYX LIVE authority remains mandatory",
  },
  sumsub: {
    provider: "sumsub",
    billingKind: "metered",
    zeroModeAllowed: false,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: 5,
    defaultRolling30DayCalls: 20,
    fallback: "sandbox/local evidence; economic eligibility remains blocked when proof is required",
  },
  twilio: {
    provider: "twilio",
    billingKind: "metered",
    zeroModeAllowed: false,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: 10,
    defaultRolling30DayCalls: 100,
    fallback: "email or manual verification only when KLYX policy permits it",
  },
  resend: {
    provider: "resend",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: 80,
    defaultRolling30DayCalls: 2400,
    fallback: "durable in-app notification/outbox",
  },
  tolgee: {
    provider: "tolgee",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "committed translation catalogs",
  },
  cloudflare_turnstile: {
    provider: "cloudflare_turnstile",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: false,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "explicit degraded server rate-limit policy only; never silent bypass",
  },
  elmah_io: {
    provider: "elmah_io",
    billingKind: "subscription",
    zeroModeAllowed: false,
    automaticDisableWhenExhausted: true,
    defaultDailyCalls: 100,
    defaultRolling30DayCalls: 2500,
    fallback: "Vercel logs plus KLYX internal server logs",
  },
  vercel: {
    provider: "vercel",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: false,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "local build/runtime; no automatic plan upgrade",
  },
  github: {
    provider: "github",
    billingKind: "free_tier",
    zeroModeAllowed: true,
    automaticDisableWhenExhausted: false,
    defaultDailyCalls: null,
    defaultRolling30DayCalls: null,
    fallback: "local Git/build/test; release mutations stop if control plane is unavailable",
  },
} as const satisfies Record<KlyxExternalProviderName, KlyxExternalCostPolicy>;

export type EvaluateKlyxExternalCostInput = {
  provider: KlyxExternalProviderName;
  mode: KlyxExternalCostMode;
  explicitlyEnabled: boolean;
  providerMonthlyBudgetUsd: number;
  globalMonthlyBudgetUsd: number;
  configuredPaidBudgetsTotalUsd: number;
  dailyQuotaAllowed?: boolean;
  rolling30DayQuotaAllowed?: boolean;
  quotaAuthorityAvailable?: boolean;
};

export function isKlyxPaidExternalProvider(
  provider: KlyxExternalProviderName
): boolean {
  const kind = KLYX_EXTERNAL_COST_POLICIES[provider].billingKind;
  return kind === "metered" || kind === "subscription";
}

function denied(
  input: EvaluateKlyxExternalCostInput,
  reason: KlyxExternalCostDecisionReason
): KlyxExternalCostDecision {
  const policy = KLYX_EXTERNAL_COST_POLICIES[input.provider];
  return {
    allowed: false,
    provider: input.provider,
    mode: input.mode,
    reason,
    circuitOpen: true,
    degraded: policy.automaticDisableWhenExhausted,
    fallback: policy.fallback,
  };
}

export function evaluateKlyxExternalCost(
  input: EvaluateKlyxExternalCostInput
): KlyxExternalCostDecision {
  const policy = KLYX_EXTERNAL_COST_POLICIES[input.provider];
  const paid = isKlyxPaidExternalProvider(input.provider);

  if (input.mode === "zero") {
    if (!policy.zeroModeAllowed) {
      return denied(input, "zero_budget_paid_provider");
    }
  } else if (paid) {
    if (!input.explicitlyEnabled) {
      return denied(input, "provider_not_explicitly_enabled");
    }
    if (input.globalMonthlyBudgetUsd <= 0) {
      return denied(input, "global_budget_missing");
    }
    if (input.providerMonthlyBudgetUsd <= 0) {
      return denied(input, "provider_budget_missing");
    }
    if (
      input.configuredPaidBudgetsTotalUsd > input.globalMonthlyBudgetUsd
    ) {
      return denied(input, "global_budget_overcommitted");
    }
  }

  if (input.quotaAuthorityAvailable === false) {
    return denied(input, "quota_authority_unavailable");
  }
  if (input.dailyQuotaAllowed === false) {
    return denied(input, "daily_quota_exhausted");
  }
  if (input.rolling30DayQuotaAllowed === false) {
    return denied(input, "rolling_30d_quota_exhausted");
  }

  return {
    allowed: true,
    provider: input.provider,
    mode: input.mode,
    reason: "allowed",
    circuitOpen: false,
    degraded: false,
    fallback: policy.fallback,
  };
}
