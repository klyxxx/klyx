import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  assertKlyxFxQuoteUsable,
  type KlyxFxQuote,
} from "@/lib/klyx-fx";

type FxQuoteRow = {
  id: string;
  provider: string;
  provider_quote_id: string | null;
  source_currency: string;
  target_currency: string;
  source_amount_minor: number;
  target_amount_minor: number;
  lock_expires_at: string;
  status: "usable" | "expired" | "consumed" | "revoked";
};

export async function getKlyxFxQuote(
  quoteId: string
): Promise<KlyxFxQuote> {
  const { data, error } = await supabaseAdmin
    .from("klyx_fx_quotes")
    .select(
      "id,provider,provider_quote_id,source_currency,target_currency,source_amount_minor,target_amount_minor,lock_expires_at,status"
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    throw new Error(`KLYX_FX_QUOTE_READ_FAILED:${error.message}`);
  }
  if (!data) {
    throw new Error("KLYX_FX_QUOTE_NOT_FOUND");
  }

  const row = data as FxQuoteRow;
  const quote: KlyxFxQuote = {
    id: row.id,
    provider: row.provider,
    providerQuoteId: row.provider_quote_id,
    sourceCurrency: row.source_currency,
    targetCurrency: row.target_currency,
    sourceAmountMinor: Number(row.source_amount_minor),
    targetAmountMinor: Number(row.target_amount_minor),
    expiresAt: row.lock_expires_at,
    status: row.status,
  };

  assertKlyxFxQuoteUsable(quote);
  return quote;
}
