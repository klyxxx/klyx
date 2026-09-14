import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import { syncCanonicalConnectedAccountFromStripe } from "@/lib/stripe-connect-webhook-account";
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "@/lib/stripe-webhook-events";

function getStripeConnectWebhookConfig() {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  const webhookSecret =
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() ?? "";

  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY manque dans les variables d environnement."
    );
  }

  if (!webhookSecret) {
    throw new Error(
      "STRIPE_CONNECT_WEBHOOK_SECRET manque dans les variables d environnement."
    );
  }

  if (
    !stripeSecretKey.startsWith("sk_test_") &&
    !stripeSecretKey.startsWith("sk_live_")
  ) {
    throw new Error("STRIPE_SECRET_KEY invalide.");
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error(
      "STRIPE_CONNECT_WEBHOOK_SECRET doit commencer par whsec_."
    );
  }

  return {
    stripe: new Stripe(stripeSecretKey),
    webhookSecret,
  };
}

async function updateConnectedAccount(
  stripe: Stripe,
  signedAccount: Stripe.Account
) {
  // Re-read Stripe's current state because account.updated can be replayed or
  // delivered out of order. Identity resolution remains canonical-account only.
  const account = await stripe.accounts.retrieve(signedAccount.id);
  await syncCanonicalConnectedAccountFromStripe(account);
}

function supersededClaimResponse(event: Stripe.Event) {
  return NextResponse.json(
    {
      received: true,
      duplicate: true,
      reason: "claim_superseded",
      eventId: event.id,
      eventType: event.type,
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  let stripe: Stripe;
  let webhookSecret: string;

  try {
    const config = getStripeConnectWebhookConfig();
    stripe = config.stripe;
    webhookSecret = config.webhookSecret;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "stripe_connect_webhook_configuration_failed",
      route: "/api/stripe/connect-webhook",
      method: "POST",
      code: "stripe_connect_webhook_configuration_failed",
      status: 500,
      startedAt,
    });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Signature Stripe manquante." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "stripe_connect_webhook_signature_rejected",
      route: "/api/stripe/connect-webhook",
      method: "POST",
      code: "invalid_stripe_connect_signature",
      status: 400,
      publicMessage: "Signature Stripe Connect invalide.",
      startedAt,
    });
  }

  let claimed = false;
  let claimAttemptCount: number | null = null;

  try {
    const claim = await claimStripeWebhookEvent(event);

    if (!claim.shouldProcess) {
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          reason: claim.reason,
          eventId: event.id,
          eventType: event.type,
        },
        { status: 200 }
      );
    }

    if (claim.attemptCount === null) {
      throw new Error("Stripe Connect webhook claim attempt missing.");
    }

    const attemptCount = claim.attemptCount;
    claimed = true;
    claimAttemptCount = attemptCount;

    if (event.type === "account.updated") {
      await updateConnectedAccount(
        stripe,
        event.data.object as Stripe.Account
      );
    }

    const finalized = await markStripeWebhookProcessed(
      event.id,
      attemptCount
    );

    if (!finalized) {
      return supersededClaimResponse(event);
    }

    return NextResponse.json({
      received: true,
      duplicate: false,
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
    if (claimed && claimAttemptCount !== null) {
      const failureMarkResult = await markStripeWebhookFailed(
        event.id,
        claimAttemptCount,
        "stripe_connect_webhook_processing_failed"
      );

      if (failureMarkResult === "superseded") {
        return supersededClaimResponse(event);
      }
    }

    return secureApiErrorResponse({
      error,
      event: "stripe_connect_webhook_processing_failed",
      route: "/api/stripe/connect-webhook",
      method: "POST",
      code: "stripe_connect_webhook_processing_failed",
      status: 500,
      startedAt,
    });
  }
}
