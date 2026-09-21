import { inspectLiveFinancialStaticGate } from "@/lib/live-financial-runtime-gate";

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
  KLYX_SETTLEMENT_CONTROL_LIVE_READY?: string;
  KLYX_STRIPE_MODE?: string;
  KLYX_LIVE_PAYMENTS_ENABLED?: string;
  KLYX_LIVE_FINANCIAL_STATE?: string;
  KLYX_LIVE_CERTIFIED_SHA?: string;
  KLYX_DEPLOYED_SHA?: string;
  KLYX_LIVE_WEBHOOKS_READY?: string;
  KLYX_LIVE_CONNECT_READY?: string;
  KLYX_LIVE_CRITICAL_ALERTS_READY?: string;
  KLYX_LIVE_DURABLE_JOBS_READY?: string;
  KLYX_LIVE_LEDGER_READY?: string;
  KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED?: string;
  KLYX_LIVE_RECONCILIATION_READY?: string;
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
    KLYX_SETTLEMENT_CONTROL_LIVE_READY:
      process.env.KLYX_SETTLEMENT_CONTROL_LIVE_READY,
    KLYX_STRIPE_MODE: process.env.KLYX_STRIPE_MODE,
    KLYX_LIVE_PAYMENTS_ENABLED: process.env.KLYX_LIVE_PAYMENTS_ENABLED,
    KLYX_LIVE_FINANCIAL_STATE: process.env.KLYX_LIVE_FINANCIAL_STATE,
    KLYX_LIVE_CERTIFIED_SHA: process.env.KLYX_LIVE_CERTIFIED_SHA,
    KLYX_DEPLOYED_SHA: process.env.KLYX_DEPLOYED_SHA,
    KLYX_LIVE_WEBHOOKS_READY: process.env.KLYX_LIVE_WEBHOOKS_READY,
    KLYX_LIVE_CONNECT_READY: process.env.KLYX_LIVE_CONNECT_READY,
    KLYX_LIVE_CRITICAL_ALERTS_READY:
      process.env.KLYX_LIVE_CRITICAL_ALERTS_READY,
    KLYX_LIVE_DURABLE_JOBS_READY:
      process.env.KLYX_LIVE_DURABLE_JOBS_READY,
    KLYX_LIVE_LEDGER_READY: process.env.KLYX_LIVE_LEDGER_READY,
    KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED:
      process.env.KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED,
    KLYX_LIVE_RECONCILIATION_READY:
      process.env.KLYX_LIVE_RECONCILIATION_READY,
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
 * Production remains on the certified destination-charge flow until a complete
 * held-funds release path has passed migration, Stripe TEST, Golden Path,
 * security, performance and E2E certification on one immutable SHA.
 *
 * This guard intentionally has no live override in phase 1. Adding one before
 * the release side effect exists would let KLYX collect provider funds without
 * a certified way to settle them.
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
    const liveGate = inspectLiveFinancialStaticGate({
      KLYX_STRIPE_MODE: env.KLYX_STRIPE_MODE,
      KLYX_LIVE_PAYMENTS_ENABLED: env.KLYX_LIVE_PAYMENTS_ENABLED,
      KLYX_LIVE_FINANCIAL_STATE: env.KLYX_LIVE_FINANCIAL_STATE,
      KLYX_LIVE_CERTIFIED_SHA: env.KLYX_LIVE_CERTIFIED_SHA,
      KLYX_DEPLOYED_SHA: env.KLYX_DEPLOYED_SHA,
      KLYX_LIVE_WEBHOOKS_READY: env.KLYX_LIVE_WEBHOOKS_READY,
      KLYX_LIVE_CONNECT_READY: env.KLYX_LIVE_CONNECT_READY,
      KLYX_LIVE_CRITICAL_ALERTS_READY:
        env.KLYX_LIVE_CRITICAL_ALERTS_READY,
      KLYX_LIVE_DURABLE_JOBS_READY:
        env.KLYX_LIVE_DURABLE_JOBS_READY,
      KLYX_LIVE_LEDGER_READY: env.KLYX_LIVE_LEDGER_READY,
      KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED:
        env.KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED,
      KLYX_LIVE_RECONCILIATION_READY:
        env.KLYX_LIVE_RECONCILIATION_READY,
      KLYX_SETTLEMENT_CONTROL_LIVE_READY:
        env.KLYX_SETTLEMENT_CONTROL_LIVE_READY,
    });

    if (!liveGate.ready) {
      throw new Error(KLYX_SETTLEMENT_LIVE_NOT_READY);
    }

    return KLYX_PLATFORM_HELD_SETTLEMENT_MODE;
  }

  if (!envTrue(env.KLYX_SETTLEMENT_CONTROL_TEST_READY)) {
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
