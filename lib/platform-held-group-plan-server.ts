import "server-only";

import { createHash } from "node:crypto";

import {
  buildPlatformHeldGroupEconomics,
  type PlatformHeldGroupEconomics,
} from "@/lib/platform-held-group-economics";
import {
  getProviderStripeDestination,
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import { getKlyxCommissionPercent } from "@/lib/klyx-economics";
import { supabaseAdmin } from "@/lib/supabase-admin";

type JsonRow = Record<string, unknown>;

export type CanonicalGroupPaymentUnit = {
  providerId: string;
  amountCents: number;
  currency: string;
  bookingIds: string[];
  slotIds: string[];
  stripeAccountId: string;
};

export type CanonicalGroupPaymentPlan = {
  batchId: string;
  priceConfirmationId: string;
  providerCount: number;
  paymentUnitCount: number;
  totalAmountCents: number;
  currency: string;
  units: CanonicalGroupPaymentUnit[];
};

export type PlatformHeldGroupPlan = {
  batchId: string;
  clientProfileId: string;
  confirmationId: string;
  paymentPlanHash: string;
  plan: CanonicalGroupPaymentPlan;
  economics: PlatformHeldGroupEconomics;
  existingState: string | null;
};

function record(value: unknown): JsonRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRow;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

function parsePlan(value: unknown): CanonicalGroupPaymentPlan | null {
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
    currency.length !== 3
  ) {
    return null;
  }

  const units: CanonicalGroupPaymentUnit[] = [];

  for (const raw of root.units) {
    const unit = record(raw);
    if (!unit) return null;

    const providerId = text(unit.providerId);
    const amountCents = numberValue(unit.amountCents);
    const unitCurrency = text(unit.currency).toUpperCase();
    const stripeAccountId = text(unit.stripeAccountId);
    const bookingIds = stringArray(unit.bookingIds);
    const slotIds = stringArray(unit.slotIds);

    if (
      !providerId ||
      amountCents === null ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      unitCurrency.length !== 3 ||
      !stripeAccountId.startsWith("acct_") ||
      bookingIds.length === 0 ||
      slotIds.length !== bookingIds.length
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

  return {
    batchId,
    priceConfirmationId,
    providerCount: Math.trunc(providerCount),
    paymentUnitCount: Math.trunc(paymentUnitCount),
    totalAmountCents: Math.trunc(totalAmountCents),
    currency,
    units,
  };
}

function hashPlan(plan: CanonicalGroupPaymentPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function bookingAmount(booking: JsonRow): number | null {
  const estimated = numberValue(booking.estimated_amount_cents);
  if (estimated !== null && estimated >= 0) return Math.round(estimated);

  const total = numberValue(booking.amount_total);
  if (total !== null && total >= 0) return Math.round(total);

  return null;
}

function bookingAccepted(booking: JsonRow): boolean {
  const status = text(booking.status).toLowerCase();
  const serviceStatus = text(booking.service_status).toLowerCase();

  return (
    ["accepted", "confirmed", "completed"].includes(status) ||
    ["started", "arrived", "ongoing", "in_progress", "completed"].includes(
      serviceStatus
    )
  );
}

export async function loadPlatformHeldGroupPlan(input: {
  batchId: string;
  clientProfileId: string;
}): Promise<PlatformHeldGroupPlan> {
  const { data: batch, error: batchError } = await supabaseAdmin
    .from("split_booking_batches")
    .select(
      "id, client_profile_id, status, expected_booking_count, created_booking_count, provider_count"
    )
    .eq("id", input.batchId)
    .eq("client_profile_id", input.clientProfileId)
    .maybeSingle();

  if (batchError) throw new Error(batchError.message);
  if (!batch) throw new Error("KLYX_PLATFORM_HELD_GROUP_BATCH_NOT_FOUND");
  if (
    batch.status !== "created" ||
    Number(batch.created_booking_count) !== Number(batch.expected_booking_count) ||
    Number(batch.provider_count) < 2
  ) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_BATCH_NOT_READY");
  }

  const { data: existingCharge, error: existingChargeError } = await supabaseAdmin
    .from("platform_held_group_charges")
    .select("payment_confirmation_id, state")
    .eq("batch_id", input.batchId)
    .maybeSingle();

  if (existingChargeError) throw new Error(existingChargeError.message);

  let confirmationQuery = supabaseAdmin
    .from("split_booking_payment_confirmations")
    .select(
      "id, batch_id, client_profile_id, payment_plan_hash, payment_plan_snapshot, provider_count, payment_unit_count, total_amount_cents, currency, invalidated_at, consumed_at"
    );

  if (existingCharge?.payment_confirmation_id) {
    confirmationQuery = confirmationQuery.eq(
      "id",
      existingCharge.payment_confirmation_id
    );
  } else {
    confirmationQuery = confirmationQuery
      .eq("batch_id", input.batchId)
      .eq("client_profile_id", input.clientProfileId)
      .is("invalidated_at", null)
      .is("consumed_at", null)
      .order("confirmed_at", { ascending: false })
      .limit(1);
  }

  const { data: confirmation, error: confirmationError } =
    await confirmationQuery.maybeSingle();

  if (confirmationError) throw new Error(confirmationError.message);
  if (
    !confirmation ||
    confirmation.batch_id !== input.batchId ||
    confirmation.client_profile_id !== input.clientProfileId ||
    confirmation.invalidated_at
  ) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_CONFIRMATION_REQUIRED");
  }

  const plan = parsePlan(confirmation.payment_plan_snapshot);
  if (
    !plan ||
    plan.batchId !== input.batchId ||
    plan.providerCount !== plan.units.length ||
    plan.paymentUnitCount !== plan.units.length ||
    plan.providerCount < 2 ||
    plan.totalAmountCents !== Number(confirmation.total_amount_cents) ||
    plan.currency !== String(confirmation.currency).toUpperCase()
  ) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_PLAN_INVALID");
  }

  const planHash = hashPlan(plan);
  if (planHash !== confirmation.payment_plan_hash) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_PLAN_HASH_MISMATCH");
  }

  const allBookingIds = plan.units.flatMap((unit) => unit.bookingIds);
  if (new Set(allBookingIds).size !== allBookingIds.length) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_BOOKING_DUPLICATE");
  }

  const [{ data: itemData, error: itemError }, { data: bookingData, error: bookingError }] =
    await Promise.all([
      supabaseAdmin
        .from("split_booking_batch_items")
        .select("booking_id, provider_profile_id")
        .eq("batch_id", input.batchId),
      supabaseAdmin
        .from("bookings")
        .select(
          "id, provider_id, babysitter_id, status, service_status, payment_status, amount_total, estimated_amount_cents, currency"
        )
        .in("id", allBookingIds),
    ]);

  if (itemError) throw new Error(itemError.message);
  if (bookingError) throw new Error(bookingError.message);

  if (
    (itemData ?? []).length !== Number(batch.expected_booking_count) ||
    (bookingData ?? []).length !== allBookingIds.length
  ) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_STRUCTURE_CHANGED");
  }

  const itemProviderByBooking = new Map(
    (itemData ?? []).map((item) => [
      String(item.booking_id),
      String(item.provider_profile_id),
    ])
  );
  const bookingById = new Map(
    ((bookingData ?? []) as JsonRow[]).map((booking) => [text(booking.id), booking])
  );

  const memberInputs: Array<{
    providerProfileId: string;
    accountId: string;
    stripeAccountId: string;
    grossAmountCents: number;
    currency: string;
    bookingIds: string[];
  }> = [];

  for (const unit of plan.units) {
    if (unit.currency !== plan.currency) {
      throw new Error("KLYX_PLATFORM_HELD_GROUP_CURRENCY_MISMATCH");
    }

    let liveGross = 0;
    for (const bookingId of unit.bookingIds) {
      const booking = bookingById.get(bookingId);
      if (!booking) {
        throw new Error("KLYX_PLATFORM_HELD_GROUP_STRUCTURE_CHANGED");
      }

      const itemProvider = itemProviderByBooking.get(bookingId);
      const liveProvider = text(booking.provider_id) || text(booking.babysitter_id);
      const liveCurrency = text(booking.currency).toUpperCase();
      const amount = bookingAmount(booking);

      if (
        itemProvider !== unit.providerId ||
        liveProvider !== unit.providerId ||
        liveCurrency !== plan.currency ||
        amount === null ||
        !bookingAccepted(booking)
      ) {
        throw new Error("KLYX_PLATFORM_HELD_GROUP_LIVE_PLAN_CHANGED");
      }

      if (
        !existingCharge &&
        ["paid", "checkout_created", "processing", "pending"].includes(
          text(booking.payment_status).toLowerCase()
        )
      ) {
        throw new Error("KLYX_PLATFORM_HELD_GROUP_CHILD_ALREADY_HAS_PAYMENT");
      }

      liveGross += amount;
    }

    if (liveGross !== unit.amountCents) {
      throw new Error("KLYX_PLATFORM_HELD_GROUP_MEMBER_AMOUNT_MISMATCH");
    }

    let destination;
    try {
      destination = await getProviderStripeDestination(unit.providerId);
    } catch (error) {
      if (isStripeConnectIdentityReviewRequired(error)) {
        throw new Error("KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED");
      }
      throw error;
    }

    if (
      destination.connect.state !== "linked" ||
      !destination.connect.stripeAccountId ||
      destination.connect.stripeAccountId !== unit.stripeAccountId
    ) {
      throw new Error("KLYX_PLATFORM_HELD_GROUP_STRIPE_IDENTITY_CHANGED");
    }

    memberInputs.push({
      providerProfileId: unit.providerId,
      accountId: destination.accountId,
      stripeAccountId: unit.stripeAccountId,
      grossAmountCents: unit.amountCents,
      currency: unit.currency,
      bookingIds: unit.bookingIds,
    });
  }

  const economics = buildPlatformHeldGroupEconomics({
    members: memberInputs,
    commissionPercent: getKlyxCommissionPercent(),
  });

  if (
    economics.grossAmountCents !== plan.totalAmountCents ||
    economics.currency !== plan.currency
  ) {
    throw new Error("KLYX_PLATFORM_HELD_GROUP_TOTAL_MISMATCH");
  }

  return {
    batchId: input.batchId,
    clientProfileId: input.clientProfileId,
    confirmationId: confirmation.id,
    paymentPlanHash: planHash,
    plan,
    economics,
    existingState: existingCharge?.state ?? null,
  };
}
