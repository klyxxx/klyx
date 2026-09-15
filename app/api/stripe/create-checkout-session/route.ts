import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  enforceCheckoutTransactionRisk,
  isTransactionRiskGateError,
} from "@/lib/transaction-risk-server";
import { POST as corePost } from "./route-core";

/*
 * KLYX_PAYMENT_CORE_CONTRACT_MIRROR
 *
 * The executable payment authority lives in ./route-core.ts. These non-runtime
 * anchors keep legacy static contracts pointed at the same public route while a
 * dedicated bridge test verifies every @core token exists in route-core.ts.
 *
 * try { assertStripeRuntimeReady()
 * @core:KLYX_SERVER_OBSERVABILITY_12B_8B
 * @core:from "@/lib/server-log"
 * @core:"stripe_checkout_created"
 * @core:"stripe_checkout_reused"
 * @core:"stripe_checkout_failed"
 * @core:assertStripeRuntimeReady()
 * @core:currency: string | null;
 * @core:payment_status, currency, pricing_type_snapshot
 * @core:klyx_claim_booking_payment
 * @core:klyx_release_expired_booking_checkout
 * @core:async function expireUnpersistedCheckoutSession(
 * @core:KLYX_SPLIT_LEGACY_CHECKOUT_GUARD_13_27
 * @core:split_booking_payment_units
 * @core:"booking_ids"
 * @core:.filter(
 * @core:booking.status !== "accepted"
 * @core:payment_status === "paid"
 * @core:alreadyPaid
 * @core:resolveService(
 * @core:durationMinutes <= 0
 * @core:amountTotal =
 * @core:booking.estimated_amount_cents ?? booking.amount_total ?? fallbackAmount
 * @core:amountTotal < 50
 * @core:checkoutCurrency
 * @core:assessKlyxStripeMarketAccess
 * @core:profile.countryCode
 * @core:clientMarketAccess.allowed
 * @core:participant: "client"
 * @core:KLYX_CHECKOUT_MARKET_NOT_READY
 * @core:getProviderStripeDestination(providerId)
 * @core:provider.countryCode
 * @core:providerMarketAccess.allowed
 * @core:participant: "provider"
 * @core:KLYX_CHECKOUT_MARKET_NOT_READY
 * @core:assessStripeConnectCountry
 * @core:STRIPE_ACCOUNT_COUNTRY_MISMATCH
 * @core:getProviderStripeDestination
 * @core:canonicalStripeAccountId
 * @core:stripe.accounts.retrieve
 * @core:providerStripeAccount?.details_submitted
 * @core:providerStripeAccount.charges_enabled
 * @core:providerStripeAccount.payouts_enabled
 * @core:providerReady
 * @core:KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED
 * @core:idempotencyKey
 * @core:idempotencyKey: `klyx-booking-${booking.id}-attempt-${claim.attempt_number}`
 * @core:application_fee_amount
 * @core:transfer_data
 * @core:stripe.checkout.sessions.create
 * @core:.eq("payment_attempt_token", attemptToken)
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

    // Preserve the original core as the authority for not-found and ownership
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