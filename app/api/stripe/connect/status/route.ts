import { NextResponse } from "next/server";
import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";

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
    assertStripeRuntimeReady();

    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const { profile: activeProfile } =
      await getAuthenticatedProfile(request);
    requireAccountType(activeProfile, "provider");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", activeProfile.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile?.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

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

    return NextResponse.json({
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      accountId: account.id,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de vérifier Stripe Connect.";
    const status =
      apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event:
        "stripe_connect_status_failed",
      route:
        "/api/stripe/connect/status",
      method: "GET",
      code:
        "stripe_connect_status_failed",
      status,
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}
