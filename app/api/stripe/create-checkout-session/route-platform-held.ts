import { NextResponse } from "next/server";
import {
  assertStripeObjectMode,
  getFinancialStripeRuntime,
} from "@/lib/financial-stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { POST as corePost } from "./route-platform-held-core";


/**
 * Cross-mode migration guard.
 *
 * The phase-2 core may replace an OPEN legacy Checkout by first expiring it, or
 * reuse an already EXPIRED slot. It must never release the DB payment claim for
 * a COMPLETE legacy Checkout whose asynchronous payment is not yet confirmed:
 * that Checkout can still settle after the request returns.
 *
 * This wrapper is the only platform-held entrypoint imported by the public
 * checkout dispatcher. The large core remains isolated so the migration guard
 * is small, auditable and independently contract-tested.
 */
export async function POST(request: Request) {
  const body = (await request.clone().json().catch(() => null)) as {
    bookingId?: string;
  } | null;
  const bookingId = body?.bookingId?.trim() ?? "";

  if (!bookingId) {
    return corePost(request);
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("payment_mode, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const checkoutSessionId = booking?.stripe_checkout_session_id?.trim() ?? "";
  const isCrossModeCheckout =
    Boolean(checkoutSessionId) && booking?.payment_mode !== "platform_held";

  if (isCrossModeCheckout) {
    const stripeRuntime = getFinancialStripeRuntime();
    const existingSession = await stripeRuntime.stripe.checkout.sessions.retrieve(
      checkoutSessionId
    );

    assertStripeObjectMode(existingSession.livemode, stripeRuntime);

    if (
      existingSession.status === "complete" &&
      existingSession.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe traite encore le paiement existant. Son statut sera actualisé automatiquement avant tout changement de mode.",
          code: "KLYX_PLATFORM_HELD_CROSS_MODE_PAYMENT_PENDING",
          paymentPending: true,
        },
        { status: 409 }
      );
    }
  }

  return corePost(request);
}
