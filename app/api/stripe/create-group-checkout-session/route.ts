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
 * The executable payment authority lives in ./route-core.ts. Every @core token
 * below is verified against that file by the route/core bridge contract test.
 *
 * try { assertStripeRuntimeReady()
 * @core:assertStripeRuntimeReady()
 * @core:assessKlyxStripeMarketAccess
 * @core:profile.countryCode
 * @core:clientMarketAccess.allowed
 * @core:participant: "client"
 * @core:KLYX_GROUP_CHECKOUT_MARKET_NOT_READY
 * @core:providerMarketAccess.allowed
 * @core:participant: "provider"
 * @core:getProfileAccountStripeConnectIdentity
 * @core:provider?.country_code
 * @core:providerStripeAccountId
 * @core:STRIPE_CONNECT_IDENTITY_CONFLICT
 * @core:KLYX_GROUP_CHECKOUT_MARKET_NOT_READY
 * @core:stripe.accounts.retrieve
 * @core:assessStripeConnectCountry
 * @core:STRIPE_ACCOUNT_COUNTRY_MISMATCH
 * @core:providerStripeAccount?.details_submitted
 * @core:providerStripeAccount.charges_enabled
 * @core:providerStripeAccount.payouts_enabled
 * @core:providerReady
 * @core:klyx_claim_booking_group_payment
 * @core:async function expireUnpersistedCheckoutSession(
 * @core:idempotencyKey
 * @core:application_fee_amount
 * @core:transfer_data
 * @core:stripe.checkout.sessions.create(
 */

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { account, profile } = await getAuthenticatedAccount(request);
    requireAccountType(profile, "client");

    const body = (await request.clone().json().catch(() => null)) as {
      groupId?: string;
    } | null;
    const groupId = body?.groupId?.trim() ?? "";

    if (!groupId) {
      return corePost(request);
    }

    const { data: group, error } = await supabaseAdmin
      .from("booking_groups")
      .select("client_profile_id, provider_profile_id")
      .eq("id", groupId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!group || group.client_profile_id !== profile.id) {
      return corePost(request);
    }

    await enforceCheckoutTransactionRisk({
      payerAccount: account,
      recipientProfileIds: group.provider_profile_id
        ? [group.provider_profile_id]
        : [],
      subjectType: "booking_group",
      subjectId: groupId,
    });

    return corePost(request);
  } catch (error) {
    if (isTransactionRiskGateError(error)) {
      return NextResponse.json(
        {
          error:
            error.decision === "blocked"
              ? "Ce paiement groupé est temporairement bloqué pour vérification de sécurité."
              : "Ce paiement groupé nécessite une vérification de sécurité avant de continuer.",
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
        : "Préflight du paiement groupé impossible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "transaction_risk_group_checkout_failed",
      route: "/api/stripe/create-group-checkout-session",
      method: "POST",
      status,
      code: "KLYX_TRANSACTION_RISK_PREFLIGHT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}