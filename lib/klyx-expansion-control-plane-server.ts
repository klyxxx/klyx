import "server-only";

import { getKlyxOpsCapabilityDecision } from "@/lib/ops-control-server";
import { resolveKlyxMarketPaymentPolicy } from "@/lib/klyx-market-policy-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxConfiguredRolloutState =
  | "DISABLED"
  | "INTERNAL"
  | "TEST"
  | "PILOT"
  | "LIMITED"
  | "GENERAL";

export type KlyxEffectiveMarketState =
  | KlyxConfiguredRolloutState
  | "DEGRADED"
  | "SUSPENDED";

export type KlyxExpansionAudience =
  | "INTERNAL"
  | "TEST"
  | "PILOT"
  | "LIMITED"
  | "GENERAL";

export type KlyxExpansionDecision = {
  allowed: boolean;
  marketKey: string;
  configuredState: KlyxConfiguredRolloutState | null;
  effectiveState: KlyxEffectiveMarketState;
  blockers: string[];
  marketVersion: number | null;
  featureState: KlyxConfiguredRolloutState | null;
  paymentRuleId: string | null;
  opsBlockingControlId: string | null;
};

type MarketRow = {
  market_key: string;
  jurisdiction_code: string;
  country_code: string | null;
  default_currency_code: string | null;
  rollout_state: KlyxConfiguredRolloutState;
  version: number | string;
};

type FeatureRow = {
  market_key: string;
  feature_key: string;
  rollout_state: KlyxConfiguredRolloutState;
};

const ROLLOUT_RANK: Record<KlyxConfiguredRolloutState, number> = {
  DISABLED: 0,
  INTERNAL: 1,
  TEST: 2,
  PILOT: 3,
  LIMITED: 4,
  GENERAL: 5,
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeMarketKey(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new Error("KLYX_EXPANSION_MARKET_REQUIRED");
  }

  return normalized;
}

function rolloutAllowsAudience(params: {
  rolloutState: KlyxConfiguredRolloutState;
  audience: KlyxExpansionAudience;
}): boolean {
  return ROLLOUT_RANK[params.rolloutState] >= ROLLOUT_RANK[params.audience];
}

