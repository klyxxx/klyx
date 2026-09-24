import type { FinanceRoundingMode } from "./types";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const BASIS_POINTS_DENOMINATOR = BigInt(10_000);

export function requiredFinanceText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export function safeFinanceIntegerFromBigInt(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error("KLYX_FINANCE_AMOUNT_TOO_LARGE");
  }
  return result;
}

export function safeNonNegativeFinanceInteger(
  value: number,
  code: string
): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

export function assertFinanceBasisPoints(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("KLYX_FINANCE_BASIS_POINTS_INVALID");
  }
  return value;
}

export function financePow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new Error("KLYX_FINANCE_MINOR_UNIT_EXPONENT_INVALID");
  }
  return BigInt(10) ** BigInt(exponent);
}

export function roundFinanceRational(
  numerator: bigint,
  denominator: bigint,
  mode: FinanceRoundingMode = "half_up"
): number {
  if (denominator <= ZERO) {
    throw new Error("KLYX_FINANCE_DENOMINATOR_INVALID");
  }
  if (mode !== "half_up") {
    throw new Error("KLYX_FINANCE_ROUNDING_MODE_INVALID");
  }

  const negative = numerator < ZERO;
  const absolute = negative ? -numerator : numerator;
  const whole = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * TWO >= denominator ? whole + ONE : whole;
  return safeFinanceIntegerFromBigInt(negative ? -rounded : rounded);
}

export function calculateBasisPointsAmount(
  amountMinor: number,
  basisPoints: number
): number {
  safeNonNegativeFinanceInteger(
    amountMinor,
    "KLYX_FINANCE_MINOR_UNITS_INVALID"
  );
  assertFinanceBasisPoints(basisPoints);
  return roundFinanceRational(
    BigInt(amountMinor) * BigInt(basisPoints),
    BASIS_POINTS_DENOMINATOR
  );
}
