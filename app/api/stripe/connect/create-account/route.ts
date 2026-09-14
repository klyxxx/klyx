// KLYX_STRIPE_CONNECT_COUNTRY_PHASE_5G
// KLYX_CONNECT_ONBOARDING_BEFORE_LIVE_SWITCH_16_08
// KLYX_ACCOUNT_LEVEL_STRIPE_CONNECT_19_45
import { NextResponse } from "next/server";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { getKlyxMarketReadiness } from "@/lib/klyx-market-readiness";
import { stripeConnectAccountCreateIdempotencyKey } from "@/lib/stripe-connect-account-idempotency";
import {
  bindCanonicalStripeAccount,
  getStripeConnectCreationDecision,
  isStripeConnectIdentityReviewRequired,
  markStripeConnectIdentityReview,
  resolveCanonicalAccountCountry,
  StripeConnectIdentityReviewRequiredError,
} from "@/lib/stripe-connect-account";
import {
  isRecoverableStripeConnectAccountForOnboarding,
  isStripePlatformActivationRequired,
  isStripePlatformProfileRequired,
} from "@/lib/stripe-connect-account-recovery";

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
    const { user, account } = await getAuthenticatedAccount(request);

    // Connect onboarding/KYC is a capability of the canonical KLYX account,
    // not of a permanent provider identity. A buyer can therefore activate
    // payouts on the same account without creating or switching profiles.
    const stripeRuntime = assertStripeConnectRuntimeConfigured();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));

    const { data: countryRows, error: countryError } = await supabaseAdmin
      .from("profiles")
      .select("country_code")
      .eq("account_id", account.id);

    if (countryError) throw new Error(countryError.message);

    const accountCountry = resolveCanonicalAccountCountry(
      (countryRows ?? []).map((row) => row.country_code)
    );

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

    // Onboarding remains preparatory. Pricing and KLYX commission are not
    // modified by this account-identity migration.
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

    const creation = await getStripeConnectCreationDecision(account.id);

    if (creation.decision === "review_required") {
      await markStripeConnectIdentityReview({
        accountId: account.id,
        reason: "connect_onboarding_identity_conflict",
        candidateStripeAccountIds: creation.historicalStripeAccountIds,
      });
      throw new StripeConnectIdentityReviewRequiredError();
    }

    let accountId = creation.connect.stripeAccountId;

    if (creation.decision === "create") {
      const idempotencyKey = stripeConnectAccountCreateIdempotencyKey({
        accountId: account.id,
        runtimeMode: stripeRuntime.mode,
      });

      const connectedAccount = await stripe.accounts.create(
        {
          type: "express",
          country:
            accountCountry as Stripe.AccountCreateParams["country"],
          email: user.email ?? undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            klyx_account_id: account.id,
            klyx_owner_user_id: user.id,
          },
        },
        { idempotencyKey }
      );

      await bindCanonicalStripeAccount(account.id, connectedAccount.id);
      accountId = connectedAccount.id;
    }

    if (!accountId) {
      throw new StripeConnectIdentityReviewRequiredError();
    }

    const origin = getAppOrigin(request);

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/connect?refresh=1`,
        return_url: `${origin}/connect?return=1`,
        type: "account_onboarding",
      });

      return NextResponse.json({ url: accountLink.url });
    } catch (error) {
      // A missing/stale historical acct_* is an identity conflict. Never
      // auto-create a replacement: preserve financial identity and fail closed.
      if (isRecoverableStripeConnectAccountForOnboarding(error)) {
        await markStripeConnectIdentityReview({
          accountId: account.id,
          reason: "stored_stripe_account_unavailable",
          candidateStripeAccountIds: [accountId],
        });
        throw new StripeConnectIdentityReviewRequiredError();
      }

      throw error;
    }
  } catch (error) {
    if (isStripeConnectIdentityReviewRequired(error)) {
      return secureApiErrorResponse({
        error,
        event: "stripe_connect_identity_review_required",
        route: "/api/stripe/connect/create-account",
        method: "POST",
        code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED",
        status: 409,
        publicMessage:
          "L'identité Stripe Connect de ce compte KLYX nécessite une revue avant toute création ou modification.",
        startedAt,
      });
    }

    if (isStripePlatformProfileRequired(error)) {
      return secureApiErrorResponse({
        error,
        event: "stripe_connect_platform_profile_required",
        route: "/api/stripe/connect/create-account",
        method: "POST",
        code: "KLYX_STRIPE_PLATFORM_PROFILE_REQUIRED",
        status: 409,
        publicMessage:
          "Le profil de plateforme Stripe Connect de KLYX doit être complété avant de pouvoir créer les comptes de versement.",
        startedAt,
      });
    }

    if (isStripePlatformActivationRequired(error)) {
      return secureApiErrorResponse({
        error,
        event: "stripe_connect_platform_activation_required",
        route: "/api/stripe/connect/create-account",
        method: "POST",
        code: "KLYX_STRIPE_PLATFORM_ACTIVATION_REQUIRED",
        status: 409,
        publicMessage:
          "Le compte Stripe principal KLYX doit être activé avant de pouvoir créer les comptes de versement.",
        startedAt,
      });
    }

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
