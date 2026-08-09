import { NextResponse } from "next/server";
import Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getPaymentFailureDetails,
  markBookingFailedFromSession,
  markBookingPaidFromSession,
  recordBookingPaymentFailure,
} from "@/lib/stripe-payments";
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "@/lib/stripe-webhook-events";
import { reconcileStripeRefund } from "@/lib/stripe-refunds";

function getStripeWebhookConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY manque dans les variables d'environnement.");
  }

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET manque dans les variables d'environnement.");
  }

  if (!stripeSecretKey.startsWith("sk_test_") && !stripeSecretKey.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY n'est pas une clé secrète Stripe valide.");
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET doit être le secret whsec_ de cet endpoint.");
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
  let stripe: Stripe;
  let webhookSecret: string;

  try {
    const config = getStripeWebhookConfig();
    stripe = config.stripe;
    webhookSecret = config.webhookSecret;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Configuration Stripe webhook incomplète.";

    console.error("Stripe webhook configuration error:", message);

    return NextResponse.json({ error: message }, { status: 500 });
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
    const message =
      error instanceof Error
        ? error.message
        : "Signature Stripe invalide.";

    console.error("Stripe webhook signature error:", message);

    return NextResponse.json({ error: message }, { status: 400 });
  }

  let claimed = false;

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

    claimed = true;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await markBookingPaidFromSession(session);
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        const paymentIntent = paymentIntentId
          ? await stripe.paymentIntents.retrieve(paymentIntentId)
          : null;

        await markBookingFailedFromSession(
          session,
          paymentIntent
            ? getPaymentFailureDetails(paymentIntent)
            : undefined
        );

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntent.id,
          limit: 1,
        });

        await recordBookingPaymentFailure(
          paymentIntent,
          sessions.data[0]?.id ?? null
        );

        break;
      }

      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        const refund = event.data.object as Stripe.Refund;
        await reconcileStripeRefund(refund);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;

        for (const refund of charge.refunds?.data ?? []) {
          await reconcileStripeRefund(refund);
        }

        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await updateConnectedAccount(account);
        break;
      }

      default:
        break;
    }

    await markStripeWebhookProcessed(event.id);

    return NextResponse.json(
      {
        received: true,
        duplicate: false,
        eventId: event.id,
        eventType: event.type,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Traitement du webhook impossible.";

    console.error(
      "Stripe webhook processing error:",
      event.id,
      event.type,
      message
    );

    if (claimed) {
      await markStripeWebhookFailed(event.id, message);
    }

    return NextResponse.json(
      {
        error: message,
        eventId: event.id,
        eventType: event.type,
      },
      { status: 500 }
    );
  }
}
