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

export type KlyxExternalCostAction =
  | "allow"
  | "fallback"
  | "block";

export type KlyxExternalCostPolicy = {
  provider: KlyxExternalProvider;
  externalRuntimeCalls: boolean;
  paidRisk: boolean;
  critical: boolean;
  fallback: string;
  defaultMonthlyBudgetMicrousd: number;
  defaultMonthlyUnitLimit: number | null;
  defaultDailyUnitLimit: number | null;
  fixedMonthlyCommitmentMicrousd: number;
  budgetEnv?: string;
  unitLimitEnv?: string;
  dailyUnitLimitEnv?: string;
  paidActivationEnv?: string;
};

export type KlyxExternalCostDecision = {
  action: KlyxExternalCostAction;
  provider: KlyxExternalProvider;
  reason:
    | "CONTROL_DISABLED_FOR_TEST"
    | "NO_EXTERNAL_RUNTIME_CALL"
    | "FREE_QUOTA_ALLOWED"
    | "PAID_BUDGET_ALLOWED"
    | "PAID_ACTIVATION_REQUIRED"
    | "ZERO_BUDGET_FALLBACK"
    | "ZERO_BUDGET_BLOCK"
    | "CALL_COST_EXCEEDS_BUDGET";
  monthlyBudgetMicrousd: number;
  monthlyUnitLimit: number | null;
  dailyUnitLimit: number | null;
  estimatedCostMicrousd: number;
  fixedMonthlyCommitmentMicrousd: number;
};

const POLICIES: Record<KlyxExternalProvider, KlyxExternalCostPolicy> = {
  openai: {
    provider: "openai",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: false,
    fallback: "deterministic_klyx",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    defaultDailyUnitLimit: 0,
    fixedMonthlyCommitmentMicrousd: 0,
    budgetEnv: "KLYX_OPENAI_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_OPENAI_MONTHLY_CALL_LIMIT",
    dailyUnitLimitEnv: "KLYX_OPENAI_DAILY_CALL_LIMIT",
  },
  supabase: {
    provider: "supabase",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: true,
    fallback: "local_supabase_for_development",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
    defaultDailyUnitLimit: null,
    fixedMonthlyCommitmentMicrousd: 0,
  },
  stripe: {
    provider: "stripe",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: true,
    fallback: "stripe_test_mode",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
    defaultDailyUnitLimit: null,
    fixedMonthlyCommitmentMicrousd: 0,
  },
  sumsub: {
    provider: "sumsub",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: true,
    fallback: "local_test_fixture_only",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    defaultDailyUnitLimit: 0,
    fixedMonthlyCommitmentMicrousd: 149_000_000,
    budgetEnv: "KLYX_SUMSUB_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_SUMSUB_MONTHLY_VERIFICATION_LIMIT",
    dailyUnitLimitEnv: "KLYX_SUMSUB_DAILY_VERIFICATION_LIMIT",
    paidActivationEnv: "KLYX_SUMSUB_PAID_SUBSCRIPTION_AUTHORIZED",
  },
  twilio: {
    provider: "twilio",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: false,
    fallback: "local_test_otp_only",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    defaultDailyUnitLimit: 0,
    fixedMonthlyCommitmentMicrousd: 0,
    budgetEnv: "KLYX_TWILIO_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_TWILIO_MONTHLY_VERIFICATION_LIMIT",
    dailyUnitLimitEnv: "KLYX_TWILIO_DAILY_VERIFICATION_LIMIT",
  },
  resend: {
    provider: "resend",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: false,
    fallback: "in_app_notification_and_server_log",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 2700,
    defaultDailyUnitLimit: 90,
    fixedMonthlyCommitmentMicrousd: 0,
    unitLimitEnv: "KLYX_RESEND_MONTHLY_EMAIL_LIMIT",
    dailyUnitLimitEnv: "KLYX_RESEND_DAILY_EMAIL_LIMIT",
  },
  tolgee: {
    provider: "tolgee",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: false,
    fallback: "committed_translation_catalogs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    defaultDailyUnitLimit: 0,
    fixedMonthlyCommitmentMicrousd: 0,
  },
  cloudflare: {
    provider: "cloudflare",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: false,
    fallback: "server_rate_limits",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
    defaultDailyUnitLimit: null,
    fixedMonthlyCommitmentMicrousd: 0,
  },
  elmah: {
    provider: "elmah",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: false,
    fallback: "vercel_and_server_logs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    defaultDailyUnitLimit: 0,
    fixedMonthlyCommitmentMicrousd: 26_000_000,
    budgetEnv: "KLYX_ELMAH_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_ELMAH_MONTHLY_EVENT_LIMIT",
    dailyUnitLimitEnv: "KLYX_ELMAH_DAILY_EVENT_LIMIT",
    paidActivationEnv: "KLYX_ELMAH_PAID_SUBSCRIPTION_AUTHORIZED",
  },
  vercel: {
    provider: "vercel",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: true,
    fallback: "local_nextjs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
    defaultDailyUnitLimit: null,
    fixedMonthlyCommitmentMicrousd: 20_000_000,
    paidActivationEnv: "KLYX_VERCEL_PRO_AUTHORIZED",
  },
  github: {
    provider: "github",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: true,
    fallback: "local_git",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
    defaultDailyUnitLimit: null,
    fixedMonthlyCommitmentMicrousd: 0,
  },
};

function finiteNonNegativeNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function usdToMicrousd(value: string | undefined, fallback: number): number {
  const parsed = finiteNonNegativeNumber(value);
  if (parsed === null) return fallback;
  return Math.floor(parsed * 1_000_000);
}

function integerLimit(value: string | undefined, fallback: number | null): number | null {
  const parsed = finiteNonNegativeNumber(value);
  if (parsed === null) return fallback;
  return Math.floor(parsed);
}

export function externalCostControlEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (
    env.NODE_ENV === "test" &&
    env.KLYX_EXTERNAL_COST_CONTROL_TEST_MODE !== "enforce"
  ) {
    return false;
  }
  return env.KLYX_EXTERNAL_COST_CONTROL_ENABLED !== "0";
}

export function getExternalCostPolicy(
  provider: KlyxExternalProvider,
  env: NodeJS.ProcessEnv = process.env
): KlyxExternalCostPolicy {
  const base = POLICIES[provider];
  return {
    ...base,
    defaultMonthlyBudgetMicrousd: base.budgetEnv
      ? usdToMicrousd(env[base.budgetEnv], base.defaultMonthlyBudgetMicrousd)
      : base.defaultMonthlyBudgetMicrousd,
    defaultMonthlyUnitLimit: base.unitLimitEnv
      ? integerLimit(env[base.unitLimitEnv], base.defaultMonthlyUnitLimit)
      : base.defaultMonthlyUnitLimit,
    defaultDailyUnitLimit: base.dailyUnitLimitEnv
      ? integerLimit(env[base.dailyUnitLimitEnv], base.defaultDailyUnitLimit)
      : base.defaultDailyUnitLimit,
  };
}

export function getGlobalPaidBudgetMicrousd(
  env: NodeJS.ProcessEnv = process.env
): number {
  return usdToMicrousd(env.KLYX_EXTERNAL_PAID_BUDGET_USD, 0);
}

export function decideExternalCostAction(input: {
  provider: KlyxExternalProvider;
  estimatedCostMicrousd?: number;
  env?: NodeJS.ProcessEnv;
}): KlyxExternalCostDecision {
  const env = input.env ?? process.env;
  const policy = getExternalCostPolicy(input.provider, env);
  const globalBudgetMicrousd = getGlobalPaidBudgetMicrousd(env);
  const effectiveBudgetMicrousd = policy.paidRisk
    ? Math.min(policy.defaultMonthlyBudgetMicrousd, globalBudgetMicrousd)
    : policy.defaultMonthlyBudgetMicrousd;
  const estimatedCostMicrousd = Math.max(
    0,
    Math.floor(input.estimatedCostMicrousd ?? 0)
  );

  const base = {
    provider: policy.provider,
    monthlyBudgetMicrousd: effectiveBudgetMicrousd,
    monthlyUnitLimit: policy.defaultMonthlyUnitLimit,
    dailyUnitLimit: policy.defaultDailyUnitLimit,
    estimatedCostMicrousd,
    fixedMonthlyCommitmentMicrousd: policy.fixedMonthlyCommitmentMicrousd,
  };

  if (!externalCostControlEnabled(env)) {
    return { ...base, action: "allow", reason: "CONTROL_DISABLED_FOR_TEST" };
  }

  if (!policy.externalRuntimeCalls) {
    return { ...base, action: "allow", reason: "NO_EXTERNAL_RUNTIME_CALL" };
  }

  if (!policy.paidRisk) {
    return { ...base, action: "allow", reason: "FREE_QUOTA_ALLOWED" };
  }

  if (
    policy.paidActivationEnv &&
    policy.fixedMonthlyCommitmentMicrousd > 0 &&
    env[policy.paidActivationEnv] !== "1"
  ) {
    return {
      ...base,
      action: policy.critical ? "block" : "fallback",
      reason: "PAID_ACTIVATION_REQUIRED",
    };
  }

  if (effectiveBudgetMicrousd <= 0) {
    return {
      ...base,
      action: policy.critical ? "block" : "fallback",
      reason: policy.critical ? "ZERO_BUDGET_BLOCK" : "ZERO_BUDGET_FALLBACK",
    };
  }

  if (estimatedCostMicrousd > effectiveBudgetMicrousd) {
    return {
      ...base,
      action: policy.critical ? "block" : "fallback",
      reason: "CALL_COST_EXCEEDS_BUDGET",
    };
  }

  return { ...base, action: "allow", reason: "PAID_BUDGET_ALLOWED" };
}

export const KLYX_EXTERNAL_PROVIDER_POLICIES = POLICIES;
