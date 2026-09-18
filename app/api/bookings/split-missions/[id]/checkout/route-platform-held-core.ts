import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  freezeMultiExecutorGroupEconomics,
  type GroupExecutorInput,
} from "@/lib/group-multiexecutor-settlement-economics";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import {
  getProviderStripeDestination,
  isStripeConnectIdentityReviewRequired,
} from "@/lib/stripe-connect-account";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import {
  getKlyxSettlementMode,
  KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
  settlementTransferGroup,
} from "@/lib/stripe-settlement-control";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JsonRow = Record<string, unknown>;

type CanonicalUnit = {
  providerId: string;
  amountCents: number;
  currency: string;
  bookingIds: string[];
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

type ParentRow = {
  id: string;
  batch_id: string;
  client_profile_id: string;
  state: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  transfer_group: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
};

type CheckoutClaim = {
  action: "create" | "reuse" | "busy" | "paid";
  attempt_number: number;
  checkout_session_id: string | null;
};

function asRecord(value: unknown): JsonRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRow)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function parseCanonicalPlan(value: unknown): CanonicalPlan | null {
  const root = asRecord(value);
  if (!root || !Array.isArray(root.units)) return null;

  const units: CanonicalUnit[] = [];
  for (const raw of root.units) {
    const unit = asRecord(raw);
    if (!unit) return null;

    const providerId = text(unit.providerId);
    const amountCents = numberValue(unit.amountCents);
    const currency = text(unit.currency).toUpperCase();
    const bookingIds = strings(unit.bookingIds);
    const stripeAccountId = text(unit.stripeAccountId);

    if (
      !providerId ||
      amountCents === null ||
      amountCents <= 0 ||
      currency.length !== 3 ||
      bookingIds.length === 0 ||
      !stripeAccountId.startsWith("acct_")
    ) {
      return null;
    }

    units.push({
      providerId,
      amountCents,
      currency,
      bookingIds,
      stripeAccountId,
    });
  }

  units.sort((a, b) => a.providerId.localeCompare(b.providerId));

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
    totalAmountCents <= 0 ||
    currency.length !== 3 ||
    providerCount !== units.length ||
    paymentUnitCount !== units.length ||
    providerCount < 2 ||
    units.some((unit) => unit.currency !== currency) ||
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

function planHash(plan: CanonicalPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function requiredTestStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (key.startsWith("sk_live_")) {
    throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED");
  }

  return new Stripe(key);
}

async function loadConfirmation(
  batchId: string,
  clientProfileId: string
): Promise<ConfirmationRow> {
  const { data, error } = await supabaseAdmin
    .from("split_booking_payment_confirmations")
    .select(
      "id, batch_id, client_profile_id, price_confirmation_id, payment_plan_hash, payment_plan_snapshot, provider_count, payment_unit_count, total_amount_cents, currency, invalidated_at, consumed_at"
    )
    .eq("batch_id", batchId)
    .eq("client_profile_id", clientProfileId)
    .is("invalidated_at", null)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_PAYMENT_CONFIRMATION_REQUIRED");

  return data as ConfirmationRow;
}

async function loadParent(batchId: string): Promise<ParentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlements")
    .select(
      "id, batch_id, client_profile_id, state, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, transfer_group, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id"
    )
    .eq("batch_id", batchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as ParentRow) : null;
}

async function claimCheckout(parentId: string, claimToken: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_claim_platform_held_group_checkout",
    {
      p_group_settlement_id: parentId,
      p_claim_token: claimToken,
    }
  );
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as CheckoutClaim[])[0];
  if (!row) throw new Error("KLYX_GROUP_HELD_CHECKOUT_CLAIM_MISSING");
  return row;
}

