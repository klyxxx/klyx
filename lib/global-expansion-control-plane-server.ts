import "server-only";

import { getKlyxOpsCapabilityDecision } from "@/lib/ops-control-server";
import { resolveKlyxMarketPaymentPolicy } from "@/lib/klyx-market-policy-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxExpansionRolloutState =
  | "DISABLED"
  | "INTERNAL"
  | "TEST"
  | "PILOT"
  | "LIMITED"
  | "GENERAL";

export type KlyxExpansionEffectiveState =
  | KlyxExpansionRolloutState
  | "DEGRADED"
  | "SUSPENDED";

export type KlyxExpansionHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "SUSPENDED";

export type KlyxExpansionAudience =
  | "internal"
  | "test"
  | "pilot"
  | "limited"
  | "general";

type MarketRow = {
  market_key: string;
  display_name: string;
  jurisdiction_code: string;
  country_code: string | null;
  default_currency_code: string | null;
  infrastructure_region: string | null;
  rollout_state: KlyxExpansionRolloutState;
  risk_policy_key: string | null;
  commission_policy_key: string | null;
  evidence_ref: string | null;
  version: number | string;
  activated_at: string | null;
};

type FeatureRow = {
  market_key: string;
  feature_key: string;
  rollout_state: KlyxExpansionRolloutState;
  evidence_ref: string | null;
  version: number | string;
};

type RequirementRow = {
  id: string;
  requirement_type:
    | "economic"
    | "activity"
    | "regulation"
    | "payment"
    | "tax"
    | "risk"
    | "infrastructure";
  requirement_key: string;
  authority:
    | "economic_identity"
    | "account_capability"
    | "market_payment_policy"
    | "payment_provider"
    | "risk_engine"
    | "operations"
    | "external_review";
  enforcement: "required" | "optional" | "blocked";
  activity_key: string | null;
  jurisdiction_code: string | null;
  evidence_ref: string | null;
  valid_from: string;
  valid_until: string | null;
};

type IncidentRow = {
  id: string;
  status: string;
  severity: string;
  market_id: string | null;
  region_id: string | null;
  country_code: string | null;
  currency: string | null;
  payment_provider: string | null;
  capability: string | null;
  dependency: string | null;
  active_control_state: string | null;
};

const ROLLOUT_RANK: Record<KlyxExpansionRolloutState, number> = {
  DISABLED: 0,
  INTERNAL: 1,
  TEST: 2,
  PILOT: 3,
  LIMITED: 4,
  GENERAL: 5,
};

const AUDIENCE_STATE: Record<
  KlyxExpansionAudience,
  KlyxExpansionRolloutState
> = {
  internal: "INTERNAL",
  test: "TEST",
  pilot: "PILOT",
  limited: "LIMITED",
  general: "GENERAL",
};

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function marketKey(value: string): string {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) throw new Error("KLYX_EXPANSION_MARKET_REQUIRED");
  return normalized;
}

function rolloutAllows(
  configured: KlyxExpansionRolloutState,
  audience: KlyxExpansionAudience
): boolean {
  return ROLLOUT_RANK[configured] >= ROLLOUT_RANK[AUDIENCE_STATE[audience]];
}

function isRequirementCurrent(
  row: RequirementRow,
  now: number
): boolean {
  const from = new Date(row.valid_from).getTime();
  const until = row.valid_until
    ? new Date(row.valid_until).getTime()
    : null;

  return (
    Number.isFinite(from) &&
    from <= now &&
    (until === null || (Number.isFinite(until) && until > now))
  );
}

function incidentMatches(
  incident: IncidentRow,
  scope: {
    marketKey: string;
    regionId: string | null;
    countryCode: string | null;
    currencyCode: string | null;
    paymentProvider: string | null;
    capability: string;
    dependency: string | null;
  }
): boolean {
  const pairs: Array<[string | null, string | null]> = [
    [incident.market_id, scope.marketKey],
    [incident.region_id, scope.regionId],
    [incident.country_code, scope.countryCode],
    [incident.currency, scope.currencyCode],
    [incident.payment_provider, scope.paymentProvider],
    [incident.capability, scope.capability],
    [incident.dependency, scope.dependency],
  ];

  const scopedPairs = pairs.filter(([incidentValue]) => Boolean(incidentValue));

  if (scopedPairs.length === 0) return false;

  return scopedPairs.every(([incidentValue, actual]) => {
    if (!incidentValue) return true;
    if (!actual) return false;
    return incidentValue.toLowerCase() === actual.toLowerCase();
  });
}

export type KlyxExpansionRequirement = {
  id: string;
  type: RequirementRow["requirement_type"];
  key: string;
  authority: RequirementRow["authority"];
  enforcement: RequirementRow["enforcement"];
  activityKey: string | null;
  jurisdictionCode: string | null;
  evidenceRef: string | null;
};

