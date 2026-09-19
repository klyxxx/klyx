import "server-only";

import { createHash } from "node:crypto";
import Stripe from "stripe";

import {
  buildMultiExecutorSettlementPlan,
  type MultiExecutorSettlementPlan,
} from "@/lib/platform-held-group-economics";
import {
  getProviderStripeDestination,
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import { getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { supabaseAdmin } from "@/lib/supabase-admin";

type JsonRecord = Record<string, unknown>;

type CanonicalUnit = {
  providerId: string;
  amountCents: number;
  currency: string;
  bookingIds: string[];
  slotIds: string[];
  stripeAccountId: string;
};

type CanonicalPlan = {
  batchId: string;
  priceConfirmationId: string;
  providerCount: number;
  paymentUnitCount: number;
  totalAmountCents: number;
  currency: string;
  units: CanonicalUnit[];
};

type ConfirmationRow = {
  id: string;
  batch_id: string;
  client_profile_id: string;
  price_confirmation_id: string;
  payment_plan_hash: string;
  payment_plan_snapshot: unknown;
  provider_count: number;
  payment_unit_count: number;
  total_amount_cents: number;
  currency: string;
  invalidated_at: string | null;
  consumed_at: string | null;
};

type BatchRow = {
  id: string;
  client_profile_id: string;
  status: string;
  provider_count: number;
  expected_booking_count: number;
  created_booking_count: number;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

export function parseCanonicalMultiExecutorPaymentPlan(
  value: unknown
): CanonicalPlan | null {
  const root = record(value);
  if (!root || !Array.isArray(root.units)) return null;

  const batchId = text(root.batchId);
  const priceConfirmationId = text(root.priceConfirmationId);
  const providerCount = numberValue(root.providerCount);
  const paymentUnitCount = numberValue(root.paymentUnitCount);
  const totalAmountCents = numberValue(root.totalAmountCents);
  const currency = text(root.currency).toUpperCase();

  if (
    !batchId ||
    !priceConfirmationId ||
    providerCount === null ||
    paymentUnitCount === null ||
    totalAmountCents === null ||
    !Number.isSafeInteger(providerCount) ||
    !Number.isSafeInteger(paymentUnitCount) ||
    !Number.isSafeInteger(totalAmountCents) ||
    providerCount < 2 ||
    paymentUnitCount < 2 ||
    totalAmountCents <= 0 ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return null;
  }

  const units: CanonicalUnit[] = [];

  for (const raw of root.units) {
    const unit = record(raw);
    if (!unit) return null;

    const providerId = text(unit.providerId);
    const amountCents = numberValue(unit.amountCents);
    const unitCurrency = text(unit.currency).toUpperCase();
    const bookingIds = strings(unit.bookingIds);
    const slotIds = strings(unit.slotIds);
    const stripeAccountId = text(unit.stripeAccountId);

    if (
      !providerId ||
      amountCents === null ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      unitCurrency !== currency ||
      bookingIds.length === 0 ||
      bookingIds.length !== slotIds.length ||
      !stripeAccountId.startsWith("acct_")
    ) {
      return null;
    }

    units.push({
      providerId,
      amountCents,
      currency: unitCurrency,
      bookingIds,
      slotIds,
      stripeAccountId,
    });
  }

  units.sort((a, b) => a.providerId.localeCompare(b.providerId));

  if (
    units.length !== providerCount ||
    units.length !== paymentUnitCount ||
    new Set(units.map((unit) => unit.providerId)).size !== units.length ||
    units.reduce((sum, unit) => sum + unit.amountCents, 0) !== totalAmountCents
  ) {
    return null;
  }

  return {
    batchId,
    priceConfirmationId,
    providerCount,
    paymentUnitCount,
    totalAmountCents,
    currency,
    units,
  };
}

export function hashCanonicalMultiExecutorPaymentPlan(
  plan: CanonicalPlan
): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

async function assertRecipientTransferReady(
  stripe: Stripe,
  stripeAccountId: string
): Promise<void> {
  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
    include: ["configuration.recipient", "identity", "requirements"],
  });

  const ready = Boolean(
    account.livemode === false &&
      account.applied_configurations?.includes("recipient") === true &&
      account.configuration?.recipient?.applied === true &&
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === "active"
  );

  if (!ready) {
    throw new Error("KLYX_GROUP_SETTLEMENT_RECIPIENT_NOT_READY");
  }
}

export type LoadedPlatformHeldGroupPlan = {
  batch: BatchRow;
  confirmation: ConfirmationRow;
  canonicalPlan: CanonicalPlan;
  settlementPlan: MultiExecutorSettlementPlan;
  membersForPersistence: Array<{
    provider_profile_id: string;
    provider_account_id: string;
    stripe_account_id: string;
    currency: string;
    gross_amount_cents: number;
    platform_fee_cents: number;
    provider_amount_cents: number;
    booking_ids: string[];
  }>;
};

export async function loadPlatformHeldGroupPlan(input: {
  batchId: string;
  clientProfileId: string;
  stripe: Stripe;
}): Promise<LoadedPlatformHeldGroupPlan> {
  const [{ data: batchData, error: batchError }, confirmationResult] =
    await Promise.all([
      supabaseAdmin
        .from("split_booking_batches")
        .select(
          "id, client_profile_id, status, provider_count, expected_booking_count, created_booking_count"
        )
        .eq("id", input.batchId)
        .eq("client_profile_id", input.clientProfileId)
        .maybeSingle(),
      supabaseAdmin
        .from("split_booking_payment_confirmations")
        .select(
          "id, batch_id, client_profile_id, price_confirmation_id, payment_plan_hash, payment_plan_snapshot, provider_count, payment_unit_count, total_amount_cents, currency, invalidated_at, consumed_at"
        )
        .eq("batch_id", input.batchId)
        .eq("client_profile_id", input.clientProfileId)
        .is("invalidated_at", null)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (batchError) throw new Error(batchError.message);
  if (confirmationResult.error) throw new Error(confirmationResult.error.message);

  const batch = batchData as BatchRow | null;
  const confirmation = confirmationResult.data as ConfirmationRow | null;

  if (!batch) throw new Error("KLYX_GROUP_SETTLEMENT_BATCH_NOT_FOUND");
  if (batch.status !== "created" || batch.provider_count < 2) {
    throw new Error("KLYX_GROUP_SETTLEMENT_BATCH_NOT_READY");
  }
  if (batch.created_booking_count !== batch.expected_booking_count) {
    throw new Error("KLYX_GROUP_SETTLEMENT_BATCH_STRUCTURE_CHANGED");
  }
  if (!confirmation || confirmation.invalidated_at) {
    throw new Error("KLYX_GROUP_SETTLEMENT_CONFIRMATION_REQUIRED");
  }

  const canonicalPlan = parseCanonicalMultiExecutorPaymentPlan(
    confirmation.payment_plan_snapshot
  );

  if (
    !canonicalPlan ||
    canonicalPlan.batchId !== batch.id ||
    canonicalPlan.priceConfirmationId !== confirmation.price_confirmation_id ||
    canonicalPlan.providerCount !== confirmation.provider_count ||
    canonicalPlan.paymentUnitCount !== confirmation.payment_unit_count ||
    canonicalPlan.totalAmountCents !== Number(confirmation.total_amount_cents) ||
    canonicalPlan.currency !== confirmation.currency.toUpperCase() ||
    hashCanonicalMultiExecutorPaymentPlan(canonicalPlan) !==
      confirmation.payment_plan_hash
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_CONFIRMATION_HASH_MISMATCH");
  }

  const resolvedUnits = [];

  for (const unit of canonicalPlan.units) {
    let destination;
    try {
      destination = await getProviderStripeDestination(unit.providerId);
    } catch (error) {
      if (isStripeConnectIdentityReviewRequired(error)) {
        throw new Error("KLYX_GROUP_SETTLEMENT_STRIPE_IDENTITY_REVIEW_REQUIRED");
      }
      throw error;
    }

    if (
      destination.connect.state !== "linked" ||
      !destination.connect.stripeAccountId ||
      destination.connect.stripeAccountId !== unit.stripeAccountId
    ) {
      throw new Error("KLYX_GROUP_SETTLEMENT_CANONICAL_STRIPE_CHANGED");
    }

    await assertRecipientTransferReady(input.stripe, unit.stripeAccountId);

    resolvedUnits.push({
      providerProfileId: unit.providerId,
      providerAccountId: destination.accountId,
      stripeAccountId: unit.stripeAccountId,
      grossAmountCents: unit.amountCents,
      currency: unit.currency,
      bookingIds: unit.bookingIds,
    });
  }

  const settlementPlan = buildMultiExecutorSettlementPlan({
    units: resolvedUnits,
    commissionPercent: getKlyxCommissionPercent(),
  });

  if (
    settlementPlan.grossAmountCents !== canonicalPlan.totalAmountCents ||
    settlementPlan.currency !== canonicalPlan.currency
  ) {
    throw new Error("KLYX_GROUP_SETTLEMENT_PLAN_TOTAL_MISMATCH");
  }

  return {
    batch,
    confirmation,
    canonicalPlan,
    settlementPlan,
    membersForPersistence: settlementPlan.members.map((member) => ({
      provider_profile_id: member.providerProfileId,
      provider_account_id: member.providerAccountId,
      stripe_account_id: member.stripeAccountId,
      currency: member.currency,
      gross_amount_cents: member.grossAmountCents,
      platform_fee_cents: member.platformFeeCents,
      provider_amount_cents: member.providerAmountCents,
      booking_ids: member.bookingIds,
    })),
  };
}