async function buildFrozenPlan(input: {
  confirmation: ConfirmationRow;
  stripeRuntimeMode: string;
}) {
  const plan = parseCanonicalPlan(input.confirmation.payment_plan_snapshot);
  if (!plan) throw new Error("KLYX_GROUP_HELD_PAYMENT_PLAN_INVALID");

  if (
    plan.batchId !== input.confirmation.batch_id ||
    plan.priceConfirmationId !== input.confirmation.price_confirmation_id ||
    planHash(plan) !== input.confirmation.payment_plan_hash ||
    plan.providerCount !== Number(input.confirmation.provider_count) ||
    plan.paymentUnitCount !== Number(input.confirmation.payment_unit_count) ||
    plan.totalAmountCents !== Number(input.confirmation.total_amount_cents) ||
    plan.currency !== input.confirmation.currency.toUpperCase()
  ) {
    throw new Error("KLYX_GROUP_HELD_PAYMENT_PLAN_HASH_MISMATCH");
  }

  const executorInputs: GroupExecutorInput[] = [];

  for (const unit of plan.units) {
    const destination = await getProviderStripeDestination(unit.providerId);

    if (
      destination.connect.state !== "linked" ||
      !destination.connect.stripeAccountId ||
      destination.connect.stripeAccountId !== unit.stripeAccountId
    ) {
      throw new Error("KLYX_GROUP_HELD_PROVIDER_STRIPE_CHANGED");
    }

    if (
      !destination.connect.onboardingComplete ||
      !destination.connect.chargesEnabled ||
      !destination.connect.payoutsEnabled
    ) {
      throw new Error("KLYX_GROUP_HELD_PROVIDER_STRIPE_NOT_READY");
    }

    const market = assessKlyxStripeMarketAccess(
      destination.countryCode ?? "",
      input.stripeRuntimeMode
    );
    if (!market.allowed) {
      throw new Error("KLYX_GROUP_HELD_PROVIDER_MARKET_NOT_READY");
    }

    executorInputs.push({
      providerProfileId: unit.providerId,
      providerAccountId: destination.accountId,
      stripeAccountId: destination.connect.stripeAccountId,
      bookingIds: unit.bookingIds,
      grossAmountCents: unit.amountCents,
      currency: unit.currency,
    });
  }

  const economics = freezeMultiExecutorGroupEconomics({
    executors: executorInputs,
  });

  if (economics.grossAmountCents !== plan.totalAmountCents) {
    throw new Error("KLYX_GROUP_HELD_GROSS_TOTAL_MISMATCH");
  }

  return { plan, economics };
}

async function prepareParent(input: {
  confirmation: ConfirmationRow;
  clientProfileId: string;
  economics: ReturnType<typeof freezeMultiExecutorGroupEconomics>;
}) {
  const transferGroup = settlementTransferGroup({
    subjectType: "split_batch",
    subjectId: input.confirmation.batch_id,
  });

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_prepare_platform_held_group_settlement",
    {
      p_batch_id: input.confirmation.batch_id,
      p_client_profile_id: input.clientProfileId,
      p_payment_confirmation_id: input.confirmation.id,
      p_payment_plan_hash: input.confirmation.payment_plan_hash,
      p_currency: input.economics.currency,
      p_gross_amount_cents: input.economics.grossAmountCents,
      p_platform_fee_cents: input.economics.platformFeeCents,
      p_provider_amount_cents: input.economics.providerAmountCents,
      p_transfer_group: transferGroup,
      p_members: input.economics.members.map((member) => ({
        provider_profile_id: member.providerProfileId,
        provider_account_id: member.providerAccountId,
        stripe_account_id: member.stripeAccountId,
        booking_ids: member.bookingIds,
        gross_amount_cents: member.grossAmountCents,
        platform_fee_cents: member.platformFeeCents,
        provider_amount_cents: member.providerAmountCents,
      })),
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string") {
    throw new Error("KLYX_GROUP_HELD_PARENT_NOT_PREPARED");
  }

  const parent = await loadParent(input.confirmation.batch_id);
  if (!parent || parent.id !== data || parent.transfer_group !== transferGroup) {
    throw new Error("KLYX_GROUP_HELD_PARENT_TRUTH_MISMATCH");
  }

  return parent;
}

