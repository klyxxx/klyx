export type KlyxExternalProvider =
  | "openai"
  | "supabase"
  | "stripe"
  | "sumsub"
  | "twilio"
  | "resend"
  | "tolgee"
  | "cloudflare"
  | "elmah"
  | "vercel"
  | "github";

export type KlyxExternalCostMode =
  | "ZERO_COST"
  | "FREE_TIER"
  | "PAID_CONTROLLED";

export type KlyxExternalCostCriticality =
  | "critical"
  | "degradable"
  | "noncritical"
  | "transaction_funded";

export type KlyxExternalProviderPolicy = {
  provider: KlyxExternalProvider;
  criticality: KlyxExternalCostCriticality;
  zeroCostNetworkAllowed: boolean;
  freeDailyActions: number | null;
  freeMonthlyActions: number | null;
  paidActivationFloorNanousd: number;
  worstCaseActionNanousd: number;
  fallback: string;
  replaceable: boolean;
};

export type KlyxExternalCostDecision = {
  allowed: boolean;
  provider: KlyxExternalProvider;
  mode: KlyxExternalCostMode;
  reason:
    | "ZERO_COST_ALLOWED"
    | "ZERO_COST_BLOCKED"
    | "FREE_TIER_ALLOWED"
    | "FREE_TIER_DAILY_EXHAUSTED"
    | "FREE_TIER_MONTHLY_EXHAUSTED"
    | "PAID_BUDGET_NOT_ENABLED"
    | "PAID_BUDGET_BELOW_ACTIVATION_FLOOR"
    | "PAID_BUDGET_EXHAUSTED"
    | "PAID_CONTROLLED_ALLOWED";
  autoDisableNonCritical: boolean;
  alertPercent: 0 | 75 | 90 | 100;
};

const USD = 1_000_000_000;

export const KLYX_EXTERNAL_PROVIDER_POLICIES: Record<
  KlyxExternalProvider,
  KlyxExternalProviderPolicy
> = {
  openai: {
    provider: "openai",
    criticality: "degradable",
    zeroCostNetworkAllowed: false,
    freeDailyActions: 0,
    freeMonthlyActions: 0,
    paidActivationFloorNanousd: 0,
    // Conservative per-request reservation. The visible KLYX reply must stay
    // bounded and Luna is the default model when paid AI is explicitly enabled.
    worstCaseActionNanousd: 10_000_000,
    fallback: "deterministic_local_assistant",
    replaceable: true,
  },
  supabase: {
    provider: "supabase",
    criticality: "critical",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 25 * USD,
    worstCaseActionNanousd: 0,
    fallback: "local_supabase_cli_and_fakes",
    replaceable: true,
  },
  stripe: {
    provider: "stripe",
    criticality: "transaction_funded",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 0,
    worstCaseActionNanousd: 0,
    fallback: "offline_fake_or_test_mode",
    replaceable: true,
  },
  sumsub: {
    provider: "sumsub",
    criticality: "degradable",
    zeroCostNetworkAllowed: false,
    freeDailyActions: 0,
    freeMonthlyActions: 0,
    // Basic has a monthly commitment. Do not activate a paid Sumsub path with
    // a budget that cannot cover the commitment.
    paidActivationFloorNanousd: 149 * USD,
    worstCaseActionNanousd: 1_350_000_000,
    fallback: "test_fixture_or_human_review",
    replaceable: true,
  },
  twilio: {
    provider: "twilio",
    criticality: "degradable",
    zeroCostNetworkAllowed: false,
    freeDailyActions: 0,
    freeMonthlyActions: 0,
    paidActivationFloorNanousd: 0,
    // Country/channel fees vary. Reserve a deliberately high upper bound per
    // verification unless a later market policy supplies a tighter bound.
    worstCaseActionNanousd: 1 * USD,
    fallback: "test_otp_or_non_sms_verification",
    replaceable: true,
  },
  resend: {
    provider: "resend",
    criticality: "degradable",
    zeroCostNetworkAllowed: true,
    // Keep safety margin below Resend Free (100/day, 3,000/month).
    freeDailyActions: 80,
    freeMonthlyActions: 2_400,
    paidActivationFloorNanousd: 20 * USD,
    worstCaseActionNanousd: 0,
    fallback: "in_app_notification_and_persisted_alert",
    replaceable: true,
  },
  tolgee: {
    provider: "tolgee",
    criticality: "noncritical",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 0,
    worstCaseActionNanousd: 0,
    fallback: "committed_json_catalogs",
    replaceable: true,
  },
  cloudflare: {
    provider: "cloudflare",
    criticality: "degradable",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 0,
    worstCaseActionNanousd: 0,
    fallback: "server_rate_limits_and_auth_abuse_controls",
    replaceable: true,
  },
  elmah: {
    provider: "elmah",
    criticality: "noncritical",
    zeroCostNetworkAllowed: false,
    freeDailyActions: 0,
    freeMonthlyActions: 0,
    paidActivationFloorNanousd: 26 * USD,
    worstCaseActionNanousd: 0,
    fallback: "vercel_logs_supabase_ops_and_github_artifacts",
    replaceable: true,
  },
  vercel: {
    provider: "vercel",
    criticality: "critical",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 20 * USD,
    worstCaseActionNanousd: 0,
    fallback: "local_next_server",
    replaceable: true,
  },
  github: {
    provider: "github",
    criticality: "critical",
    zeroCostNetworkAllowed: true,
    freeDailyActions: null,
    freeMonthlyActions: null,
    paidActivationFloorNanousd: 0,
    worstCaseActionNanousd: 0,
    fallback: "local_git_and_local_test_runner",
    replaceable: true,
  },
};

