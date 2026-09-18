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
import { POST as corePost } from "./route-core";
import { POST as platformHeldPost } from "./route-platform-held";

/*
 * KLYX_PAYMENT_CORE_CONTRACT_MIRROR
 *
 * The certified destination-charge authority remains in ./route-core.ts.
 * Platform-held TEST mode is additive in ./route-platform-held.ts. This public
 * route owns only authentication, transaction-risk preflight and mode dispatch.
 *
 * @core:KLYX_SERVER_OBSERVABILITY_12B_8B
 * @core:assertStripeRuntimeReady()
 * @core:KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27
 * @core:assessKlyxStripeMarketAccess
 * @core:getProfileAccountStripeConnectIdentity(providerId)
 * @core:STRIPE_CONNECT_IDENTITY_CONFLICT
 * @core:assertStripeConnectIdentityUsable
 * @core:stripe.accounts.retrieve
 * @core:assessStripeConnectCountry
 * @core:klyx_claim_booking_payment
 * @core:application_fee_amount
 * @core:transfer_data
 * @core:stripe.checkout.sessions.create
 */

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const body = (await request.clone().json().catch(() => null)) as {
      bookingId?: string;
    } | null;
    const bookingId = body?.bookingId?.trim() ?? "";

    if (!bookingId) {
      return corePost(request);
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("parent_id, provider_id, babysitter_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Preserve the payment cores as authority for not-found and ownership
    // responses. The risk preflight must not leak transaction existence.
    if (!booking || booking.parent_id !== profile.id) {
      return corePost(request);
    }

    const providerId = booking.provider_id ?? booking.babysitter_id;

    await enforceCheckoutTransactionRisk({
      payerAccount: account,
      recipientProfileIds: providerId ? [providerId] : [],
      subjectType: "booking",
      subjectId: bookingId,
    });

    const settlementMode = getKlyxSettlementMode();

    if (settlementMode === KLYX_PLATFORM_HELD_SETTLEMENT_MODE) {
      return platformHeldPost(request);
    }

    return corePost(request);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            error.decision === "blocked"
              ? "Ce paiement est temporairement bloqué pour vérification de sécurité."
              : "Ce paiement nécessite une vérification de sécurité avant de continuer.",
          code: error.code,
          participant: error.participant,
          automaticSuspension: false,
        },
        { status: 409 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Préflight de paiement impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_single_checkout_failed",
      route: "/api/stripe/create-checkout-session",
      method: "POST",
      status,
      code: "KLYX_TRANSACTION_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
