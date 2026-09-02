import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

async function updateConnectedAccount(account: Stripe.Account) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_onboarding_complete: Boolean(account.details_submitted),
      stripe_charges_enabled: Boolean(account.charges_enabled),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    throw new Error(error.message);
  }
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

  try {
    if (event.type === "account.updated") {
      await updateConnectedAccount(event.data.object as Stripe.Account);
    }

    return NextResponse.json({
      received: true,
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
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
