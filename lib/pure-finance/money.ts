import {
  financePow10,
  requiredFinanceText,
  roundFinanceRational,
  safeFinanceIntegerFromBigInt,
  safeNonNegativeFinanceInteger,
} from "./math";
import type {
  CurrencyCatalog,
  CurrencyPolicy,
  FinanceRoundingMode,
  FxRate,
  Money,
} from "./types";

export function normalizeFinanceCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("KLYX_FINANCE_CURRENCY_INVALID");
  }
  return normalized;
}

export function resolveCurrencyPolicy(
  catalog: CurrencyCatalog,
  currencyCode: string
): CurrencyPolicy {
  const currency = normalizeFinanceCurrency(currencyCode);
  const matches = catalog.filter(
    (item) => normalizeFinanceCurrency(item.code) === currency
  );

  if (matches.length === 0) {
    throw new Error("KLYX_FINANCE_CURRENCY_POLICY_MISSING");
  }
  if (matches.length > 1) {
    throw new Error("KLYX_FINANCE_CURRENCY_POLICY_DUPLICATE");
  }

  const exponent = matches[0].minorUnitExponent;
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new Error("KLYX_FINANCE_MINOR_UNIT_EXPONENT_INVALID");
  }
  return { code: currency, minorUnitExponent: exponent };
}

function expandScientific(value: string): string {
  if (!/[eE]/.test(value)) return value;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) throw new Error("KLYX_FINANCE_DECIMAL_INVALID");

  const sign = match[1] ?? "";
  const integer = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isInteger(exponent)) {
    throw new Error("KLYX_FINANCE_DECIMAL_INVALID");
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

export function decimalToMinorUnits(
  decimal: string,
  currencyCode: string,
  catalog: CurrencyCatalog,
  mode: FinanceRoundingMode = "half_up"
): number {
  if (mode !== "half_up") {
    throw new Error("KLYX_FINANCE_ROUNDING_MODE_INVALID");
  }

  const exponent = resolveCurrencyPolicy(
    catalog,
    currencyCode
  ).minorUnitExponent;
  const normalized = expandScientific(decimal.trim().replace(",", "."));
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error("KLYX_FINANCE_DECIMAL_INVALID");

  const negative = match[1] === "-";
  const whole = match[2];
  const fraction = match[3] ?? "";
  const kept = fraction.slice(0, exponent).padEnd(exponent, "0");
  const dropped = fraction.slice(exponent);

  let result = BigInt(`${whole}${kept}` || "0");
  if (dropped && Number(dropped[0]) >= 5) result += BigInt(1);
  return safeFinanceIntegerFromBigInt(negative ? -result : result);
}

export function minorUnitsToDecimal(
  amountMinor: number,
  currencyCode: string,
  catalog: CurrencyCatalog
): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("KLYX_FINANCE_MINOR_UNITS_INVALID");
  }

  const exponent = resolveCurrencyPolicy(
    catalog,
    currencyCode
  ).minorUnitExponent;
  const negative = amountMinor < 0;
  const digits = BigInt(Math.abs(amountMinor))
    .toString()
    .padStart(exponent + 1, "0");

  if (exponent === 0) return `${negative ? "-" : ""}${digits}`;
  const split = digits.length - exponent;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

function positiveIntegerText(value: string, code: string): bigint {
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) throw new Error(code);
  return BigInt(normalized);
}

export function convertMoney(
  money: Money,
  targetCurrencyCode: string,
  rate: FxRate | null,
  catalog: CurrencyCatalog
): Money {
  const amountMinor = safeNonNegativeFinanceInteger(
    money.amountMinor,
    "KLYX_FINANCE_MINOR_UNITS_INVALID"
  );
  const sourcePolicy = resolveCurrencyPolicy(catalog, money.currency);
  const targetPolicy = resolveCurrencyPolicy(catalog, targetCurrencyCode);

  if (sourcePolicy.code === targetPolicy.code) {
    return { amountMinor, currency: sourcePolicy.code };
  }
  if (!rate) throw new Error("KLYX_FINANCE_FX_RATE_REQUIRED");
  requiredFinanceText(rate.id, "KLYX_FINANCE_FX_RATE_ID_REQUIRED");

  if (
    normalizeFinanceCurrency(rate.sourceCurrency) !== sourcePolicy.code ||
    normalizeFinanceCurrency(rate.targetCurrency) !== targetPolicy.code
  ) {
    throw new Error("KLYX_FINANCE_FX_CURRENCY_MISMATCH");
  }

  const numerator = positiveIntegerText(
    rate.numerator,
    "KLYX_FINANCE_FX_NUMERATOR_INVALID"
  );
  const denominator = positiveIntegerText(
    rate.denominator,
    "KLYX_FINANCE_FX_DENOMINATOR_INVALID"
  );

  const scaledNumerator =
    BigInt(amountMinor) * numerator * financePow10(targetPolicy.minorUnitExponent);
  const scaledDenominator =
    denominator * financePow10(sourcePolicy.minorUnitExponent);

  return {
    amountMinor: roundFinanceRational(scaledNumerator, scaledDenominator),
    currency: targetPolicy.code,
  };
}
