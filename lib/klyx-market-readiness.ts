import {
  KLYX_SUPPORTED_MARKETS,
  getKlyxMarket,
  type KlyxSupportedMarket,
} from "./klyx-supported-markets";

export type KlyxMarketReadinessStatus =
  | "unverified"
  | "verified"
  | "blocked"
  | "not_applicable";

export type KlyxMarketLaunchStatus =
  | "closed"
  | "pilot"
  | "open";

export type KlyxMarketReadinessDimension = {
  status: KlyxMarketReadinessStatus;
  verifiedAt: string | null;
  sourceRef: string | null;
  note: string | null;
};

export type KlyxMarketLaunchDecision = {
  status: KlyxMarketLaunchStatus;
  decidedAt: string | null;
  evidenceRef: string | null;
};

export type KlyxMarketReadiness = {
  countryCode: string;
  countryName: string | null;
  currencyCode: string | null;
  monetarySupport: "supported" | "unsupported";
  stripeConnect: KlyxMarketReadinessDimension;
  kyc: KlyxMarketReadinessDimension;
  tax: KlyxMarketReadinessDimension;
  regulatedCategories: KlyxMarketReadinessDimension;
  launchDecision: KlyxMarketLaunchDecision;
};

export type KlyxMarketReadinessAssessment = {
  ready: boolean;
  blockers: string[];
};

type ReadinessOverride = Partial<
  Pick<
    KlyxMarketReadiness,
    | "stripeConnect"
    | "kyc"
    | "tax"
    | "regulatedCategories"
    | "launchDecision"
  >
>;

const UNVERIFIED_DIMENSION: KlyxMarketReadinessDimension = {
  status: "unverified",
  verifiedAt: null,
  sourceRef: null,
  note: null,
};

const CLOSED_LAUNCH: KlyxMarketLaunchDecision = {
  status: "closed",
  decidedAt: null,
  evidenceRef: null,
};

/**
 * Explicit, reviewed overrides only.
 *
 * IMPORTANT:
 * - KLYX_SUPPORTED_MARKETS is a historical name for the monetary catalogue.
 * - Being present in that catalogue is NOT evidence that KLYX may launch,
 *   onboard providers, use Stripe Connect, satisfy KYC/tax rules, or offer
 *   regulated categories in that country/territory.
 * - Do not add an `open` decision without dated evidence for every required
 *   dimension and an explicit launch decision reference.
 */
export const KLYX_MARKET_READINESS_OVERRIDES:
  Readonly<Record<string, ReadinessOverride>> = Object.freeze({});

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

function cloneDimension(
  value: KlyxMarketReadinessDimension = UNVERIFIED_DIMENSION
): KlyxMarketReadinessDimension {
  return { ...value };
}

function cloneLaunchDecision(
  value: KlyxMarketLaunchDecision = CLOSED_LAUNCH
): KlyxMarketLaunchDecision {
  return { ...value };
}

function buildBaseReadiness(
  countryCode: string,
  market: KlyxSupportedMarket | null
): KlyxMarketReadiness {
  return {
    countryCode,
    countryName: market?.countryName ?? null,
    currencyCode: market?.currencyCode ?? null,
    monetarySupport: market ? "supported" : "unsupported",
    stripeConnect: cloneDimension(),
    kyc: cloneDimension(),
    tax: cloneDimension(),
    regulatedCategories: cloneDimension(),
    launchDecision: cloneLaunchDecision(),
  };
}

export function getKlyxMarketReadiness(
  countryCode: string
): KlyxMarketReadiness {
  const normalized = normalizeCountryCode(countryCode);
  const market = getKlyxMarket(normalized);
  const base = buildBaseReadiness(normalized, market);
  const override = KLYX_MARKET_READINESS_OVERRIDES[normalized];

  if (!override) {
    return base;
  }

  return {
    ...base,
    stripeConnect: cloneDimension(override.stripeConnect ?? base.stripeConnect),
    kyc: cloneDimension(override.kyc ?? base.kyc),
    tax: cloneDimension(override.tax ?? base.tax),
    regulatedCategories: cloneDimension(
      override.regulatedCategories ?? base.regulatedCategories
    ),
    launchDecision: cloneLaunchDecision(
      override.launchDecision ?? base.launchDecision
    ),
  };
}

function dimensionIsProven(
  dimension: KlyxMarketReadinessDimension
) {
  const statusAllowsLaunch =
    dimension.status === "verified" ||
    dimension.status === "not_applicable";

  return Boolean(
    statusAllowsLaunch &&
      dimension.verifiedAt?.trim() &&
      dimension.sourceRef?.trim()
  );
}

function launchDecisionIsProven(
  decision: KlyxMarketLaunchDecision
) {
  return Boolean(
    decision.status === "open" &&
      decision.decidedAt?.trim() &&
      decision.evidenceRef?.trim()
  );
}

export function assessKlyxMarketReadiness(
  readiness: KlyxMarketReadiness
): KlyxMarketReadinessAssessment {
  const blockers: string[] = [];

  if (readiness.monetarySupport !== "supported") {
    blockers.push("monetary_support");
  }

  const dimensions = [
    ["stripe_connect", readiness.stripeConnect],
    ["kyc", readiness.kyc],
    ["tax", readiness.tax],
    ["regulated_categories", readiness.regulatedCategories],
  ] as const;

  for (const [name, dimension] of dimensions) {
    if (!dimensionIsProven(dimension)) {
      blockers.push(name);
    }
  }

  if (!launchDecisionIsProven(readiness.launchDecision)) {
    blockers.push("launch_decision");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function isKlyxMarketCommerciallyReady(
  countryCode: string
) {
  return assessKlyxMarketReadiness(
    getKlyxMarketReadiness(countryCode)
  ).ready;
}

export function listKlyxMarketReadiness() {
  return KLYX_SUPPORTED_MARKETS.map((market) =>
    getKlyxMarketReadiness(market.countryCode)
  );
}
