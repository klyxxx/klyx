import {
  getKlyxMarket,
} from "@/lib/klyx-supported-markets";

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

// KLYX_TRANSACTION_CURRENCY_CONTRACT_14_22

function normalizeCountryCode(
  value: string
) {
  return value
    .trim()
    .toUpperCase();
}

function normalizeCurrencyCode(
  value: string
) {
  return value
    .trim()
    .toUpperCase();
}

export function getKlyxMinorUnitExponent(
  currencyCode: string
): number {
  const normalizedCurrency =
    normalizeCurrencyCode(
      currencyCode
    );

  if (!normalizedCurrency) {
    throw new Error(
      "KLYX_CURRENCY_REQUIRED"
    );
  }

  try {
    const options =
      new Intl.NumberFormat(
        "en",
        {
          style: "currency",
          currency:
            normalizedCurrency,
        }
      ).resolvedOptions();

    return (
      options.maximumFractionDigits ??
      options.minimumFractionDigits ??
      2
    );
  } catch {
    throw new Error(
      "KLYX_CURRENCY_INVALID"
    );
  }
}

/**
 * Résout le contexte monétaire depuis le pays.
 *
 * La devise déclarée, lorsqu'elle existe, doit
 * impérativement correspondre à celle du marché.
 *
 * Exemple :
 * BE + EUR = valide
 * CA + CAD = valide
 * CA + USD = refusé
 */
export function resolveKlyxMoneyContext(
  countryCode: string,
  declaredCurrencyCode?: string | null
): KlyxMoneyContext {
  const normalizedCountry =
    normalizeCountryCode(
      countryCode
    );

  const market =
    getKlyxMarket(
      normalizedCountry
    );

  if (!market) {
    throw new Error(
      "KLYX_MARKET_NOT_SUPPORTED"
    );
  }

  const marketCurrency =
    normalizeCurrencyCode(
      market.currencyCode
    );

  if (
    declaredCurrencyCode != null &&
    declaredCurrencyCode.trim()
  ) {
    const declaredCurrency =
      normalizeCurrencyCode(
        declaredCurrencyCode
      );

    if (
      declaredCurrency !==
      marketCurrency
    ) {
      throw new Error(
        "KLYX_CURRENCY_MARKET_MISMATCH"
      );
    }
  }

  return {
    countryCode:
      market.countryCode,

    currencyCode:
      marketCurrency,

    currencySymbol:
      market.currencySymbol,

    stripeCurrency:
      marketCurrency.toLowerCase(),

    minorUnitExponent:
      getKlyxMinorUnitExponent(
        marketCurrency
      ),
  };
}

// KLYX_PROFILE_CURRENCY_GUARD_14_22
export function resolveKlyxProfileMoney(
  profile: KlyxMoneyProfile
): KlyxMoneyContext {
  if (
    !profile.countryCode ||
    !profile.currencyCode
  ) {
    throw new Error(
      "KLYX_PROFILE_MARKET_REQUIRED"
    );
  }

  return resolveKlyxMoneyContext(
    profile.countryCode,
    profile.currencyCode
  );
}

function assertFiniteAmount(
  amount: number
) {
  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error(
      "KLYX_MONEY_AMOUNT_INVALID"
    );
  }
}

/**
 * Convertit une valeur utilisateur vers l'unité
 * minimale exigée pour les transactions.
 *
 * 12.34 EUR -> 1234
 *
 * La fonction ne déclenche AUCUN paiement.
 */
export function toKlyxMinorUnits(
  amount: number,
  countryCode: string,
  currencyCode?: string | null
): number {
  assertFiniteAmount(amount);

  const context =
    resolveKlyxMoneyContext(
      countryCode,
      currencyCode
    );

  const multiplier =
    10 **
    context.minorUnitExponent;

  const minorUnits =
    Math.round(
      (amount +
        Number.EPSILON) *
        multiplier
    );

  if (
    !Number.isSafeInteger(
      minorUnits
    )
  ) {
    throw new Error(
      "KLYX_MONEY_AMOUNT_TOO_LARGE"
    );
  }

  return minorUnits;
}

export function fromKlyxMinorUnits(
  minorUnits: number,
  countryCode: string,
  currencyCode?: string | null
): number {
  if (
    !Number.isSafeInteger(
      minorUnits
    ) ||
    minorUnits < 0
  ) {
    throw new Error(
      "KLYX_MINOR_UNITS_INVALID"
    );
  }

  const context =
    resolveKlyxMoneyContext(
      countryCode,
      currencyCode
    );

  return (
    minorUnits /
    10 **
      context.minorUnitExponent
  );
}

export function formatKlyxMoney(
  amount: number,
  countryCode: string,
  currencyCode?: string | null,
  locale = "fr-BE"
): string {
  assertFiniteAmount(amount);

  const context =
    resolveKlyxMoneyContext(
      countryCode,
      currencyCode
    );

  return new Intl.NumberFormat(
    locale,
    {
      style: "currency",
      currency:
        context.currencyCode,
    }
  ).format(amount);
}

// KLYX_STRIPE_CURRENCY_FROM_MARKET_14_22
export function getKlyxStripeCurrency(
  countryCode: string,
  currencyCode?: string | null
): string {
  return resolveKlyxMoneyContext(
    countryCode,
    currencyCode
  ).stripeCurrency;
}

/**
 * Vérifie que deux transactions/profils utilisent
 * exactement la même devise.
 *
 * Aucun taux de change silencieux.
 */
export function assertKlyxSameCurrency(
  leftCurrencyCode: string,
  rightCurrencyCode: string
): string {
  const left =
    normalizeCurrencyCode(
      leftCurrencyCode
    );

  const right =
    normalizeCurrencyCode(
      rightCurrencyCode
    );

  if (
    !left ||
    !right ||
    left !== right
  ) {
    throw new Error(
      "KLYX_TRANSACTION_CURRENCY_MISMATCH"
    );
  }

  return left;
}

// KLYX_NO_SILENT_FX_14_22
export const KLYX_SILENT_CURRENCY_CONVERSION_ALLOWED =
  false;

// KLYX_NO_AUTOMATIC_PAYMENT_14_22
export const KLYX_AUTOMATIC_PAYMENT_ALLOWED =
  false;