async function attachCheckout(input: {
  parentId: string;
  claimToken: string;
  sessionId: string;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_attach_platform_held_group_checkout",
    {
      p_group_settlement_id: input.parentId,
      p_claim_token: input.claimToken,
      p_checkout_session_id: input.sessionId,
    }
  );
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_HELD_CHECKOUT_ATTACH_LOST");
}

async function releaseExpiredCheckout(parentId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_release_expired_platform_held_group_checkout",
    {
      p_group_settlement_id: parentId,
      p_checkout_session_id: sessionId,
    }
  );
  if (error) throw new Error(error.message);
  return data === true;
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    if (getKlyxSettlementMode() !== KLYX_PLATFORM_HELD_SETTLEMENT_MODE) {
      throw new Error("KLYX_PLATFORM_HELD_MODE_NOT_ACTIVE");
    }

    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;
    const parent = await loadParent(batchId);

    if (!parent || parent.client_profile_id !== profile.id) {
      return NextResponse.json({
        prepared: false,
        status: "not_started",
        onePlatformCharge: true,
        perExecutorSettlement: true,
      });
    }

    return NextResponse.json({
      prepared: true,
      groupSettlementId: parent.id,
      status: parent.state,
      amountTotalCents: Number(parent.gross_amount_cents),
      platformFeeCents: Number(parent.platform_fee_cents),
      providerAmountCents: Number(parent.provider_amount_cents),
      currency: parent.currency,
      checkoutSessionId: parent.stripe_checkout_session_id,
      onePlatformCharge: true,
      perExecutorSettlement: true,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "platform_held_group_checkout_read_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "GET",
      status: 500,
      code: "KLYX_GROUP_HELD_CHECKOUT_READ_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    if (getKlyxSettlementMode() !== KLYX_PLATFORM_HELD_SETTLEMENT_MODE) {
      throw new Error("KLYX_PLATFORM_HELD_MODE_NOT_ACTIVE");
    }

    const stripe = requiredTestStripe();
    const stripeRuntime = assertStripeRuntimeReady();
    const { user, profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const clientMarket = assessKlyxStripeMarketAccess(
      profile.countryCode,
      stripeRuntime.mode
    );
    if (!clientMarket.allowed) {
      return NextResponse.json(
        {
          error: "KLYX n'est pas ouvert à ce paiement dans le pays du client.",
          code: "KLYX_GROUP_HELD_CLIENT_MARKET_NOT_READY",
        },
        { status: 409 }
      );
    }

    const body = asRecord(await request.json());
    if (!body || body.checkoutPreparationConfirmed !== true) {
      return NextResponse.json(
        {
          error: "Préparation explicite du paiement requise.",
          code: "SPLIT_CHECKOUT_PREPARATION_CONFIRMATION_REQUIRED",
          automaticPayment: false,
        },
        { status: 400 }
      );
    }

    const { id: batchId } = await context.params;
    const confirmation = await loadConfirmation(batchId, profile.id);
    const { plan, economics } = await buildFrozenPlan({
      confirmation,
      stripeRuntimeMode: stripeRuntime.mode,
    });

    const parent = await prepareParent({
      confirmation,
      clientProfileId: profile.id,
      economics,
    });

    if (parent.state !== "pending_payment") {
      return NextResponse.json(
        {
          alreadyPaid: true,
          status: parent.state,
          groupSettlementId: parent.id,
        },
        { status: 409 }
      );
    }

    let claimToken = randomUUID();
    let claim = await claimCheckout(parent.id, claimToken);

    if (claim.action === "paid") {
      return NextResponse.json(
        { alreadyPaid: true, groupSettlementId: parent.id },
        { status: 409 }
      );
    }

    if (claim.action === "busy") {
      return NextResponse.json(
        {
          paymentPending: true,
          groupSettlementId: parent.id,
          automaticPayment: false,
        },
        { status: 409 }
      );
    }

    if (claim.action === "reuse" && claim.checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        claim.checkout_session_id
      );

      if (existing.livemode) {
        throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
      }

      const sameFlow =
        existing.metadata?.klyx_flow ===
          "platform_held_group_multiexecutor" &&
        existing.metadata?.group_settlement_id === parent.id &&
        existing.metadata?.split_batch_id === batchId;

      if (sameFlow && existing.status === "open" && existing.url) {
        return NextResponse.json({
          url: existing.url,
          reused: true,
          groupSettlementId: parent.id,
          paymentMode: "platform_held_group",
          amountTotalCents: economics.grossAmountCents,
          currency: economics.currency,
          executorCount: economics.members.length,
        });
      }

      if (sameFlow && existing.payment_status === "paid") {
        return NextResponse.json(
          {
            paymentPending: true,
            groupSettlementId: parent.id,
            paymentMode: "platform_held_group",
          },
          { status: 409 }
        );
      }

      if (existing.status === "open") {
        await stripe.checkout.sessions.expire(existing.id);
      }
      if (existing.status === "expired" || !sameFlow) {
        await releaseExpiredCheckout(parent.id, existing.id);
        claimToken = randomUUID();
        claim = await claimCheckout(parent.id, claimToken);
      }
    }

    if (claim.action !== "create") {
      return NextResponse.json(
        {
          paymentPending: claim.action !== "paid",
          alreadyPaid: claim.action === "paid",
          groupSettlementId: parent.id,
        },
        { status: 409 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const metadata = {
      klyx_flow: "platform_held_group_multiexecutor",
      split_batch_id: batchId,
      group_settlement_id: parent.id,
      payment_confirmation_id: confirmation.id,
      payment_mode: "platform_held_group",
      settlement_transfer_group: parent.transfer_group,
      executor_count: String(economics.members.length),
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        success_url: `${origin}/bookings/split/${batchId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/bookings/split/${batchId}?payment=cancelled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: economics.currency.toLowerCase(),
              unit_amount: economics.grossAmountCents,
              product_data: {
                name: "Mission multi-prestataires KLYX",
                description: `${economics.members.length} exécutants`,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: {
          metadata,
          transfer_group: parent.transfer_group,
        },
      },
      {
        idempotencyKey: `klyx-platform-held-group-${parent.id}-attempt-${claim.attempt_number}`,
      }
    );

    if (session.livemode) {
      throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
    }
    if (!session.url) {
      throw new Error("KLYX_GROUP_HELD_CHECKOUT_URL_MISSING");
    }

    await attachCheckout({
      parentId: parent.id,
      claimToken,
      sessionId: session.id,
    });

    const now = new Date().toISOString();
    const { error: consumeError } = await supabaseAdmin
      .from("split_booking_payment_confirmations")
      .update({ consumed_at: now, updated_at: now })
      .eq("id", confirmation.id)
      .is("consumed_at", null);

    if (consumeError) throw new Error(consumeError.message);

    return NextResponse.json({
      url: session.url,
      reused: false,
      groupSettlementId: parent.id,
      paymentMode: "platform_held_group",
      amountTotalCents: economics.grossAmountCents,
      platformFeeCents: economics.platformFeeCents,
      providerAmountCents: economics.providerAmountCents,
      currency: economics.currency,
      executorCount: economics.members.length,
      onePlatformCharge: true,
      automaticPayment: false,
      planProviderCount: plan.providerCount,
    });
  } catch (error) {
    if (isStripeConnectIdentityReviewRequired(error)) {
      return NextResponse.json(
        {
          error:
            "Une identité Stripe Connect d'un exécutant nécessite une revue.",
          code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED",
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Impossible de préparer le paiement groupé Platform-Held.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "platform_held_group_checkout_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "POST",
      status,
      code: "KLYX_GROUP_HELD_CHECKOUT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
