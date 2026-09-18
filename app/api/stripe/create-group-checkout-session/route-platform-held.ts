import { NextResponse } from "next/server";
import Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { POST as corePost } from "./route-platform-held-core";

function testStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  if (key.startsWith("sk_live_")) {
    throw new Error("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("KLYX_SETTLEMENT_STRIPE_TEST_KEY_REQUIRED");
  }

  return new Stripe(key);
}

/**
 * Cross-mode guard for grouped Checkout.
 *
 * An OPEN legacy session may be expired by the held core. A COMPLETE session
 * whose asynchronous payment is not yet paid must never have its DB claim
 * released because Stripe can still settle it later.
 */
export async function POST(request: Request) {
  const body = (await request.clone().json().catch(() => null)) as {
    groupId?: string;
  } | null;
  const groupId = body?.groupId?.trim() ?? "";

  if (!groupId) return corePost(request);

  const { data: group, error } = await supabaseAdmin
    .from("booking_groups")
    .select("payment_mode, stripe_checkout_session_id")
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const sessionId = group?.stripe_checkout_session_id?.trim() ?? "";
  const crossMode = Boolean(sessionId) && group?.payment_mode !== "platform_held";

  if (crossMode) {
    const stripe = testStripeClient();
    const existing = await stripe.checkout.sessions.retrieve(sessionId);

    if (existing.status === "complete" && existing.payment_status !== "paid") {
      return NextResponse.json(
        {
          error:
            "Stripe traite encore le paiement groupé existant. Son statut doit être finalisé avant tout changement de mode.",
          code: "KLYX_PLATFORM_HELD_GROUP_CROSS_MODE_PAYMENT_PENDING",
          paymentPending: true,
        },
        { status: 409 }
      );
    }
  }

  return corePost(request);
}
