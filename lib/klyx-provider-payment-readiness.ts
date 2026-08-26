// KLYX_PROVIDER_LIVE_PAYMENT_READINESS_16_05
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

  const connectSetupAllowed =
    input.runtimeMode === "test" ||
    (input.livePaymentsEnabled && input.marketCommerciallyReady);

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
