import type Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  handleSplitStripeWebhookEvent as handleSplitStripeWebhookEventCore,
  reconcileSplitStripeRefund,
} from "@/lib/split-stripe-payments-core";

export { reconcileSplitStripeRefund };

// KLYX_SPLIT_STALE_FAILURE_GUARD_16_11
// A PaymentIntent failure is allowed to mutate KLYX only when Stripe can map
// it back to the exact Checkout Session that is still active for the unit.
// Missing or stale session correlation is intentionally treated as handled:
// retrying an ambiguous failure must never poison a newer payment attempt.
async function splitFailureBelongsToActiveCheckout(
  stripe: Stripe,
  intent: Stripe.PaymentIntent
): Promise<boolean> {
  if (intent.metadata?.klyx_flow !== "split_payment_13_27") {
    return true;
  }

  const unitId = intent.metadata?.split_payment_unit_id?.trim() ?? "";

  if (!unitId) {
    return false;
  }

  const sessions = await stripe.checkout.sessions.list({
    payment_intent: intent.id,
    limit: 1,
  });

  const checkoutSessionId = sessions.data[0]?.id ?? null;

  if (!checkoutSessionId) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("split_booking_payment_units")
    .select("status, stripe_checkout_session_id")
    .eq("id", unitId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return false;
  }

  if (data.status === "paid") {
    return false;
  }

  return data.stripe_checkout_session_id === checkoutSessionId;
}

export async function handleSplitStripeWebhookEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<boolean> {
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;

    if (intent.metadata?.klyx_flow === "split_payment_13_27") {
      const belongsToActiveCheckout =
        await splitFailureBelongsToActiveCheckout(stripe, intent);

      if (!belongsToActiveCheckout) {
        return true;
      }
    }
  }

  return handleSplitStripeWebhookEventCore(stripe, event);
}
