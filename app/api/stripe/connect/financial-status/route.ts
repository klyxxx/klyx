import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  getCanonicalStripeConnect,
  isStripeConnectIdentityReviewRequired,
  StripeConnectIdentityReviewRequiredError,
} from "@/lib/stripe-connect-account";
import { assertStripeRuntimeConfiguredForDiagnostics } from "@/lib/stripe-runtime";

// KLYX_PROVIDER_STRIPE_FINANCIAL_VISIBILITY_16_07
// KLYX_ACCOUNT_LEVEL_STRIPE_CONNECT_19_45

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
    const { account } = await getAuthenticatedAccount(request);

    assertStripeRuntimeConfiguredForDiagnostics();

    const connect = await getCanonicalStripeConnect(account.id);

    if (connect.state === "review_required") {
      throw new StripeConnectIdentityReviewRequiredError();
    }

    const stripeAccountId = connect.stripeAccountId?.trim();

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

    const [stripeAccount, balance, payouts] = await Promise.all([
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

    if ("deleted" in stripeAccount && stripeAccount.deleted) {
      throw new StripeConnectIdentityReviewRequiredError();
    }

    return noStoreJson({
      connected: true,
      defaultCurrency: stripeAccount.default_currency || "eur",
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
    if (isStripeConnectIdentityReviewRequired(error)) {
      return noStoreJson(
        {
          error:
            "L'identité Stripe Connect de ce compte KLYX nécessite une revue.",
          code: "KLYX_STRIPE_CONNECT_IDENTITY_REVIEW_REQUIRED",
          reviewRequired: true,
          connected: false,
          defaultCurrency: "eur",
          available: [],
          pending: [],
          payouts: [],
        },
        409
      );
    }

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
