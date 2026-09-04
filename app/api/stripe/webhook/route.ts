import { handleSplitStripeWebhookEvent } from "@/lib/split-stripe-payments";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  markBookingGroupFailedFromSession,
  markBookingGroupPaidFromSession,
  recordBookingGroupPaymentFailure,
} from "@/lib/stripe-group-payments";
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
import {
  reconcileStripeRefund,
} from "@/lib/stripe-refunds";

// KLYX_GROUP_WEBHOOK_12_86
// KLYX_STRIPE_WEBHOOK_RETRY_LEASE_16_07

function getStripeWebhookConfig() {
  const stripeSecretKey =
    process.env
      .STRIPE_SECRET_KEY
      ?.trim() ??
    "";

  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET
      ?.trim() ??
    "";

  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY manque dans les variables d environnement."
    );
  }

  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET manque dans les variables d environnement."
    );
  }

  if (
    !stripeSecretKey.startsWith(
      "sk_test_"
    ) &&
    !stripeSecretKey.startsWith(
      "sk_live_"
    )
  ) {
    throw new Error(
      "STRIPE_SECRET_KEY invalide."
    );
  }

  if (
    !webhookSecret.startsWith(
      "whsec_"
    )
  ) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET doit commencer par whsec_."
    );
  }

  return {
    stripe:
      new Stripe(
        stripeSecretKey
      ),
    webhookSecret,
  };
}

async function updateConnectedAccount(
  account: Stripe.Account
) {
  const {
    error,
  } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_onboarding_complete:
        Boolean(
          account.details_submitted
        ),
      stripe_charges_enabled:
        Boolean(
          account.charges_enabled
        ),
      stripe_payouts_enabled:
        Boolean(
          account.payouts_enabled
        ),
    })
    .eq(
      "stripe_account_id",
      account.id
    );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

function isGroupSession(
  session: Stripe.Checkout.Session
) {
  return Boolean(
    session.metadata
      ?.booking_group_id
  );
}

function isGroupIntent(
  intent: Stripe.PaymentIntent
) {
  return Boolean(
    intent.metadata
      ?.booking_group_id
  );
}

