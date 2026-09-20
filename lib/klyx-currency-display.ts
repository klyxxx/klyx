import {
  klyxMinorUnitsToDecimalString,
  normalizeKlyxCurrencyCode,
} from "@/lib/klyx-currency";

// KLYX_TRANSACTION_CURRENCY_DISPLAY_15_04
export function formatKlyxCurrencyAmount(
  amountMinor: number,
  currency: string | null | undefined
): string {
  const rawCurrency = currency?.trim() ?? "";

  if (!/^[a-zA-Z]{3}$/.test(rawCurrency)) {
    return Number.isSafeInteger(amountMinor)
      ? String(amountMinor)
      : "0";
  }

  const currencyCode = normalizeKlyxCurrencyCode(rawCurrency);
  const safeAmount = Number.isSafeInteger(amountMinor)
    ? amountMinor
    : 0;

  return `${klyxMinorUnitsToDecimalString(
    safeAmount,
    currencyCode
  )} ${currencyCode}`;
}
