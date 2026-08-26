// KLYX_TRANSACTION_CURRENCY_DISPLAY_15_04

export function formatKlyxCurrencyAmount(
  amountCents: number,
  currency: string | null | undefined
): string {
  const normalizedCurrency =
    currency
      ?.trim()
      .toUpperCase() ?? "";
  const amount = Number.isFinite(amountCents)
    ? amountCents
    : 0;
  const formattedAmount = (amount / 100).toFixed(2);

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return formattedAmount;
  }

  return `${formattedAmount} ${normalizedCurrency}`;
}
