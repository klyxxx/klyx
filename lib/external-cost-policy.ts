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
  budgetEnv?: string;
  unitLimitEnv?: string;
};

export type KlyxExternalCostDecision = {
  action: KlyxExternalCostAction;
  provider: KlyxExternalProvider;
  reason:
    | "CONTROL_DISABLED_FOR_TEST"
    | "NO_EXTERNAL_RUNTIME_CALL"
    | "FREE_QUOTA_ALLOWED"
    | "PAID_BUDGET_ALLOWED"
    | "ZERO_BUDGET_FALLBACK"
    | "ZERO_BUDGET_BLOCK"
    | "CALL_COST_EXCEEDS_BUDGET";
  monthlyBudgetMicrousd: number;
  monthlyUnitLimit: number | null;
  estimatedCostMicrousd: number;
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
    budgetEnv: "KLYX_OPENAI_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_OPENAI_MONTHLY_CALL_LIMIT",
  },
  supabase: {
    provider: "supabase",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: true,
    fallback: "local_supabase_for_development",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
  },
  stripe: {
    provider: "stripe",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: true,
    fallback: "stripe_test_mode",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
  },
  sumsub: {
    provider: "sumsub",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: true,
    fallback: "local_test_fixture_only",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    budgetEnv: "KLYX_SUMSUB_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_SUMSUB_MONTHLY_VERIFICATION_LIMIT",
  },
  twilio: {
    provider: "twilio",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: false,
    fallback: "local_test_otp_only",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    budgetEnv: "KLYX_TWILIO_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_TWILIO_MONTHLY_VERIFICATION_LIMIT",
  },
  resend: {
    provider: "resend",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: false,
    fallback: "in_app_notification_and_server_log",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 2700,
    unitLimitEnv: "KLYX_RESEND_MONTHLY_EMAIL_LIMIT",
  },
  tolgee: {
    provider: "tolgee",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: false,
    fallback: "committed_translation_catalogs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
  },
  cloudflare: {
    provider: "cloudflare",
    externalRuntimeCalls: true,
    paidRisk: false,
    critical: false,
    fallback: "server_rate_limits",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
  },
  elmah: {
    provider: "elmah",
    externalRuntimeCalls: true,
    paidRisk: true,
    critical: false,
    fallback: "vercel_and_server_logs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: 0,
    budgetEnv: "KLYX_ELMAH_MONTHLY_BUDGET_USD",
    unitLimitEnv: "KLYX_ELMAH_MONTHLY_EVENT_LIMIT",
  },
  vercel: {
    provider: "vercel",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: true,
    fallback: "local_nextjs",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
  },
  github: {
    provider: "github",
    externalRuntimeCalls: false,
    paidRisk: false,
    critical: true,
    fallback: "local_git",
    defaultMonthlyBudgetMicrousd: 0,
    defaultMonthlyUnitLimit: null,
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
    estimatedCostMicrousd,
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