function supersededClaimResponse(
  event: Stripe.Event
) {
  return NextResponse.json(
    {
      received: true,
      duplicate: true,
      reason: "claim_superseded",
      eventId: event.id,
      eventType: event.type,
    },
    {
      status: 200,
    }
  );
}

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();
  let stripe: Stripe;
  let webhookSecret:
    string;

  try {
    const config =
      getStripeWebhookConfig();

    stripe =
      config.stripe;

    webhookSecret =
      config.webhookSecret;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event:
        "stripe_webhook_configuration_failed",
      route:
        "/api/stripe/webhook",
      method: "POST",
      code:
        "stripe_webhook_configuration_failed",
      status: 500,
      startedAt,
    });
  }

  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Signature Stripe manquante.",
      },
      {
        status: 400,
      }
    );
  }

  let event:
    Stripe.Event;

  try {
    const rawBody =
      await request.text();

    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event:
        "stripe_webhook_signature_rejected",
      route:
        "/api/stripe/webhook",
      method: "POST",
      code:
        "invalid_stripe_signature",
      status: 400,
      publicMessage:
        "Signature Stripe invalide.",
      startedAt,
    });
  }

  let claimed =
    false;
  let claimAttemptCount:
    number | null =
    null;

  try {
    const claim =
      await claimStripeWebhookEvent(
        event
      );

    if (
      !claim.shouldProcess
    ) {
      return NextResponse.json(
        {
          received:
            true,
          duplicate:
            true,
          reason:
            claim.reason,
          eventId:
            event.id,
          eventType:
            event.type,
        },
        {
          status: 200,
        }
      );
    }

    if (
      claim.attemptCount ===
      null
    ) {
      throw new Error(
        "Stripe webhook claim attempt missing."
      );
    }

    const attemptCount =
      claim.attemptCount;

    claimed =
      true;
    claimAttemptCount =
      attemptCount;

    // KLYX_SPLIT_STRIPE_WEBHOOK_WIRING_13_27
    const splitPaymentHandled =
      await handleSplitStripeWebhookEvent(
        stripe,
        event
      );

    if (splitPaymentHandled) {
      const finalized =
        await markStripeWebhookProcessed(
          event.id,
          attemptCount
        );

      if (!finalized) {
        return supersededClaimResponse(
          event
        );
      }

      return NextResponse.json(
        {
          received: true,
          duplicate: false,
          splitPayment: true,
          eventId: event.id,
          eventType: event.type,
        },
        {
          status: 200,
        }
      );
    }
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session =
          event.data
            .object as
            Stripe.Checkout.Session;

        if (
          session.payment_status ===
          "paid"
        ) {
          if (
            isGroupSession(
              session
            )
          ) {
            await markBookingGroupPaidFromSession(
              session
            );
          } else {
            await markBookingPaidFromSession(
              session
            );
          }
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session =
          event.data
            .object as
            Stripe.Checkout.Session;

        const paymentIntentId =
          typeof session.payment_intent ===
          "string"
            ? session.payment_intent
            : session.payment_intent
                ?.id;

        const intent =
          paymentIntentId
            ? await stripe
                .paymentIntents
                .retrieve(
                  paymentIntentId
                )
            : null;

        const failure =
          intent
            ? getPaymentFailureDetails(
                intent
              )
            : {
                code:
                  "payment_failed",
                message:
                  "Le paiement a ete refuse.",
              };

        if (
          isGroupSession(
            session
          )
        ) {
          await markBookingGroupFailedFromSession(
            session,
            failure
          );
        } else {
          await markBookingFailedFromSession(
            session,
            failure
          );
        }

        break;
      }

      case "payment_intent.succeeded": {
        const intent =
          event.data
            .object as
            Stripe.PaymentIntent;

        const sessions =
          await stripe
            .checkout
            .sessions
            .list({
              payment_intent:
                intent.id,
              limit: 1,
            });

        const listedSession =
          sessions.data[0];

        if (!listedSession) {
          throw new Error(
            `Aucune session Checkout trouvée pour le paiement Stripe ${intent.id}.`
          );
        }

        const session =
          await stripe.checkout.sessions.retrieve(
            listedSession.id
          );

        if (
          session.payment_status !==
          "paid"
        ) {
          throw new Error(
            `Le PaymentIntent ${intent.id} est réussi mais la session Checkout ${session.id} n'est pas marquée payée.`
          );
        }

        if (
          isGroupIntent(intent) ||
          isGroupSession(session)
        ) {
          await markBookingGroupPaidFromSession(
            session
          );
        } else {
          await markBookingPaidFromSession(
            session
          );
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const intent =
          event.data
            .object as
            Stripe.PaymentIntent;

        const sessions =
          await stripe
            .checkout
            .sessions
            .list({
              payment_intent:
                intent.id,
              limit: 1,
            });

        if (
          isGroupIntent(
            intent
          )
        ) {
          await recordBookingGroupPaymentFailure(
            intent,
            sessions.data[0]
              ?.id ??
              null
          );
        } else {
          await recordBookingPaymentFailure(
            intent,
            sessions.data[0]
              ?.id ??
              null
          );
        }

        break;
      }

      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        const refund =
          event.data
            .object as
            Stripe.Refund;

        await reconcileStripeRefund(
          refund
        );

        break;
      }

      case "charge.refunded": {
        const charge =
          event.data
            .object as
            Stripe.Charge;

        for (
          const refund
          of charge.refunds
            ?.data ??
            []
        ) {
          await reconcileStripeRefund(
            refund
          );
        }

        break;
      }

      case "account.updated": {
        const account =
          event.data
            .object as
            Stripe.Account;

        await updateConnectedAccount(
          account
        );

        break;
      }

      default:
        break;
    }

    const finalized =
      await markStripeWebhookProcessed(
        event.id,
        attemptCount
      );

    if (!finalized) {
      return supersededClaimResponse(
        event
      );
    }

    return NextResponse.json(
      {
        received:
          true,
        duplicate:
          false,
        eventId:
          event.id,
        eventType:
          event.type,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    if (
      claimed &&
      claimAttemptCount !==
        null
    ) {
      const failureMarkResult =
        await markStripeWebhookFailed(
          event.id,
          claimAttemptCount,
          "stripe_webhook_processing_failed"
        );

      if (
        failureMarkResult ===
        "superseded"
      ) {
        return supersededClaimResponse(
          event
        );
      }
    }

    return secureApiErrorResponse({
      error,
      event:
        "stripe_webhook_processing_failed",
      route:
        "/api/stripe/webhook",
      method: "POST",
      code:
        "stripe_webhook_processing_failed",
      status: 500,
      startedAt,
    });
  }
}
