// KLYX_STRIPE_CONNECT_COUNTRY_PHASE_5G
// KLYX_CONNECT_ONBOARDING_BEFORE_LIVE_SWITCH_16_08
import { NextResponse } from "next/server";
import { assertStripeRuntimeConfiguredForDiagnostics } from "@/lib/stripe-runtime";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function getAppOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configuredUrl || new URL(request.url).origin;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL doit commencer par http:// ou https://."
    );
  }

  return parsed.origin;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { user, profile: activeProfile } =
      await getAuthenticatedProfile(request);
    requireAccountType(activeProfile, "provider");

    // Onboarding/KYC is a configuration action, not a charge. It must work
    // before KLYX_LIVE_PAYMENTS_ENABLED is opened. Transactional checkout
    // routes continue to require assertStripeRuntimeReady().
    const stripeRuntime = assertStripeRuntimeConfiguredForDiagnostics();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));

    const accountCountry = activeProfile.countryCode.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(accountCountry)) {
      return NextResponse.json(
        {
          error:
            "Configure ton pays KLYX avant de créer ton compte de paiement.",
          code: "KLYX_STRIPE_COUNTRY_REQUIRED",
        },
        { status: 409 }
      );
    }

    // Test mode stays available for launch certification. In live mode, the
    // reviewed market-readiness matrix is the source of truth and fails closed.
    if (stripeRuntime.mode === "live") {
      const marketReadiness = getKlyxMarketReadiness(accountCountry);
      const marketAssessment = assessKlyxMarketReadiness(marketReadiness);

      if (!marketAssessment.ready) {
        return NextResponse.json(
          {
            error:
              "KLYX n'est pas encore ouvert aux paiements réels dans ce pays.",
            code: "KLYX_MARKET_NOT_COMMERCIALLY_READY",
            countryCode: accountCountry,
            blockers: marketAssessment.blockers,
          },
          { status: 409 }
        );
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("id", activeProfile.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profil KLYX introuvable." },
        { status: 404 }
      );
    }

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country:
          accountCountry as Stripe.AccountCreateParams["country"],
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          klyx_profile_id: activeProfile.id,
          klyx_owner_user_id: user.id,
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_account_id: account.id,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", activeProfile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const origin = getAppOrigin(request);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/connect?refresh=1`,
      return_url: `${origin}/connect?return=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de démarrer Stripe Connect.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "stripe_connect_account_failed",
      route: "/api/stripe/connect/create-account",
      method: "POST",
      code: "stripe_connect_account_failed",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
