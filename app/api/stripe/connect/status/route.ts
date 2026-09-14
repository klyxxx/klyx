import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
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
  getCanonicalStripeConnect,
  isStripeConnectIdentityReviewRequired,
  markStripeConnectIdentityReview,
  resolveCanonicalAccountCountry,
  StripeConnectIdentityReviewRequiredError,
  updateCanonicalStripeAccountStatus,
} from "@/lib/stripe-connect-account";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PROVIDER_LIVE_PAYMENT_READINESS_STATUS_15_06
// KLYX_PROVIDER_LIVE_SWITCH_DIAGNOSTIC_16_06
// KLYX_ACCOUNT_LEVEL_STRIPE_CONNECT_19_45

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { account: klyxAccount } = await getAuthenticatedAccount(request);

    const stripeRuntime = assertStripeConnectRuntimeConfigured();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));

    const { data: countryRows, error: countryError } = await supabaseAdmin
      .from("profiles")
      .select("country_code")
      .eq("account_id", klyxAccount.id);

    if (countryError) throw new Error(countryError.message);

    const accountCountry = resolveCanonicalAccountCountry(
      (countryRows ?? []).map((row) => row.country_code)
    );
    const marketReadiness = getKlyxMarketReadiness(accountCountry);
    const marketAssessment = assessKlyxMarketReadiness(marketReadiness);

    const disconnectedResponse = () => {
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
        accountUnavailable: false,
        reviewRequired: false,
        runtimeMode: stripeRuntime.mode,
        livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
        countryCode: marketReadiness.countryCode,
        stripeAccountCountryCode: null,
        stripeAccountCountryMismatch: false,
        marketCommerciallyReady: marketAssessment.ready,
        marketBlockers: marketAssessment.blockers,
        ...readiness,
        paymentBlockReason: readiness.blockReason,
      });
    };

    const connect = await getCanonicalStripeConnect(klyxAccount.id);

    if (connect.state === "review_required") {
      throw new StripeConnectIdentityReviewRequiredError();
    }

    if (!connect.stripeAccountId) {
      return disconnectedResponse();
    }

    let stripeAccount: Stripe.Account;

    try {
      stripeAccount = await stripe.accounts.retrieve(connect.stripeAccountId);
    } catch (error) {
      if (isMissingStripeConnectAccount(error)) {
        await markStripeConnectIdentityReview({
          accountId: klyxAccount.id,
          reason: "stored_stripe_account_unavailable",
          candidateStripeAccountIds: [connect.stripeAccountId],
        });
        throw new StripeConnectIdentityReviewRequiredError();
      }

      throw error;
    }

    const countryAssessment = assessStripeConnectCountry({
      klyxCountryCode: accountCountry,
      stripeCountryCode: stripeAccount.country,
    });
    const countryMismatch = !countryAssessment.matches;
    const onboardingComplete = Boolean(stripeAccount.details_submitted);
    const chargesEnabled = Boolean(stripeAccount.charges_enabled);
    const payoutsEnabled = Boolean(stripeAccount.payouts_enabled);

    await updateCanonicalStripeAccountStatus({
      accountId: klyxAccount.id,
      stripeAccount,
    });

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
    if (isStripeConnectIdentityReviewRequired(error)) {
      return NextResponse.json(
        {
          error:
            "L'identité Stripe Connect de ce compte KLYX nécessite une revue.",
          code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED",
          reviewRequired: true,
        },
        { status: 409 }
      );
    }

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
