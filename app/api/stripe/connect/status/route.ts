import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  assessKlyxMarketReadiness,
  getKlyxMarketReadiness,
} from "@/lib/klyx-market-readiness";
import { assessKlyxProviderPaymentReadiness } from "@/lib/klyx-provider-payment-readiness";
import { isMissingStripeConnectAccount } from "@/lib/stripe-connect-account-recovery";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PROVIDER_LIVE_PAYMENT_READINESS_STATUS_15_06
// KLYX_PROVIDER_LIVE_SWITCH_DIAGNOSTIC_16_06

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
    const { profile: activeProfile } =
      await getAuthenticatedProfile(request);
    requireAccountType(activeProfile, "provider");

    const stripeRuntime = assertStripeConnectRuntimeConfigured();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const marketReadiness = getKlyxMarketReadiness(
      activeProfile.countryCode
    );
    const marketAssessment = assessKlyxMarketReadiness(marketReadiness);

    const disconnectedResponse = (accountUnavailable = false) => {
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
        runtimeMode: stripeRuntime.mode,
        livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
        countryCode: marketReadiness.countryCode,
        marketCommerciallyReady: marketAssessment.ready,
        marketBlockers: marketAssessment.blockers,
        ...readiness,
        paymentBlockReason: readiness.blockReason,
      });
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", activeProfile.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile?.stripe_account_id) {
      return disconnectedResponse(false);
    }

    let account: Stripe.Account;

    try {
      account = await stripe.accounts.retrieve(profile.stripe_account_id);
    } catch (error) {
      // GET remains read-only for account identity. A definitively missing
      // Stripe account is exposed as recoverable disconnected state so the UI
      // can offer onboarding again; POST owns replacement creation.
      if (isMissingStripeConnectAccount(error)) {
        return disconnectedResponse(true);
      }

      throw error;
    }

    const onboardingComplete = Boolean(account.details_submitted);
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq("id", activeProfile.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const readiness = assessKlyxProviderPaymentReadiness({
      runtimeMode: stripeRuntime.mode,
      livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
      marketCommerciallyReady: marketAssessment.ready,
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
    });

    return NextResponse.json({
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      accountId: account.id,
      accountUnavailable: false,
      runtimeMode: stripeRuntime.mode,
      livePaymentsEnabled: stripeRuntime.livePaymentsEnabled,
      countryCode: marketReadiness.countryCode,
      marketCommerciallyReady: marketAssessment.ready,
      marketBlockers: marketAssessment.blockers,
      ...readiness,
      paymentBlockReason: readiness.blockReason,
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
