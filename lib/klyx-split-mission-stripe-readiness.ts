import type { KlyxSplitMissionStripeReadinessMessageKey } from "./klyx-split-mission-stripe-readiness-i18n";

// KLYX_SPLIT_STRIPE_READINESS_CONTRACT_15_05

export function splitMissionStripeProviderStateMessageKey(
  state: string
): KlyxSplitMissionStripeReadinessMessageKey {
  if (state === "ready") {
    return "stateReady";
  }

  if (state === "missing_profile") {
    return "stateMissingProfile";
  }

  if (state === "market_not_ready") {
    return "stateMarketNotReady";
  }

  if (state === "missing_account") {
    return "stateMissingAccount";
  }

  if (state === "country_mismatch") {
    return "stateCountryMismatch";
  }

  if (state === "lookup_failed") {
    return "stateLookupFailed";
  }

  return "stateRestricted";
}

export function splitMissionStripeBlockMessageKey(
  value: string | null | undefined
): KlyxSplitMissionStripeReadinessMessageKey {
  if (value === "PRICE_CONFIRMATION_REQUIRED") {
    return "blockPriceConfirmationRequired";
  }

  if (value === "PAYMENT_PLAN_REVALIDATION_REQUIRED") {
    return "blockPaymentPlanRevalidationRequired";
  }

  if (value === "STRIPE_SERVER_CONFIGURATION_REQUIRED") {
    return "blockStripeServerConfigurationRequired";
  }

  if (value === "CLIENT_MARKET_NOT_READY") {
    return "blockClientMarketNotReady";
  }

  if (value === "PROVIDER_MARKET_NOT_READY") {
    return "blockProviderMarketNotReady";
  }

  if (value === "STRIPE_ACCOUNT_COUNTRY_MISMATCH") {
    return "blockProviderCountryMismatch";
  }

  if (value === "PROVIDER_STRIPE_NOT_READY") {
    return "blockProviderStripeNotReady";
  }

  if (value === "MULTI_PROVIDER_REQUIRED") {
    return "blockMultiProviderRequired";
  }

  return "blockDefault";
}
