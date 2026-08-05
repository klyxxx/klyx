import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getPaymentFailureDetails,
  markBookingFailedFromSession,
  markBookingPaidFromSession,
  recordBookingPaymentFailure,
} from "@/lib/stripe-payments";

function getStripeConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripeSecretKey || !webhookSecret) {
    throw new Error(
      "STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET manque dans .env.local."
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
  let stripe: Stripe;
  let webhookSecret: string;

  try {
    const config = getStripeConfig();
    stripe = config.stripe;
    webhookSecret = config.webhookSecret;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Configuration Stripe incomplète.",
      },
      { status: 500 }
    );
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Signature Stripe invalide.",
      },
      { status: 400 }
    );
  }

  try {
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
          paymentIntent ? getPaymentFailureDetails(paymentIntent) : undefined
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

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await updateConnectedAccount(account);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Traitement du webhook impossible.",
      },
      { status: 500 }
    );
  }
}
