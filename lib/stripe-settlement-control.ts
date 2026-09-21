export const KLYX_LEGACY_SETTLEMENT_MODE = "connect_destination" as const;
export const KLYX_PLATFORM_HELD_SETTLEMENT_MODE = "platform_held" as const;

export type KlyxSettlementMode =
  | typeof KLYX_LEGACY_SETTLEMENT_MODE
  | typeof KLYX_PLATFORM_HELD_SETTLEMENT_MODE;

export const KLYX_SETTLEMENT_LIVE_NOT_READY =
  "KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY";
export const KLYX_SETTLEMENT_TEST_NOT_ARMED =
  "KLYX_SETTLEMENT_CONTROL_TEST_NOT_ARMED";
export const KLYX_SETTLEMENT_MODE_INVALID =
  "KLYX_SETTLEMENT_MODE_INVALID";

export type SettlementEnvironment = {
  KLYX_STRIPE_SETTLEMENT_MODE?: string;
  KLYX_SETTLEMENT_CONTROL_TEST_READY?: string;
  KLYX_LIVE_PAYMENTS_ENABLED?: string;
  KLYX_LIVE_CERTIFICATION_ENABLED?: string;
  KLYX_LIVE_CERTIFICATION_SHA?: string;
  KLYX_DR_CERTIFIED_SHA?: string;
  KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  STRIPE_SECRET_KEY?: string;
};

export type PlatformHeldPaymentIntentPlan = {
  paymentMode: typeof KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
  transferGroup: string;
  metadata: Record<string, string>;
};

function envTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function runtimeSettlementEnvironment(): SettlementEnvironment {
  return {
    KLYX_STRIPE_SETTLEMENT_MODE: process.env.KLYX_STRIPE_SETTLEMENT_MODE,
    KLYX_SETTLEMENT_CONTROL_TEST_READY:
      process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY,
    KLYX_LIVE_PAYMENTS_ENABLED:
      process.env.KLYX_LIVE_PAYMENTS_ENABLED,
    KLYX_LIVE_CERTIFICATION_ENABLED:
      process.env.KLYX_LIVE_CERTIFICATION_ENABLED,
    KLYX_LIVE_CERTIFICATION_SHA:
      process.env.KLYX_LIVE_CERTIFICATION_SHA,
    KLYX_DR_CERTIFIED_SHA:
      process.env.KLYX_DR_CERTIFIED_SHA,
    KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA:
      process.env.KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA,
    VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };
}

function normalizedRequestedMode(
  env: SettlementEnvironment
): KlyxSettlementMode {
  const raw = env.KLYX_STRIPE_SETTLEMENT_MODE?.trim().toLowerCase();

  if (!raw || raw === KLYX_LEGACY_SETTLEMENT_MODE) {
    return KLYX_LEGACY_SETTLEMENT_MODE;
  }

  if (raw === KLYX_PLATFORM_HELD_SETTLEMENT_MODE) {
    return KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
  }

  throw new Error(KLYX_SETTLEMENT_MODE_INVALID);
}

/**
 * Platform-held settlement remains fail-closed.
 *
 * TEST requires the historical explicit TEST arm.
 * LIVE requires one immutable deployed SHA that is also the DR-certified SHA.
 * Before Mission 1 certification, only the controlled certification canary may
 * arm the mode. General LIVE additionally requires the exact financial
 * certification SHA. Per-profile canary authorization is enforced again at
 * every Stripe mutation boundary by klyx-financial-stripe-runtime.
 */
export function getKlyxSettlementMode(
  env: SettlementEnvironment = runtimeSettlementEnvironment()
): KlyxSettlementMode {
  const requested = normalizedRequestedMode(env);

  if (requested === KLYX_LEGACY_SETTLEMENT_MODE) {
    return requested;
  }

  const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (secret.startsWith("sk_live_")) {
    const deployedSha =
      env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
    const drSha =
      env.KLYX_DR_CERTIFIED_SHA?.trim().toLowerCase() ?? "";
    const certificationSha =
      env.KLYX_LIVE_CERTIFICATION_SHA?.trim().toLowerCase() ?? "";
    const financialCertifiedSha =
      env.KLYX_PRODUCTION_FINANCIAL_CERTIFIED_SHA
        ?.trim()
        .toLowerCase() ?? "";
    const validSha = /^[0-9a-f]{40}$/;

    if (
      !validSha.test(deployedSha) ||
      drSha !== deployedSha
    ) {
      throw new Error(KLYX_SETTLEMENT_LIVE_NOT_READY);
    }

    if (envTrue(env.KLYX_LIVE_PAYMENTS_ENABLED)) {
      if (financialCertifiedSha !== deployedSha) {
        throw new Error(KLYX_SETTLEMENT_LIVE_NOT_READY);
      }
      return KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
    }

    if (
      envTrue(env.KLYX_LIVE_CERTIFICATION_ENABLED) &&
      certificationSha === deployedSha
    ) {
      return KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
    }

    throw new Error(KLYX_SETTLEMENT_LIVE_NOT_READY);
  }

  if (
    !secret.startsWith("sk_test_") ||
    !envTrue(env.KLYX_SETTLEMENT_CONTROL_TEST_READY)
  ) {
    throw new Error(KLYX_SETTLEMENT_TEST_NOT_ARMED);
  }

  return KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
}

export function settlementTransferGroup(input: {
  subjectType: "booking" | "booking_group" | "split_unit" | "split_batch";
  subjectId: string;
}): string {
  const subjectId = input.subjectId.trim();

  if (!subjectId) {
    throw new Error("KLYX_SETTLEMENT_SUBJECT_REQUIRED");
  }

  return `klyx:${input.subjectType}:${subjectId}`;
}

/**
 * Phase-1 builder for the future separate-charge/transfer path.
 *
 * Deliberately returns no `transfer_data` and no `application_fee_amount`.
 * In platform-held mode the customer charge is created on the KLYX platform;
 * the provider amount is released later by an explicit Stripe Transfer after
 * mission completion and risk approval.
 */
export function buildPlatformHeldPaymentIntentPlan(input: {
  subjectType: "booking" | "booking_group" | "split_unit";
  subjectId: string;
  providerProfileId: string;
  providerStripeAccountId: string;
  metadata?: Record<string, string>;
}): PlatformHeldPaymentIntentPlan {
  const providerProfileId = input.providerProfileId.trim();
  const providerStripeAccountId = input.providerStripeAccountId.trim();

  if (!providerProfileId) {
    throw new Error("KLYX_SETTLEMENT_PROVIDER_REQUIRED");
  }

  if (!providerStripeAccountId.startsWith("acct_")) {
    throw new Error("KLYX_SETTLEMENT_STRIPE_ACCOUNT_REQUIRED");
  }

  const transferGroup = settlementTransferGroup({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });

  return {
    paymentMode: KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
    transferGroup,
    metadata: {
      ...(input.metadata ?? {}),
      payment_mode: KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
      settlement_transfer_group: transferGroup,
      settlement_provider_profile_id: providerProfileId,
      settlement_provider_stripe_account_id: providerStripeAccountId,
    },
  };
}
