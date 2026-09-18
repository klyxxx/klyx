import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedAccount } from "@/lib/api-auth";
import {
  assessKlyxMarketReadiness,
  getKlyxMarketReadiness,
} from "@/lib/klyx-market-readiness";
import { assessKlyxProviderPaymentReadiness } from "@/lib/klyx-provider-payment-readiness";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import { isMissingStripeConnectAccount } from "@/lib/stripe-connect-account-recovery";
import {
  assertStripeConnectIdentityUsable,
  getAccountStripeConnectIdentity,
  STRIPE_CONNECT_IDENTITY_CONFLICT,
  STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
} from "@/lib/stripe-connect-account-identity";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable manquante : ${name}`);
  return value;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { account, profile: activeProfile } =
      await getAuthenticatedAccount(request);
    const stripeRuntime = assertStripeConnectRuntimeConfigured();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const marketReadiness = getKlyxMarketReadiness(activeProfile.countryCode);
    const marketAssessment = assessKlyxMarketReadiness(marketReadiness);

    const disconnectedResponse = (
      accountUnavailable = false,
      reviewRequired = false
    ) => {
      const readiness = assessKlyxProviderPaymentReadiness({
        runtimeMode: stripeRuntime.mode,
        livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
        marketCommerciallyReady: marketAssessment.ready,
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });

      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountId: null,
        accountUnavailable,
        reviewRequired,
        runtimeMode: stripeRuntime.mode,
        livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
        countryCode: marketReadiness.countryCode,
        stripeAccountCountryCode: null,
        stripeAccountCountryMismatch: false,
        marketCommerciallyReady: marketAssessment.ready,
        marketBlockers: marketAssessment.blockers,
        ...readiness,
        paymentBlockReason: reviewRequired
          ? STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED
          : readiness.blockReason,
      });
    };

    const identity = await getAccountStripeConnectIdentity(account.id);

    if (identity.state === "conflict") {
      return NextResponse.json(
        {
          error:
            "Plusieurs identités Stripe historiques sont associées à ce compte KLYX. Une revue est requise.",
          code: STRIPE_CONNECT_IDENTITY_CONFLICT,
          reviewRequired: true,
        },
        { status: 409 }
      );
    }

    const stripeAccountId = assertStripeConnectIdentityUsable(identity);
    if (!stripeAccountId) return disconnectedResponse(false, false);

    let stripeAccount: Stripe.Account;

    try {
      stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    } catch (error) {
      if (isMissingStripeConnectAccount(error)) {
        return disconnectedResponse(true, true);
      }
      throw error;
    }

    const countryAssessment = assessStripeConnectCountry({
      klyxCountryCode: activeProfile.countryCode,
      stripeCountryCode: stripeAccount.country,
    });
    const countryMismatch = !countryAssessment.matches;
    const onboardingComplete = Boolean(stripeAccount.details_submitted);
    const chargesEnabled = Boolean(stripeAccount.charges_enabled);
    const payoutsEnabled = Boolean(stripeAccount.payouts_enabled);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq("account_id", account.id);

    if (updateError) throw new Error(updateError.message);

    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: stripeRuntime.mode,
      livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
      marketCommerciallyReady: marketAssessment.ready && !countryMismatch,
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
    });
    const marketBlockers = countryMismatch
      ? [...marketAssessment.blockers, STRIPE_ACCOUNT_COUNTRY_MISMATCH]
      : marketAssessment.blockers;

    return NextResponse.json({
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      accountId: stripeAccount.id,
      accountUnavailable: false,
      reviewRequired: false,
      runtimeMode: stripeRuntime.mode,
      livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
      countryCode: marketReadiness.countryCode,
      stripeAccountCountryCode: countryAssessment.stripeCountryCode,
      stripeAccountCountryMismatch: countryMismatch,
      marketCommerciallyReady: marketAssessment.ready && !countryMismatch,
      marketBlockers,
      ...readiness,
      livePaymentsOperational:
        countryMismatch ? false : readiness.livePaymentsOperational,
      paymentBlockReason:
        countryMismatch
          ? STRIPE_ACCOUNT_COUNTRY_MISMATCH
          : readiness.blockReason,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de vérifier Stripe Connect.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "stripe_connect_status_failed",
      route: "/api/stripe/connect/status",
      method: "GET",
      code: "stripe_connect_status_failed",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
