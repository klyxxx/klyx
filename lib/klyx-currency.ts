export type KlyxRoundingMode = "half_up";

export type KlyxMinorUnitPolicy = {
  currencyCode: string;
  accountingExponent: number;
  stripeChargeExponent: number;
  stripeChargeIncrement: number;
  stripePayoutIncrement: number;
  zeroDecimal: boolean;
};

const STRIPE_CHARGE_OVERRIDES: Readonly<
  Record<string, { exponent: number; increment: number }>
> = Object.freeze({
  ISK: { exponent: 2, increment: 100 },
  UGX: { exponent: 2, increment: 100 },
});

const STRIPE_PAYOUT_INCREMENT_OVERRIDES: Readonly<Record<string, number>> =
  Object.freeze({
    HUF: 100,
    TWD: 100,
  });

export function normalizeKlyxCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error("KLYX_COUNTRY_CODE_INVALID");
  }
  return normalized;
}

export function normalizeKlyxCurrencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("KLYX_CURRENCY_INVALID");
  }
  return normalized;
}

export function getKlyxCurrencyMinorUnitExponent(currencyCode: string): number {
  const currency = normalizeKlyxCurrencyCode(currencyCode);
  try {
    const options = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions();

    const exponent =
      options.maximumFractionDigits ?? options.minimumFractionDigits ?? 2;

    if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
      throw new Error("KLYX_CURRENCY_MINOR_UNIT_INVALID");
    }
    return exponent;
  } catch {
    throw new Error("KLYX_CURRENCY_INVALID");
  }
}

export function getKlyxMinorUnitPolicy(currencyCode: string): KlyxMinorUnitPolicy {
  const currency = normalizeKlyxCurrencyCode(currencyCode);
  const accountingExponent = getKlyxCurrencyMinorUnitExponent(currency);
  const chargeOverride = STRIPE_CHARGE_OVERRIDES[currency];

  return {
    currencyCode: currency,
    accountingExponent,
    stripeChargeExponent: chargeOverride?.exponent ?? accountingExponent,
    stripeChargeIncrement: chargeOverride?.increment ?? 1,
    stripePayoutIncrement:
      STRIPE_PAYOUT_INCREMENT_OVERRIDES[currency] ??
      chargeOverride?.increment ??
      1,
    zeroDecimal: accountingExponent === 0,
  };
}

function expandScientific(value: string): string {
  if (!/[eE]/.test(value)) return value;

  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) {
    throw new Error("KLYX_MONEY_AMOUNT_INVALID");
  }

  const sign = match[1] ?? "";
  const integer = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isInteger(exponent)) {
    throw new Error("KLYX_MONEY_AMOUNT_INVALID");
  }

  const digits = integer + fraction;
  const decimalIndex = integer.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function decimalText(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("KLYX_MONEY_AMOUNT_INVALID");
    }
    return expandScientific(String(value));
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    throw new Error("KLYX_MONEY_AMOUNT_INVALID");
  }
  return expandScientific(normalized);
}

export function roundKlyxRationalToSafeInteger(
  numerator: bigint,
  denominator: bigint,
  mode: KlyxRoundingMode = "half_up"
): number {
  if (denominator <= BigInt(0)) {
    throw new Error("KLYX_MONEY_DENOMINATOR_INVALID");
  }
  if (mode !== "half_up") {
    throw new Error("KLYX_MONEY_ROUNDING_MODE_INVALID");
  }

  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  const whole = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * BigInt(2) >= denominator ? whole + BigInt(1) : whole;
  const signed = negative ? -rounded : rounded;

  const asNumber = Number(signed);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error("KLYX_MONEY_AMOUNT_TOO_LARGE");
  }
  return asNumber;
}

export function decimalToKlyxMinorUnits(
  value: string | number,
  currencyCode: string,
  rounding: KlyxRoundingMode = "half_up"
): number {
  const exponent = getKlyxCurrencyMinorUnitExponent(currencyCode);
  const text = decimalText(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);

  if (!match) {
    throw new Error("KLYX_MONEY_AMOUNT_INVALID");
  }

  const negative = match[1] === "-";
  const whole = match[2];
  const fraction = match[3] ?? "";
  const kept = fraction.slice(0, exponent).padEnd(exponent, "0");
  const dropped = fraction.slice(exponent);

  let absoluteMinor = BigInt(`${whole}${kept}` || "0");

  if (dropped && rounding === "half_up" && Number(dropped[0]) >= 5) {
    absoluteMinor += BigInt(1);
  }

  const signed = negative ? -absoluteMinor : absoluteMinor;
  const result = Number(signed);

  if (!Number.isSafeInteger(result)) {
    throw new Error("KLYX_MONEY_AMOUNT_TOO_LARGE");
  }

  return result;
}

