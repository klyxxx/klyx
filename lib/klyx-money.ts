import {
  decimalToKlyxMinorUnits,
  getKlyxCurrencyMinorUnitExponent,
  klyxMinorUnitsToDecimalString,
  normalizeKlyxCountryCode,
  normalizeKlyxCurrencyCode,
} from "@/lib/klyx-currency";
import { getKlyxMarket } from "@/lib/klyx-supported-markets";

export type KlyxMoneyContext = {
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
  stripeCurrency: string;
  minorUnitExponent: number;
};

export type KlyxMoneyProfile = {
  countryCode: string | null;
  currencyCode: string | null;
};

// Compatibility tokens retained for old diagnostics/scripts only.
// They are no longer authorization rules.
export const KLYX_MARKET_NOT_SUPPORTED = "KLYX_MARKET_NOT_SUPPORTED" as const;
export const KLYX_CURRENCY_MARKET_MISMATCH =
  "KLYX_CURRENCY_MARKET_MISMATCH" as const;

// KLYX_TRANSACTION_CURRENCY_CONTRACT_14_22
// KLYX_GLOBAL_CURRENCY_AUTHORITY_20260920

export function getKlyxMinorUnitExponent(currencyCode: string): number {
  return getKlyxCurrencyMinorUnitExponent(currencyCode);
}

function currencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);

    return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

/**
 * Resolve transaction money without making country -> currency a permanent
 * product constraint.
 *
 * Explicit currency is authoritative. The historical market catalogue may
 * supply a compatibility default only when a caller has not yet migrated to
 * an explicit currency. It never rejects a valid country/currency pair.
 */
export function resolveKlyxMoneyContext(
  countryCode: string,
  declaredCurrencyCode?: string | null
): KlyxMoneyContext {
  const normalizedCountry = normalizeKlyxCountryCode(countryCode);
  const declared = declaredCurrencyCode?.trim()
    ? normalizeKlyxCurrencyCode(declaredCurrencyCode)
    : null;

  const legacySuggestion = getKlyxMarket(normalizedCountry)?.currencyCode ?? null;
  const currency = declared ?? legacySuggestion;

  if (!currency) {
    throw new Error("KLYX_CURRENCY_REQUIRED");
  }

  const normalizedCurrency = normalizeKlyxCurrencyCode(currency);

  return {
    countryCode: normalizedCountry,
    currencyCode: normalizedCurrency,
    currencySymbol: currencySymbol(normalizedCurrency),
    stripeCurrency: normalizedCurrency.toLowerCase(),
    minorUnitExponent: getKlyxCurrencyMinorUnitExponent(normalizedCurrency),
  };
}

// KLYX_PROFILE_CURRENCY_GUARD_14_22
export function resolveKlyxProfileMoney(
  profile: KlyxMoneyProfile
): KlyxMoneyContext {
  if (!profile.countryCode || !profile.currencyCode) {
    throw new Error("KLYX_PROFILE_MARKET_REQUIRED");
  }

  return resolveKlyxMoneyContext(profile.countryCode, profile.currencyCode);
}

function assertFiniteAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("KLYX_MONEY_AMOUNT_INVALID");
  }
}

/**
 * Convert a user-facing major-unit amount to the ISO currency minor unit.
 * Rounding is canonical half-up through klyx-currency, never implicit * 100.
 */
export function toKlyxMinorUnits(
  amount: number,
  countryCode: string,
  currencyCode?: string | null
): number {
  assertFiniteAmount(amount);

  const context = resolveKlyxMoneyContext(countryCode, currencyCode);
  return decimalToKlyxMinorUnits(
    String(amount),
    context.currencyCode,
    "half_up"
  );
}

export function fromKlyxMinorUnits(
  minorUnits: number,
  countryCode: string,
  currencyCode?: string | null
): number {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  const context = resolveKlyxMoneyContext(countryCode, currencyCode);
  return Number(
    klyxMinorUnitsToDecimalString(minorUnits, context.currencyCode)
  );
}

export function formatKlyxMoney(
  amount: number,
  countryCode: string,
  currencyCode?: string | null,
  locale = "en"
): string {
  assertFiniteAmount(amount);

  const context = resolveKlyxMoneyContext(countryCode, currencyCode);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: context.currencyCode,
  }).format(amount);
}

// Historical marker name retained; currency now comes from the transaction,
// not from a permanent market list.
// KLYX_STRIPE_CURRENCY_FROM_MARKET_14_22
export function getKlyxStripeCurrency(
  countryCode: string,
  currencyCode?: string | null
): string {
  return resolveKlyxMoneyContext(countryCode, currencyCode).stripeCurrency;
}

/**
 * Some existing flows intentionally forbid FX. New cross-currency flows must
 * use an explicit KlyxFxQuote rather than bypassing this guard.
 */
export function assertKlyxSameCurrency(
  leftCurrencyCode: string,
  rightCurrencyCode: string
): string {
  const left = normalizeKlyxCurrencyCode(leftCurrencyCode);
  const right = normalizeKlyxCurrencyCode(rightCurrencyCode);

  if (left !== right) {
    throw new Error("KLYX_TRANSACTION_CURRENCY_MISMATCH");
  }

  return left;
}

// KLYX_NO_SILENT_FX_14_22
export const KLYX_SILENT_CURRENCY_CONVERSION_ALLOWED = false;

// KLYX_NO_AUTOMATIC_PAYMENT_14_22
export const KLYX_AUTOMATIC_PAYMENT_ALLOWED = false;
