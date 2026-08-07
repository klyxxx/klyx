import { supabaseAdmin } from "@/lib/supabase-admin";

export type FinancialLedgerEntry = {
  bookingId: string;
  entryKey: string;
  entryType:
    | "payment_succeeded"
    | "payment_failed"
    | "refund_succeeded"
    | "refund_failed";
  status: "succeeded" | "failed" | "processing";
  currency?: string | null;
  grossAmountCents?: number | null;
  platformFeeCents?: number | null;
  providerAmountCents?: number | null;
  refundAmountCents?: number | null;
  paymentMode?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeRefundId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export async function upsertFinancialLedgerEntry(
  entry: FinancialLedgerEntry
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("booking_financial_ledger")
    .upsert(
      {
        booking_id: entry.bookingId,
        entry_key: entry.entryKey,
        entry_type: entry.entryType,
        status: entry.status,
        currency: (entry.currency || "EUR").toUpperCase(),
        gross_amount_cents: Math.max(entry.grossAmountCents ?? 0, 0),
        platform_fee_cents: Math.max(entry.platformFeeCents ?? 0, 0),
        provider_amount_cents:
          entry.providerAmountCents == null
            ? null
            : Math.max(entry.providerAmountCents, 0),
        refund_amount_cents: Math.max(entry.refundAmountCents ?? 0, 0),
        payment_mode: entry.paymentMode ?? null,
        stripe_checkout_session_id: entry.stripeCheckoutSessionId ?? null,
        stripe_payment_intent_id: entry.stripePaymentIntentId ?? null,
        stripe_refund_id: entry.stripeRefundId ?? null,
        failure_code: entry.failureCode ?? null,
        failure_message: entry.failureMessage?.slice(0, 1000) ?? null,
        updated_at: now,
      },
      {
        onConflict: "entry_key",
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}