export function klyxMinorUnitsToDecimalString(
  minorUnits: number,
  currencyCode: string
): string {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  const exponent = getKlyxCurrencyMinorUnitExponent(currencyCode);
  const negative = minorUnits < 0;
  const absolute = Math.abs(minorUnits);
  const digits = String(absolute).padStart(exponent + 1, "0");

  if (exponent === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const split = digits.length - exponent;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

export function formatKlyxMinorUnits(
  minorUnits: number,
  currencyCode: string,
  locale = "en"
): string {
  const currency = normalizeKlyxCurrencyCode(currencyCode);
  const value = Number(klyxMinorUnitsToDecimalString(minorUnits, currency));

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}

export function calculateKlyxBasisPointsAmount(
  amountMinor: number,
  basisPoints: number
): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error("KLYX_BASIS_POINTS_INVALID");
  }

  return roundKlyxRationalToSafeInteger(
    BigInt(amountMinor) * BigInt(basisPoints),
    10_00BigInt(0)
  );
}

export function assertKlyxStripeIncrement(
  amountMinor: number,
  increment: number
): void {
  if (
    !Number.isSafeInteger(amountMinor) ||
    !Number.isSafeInteger(increment) ||
    increment <= 0 ||
    amountMinor % increment !== 0
  ) {
    throw new Error("KLYX_STRIPE_CURRENCY_INCREMENT_INVALID");
  }
}


export function toKlyxStripeChargeAmount(
  accountingMinorUnits: number,
  currencyCode: string
): number {
  if (!Number.isSafeInteger(accountingMinorUnits) || accountingMinorUnits < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  const policy = getKlyxMinorUnitPolicy(currencyCode);
  const exponentDelta =
    policy.stripeChargeExponent - policy.accountingExponent;

  let stripeAmount = accountingMinorUnits;

  if (exponentDelta > 0) {
    const multiplier = 10 ** exponentDelta;
    if (!Number.isSafeInteger(multiplier)) {
      throw new Error("KLYX_STRIPE_CURRENCY_SCALE_INVALID");
    }
    stripeAmount = accountingMinorUnits * multiplier;
  } else if (exponentDelta < 0) {
    const divisor = 10 ** -exponentDelta;
    if (accountingMinorUnits % divisor !== 0) {
      throw new Error("KLYX_STRIPE_CURRENCY_SCALE_LOSS");
    }
    stripeAmount = accountingMinorUnits / divisor;
  }

  if (!Number.isSafeInteger(stripeAmount)) {
    throw new Error("KLYX_MONEY_AMOUNT_TOO_LARGE");
  }

  assertKlyxStripeIncrement(
    stripeAmount,
    policy.stripeChargeIncrement
  );

  return stripeAmount;
}

export function fromKlyxStripeChargeAmount(
  stripeAmount: number,
  currencyCode: string
): number {
  if (!Number.isSafeInteger(stripeAmount) || stripeAmount < 0) {
    throw new Error("KLYX_MINOR_UNITS_INVALID");
  }

  const policy = getKlyxMinorUnitPolicy(currencyCode);
  assertKlyxStripeIncrement(stripeAmount, policy.stripeChargeIncrement);

  const exponentDelta =
    policy.stripeChargeExponent - policy.accountingExponent;

  let accountingMinorUnits = stripeAmount;

  if (exponentDelta > 0) {
    const divisor = 10 ** exponentDelta;
    if (stripeAmount % divisor !== 0) {
      throw new Error("KLYX_STRIPE_CURRENCY_SCALE_LOSS");
    }
    accountingMinorUnits = stripeAmount / divisor;
  } else if (exponentDelta < 0) {
    const multiplier = 10 ** -exponentDelta;
    accountingMinorUnits = stripeAmount * multiplier;
  }

  if (!Number.isSafeInteger(accountingMinorUnits)) {
    throw new Error("KLYX_MONEY_AMOUNT_TOO_LARGE");
  }

  return accountingMinorUnits;
}

export function assertKlyxStripePayoutAmount(
  accountingMinorUnits: number,
  currencyCode: string
): void {
  const policy = getKlyxMinorUnitPolicy(currencyCode);
  if (
    !Number.isSafeInteger(accountingMinorUnits) ||
    accountingMinorUnits < 0 ||
    accountingMinorUnits % policy.stripePayoutIncrement !== 0
  ) {
    throw new Error("KLYX_STRIPE_PAYOUT_INCREMENT_INVALID");
  }
}