function boundedPercent(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.floor((used / limit) * 100)));
}

export function klyxCostAlertPercent(used: number, limit: number): 0 | 75 | 90 | 100 {
  const percent = boundedPercent(used, limit);
  if (percent >= 100) return 100;
  if (percent >= 90) return 90;
  if (percent >= 75) return 75;
  return 0;
}

export function parseKlyxExternalCostMode(value: string | null | undefined): KlyxExternalCostMode {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "FREE_TIER" || normalized === "PAID_CONTROLLED") {
    return normalized;
  }
  return "ZERO_COST";
}

export function klyxExternalNetworkAllowedSynchronously(
  provider: KlyxExternalProvider,
  mode: KlyxExternalCostMode,
): boolean {
  const policy = KLYX_EXTERNAL_PROVIDER_POLICIES[provider];
  if (mode === "ZERO_COST") return policy.zeroCostNetworkAllowed;
  return true;
}

export function decideKlyxExternalCost(input: {
  provider: KlyxExternalProvider;
  mode: KlyxExternalCostMode;
  dailyUsed: number;
  monthlyUsed: number;
  monthlyBudgetNanousd: number;
}): KlyxExternalCostDecision {
  const policy = KLYX_EXTERNAL_PROVIDER_POLICIES[input.provider];
  const autoDisable = policy.criticality === "noncritical" || policy.criticality === "degradable";

  if (input.mode === "ZERO_COST") {
    return {
      allowed: policy.zeroCostNetworkAllowed,
      provider: input.provider,
      mode: input.mode,
      reason: policy.zeroCostNetworkAllowed ? "ZERO_COST_ALLOWED" : "ZERO_COST_BLOCKED",
      autoDisableNonCritical: !policy.zeroCostNetworkAllowed && autoDisable,
      alertPercent: policy.zeroCostNetworkAllowed ? 0 : 100,
    };
  }

  if (input.mode === "FREE_TIER") {
    if (policy.freeDailyActions !== null && input.dailyUsed >= policy.freeDailyActions) {
      return {
        allowed: false,
        provider: input.provider,
        mode: input.mode,
        reason: "FREE_TIER_DAILY_EXHAUSTED",
        autoDisableNonCritical: autoDisable,
        alertPercent: 100,
      };
    }
    if (policy.freeMonthlyActions !== null && input.monthlyUsed >= policy.freeMonthlyActions) {
      return {
        allowed: false,
        provider: input.provider,
        mode: input.mode,
        reason: "FREE_TIER_MONTHLY_EXHAUSTED",
        autoDisableNonCritical: autoDisable,
        alertPercent: 100,
      };
    }
    const limit = policy.freeMonthlyActions ?? policy.freeDailyActions ?? 0;
    const used = policy.freeMonthlyActions !== null ? input.monthlyUsed : input.dailyUsed;
    return {
      allowed: policy.zeroCostNetworkAllowed,
      provider: input.provider,
      mode: input.mode,
      reason: policy.zeroCostNetworkAllowed ? "FREE_TIER_ALLOWED" : "ZERO_COST_BLOCKED",
      autoDisableNonCritical: !policy.zeroCostNetworkAllowed && autoDisable,
      alertPercent: limit > 0 ? klyxCostAlertPercent(used, limit) : 0,
    };
  }

  if (input.monthlyBudgetNanousd <= 0) {
    return {
      allowed: false,
      provider: input.provider,
      mode: input.mode,
      reason: "PAID_BUDGET_NOT_ENABLED",
      autoDisableNonCritical: autoDisable,
      alertPercent: 100,
    };
  }

  if (input.monthlyBudgetNanousd < policy.paidActivationFloorNanousd) {
    return {
      allowed: false,
      provider: input.provider,
      mode: input.mode,
      reason: "PAID_BUDGET_BELOW_ACTIVATION_FLOOR",
      autoDisableNonCritical: autoDisable,
      alertPercent: 100,
    };
  }

  const maxCalls = policy.worstCaseActionNanousd > 0
    ? Math.floor(input.monthlyBudgetNanousd / policy.worstCaseActionNanousd)
    : Number.MAX_SAFE_INTEGER;

  if (input.monthlyUsed >= maxCalls) {
    return {
      allowed: false,
      provider: input.provider,
      mode: input.mode,
      reason: "PAID_BUDGET_EXHAUSTED",
      autoDisableNonCritical: autoDisable,
      alertPercent: 100,
    };
  }

  return {
    allowed: true,
    provider: input.provider,
    mode: input.mode,
    reason: "PAID_CONTROLLED_ALLOWED",
    autoDisableNonCritical: false,
    alertPercent: maxCalls === Number.MAX_SAFE_INTEGER
      ? 0
      : klyxCostAlertPercent(input.monthlyUsed, maxCalls),
  };
}