export async function resolveKlyxExpansionDecision(input: {
  marketKey: string;
  audience: KlyxExpansionAudience;
  featureKey?: string | null;
  capability: string;
  payerCountryCode?: string | null;
  executionCountryCode?: string | null;
  serviceSlug?: string | null;
  currencyCode?: string | null;
  paymentProvider?: string | null;
  requirePaymentPolicy?: boolean;
}): Promise<KlyxExpansionDecision> {
  const marketKey = normalizeMarketKey(input.marketKey);
  const capability = clean(input.capability)?.toLowerCase();

  if (!capability) {
    throw new Error("KLYX_EXPANSION_CAPABILITY_REQUIRED");
  }

  const { data: marketData, error: marketError } = await supabaseAdmin
    .from("klyx_markets")
    .select(
      "market_key,jurisdiction_code,country_code,default_currency_code,rollout_state,version"
    )
    .eq("market_key", marketKey)
    .maybeSingle();

  if (marketError) {
    throw new Error("KLYX_EXPANSION_MARKET_READ_FAILED", {
      cause: marketError,
    });
  }

  const market = marketData as MarketRow | null;

  if (!market) {
    return {
      allowed: false,
      marketKey,
      configuredState: null,
      effectiveState: "SUSPENDED",
      blockers: ["market_not_configured"],
      marketVersion: null,
      featureState: null,
      paymentRuleId: null,
      opsBlockingControlId: null,
    };
  }

  const blockers: string[] = [];
  const featureKey = clean(input.featureKey)?.toLowerCase() ?? null;
  let feature: FeatureRow | null = null;

  if (!rolloutAllowsAudience({
    rolloutState: market.rollout_state,
    audience: input.audience,
  })) {
    blockers.push("market_rollout");
  }

  if (featureKey) {
    const { data: featureData, error: featureError } = await supabaseAdmin
      .from("klyx_market_features")
      .select("market_key,feature_key,rollout_state")
      .eq("market_key", marketKey)
      .eq("feature_key", featureKey)
      .maybeSingle();

    if (featureError) {
      throw new Error("KLYX_EXPANSION_FEATURE_READ_FAILED", {
        cause: featureError,
      });
    }

    feature = featureData as FeatureRow | null;

    if (!feature) {
      blockers.push("feature_not_configured");
    } else if (
      !rolloutAllowsAudience({
        rolloutState: feature.rollout_state,
        audience: input.audience,
      })
    ) {
      blockers.push("feature_rollout");
    }
  }

  const countryCode =
    clean(input.executionCountryCode)?.toUpperCase() ??
    market.country_code;
  const currencyCode =
    clean(input.currencyCode)?.toUpperCase() ??
    market.default_currency_code;

  const opsDecision = await getKlyxOpsCapabilityDecision({
    capability,
    marketId: marketKey,
    countryCode,
    currency: currencyCode,
    paymentProvider:
      clean(input.paymentProvider)?.toLowerCase() ?? null,
  });

  if (!opsDecision.allowed) {
    blockers.push("operations_control");
  }

  let paymentRuleId: string | null = null;

  if (input.requirePaymentPolicy) {
    const payerCountryCode =
      clean(input.payerCountryCode)?.toUpperCase() ?? null;
    const executionCountryCode =
      clean(input.executionCountryCode)?.toUpperCase() ??
      market.country_code;
    const serviceSlug = clean(input.serviceSlug) ?? "*";

    if (!payerCountryCode) blockers.push("payer_country_required");
    if (!executionCountryCode) blockers.push("execution_country_required");
    if (!currencyCode) blockers.push("currency_required");

    if (
      payerCountryCode &&
      executionCountryCode &&
      currencyCode
    ) {
      const paymentPolicy = await resolveKlyxMarketPaymentPolicy({
        payerCountryCode,
        executionCountryCode,
        serviceSlug,
        currencyCode,
      });

      paymentRuleId = paymentPolicy.rule?.id ?? null;

      if (!paymentPolicy.assessment.allowed) {
        blockers.push(
          ...paymentPolicy.assessment.blockers.map(
            (blocker) => `payment:${blocker}`
          )
        );
      }
    }
  }

  const effectiveState: KlyxEffectiveMarketState =
    !opsDecision.allowed
      ? "SUSPENDED"
      : blockers.length > 0 &&
          market.rollout_state !== "DISABLED"
        ? "DEGRADED"
        : market.rollout_state;

  return {
    allowed: blockers.length === 0,
    marketKey,
    configuredState: market.rollout_state,
    effectiveState,
    blockers: [...new Set(blockers)],
    marketVersion: Number(market.version),
    featureState: feature?.rollout_state ?? null,
    paymentRuleId,
    opsBlockingControlId: opsDecision.blockingControlId,
  };
}

export async function listKlyxMarketRequirements(params: {
  marketKey: string;
  at?: Date;
}) {
  const marketKey = normalizeMarketKey(params.marketKey);
  const at = params.at ?? new Date();

  const { data, error } = await supabaseAdmin
    .from("klyx_market_requirements")
    .select(
      "id,market_key,requirement_type,requirement_key,authority,enforcement,activity_key,jurisdiction_code,evidence_ref,valid_from,valid_until,metadata,version"
    )
    .eq("market_key", marketKey)
    .lte("valid_from", at.toISOString());

  if (error) {
    throw new Error("KLYX_EXPANSION_REQUIREMENTS_READ_FAILED", {
      cause: error,
    });
  }

  return (data ?? []).filter((row) => {
    if (!row.valid_until) return true;
    return new Date(row.valid_until).getTime() > at.getTime();
  });
}