export type KlyxGlobalExpansionDecision = {
  allowed: boolean;
  effectiveState: KlyxExpansionEffectiveState;
  health: KlyxExpansionHealth;
  blockers: string[];
  market: {
    key: string;
    displayName: string;
    jurisdictionCode: string;
    countryCode: string | null;
    defaultCurrencyCode: string | null;
    infrastructureRegion: string | null;
    rolloutState: KlyxExpansionRolloutState;
    riskPolicyKey: string | null;
    commissionPolicyKey: string | null;
    evidenceRef: string | null;
    version: number;
    activatedAt: string | null;
  } | null;
  feature: {
    key: string;
    rolloutState: KlyxExpansionRolloutState;
    evidenceRef: string | null;
    version: number;
  } | null;
  requirements: KlyxExpansionRequirement[];
  payment: {
    evaluated: boolean;
    allowed: boolean;
    blockers: string[];
    ruleId: string | null;
  };
  operations: {
    allowed: boolean;
    blockingControlId: string | null;
    reasonCode: string | null;
    controlVersion: number | null;
    matchingIncidentIds: string[];
  };
};

export async function getKlyxGlobalExpansionDecision(input: {
  marketKey: string;
  audience: KlyxExpansionAudience;
  capability: string;
  featureKey?: string | null;
  regionId?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
  paymentProvider?: string | null;
  dependency?: string | null;
  requiresPayments?: boolean;
  payerCountryCode?: string | null;
  executionCountryCode?: string | null;
  serviceSlug?: string | null;
  at?: Date;
}): Promise<KlyxGlobalExpansionDecision> {
  const key = marketKey(input.marketKey);
  const capability = clean(input.capability)?.toLowerCase();

  if (!capability) {
    throw new Error("KLYX_EXPANSION_CAPABILITY_REQUIRED");
  }

  const now = input.at ?? new Date();

  const marketResult = await supabaseAdmin
    .from("klyx_markets")
    .select(
      "market_key,display_name,jurisdiction_code,country_code,default_currency_code,infrastructure_region,rollout_state,risk_policy_key,commission_policy_key,evidence_ref,version,activated_at"
    )
    .eq("market_key", key)
    .maybeSingle();

  if (marketResult.error) {
    throw new Error("KLYX_EXPANSION_MARKET_READ_FAILED", {
      cause: marketResult.error,
    });
  }

  const market = (marketResult.data ?? null) as MarketRow | null;

  if (!market) {
    return {
      allowed: false,
      effectiveState: "DISABLED",
      health: "HEALTHY",
      blockers: ["market_config_missing"],
      market: null,
      feature: null,
      requirements: [],
      payment: {
        evaluated: false,
        allowed: false,
        blockers: [],
        ruleId: null,
      },
      operations: {
        allowed: false,
        blockingControlId: null,
        reasonCode: "MARKET_CONFIG_MISSING",
        controlVersion: null,
        matchingIncidentIds: [],
      },
    };
  }

  const countryCode =
    clean(input.countryCode)?.toUpperCase() ??
    market.country_code;
  const currencyCode =
    clean(input.currencyCode)?.toUpperCase() ??
    market.default_currency_code;
  const regionId =
    clean(input.regionId)?.toLowerCase() ??
    market.infrastructure_region;
  const paymentProvider =
    clean(input.paymentProvider)?.toLowerCase() ??
    (input.requiresPayments ? "stripe" : null);
  const dependency = clean(input.dependency)?.toLowerCase() ?? null;
  const featureKey = clean(input.featureKey)?.toLowerCase() ?? null;

  const requirementsQuery = supabaseAdmin
    .from("klyx_market_requirements")
    .select(
      "id,requirement_type,requirement_key,authority,enforcement,activity_key,jurisdiction_code,evidence_ref,valid_from,valid_until"
    )
    .eq("market_key", key);

  const incidentsQuery = supabaseAdmin
    .from("ops_incidents_current")
    .select(
      "id,status,severity,market_id,region_id,country_code,currency,payment_provider,capability,dependency,active_control_state"
    )
    .in("status", ["open", "acknowledged", "mitigating"])
    .limit(200);

  const featureQuery = featureKey
    ? supabaseAdmin
        .from("klyx_market_features")
        .select(
          "market_key,feature_key,rollout_state,evidence_ref,version"
        )
        .eq("market_key", key)
        .eq("feature_key", featureKey)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [requirementsResult, incidentsResult, featureResult] =
    await Promise.all([
      requirementsQuery,
      incidentsQuery,
      featureQuery,
    ]);

  if (requirementsResult.error) {
    throw new Error("KLYX_EXPANSION_REQUIREMENTS_READ_FAILED", {
      cause: requirementsResult.error,
    });
  }

  if (incidentsResult.error) {
    throw new Error("KLYX_EXPANSION_HEALTH_READ_FAILED", {
      cause: incidentsResult.error,
    });
  }

  if (featureResult.error) {
    throw new Error("KLYX_EXPANSION_FEATURE_READ_FAILED", {
      cause: featureResult.error,
    });
  }

  const requirements = (
    (requirementsResult.data ?? []) as RequirementRow[]
  )
    .filter((row) => isRequirementCurrent(row, now.getTime()))
    .map<KlyxExpansionRequirement>((row) => ({
      id: row.id,
      type: row.requirement_type,
      key: row.requirement_key,
      authority: row.authority,
      enforcement: row.enforcement,
      activityKey: row.activity_key,
      jurisdictionCode: row.jurisdiction_code,
      evidenceRef: row.evidence_ref,
    }));

  const feature = featureResult.data
    ? (featureResult.data as FeatureRow)
    : null;

  const opsDecision = await getKlyxOpsCapabilityDecision({
    capability,
    marketId: key,
    regionId,
    countryCode,
    currency: currencyCode,
    paymentProvider,
    dependency,
  });

  const matchingIncidents = (
    (incidentsResult.data ?? []) as IncidentRow[]
  ).filter((incident) =>
    incidentMatches(incident, {
      marketKey: key,
      regionId,
      countryCode,
      currencyCode,
      paymentProvider,
      capability,
      dependency,
    })
  );

  const health: KlyxExpansionHealth = !opsDecision.allowed
    ? "SUSPENDED"
    : matchingIncidents.length > 0
      ? "DEGRADED"
      : "HEALTHY";

  const blockers: string[] = [];

  if (!rolloutAllows(market.rollout_state, input.audience)) {
    blockers.push("market_rollout");
  }

  if (featureKey) {
    if (!feature) {
      blockers.push("feature_config_missing");
    } else if (!rolloutAllows(feature.rollout_state, input.audience)) {
      blockers.push("feature_rollout");
    }
  }

  for (const requirement of requirements) {
    if (requirement.enforcement === "blocked") {
      blockers.push(`requirement_blocked:${requirement.key}`);
    }

    if (
      requirement.enforcement === "required" &&
      !requirement.evidenceRef
    ) {
      blockers.push(`requirement_evidence_missing:${requirement.key}`);
    }
  }

  if (!opsDecision.allowed) {
    blockers.push(
      `operations:${opsDecision.reasonCode ?? "CONTROL_DISABLED"}`
    );
  }

  let payment = {
    evaluated: false,
    allowed: true,
    blockers: [] as string[],
    ruleId: null as string | null,
  };

  if (input.requiresPayments) {
    const executionCountryCode =
      clean(input.executionCountryCode)?.toUpperCase() ??
      countryCode;
    const payerCountryCode =
      clean(input.payerCountryCode)?.toUpperCase() ??
      executionCountryCode;
    const serviceSlug = clean(input.serviceSlug) ?? "*";

    if (!executionCountryCode || !payerCountryCode || !currencyCode) {
      payment = {
        evaluated: true,
        allowed: false,
        blockers: ["payment_context_incomplete"],
        ruleId: null,
      };
      blockers.push("payment:payment_context_incomplete");
    } else {
      const resolved = await resolveKlyxMarketPaymentPolicy({
        payerCountryCode,
        executionCountryCode,
        serviceSlug,
        currencyCode,
        at: now,
      });

      payment = {
        evaluated: true,
        allowed: resolved.assessment.allowed,
        blockers: resolved.assessment.blockers,
        ruleId: resolved.rule?.id ?? null,
      };

      for (const blocker of resolved.assessment.blockers) {
        blockers.push(`payment:${blocker}`);
      }
    }
  }

  const effectiveState: KlyxExpansionEffectiveState =
    health === "SUSPENDED"
      ? "SUSPENDED"
      : health === "DEGRADED"
        ? "DEGRADED"
        : market.rollout_state;

  return {
    allowed: blockers.length === 0,
    effectiveState,
    health,
    blockers,
    market: {
      key: market.market_key,
      displayName: market.display_name,
      jurisdictionCode: market.jurisdiction_code,
      countryCode: market.country_code,
      defaultCurrencyCode: market.default_currency_code,
      infrastructureRegion: market.infrastructure_region,
      rolloutState: market.rollout_state,
      riskPolicyKey: market.risk_policy_key,
      commissionPolicyKey: market.commission_policy_key,
      evidenceRef: market.evidence_ref,
      version: Number(market.version),
      activatedAt: market.activated_at,
    },
    feature: feature
      ? {
          key: feature.feature_key,
          rolloutState: feature.rollout_state,
          evidenceRef: feature.evidence_ref,
          version: Number(feature.version),
        }
      : null,
    requirements,
    payment,
    operations: {
      allowed: opsDecision.allowed,
      blockingControlId: opsDecision.blockingControlId,
      reasonCode: opsDecision.reasonCode,
      controlVersion: opsDecision.controlVersion,
      matchingIncidentIds: matchingIncidents.map(
        (incident) => incident.id
      ),
    },
  };
}

export async function requireKlyxGlobalExpansionAvailable(
  input: Parameters<typeof getKlyxGlobalExpansionDecision>[0]
): Promise<KlyxGlobalExpansionDecision> {
  const decision = await getKlyxGlobalExpansionDecision(input);

  if (!decision.allowed) {
    throw new Error(
      `KLYX_EXPANSION_BLOCKED:${decision.blockers.join(",")}`
    );
  }

  return decision;
}
