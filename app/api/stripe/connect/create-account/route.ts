// KLYX_STRIPE_CONNECT_COUNTRY_PHASE_5G
// KLYX_CONNECT_ONBOARDING_BEFORE_LIVE_SWITCH_16_08
import { NextResponse } from "next/server";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { getKlyxMarketReadiness } from "@/lib/klyx-market-readiness";
import { isMissingStripeConnectAccount } from "@/lib/stripe-connect-account-recovery";

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

    // Connect onboarding/KYC is preparatory configuration, not a charge.
    // Only a mode-compatible server secret is required here. Client checkout
    // routes continue to require the complete transactional runtime gate.
    const stripeRuntime = assertStripeConnectRuntimeConfigured();
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

    // Provider onboarding is preparatory. KLYX may collect Stripe's KYC and
    // payout setup before a market is commercially opened. We still require a
    // known monetary market here; Stripe remains authoritative for whether the
    // requested country can create the requested Connect capabilities.
    if (stripeRuntime.mode === "live") {
      const marketReadiness = getKlyxMarketReadiness(accountCountry);

      if (marketReadiness.monetarySupport !== "supported") {
        return NextResponse.json(
          {
            error:
              "Ce pays n'est pas encore pris en charge pour la configuration des paiements KLYX.",
            code: "KLYX_STRIPE_COUNTRY_UNSUPPORTED",
            countryCode: accountCountry,
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

    async function createAndPersistAccount(): Promise<string> {
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

      return account.id;
    }

    const origin = getAppOrigin(request);

    async function createAccountLink(accountId: string) {
      return stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/connect?refresh=1`,
        return_url: `${origin}/connect?return=1`,
        type: "account_onboarding",
      });
    }

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      accountId = await createAndPersistAccount();
    }

    let accountLink: Stripe.AccountLink;

    try {
      accountLink = await createAccountLink(accountId);
    } catch (error) {
      // A stored Connect id can become unusable after a Stripe account is
      // deleted or when KLYX intentionally switches Stripe environments. Only
      // Stripe's definitive resource_missing signal is recoverable here;
      // every transient/auth/configuration error still fails closed.
      if (!isMissingStripeConnectAccount(error)) {
        throw error;
      }

      accountId = await createAndPersistAccount();
      accountLink = await createAccountLink(accountId);
    }

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
