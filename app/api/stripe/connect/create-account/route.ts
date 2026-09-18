// KLYX_STRIPE_CONNECT_ACCOUNT_CANONICAL_20260914
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedAccount } from "@/lib/api-auth";
import { getKlyxMarketReadiness } from "@/lib/klyx-market-readiness";
import {
  assertStripeConnectIdentityUsable,
  getAccountStripeConnectIdentity,
  persistAccountStripeConnectIdentity,
  STRIPE_CONNECT_IDENTITY_CONFLICT,
  STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
} from "@/lib/stripe-connect-account-identity";
import { stripeConnectAccountCreateIdempotencyKey } from "@/lib/stripe-connect-account-idempotency";
import {
  isRecoverableStripeConnectAccountForOnboarding,
  isStripePlatformActivationRequired,
  isStripePlatformProfileRequired,
} from "@/lib/stripe-connect-account-recovery";
import { assertStripeConnectRuntimeConfigured } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) throw new Error(`Variable manquante : ${name}`);
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

async function createTestConnectedAccount(input: {
  stripe: Stripe;
  accountId: string;
  accountCountry: string;
  ownerUserId: string;
  email: string;
  idempotencyKey: string;
}): Promise<string> {
  const connectedAccount = await input.stripe.v2.core.accounts.create(
    {
      contact_email: input.email,
      display_name: "KLYX Stripe TEST Connect",
      dashboard: "express",
      identity: {
        country:
          input.accountCountry as Stripe.V2.Core.AccountCreateParams.Identity["country"],
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      defaults: {
        currency: "eur",
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      metadata: {
        klyx_account_id: input.accountId,
        klyx_owner_user_id: input.ownerUserId,
      },
      include: [
        "configuration.merchant",
        "configuration.recipient",
        "identity",
        "requirements",
      ],
    },
    { idempotencyKey: input.idempotencyKey }
  );

  return connectedAccount.id;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { user, account, profile: activeProfile } =
      await getAuthenticatedAccount(request);

    const stripeRuntime = assertStripeConnectRuntimeConfigured();
    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    const accountCountry = activeProfile.countryCode.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(accountCountry)) {
      return NextResponse.json(
        {
          error: "Configure ton pays KLYX avant de créer ton compte de paiement.",
          code: "KLYX_STRIPE_COUNTRY_REQUIRED",
        },
        { status: 409 }
      );
    }

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

    const identity = await getAccountStripeConnectIdentity(account.id);
    let accountId = assertStripeConnectIdentityUsable(identity);

    if (!accountId) {
      const idempotencyKey = stripeConnectAccountCreateIdempotencyKey({
        accountId: account.id,
        runtimeMode: stripeRuntime.mode,
      });

      let createdAccountId: string;

      if (stripeRuntime.mode === "test") {
        const email = user.email?.trim();
        if (!email) {
          throw new Error("Une adresse e-mail est requise pour Stripe Connect TEST.");
        }

        createdAccountId = await createTestConnectedAccount({
          stripe,
          accountId: account.id,
          accountCountry,
          ownerUserId: user.id,
          email,
          idempotencyKey,
        });
      } else {
        const created = await stripe.accounts.create(
          {
            type: "express",
            country: accountCountry as Stripe.AccountCreateParams["country"],
            email: user.email ?? undefined,
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            },
            metadata: {
              klyx_account_id: account.id,
              klyx_owner_user_id: user.id,
              klyx_profile_id_compat: activeProfile.id,
            },
          },
          { idempotencyKey }
        );
        createdAccountId = created.id;
      }

      await persistAccountStripeConnectIdentity({
        accountId: account.id,
        stripeAccountId: createdAccountId,
        sourceProfileId: activeProfile.id,
      });

      // Compatibility mirror only. Canonical authority is the account-level row.
      const { error: mirrorError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_account_id: createdAccountId,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", activeProfile.id);

      if (mirrorError) throw new Error(mirrorError.message);
      accountId = createdAccountId;
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
      // Once an account-level or historical Stripe identity exists, KLYX never
      // creates a replacement automatically. Missing/environment-mismatched
      // identities require explicit financial review to protect payouts/history.
      if (isRecoverableStripeConnectAccountForOnboarding(error)) {
        return NextResponse.json(
          {
            error:
              "L'identité Stripe existante de ce compte KLYX doit être vérifiée avant toute nouvelle création.",
            code: STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED,
          },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
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

    if (
      message === STRIPE_CONNECT_IDENTITY_CONFLICT ||
      message === STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED
    ) {
      return NextResponse.json(
        {
          error:
            "Plusieurs identités Stripe historiques sont associées à ce compte KLYX. Une revue est requise.",
          code: message,
        },
        { status: 409 }
      );
    }

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
