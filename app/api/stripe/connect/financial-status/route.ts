import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { assertStripeRuntimeConfiguredForDiagnostics } from "@/lib/stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PROVIDER_STRIPE_FINANCIAL_VISIBILITY_16_07

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile: activeProfile } =
      await getAuthenticatedProfile(request);
    requireAccountType(activeProfile, "provider");

    assertStripeRuntimeConfiguredForDiagnostics();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", activeProfile.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    const stripeAccountId = profile?.stripe_account_id?.trim();

    if (!stripeAccountId) {
      return noStoreJson({
        connected: false,
        defaultCurrency: "eur",
        available: [],
        pending: [],
        payouts: [],
      });
    }

    const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));

    const [account, balance, payouts] = await Promise.all([
      stripe.accounts.retrieve(stripeAccountId),
      stripe.balance.retrieve({}, { stripeAccount: stripeAccountId }),
      stripe.payouts.list(
        {
          limit: 5,
        },
        {
          stripeAccount: stripeAccountId,
        }
      ),
    ]);

    if ("deleted" in account && account.deleted) {
      return noStoreJson(
        {
          connected: false,
          defaultCurrency: "eur",
          available: [],
          pending: [],
          payouts: [],
        },
        409
      );
    }

    return noStoreJson({
      connected: true,
      defaultCurrency: account.default_currency || "eur",
      available: balance.available.map((entry) => ({
        amountCents: entry.amount,
        currency: entry.currency,
      })),
      pending: balance.pending.map((entry) => ({
        amountCents: entry.amount,
        currency: entry.currency,
      })),
      payouts: payouts.data.map((payout) => ({
        amountCents: payout.amount,
        currency: payout.currency,
        status: payout.status,
        arrivalDate: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
        createdAt: new Date(payout.created * 1000).toISOString(),
        failureCode: payout.failure_code || null,
        failureMessage: payout.failure_message || null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger le solde Stripe Connect.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "stripe_connect_financial_status_failed",
      route: "/api/stripe/connect/financial-status",
      method: "GET",
      code: "stripe_connect_financial_status_failed",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
