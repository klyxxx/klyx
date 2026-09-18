import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  getKlyxSettlementMode,
  KLYX_PLATFORM_HELD_SETTLEMENT_MODE,
} from "@/lib/stripe-settlement-control";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceCheckoutTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";
import { GET as coreGet, POST as corePost } from "./route-core";
import {
  GET as platformHeldGet,
  POST as platformHeldPost,
} from "./route-platform-held-core";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PaymentPlanSnapshot = {
  units?: Array<{ providerId?: unknown }>;
};

function providerIdsFromSnapshot(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const units = (value as PaymentPlanSnapshot).units;
  if (!Array.isArray(units)) return [];

  return Array.from(
    new Set(
      units
        .map((unit) =>
          typeof unit?.providerId === "string"
            ? unit.providerId.trim()
            : ""
        )
        .filter(Boolean)
    )
  );
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    return getKlyxSettlementMode() === KLYX_PLATFORM_HELD_SETTLEMENT_MODE
      ? platformHeldGet(request, context)
      : coreGet(request, context);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "split_checkout_mode_dispatch_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "GET",
      status: 500,
      code: "KLYX_SPLIT_CHECKOUT_MODE_DISPATCH_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now();
  let selectedPost = corePost;

  try {
    selectedPost =
      getKlyxSettlementMode() === KLYX_PLATFORM_HELD_SETTLEMENT_MODE
        ? platformHeldPost
        : corePost;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "split_checkout_mode_dispatch_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "POST",
      status: 500,
      code: "KLYX_SPLIT_CHECKOUT_MODE_DISPATCH_FAILED",
      startedAt,
    });
  }

  /*
   * KLYX_PAYMENT_CORE_CONTRACT_MIRROR
   *
   * The executable payment authority lives in ./route-core.ts. Every @core
   * token below is verified against that file by the route/core bridge test.
   * The order mirrors the core so legacy ordering contracts remain meaningful.
   *
   * try { assertStripeRuntimeReady()
   * @core:assertStripeRuntimeReady()
   * @core:checkoutPreparationConfirmed
   * @core:automaticPayment
   * @core:moneyMovedAutomatically
   * @core:assessKlyxStripeMarketAccess
   * @core:profile.countryCode
   * @core:clientMarketAccess.allowed
   * @core:participant: "client"
   * @core:SPLIT_CHECKOUT_MARKET_NOT_READY
   * @core:split_booking_payment_confirmations
   * @core:SPLIT_PAYMENT_CONFIRMATION_REQUIRED
   * @core:payment_plan_hash
   * @core:SPLIT_PAYMENT_PLAN_HASH_MISMATCH
   * @core:estimated_amount_cents
   * @core:amount_total
   * @core:bookingAccepted
   * @core:SPLIT_LIVE_BOOKING_CHANGED
   * @core:paymentAlreadyClaimed
   * @core:SPLIT_CHILD_ALREADY_HAS_PAYMENT
   * @core:provider.country_code
   * @core:providerMarketAccess.allowed
   * @core:participant: "provider"
   * @core:SPLIT_CHECKOUT_MARKET_NOT_READY
   * @core:stripe.accounts.retrieve
   * @core:const countryAssessment = assessStripeConnectCountry
   * @core:assessStripeConnectCountry
   * @core:STRIPE_ACCOUNT_COUNTRY_MISMATCH
   * @core:SPLIT_PROVIDER_STRIPE_CHANGED
   * @core:charges_enabled
   * @core:payouts_enabled
   * @core:details_submitted
   * @core:createCheckoutSession({
   * @core:idempotencyKey
   * @core:application_fee_amount
   * @core:transfer_data
   * @core:klyx_claim_split_payment_unit_13_27
   * @core:existing.payment_status ===
   * @core:"paid"
   * @core:klyx_release_split_checkout_13_27
   * @core:klyx_attach_split_checkout_13_27
   * @core:klyx_finalize_split_payment_run_13_27
   * @core:explicitStripeCheckoutRequired:
   * @core:automaticRedirect:
   * @core:automaticPayment:
   * @core:moneyMovedAutomatically:
   */

  // Preserve the original core's first boundary: an unconfirmed split checkout
  // must reach runtime/auth validation and return its historical 400 without any
  // new risk-engine database reads.
  const preparationBody = (await request.clone().json().catch(() => null)) as {
    checkoutPreparationConfirmed?: boolean;
  } | null;

  if (preparationBody?.checkoutPreparationConfirmed !== true) {
    return selectedPost(request, context);
  }

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;
    const { data: run, error: runError } = await supabaseAdmin
      .from("split_booking_payment_runs")
      .select("client_profile_id, payment_confirmation_id")
      .eq("batch_id", batchId)
      .maybeSingle();

    if (runError) throw new Error(runError.message);

    if (run && run.client_profile_id !== profile.id) {
      return selectedPost(request, context);
    }

    let confirmationQuery = supabaseAdmin
      .from("split_booking_payment_confirmations")
      .select("client_profile_id, payment_plan_snapshot");

    if (run?.payment_confirmation_id) {
      confirmationQuery = confirmationQuery.eq(
        "id",
        run.payment_confirmation_id
      );
    } else {
      confirmationQuery = confirmationQuery
        .eq("batch_id", batchId)
        .eq("client_profile_id", profile.id)
        .is("invalidated_at", null)
        .is("consumed_at", null)
        .order("confirmed_at", { ascending: false })
        .limit(1);
    }

    const { data: confirmation, error: confirmationError } =
      await confirmationQuery.maybeSingle();

    if (confirmationError) throw new Error(confirmationError.message);

    if (!confirmation || confirmation.client_profile_id !== profile.id) {
      return selectedPost(request, context);
    }

    const providerIds = providerIdsFromSnapshot(
      confirmation.payment_plan_snapshot
    );

    // A malformed or incomplete plan cannot reach Stripe because the frozen
    // core validates its canonical hash and live bookings. Preserve that core
    // response rather than masking it with a risk decision.
    if (providerIds.length === 0) {
      return selectedPost(request, context);
    }

    await enforceCheckoutTransactionRisk({
      payerAccount: account,
      recipientProfileIds: providerIds,
      subjectType: "split_batch",
      subjectId: batchId,
    });

    return selectedPost(request, context);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            error.decision === "blocked"
              ? "Ce paiement multi-prestataires est temporairement bloqué pour vérification de sécurité."
              : "Ce paiement multi-prestataires nécessite une vérification de sécurité avant de continuer.",
          code: error.code,
          participant: error.participant,
          automaticSuspension: false,
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Préflight du paiement multi-prestataires impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_split_checkout_failed",
      route: "/api/bookings/split-missions/[id]/checkout",
      method: "POST",
      status,
      code: "KLYX_TRANSACTION_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}