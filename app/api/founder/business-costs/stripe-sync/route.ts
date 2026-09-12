import { NextResponse } from "next/server";
import Stripe from "stripe";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key || (!key.startsWith("sk_test_") && !key.startsWith("sk_live_"))) {
    throw new Error("KLYX_STRIPE_SECRET_KEY_INVALID");
  }
  return new Stripe(key);
}

async function balanceTransactionForCharge(
  stripe: Stripe,
  charge: Stripe.Charge
): Promise<Stripe.BalanceTransaction | null> {
  if (!charge.balance_transaction) return null;
  if (typeof charge.balance_transaction !== "string") {
    return charge.balance_transaction;
  }
  return stripe.balanceTransactions.retrieve(charge.balance_transaction);
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as { bookingId?: unknown };
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";

    if (!bookingId) {
      return NextResponse.json(
        { error: "Réservation obligatoire." },
        { status: 400 }
      );
    }

    const [{ data: booking, error: bookingError }, { data: ledger, error: ledgerError }] =
      await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select("id, service_id")
          .eq("id", bookingId)
          .maybeSingle(),
        supabaseAdmin
          .from("booking_financial_ledger")
          .select("stripe_payment_intent_id")
          .eq("booking_id", bookingId)
          .eq("entry_type", "payment_succeeded")
          .eq("status", "succeeded")
          .not("stripe_payment_intent_id", "is", null),
      ]);

    if (bookingError) throw new Error(bookingError.message);
    if (ledgerError) throw new Error(ledgerError.message);
    if (!booking || !booking.service_id) {
      return NextResponse.json(
        { error: "Réservation ou service introuvable." },
        { status: 404 }
      );
    }

    const paymentIntentIds = [
      ...new Set(
        (ledger ?? [])
          .map((row) => row.stripe_payment_intent_id)
          .filter((value): value is string => Boolean(value))
      ),
    ];

    if (paymentIntentIds.length === 0) {
      return NextResponse.json(
        { error: "Aucun paiement Stripe réussi à synchroniser." },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const synced: Array<{
      paymentIntentId: string;
      balanceTransactionId: string;
      amountCents: number;
      currency: string;
    }> = [];

    for (const paymentIntentId of paymentIntentIds) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge =
        typeof intent.latest_charge === "string"
          ? await stripe.charges.retrieve(intent.latest_charge, {
              expand: ["balance_transaction"],
            })
          : intent.latest_charge;

      if (!charge) continue;
      const balance = await balanceTransactionForCharge(stripe, charge);
      if (!balance) continue;

      const amountCents = Math.max(0, Math.round(balance.fee));
      const currency = balance.currency.toUpperCase();
      const sourceKey = `stripe_fee:${balance.id}`;

      const { error: insertError } = await supabaseAdmin
        .from("business_cost_events")
        .upsert(
          {
            cost_type: "stripe_fee",
            amount_cents: amountCents,
            currency,
            service_id: booking.service_id,
            booking_id: booking.id,
            source: "stripe",
            source_key: sourceKey,
            note: `Stripe balance transaction ${balance.id}`,
            occurred_at: new Date(balance.created * 1000).toISOString(),
            created_by: founder.id,
          },
          { onConflict: "source_key", ignoreDuplicates: true }
        );
      if (insertError) throw new Error(insertError.message);

      synced.push({
        paymentIntentId,
        balanceTransactionId: balance.id,
        amountCents,
        currency,
      });
    }

    const { error: trackingError } = await supabaseAdmin
      .from("business_cost_tracking_state")
      .update({
        tracking_mode: "automated",
        note: "Actual Stripe processing fees synced from Stripe balance transactions.",
        updated_at: new Date().toISOString(),
      })
      .eq("cost_type", "stripe_fee");
    if (trackingError) throw new Error(trackingError.message);

    return NextResponse.json(
      {
        bookingId,
        synced,
        source: "stripe_balance_transaction",
        estimated: false,
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_business_stripe_fee_sync_failed",
      route: "/api/founder/business-costs/stripe-sync",
      method: "POST",
      status,
      code: "KLYX_FOUNDER_BUSINESS_STRIPE_FEE_SYNC_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
