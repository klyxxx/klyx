export type KlyxExternalProvider =
  | "openai"
  | "supabase"
  | "stripe"
  | "sumsub"
  | "twilio"
  | "resend"
  | "tolgee"
  | "cloudflare"
  | "elmah_io"
  | "vercel"
  | "github";

export type KlyxExternalCostMode = "zero" | "guarded";
export type KlyxExternalCostCriticality = "critical" | "important" | "non_critical";

export type KlyxExternalCostDecision = {
  allowed: boolean;
  circuit: "closed" | "open";
  reason:
    | "ZERO_COST_PROVIDER"
    | "ZERO_BUDGET_MODE"
    | "BUDGET_NOT_CONFIGURED"
    | "ESTIMATED_COST_EXCEEDS_BUDGET"
    | "WITHIN_BUDGET";
  fallback: string;
  maxCallsFromBudget: number | null;
};

export const KLYX_EXTERNAL_PROVIDER_DEFAULTS: Record<
  KlyxExternalProvider,
  {
    metered: boolean;
    zeroModeAllowed: boolean;
    estimatedCostMicroUsd: number;
    fallback: string;
  }
> = {
  openai: {
    metered: true,
    zeroModeAllowed: false,
    estimatedCostMicroUsd: 100_000,
    fallback: "deterministic_local_reply",
  },
  supabase: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "local_supabase_for_tests",
  },
  stripe: {
    metered: true,
    zeroModeAllowed: false,
    estimatedCostMicroUsd: 0,
    fallback: "stripe_test_or_fake_adapter",
  },
  sumsub: {
    metered: true,
    zeroModeAllowed: false,
    estimatedCostMicroUsd: 1_350_000,
    fallback: "pending_verification_or_local_fixture",
  },
  twilio: {
    metered: true,
    zeroModeAllowed: false,
    estimatedCostMicroUsd: 250_000,
    fallback: "local_test_otp_or_no_phone_verification",
  },
  resend: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "in_app_notification",
  },
  tolgee: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "committed_translation_catalogs",
  },
  cloudflare: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "application_rate_limits",
  },
  elmah_io: {
    metered: true,
    zeroModeAllowed: false,
    estimatedCostMicroUsd: 0,
    fallback: "vercel_logs_and_local_server_logs",
  },
  vercel: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "local_nextjs_runtime",
  },
  github: {
    metered: false,
    zeroModeAllowed: true,
    estimatedCostMicroUsd: 0,
    fallback: "local_test_and_build",
  },
};

export function evaluateKlyxExternalCost(input: {
  mode: KlyxExternalCostMode;
  provider: KlyxExternalProvider;
  estimatedCostMicroUsd?: number;
  monthlyBudgetMicroUsd?: number | null;
  criticality?: KlyxExternalCostCriticality;
}): KlyxExternalCostDecision {
  const defaults = KLYX_EXTERNAL_PROVIDER_DEFAULTS[input.provider];
  const estimatedCostMicroUsd = Math.max(
    0,
    Math.floor(input.estimatedCostMicroUsd ?? defaults.estimatedCostMicroUsd)
  );
  const monthlyBudgetMicroUsd =
    input.monthlyBudgetMicroUsd == null
      ? null
      : Math.max(0, Math.floor(input.monthlyBudgetMicroUsd));

  if (!defaults.metered && estimatedCostMicroUsd === 0) {
    return {
      allowed: true,
      circuit: "closed",
      reason: "ZERO_COST_PROVIDER",
      fallback: defaults.fallback,
      maxCallsFromBudget: null,
    };
  }

  if (input.mode === "zero" && !defaults.zeroModeAllowed) {
    return {
      allowed: false,
      circuit: "open",
      reason: "ZERO_BUDGET_MODE",
      fallback: defaults.fallback,
      maxCallsFromBudget: 0,
    };
  }

  if (monthlyBudgetMicroUsd == null || monthlyBudgetMicroUsd <= 0) {
    return {
      allowed: false,
      circuit: "open",
      reason: "BUDGET_NOT_CONFIGURED",
      fallback: defaults.fallback,
      maxCallsFromBudget: 0,
    };
  }

  if (estimatedCostMicroUsd <= 0) {
    return {
      allowed: true,
      circuit: "closed",
      reason: "WITHIN_BUDGET",
      fallback: defaults.fallback,
      maxCallsFromBudget: null,
    };
  }

  const maxCallsFromBudget = Math.floor(
    monthlyBudgetMicroUsd / estimatedCostMicroUsd
  );

  if (maxCallsFromBudget < 1) {
    return {
      allowed: false,
      circuit: "open",
      reason: "ESTIMATED_COST_EXCEEDS_BUDGET",
      fallback: defaults.fallback,
      maxCallsFromBudget: 0,
    };
  }

  return {
    allowed: true,
    circuit: "closed",
    reason: "WITHIN_BUDGET",
    fallback: defaults.fallback,
    maxCallsFromBudget,
  };
}
