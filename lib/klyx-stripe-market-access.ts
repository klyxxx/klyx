import {
  assessKlyxMarketReadiness,
  getKlyxMarketReadiness,
} from "./klyx-market-readiness";
import type { StripeRuntimeMode } from "./stripe-runtime";

export type KlyxStripeMarketAccess = {
  allowed: boolean;
  countryCode: string;
  blockers: string[];
  reason:
    | "test_mode"
    | "commercially_ready"
    | "country_required"
    | "market_not_ready";
};

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

/**
 * Stripe test mode stays available for launch certification and sandbox flows.
 * Live Stripe activity is fail-closed and requires the reviewed KLYX market
 * readiness matrix to prove that the country is commercially open.
 */
export function assessKlyxStripeMarketAccess(
  countryCode: string,
  stripeMode: StripeRuntimeMode
): KlyxStripeMarketAccess {
  const normalized = normalizeCountryCode(countryCode);

  if (stripeMode === "test") {
    return {
      allowed: true,
      countryCode: normalized,
      blockers: [],
      reason: "test_mode",
    };
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return {
      allowed: false,
      countryCode: normalized,
      blockers: ["country_code"],
      reason: "country_required",
    };
  }

  const readiness = getKlyxMarketReadiness(normalized);
  const assessment = assessKlyxMarketReadiness(readiness);

  return {
    allowed: assessment.ready,
    countryCode: normalized,
    blockers: assessment.blockers,
    reason: assessment.ready ? "commercially_ready" : "market_not_ready",
  };
}
