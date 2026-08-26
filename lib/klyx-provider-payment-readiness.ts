// KLYX_PROVIDER_LIVE_PAYMENT_READINESS_16_05
// KLYX_CONNECT_ONBOARDING_BEFORE_LIVE_SWITCH_16_08
export type KlyxProviderPaymentBlockReason =
  | "TEST_MODE"
  | "LIVE_PAYMENTS_DISABLED"
  | "MARKET_NOT_COMMERCIALLY_READY"
  | "STRIPE_NOT_CONFIGURED";

export type KlyxProviderPaymentReadinessInput = {
  runtimeMode: "test" | "live";
  livePaymentsEnabled: boolean;
  marketCommerciallyReady: boolean;
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export type KlyxProviderPaymentReadiness = {
  stripeConfigured: boolean;
  connectSetupAllowed: boolean;
  livePaymentsOperational: boolean;
  blockReason: KlyxProviderPaymentBlockReason | null;
};

export function assessKlyxProviderPaymentReadiness(
  input: KlyxProviderPaymentReadinessInput
): KlyxProviderPaymentReadiness {
  const stripeConfigured = Boolean(
    input.connected &&
      input.onboardingComplete &&
      input.chargesEnabled &&
      input.payoutsEnabled
  );

  // Connect onboarding/KYC must be completable before KLYX opens real charges.
  // The commercial market gate still fails closed in live mode, while the
  // transactional live switch remains enforced by livePaymentsOperational.
  const connectSetupAllowed =
    input.runtimeMode === "test" || input.marketCommerciallyReady;

  let blockReason: KlyxProviderPaymentBlockReason | null = null;

  if (input.runtimeMode === "test") {
    blockReason = "TEST_MODE";
  } else if (!input.livePaymentsEnabled) {
    blockReason = "LIVE_PAYMENTS_DISABLED";
  } else if (!input.marketCommerciallyReady) {
    blockReason = "MARKET_NOT_COMMERCIALLY_READY";
  } else if (!stripeConfigured) {
    blockReason = "STRIPE_NOT_CONFIGURED";
  }

  return {
    stripeConfigured,
    connectSetupAllowed,
    livePaymentsOperational: blockReason === null,
    blockReason,
  };
}
