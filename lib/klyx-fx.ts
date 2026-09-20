import {
  normalizeKlyxCurrencyCode,
  roundKlyxRationalToSafeInteger,
} from "@/lib/klyx-currency";

export type KlyxFxQuote = {
  id: string;
  provider: string;
  providerQuoteId: string | null;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmountMinor: number;
  targetAmountMinor: number;
  expiresAt: string;
  status: "usable" | "expired" | "consumed" | "revoked";
};

export const KLYX_SILENT_FX_ALLOWED = false as const;

export function assertKlyxFxQuoteUsable(
  quote: KlyxFxQuote,
  at = new Date()
): void {
  if (quote.status !== "usable") {
    throw new Error("KLYX_FX_QUOTE_NOT_USABLE");
  }

  if (
    !Number.isSafeInteger(quote.sourceAmountMinor) ||
    quote.sourceAmountMinor <= 0 ||
    !Number.isSafeInteger(quote.targetAmountMinor) ||
    quote.targetAmountMinor <= 0
  ) {
    throw new Error("KLYX_FX_QUOTE_AMOUNT_INVALID");
  }

  const expiresAt = new Date(quote.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= at.getTime()) {
    throw new Error("KLYX_FX_QUOTE_EXPIRED");
  }
}

export function convertKlyxMinorUnitsWithQuote(params: {
  amountMinor: number;
  sourceCurrency: string;
  targetCurrency: string;
  quote?: KlyxFxQuote | null;
  at?: Date;
}): number {
  if (!Number.isSafeInteger(params.amountMinor) || params.amountMinor < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  const source = normalizeKlyxCurrencyCode(params.sourceCurrency);
  const target = normalizeKlyxCurrencyCode(params.targetCurrency);

  if (source === target) {
    return params.amountMinor;
  }

  const quote = params.quote;
  if (!quote) {
    throw new Error("KLYX_FX_QUOTE_REQUIRED");
  }

  assertKlyxFxQuoteUsable(quote, params.at);

  if (
    normalizeKlyxCurrencyCode(quote.sourceCurrency) !== source ||
    normalizeKlyxCurrencyCode(quote.targetCurrency) !== target
  ) {
    throw new Error("KLYX_FX_QUOTE_CURRENCY_MISMATCH");
  }

  return roundKlyxRationalToSafeInteger(
    BigInt(params.amountMinor) * BigInt(quote.targetAmountMinor),
    BigInt(quote.sourceAmountMinor)
  );
}
