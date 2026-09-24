export type FinanceRoundingMode = "half_up";

export type CurrencyPolicy = {
  code: string;
  minorUnitExponent: number;
};

export type CurrencyCatalog = readonly CurrencyPolicy[];

export type Money = {
  amountMinor: number;
  currency: string;
};

export type FxRate = {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  numerator: string;
  denominator: string;
};

export type CommissionPolicy = {
  basisPoints: number;
  fixedMinor?: number;
};

export type TaxRule = {
  id: string;
  basis: "gross" | "commission";
  bearer: "platform" | "provider";
  basisPoints: number;
};

export type AppliedTax = TaxRule & {
  amountMinor: number;
};

export type FinancialMovementType =
  | "charge"
  | "commission"
  | "provider_liability"
  | "transfer"
  | "reversal"
  | "refund";

export type FinancialEvent = {
  id: string;
  operationId: string;
  sequence: number;
  type: FinancialMovementType;
  amountMinor: number;
  currency: string;
  cause: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
};

export type FinancialBreakdown = {
  grossMinor: number;
  commissionMinor: number;
  platformTaxMinor: number;
  providerTaxMinor: number;
  platformNetMinor: number;
  providerLiabilityMinor: number;
  taxes: readonly AppliedTax[];
};

export type RefundAllocation = {
  refundMinor: number;
  commissionRefundMinor: number;
  providerLiabilityRefundMinor: number;
  providerTaxRefundMinor: number;
  platformTaxRefundMinor: number;
};

export type FinancialState = {
  version: 1;
  transactionId: string;
  currency: string;
  breakdown: FinancialBreakdown;
  refundedMinor: number;
  commissionRefundedMinor: number;
  providerLiabilityRefundedMinor: number;
  providerTaxRefundedMinor: number;
  platformTaxRefundedMinor: number;
  transferredMinor: number;
  reversedMinor: number;
  operationIds: readonly string[];
  events: readonly FinancialEvent[];
};

export type PayoutProjection = {
  id: string;
  transactionId: string;
  type: "payout";
  currency: string;
  amountMinor: number;
  basisSequence: number;
};

const MAX_MINOR_UNIT_EXPONENT = 6;
const BASIS_POINTS_DENOMINATOR = 10_000n;

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function safeNonNegativeInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function safeIntegerFromBigInt(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error("KLYX_FINANCE_AMOUNT_TOO_LARGE");
  }
  return result;
}

function basisPoints(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("KLYX_FINANCE_BASIS_POINTS_INVALID");
  }
  return value;
}

function pow10(exponent: number): bigint {
  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > MAX_MINOR_UNIT_EXPONENT
  ) {
    throw new Error("KLYX_FINANCE_MINOR_UNIT_EXPONENT_INVALID");
  }
  return 10n ** BigInt(exponent);
}

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
  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > MAX_MINOR_UNIT_EXPONENT
  ) {
    throw new Error("KLYX_FINANCE_MINOR_UNIT_EXPONENT_INVALID");
  }
  return { code: currency, minorUnitExponent: exponent };
}

export function roundFinanceRational(
  numerator: bigint,
  denominator: bigint,
  mode: FinanceRoundingMode = "half_up"
): number {
  if (denominator <= 0n) {
    throw new Error("KLYX_FINANCE_DENOMINATOR_INVALID");
  }
  if (mode !== "half_up") {
    throw new Error("KLYX_FINANCE_ROUNDING_MODE_INVALID");
  }

  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const whole = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? whole + 1n : whole;
  return safeIntegerFromBigInt(negative ? -rounded : rounded);
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
  const policy = resolveCurrencyPolicy(catalog, currencyCode);
  const normalized = expandScientific(decimal.trim().replace(",", "."));
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error("KLYX_FINANCE_DECIMAL_INVALID");

  const negative = match[1] === "-";
  const whole = match[2];
  const fraction = match[3] ?? "";
  const exponent = policy.minorUnitExponent;
  const kept = fraction.slice(0, exponent).padEnd(exponent, "0");
  const dropped = fraction.slice(exponent);

  let result = BigInt(`${whole}${kept}` || "0");
  if (dropped && Number(dropped[0]) >= 5) result += 1n;
  return safeIntegerFromBigInt(negative ? -result : result);
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

export function calculateBasisPointsAmount(
  amountMinor: number,
  rateBasisPoints: number
): number {
  safeNonNegativeInteger(amountMinor, "KLYX_FINANCE_MINOR_UNITS_INVALID");
  basisPoints(rateBasisPoints);
  return roundFinanceRational(
    BigInt(amountMinor) * BigInt(rateBasisPoints),
    BASIS_POINTS_DENOMINATOR
  );
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
  const amountMinor = safeNonNegativeInteger(
    money.amountMinor,
    "KLYX_FINANCE_MINOR_UNITS_INVALID"
  );
  const sourcePolicy = resolveCurrencyPolicy(catalog, money.currency);
  const targetPolicy = resolveCurrencyPolicy(catalog, targetCurrencyCode);

  if (sourcePolicy.code === targetPolicy.code) {
    return { amountMinor, currency: sourcePolicy.code };
  }
  if (!rate) throw new Error("KLYX_FINANCE_FX_RATE_REQUIRED");
  requiredText(rate.id, "KLYX_FINANCE_FX_RATE_ID_REQUIRED");

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
    BigInt(amountMinor) * numerator * pow10(targetPolicy.minorUnitExponent);
  const scaledDenominator =
    denominator * pow10(sourcePolicy.minorUnitExponent);

  return {
    amountMinor: roundFinanceRational(scaledNumerator, scaledDenominator),
    currency: targetPolicy.code,
  };
}

function validateTaxRules(rules: readonly TaxRule[]): readonly TaxRule[] {
  const ids = new Set<string>();
  return rules.map((rule) => {
    const id = requiredText(rule.id, "KLYX_FINANCE_TAX_ID_REQUIRED");
    if (ids.has(id)) throw new Error("KLYX_FINANCE_TAX_ID_DUPLICATE");
    ids.add(id);
    basisPoints(rule.basisPoints);
    if (rule.basis !== "gross" && rule.basis !== "commission") {
      throw new Error("KLYX_FINANCE_TAX_BASIS_INVALID");
    }
    if (rule.bearer !== "platform" && rule.bearer !== "provider") {
      throw new Error("KLYX_FINANCE_TAX_BEARER_INVALID");
    }
    return { ...rule, id };
  });
}

export function calculateFinancialBreakdown(input: {
  grossMinor: number;
  commission: CommissionPolicy;
  taxes?: readonly TaxRule[];
}): FinancialBreakdown {
  const grossMinor = safeNonNegativeInteger(
    input.grossMinor,
    "KLYX_FINANCE_GROSS_INVALID"
  );
  if (grossMinor === 0) throw new Error("KLYX_FINANCE_GROSS_ZERO");

  const commissionMinor =
    calculateBasisPointsAmount(
      grossMinor,
      basisPoints(input.commission.basisPoints)
    ) +
    safeNonNegativeInteger(
      input.commission.fixedMinor ?? 0,
      "KLYX_FINANCE_COMMISSION_FIXED_INVALID"
    );

  if (!Number.isSafeInteger(commissionMinor) || commissionMinor > grossMinor) {
    throw new Error("KLYX_FINANCE_COMMISSION_EXCEEDS_GROSS");
  }

  const taxes = validateTaxRules(input.taxes ?? []).map((rule) => ({
    ...rule,
    amountMinor: calculateBasisPointsAmount(
      rule.basis === "gross" ? grossMinor : commissionMinor,
      rule.basisPoints
    ),
  }));

  const platformTaxMinor = taxes
    .filter((tax) => tax.bearer === "platform")
    .reduce((sum, tax) => sum + tax.amountMinor, 0);
  const providerTaxMinor = taxes
    .filter((tax) => tax.bearer === "provider")
    .reduce((sum, tax) => sum + tax.amountMinor, 0);

  if (platformTaxMinor > commissionMinor) {
    throw new Error("KLYX_FINANCE_PLATFORM_TAX_EXCEEDS_COMMISSION");
  }
  if (commissionMinor + providerTaxMinor > grossMinor) {
    throw new Error("KLYX_FINANCE_PROVIDER_TAX_EXCEEDS_AVAILABLE_GROSS");
  }

  return {
    grossMinor,
    commissionMinor,
    platformTaxMinor,
    providerTaxMinor,
    platformNetMinor: commissionMinor - platformTaxMinor,
    providerLiabilityMinor: grossMinor - commissionMinor - providerTaxMinor,
    taxes,
  };
}

function makeEvent(input: {
  transactionId: string;
  operationId: string;
  sequence: number;
  type: FinancialMovementType;
  amountMinor: number;
  currency: string;
  cause: string;
  details?: Readonly<Record<string, string | number | boolean | null>>;
}): FinancialEvent {
  return {
    id: `${input.transactionId}:${input.operationId}:${input.type}:${input.sequence}`,
    operationId: input.operationId,
    sequence: input.sequence,
    type: input.type,
    amountMinor: safeNonNegativeInteger(
      input.amountMinor,
      "KLYX_FINANCE_EVENT_AMOUNT_INVALID"
    ),
    currency: normalizeFinanceCurrency(input.currency),
    cause: requiredText(input.cause, "KLYX_FINANCE_EVENT_CAUSE_REQUIRED"),
    details: input.details ?? {},
  };
}

function appendEvents(
  state: FinancialState,
  operationId: string,
  entries: readonly Omit<
    FinancialEvent,
    "id" | "operationId" | "sequence" | "currency"
  >[]
): FinancialState {
  const normalizedOperationId = requiredText(
    operationId,
    "KLYX_FINANCE_OPERATION_ID_REQUIRED"
  );
  if (state.operationIds.includes(normalizedOperationId)) {
    throw new Error("KLYX_FINANCE_OPERATION_DUPLICATE");
  }

  const start = state.events.length;
  const appended = entries.map((entry, index) =>
    makeEvent({
      transactionId: state.transactionId,
      operationId: normalizedOperationId,
      sequence: start + index + 1,
      type: entry.type,
      amountMinor: entry.amountMinor,
      currency: state.currency,
      cause: entry.cause,
      details: entry.details,
    })
  );

  return {
    ...state,
    operationIds: [...state.operationIds, normalizedOperationId],
    events: [...state.events, ...appended],
  };
}

export function createFinancialState(input: {
  transactionId: string;
  currency: string;
  grossMinor: number;
  commission: CommissionPolicy;
  taxes?: readonly TaxRule[];
}): FinancialState {
  const transactionId = requiredText(
    input.transactionId,
    "KLYX_FINANCE_TRANSACTION_ID_REQUIRED"
  );
  const currency = normalizeFinanceCurrency(input.currency);
  const breakdown = calculateFinancialBreakdown(input);

  const empty: FinancialState = {
    version: 1,
    transactionId,
    currency,
    breakdown,
    refundedMinor: 0,
    commissionRefundedMinor: 0,
    providerLiabilityRefundedMinor: 0,
    providerTaxRefundedMinor: 0,
    platformTaxRefundedMinor: 0,
    transferredMinor: 0,
    reversedMinor: 0,
    operationIds: [],
    events: [],
  };

  const initialized = appendEvents(empty, "initial", [
    {
      type: "charge",
      amountMinor: breakdown.grossMinor,
      cause: "charge_created",
      details: {},
    },
    {
      type: "commission",
      amountMinor: breakdown.commissionMinor,
      cause: "commission_recognized",
      details: {
        platformTaxMinor: breakdown.platformTaxMinor,
        platformNetMinor: breakdown.platformNetMinor,
      },
    },
    {
      type: "provider_liability",
      amountMinor: breakdown.providerLiabilityMinor,
      cause: "provider_liability_recognized",
      details: { providerTaxMinor: breakdown.providerTaxMinor },
    },
  ]);

  assertFinancialState(initialized);
  return initialized;
}

type WeightedBucket = { key: string; weight: number };

function allocateProportionally(
  total: number,
  buckets: readonly WeightedBucket[]
): Record<string, number> {
  safeNonNegativeInteger(total, "KLYX_FINANCE_ALLOCATION_TOTAL_INVALID");
  const totalWeight = buckets.reduce((sum, bucket) => {
    safeNonNegativeInteger(
      bucket.weight,
      "KLYX_FINANCE_ALLOCATION_WEIGHT_INVALID"
    );
    return sum + bucket.weight;
  }, 0);

  if (totalWeight === 0) {
    if (total !== 0) throw new Error("KLYX_FINANCE_ALLOCATION_WEIGHT_ZERO");
    return Object.fromEntries(buckets.map((bucket) => [bucket.key, 0]));
  }
  if (total > totalWeight) {
    throw new Error("KLYX_FINANCE_ALLOCATION_EXCEEDS_WEIGHT");
  }

  const denominator = BigInt(totalWeight);
  const rows = buckets.map((bucket) => {
    const product = BigInt(total) * BigInt(bucket.weight);
    return {
      key: bucket.key,
      floor: safeIntegerFromBigInt(product / denominator),
      remainder: product % denominator,
    };
  });

  const result = Object.fromEntries(rows.map((row) => [row.key, row.floor]));
  let remaining = total - rows.reduce((sum, row) => sum + row.floor, 0);
  const order = [...rows].sort((left, right) => {
    if (left.remainder > right.remainder) return -1;
    if (left.remainder < right.remainder) return 1;
    if (left.key < right.key) return -1;
    if (left.key > right.key) return 1;
    return 0;
  });

  for (let index = 0; remaining > 0; index += 1) {
    result[order[index % order.length].key] += 1;
    remaining -= 1;
  }

  return result;
}

function cumulativeRefundAllocation(
  state: FinancialState,
  cumulativeRefundMinor: number
): RefundAllocation {
  if (
    !Number.isSafeInteger(cumulativeRefundMinor) ||
    cumulativeRefundMinor < 0 ||
    cumulativeRefundMinor > state.breakdown.grossMinor
  ) {
    throw new Error("KLYX_FINANCE_REFUND_AMOUNT_INVALID");
  }

  const gross = allocateProportionally(cumulativeRefundMinor, [
    { key: "commission", weight: state.breakdown.commissionMinor },
    { key: "provider_liability", weight: state.breakdown.providerLiabilityMinor },
    { key: "provider_tax", weight: state.breakdown.providerTaxMinor },
  ]);

  let platformTaxRefundMinor = 0;
  if (state.breakdown.commissionMinor > 0) {
    platformTaxRefundMinor = allocateProportionally(gross.commission, [
      { key: "platform_tax", weight: state.breakdown.platformTaxMinor },
      { key: "platform_net", weight: state.breakdown.platformNetMinor },
    ]).platform_tax;
  }

  return {
    refundMinor: cumulativeRefundMinor,
    commissionRefundMinor: gross.commission,
    providerLiabilityRefundMinor: gross.provider_liability,
    providerTaxRefundMinor: gross.provider_tax,
    platformTaxRefundMinor,
  };
}

export function previewRefundAllocation(
  state: FinancialState,
  additionalRefundMinor: number
): RefundAllocation {
  assertFinancialState(state, { allowPendingReversal: true });
  const additional = safeNonNegativeInteger(
    additionalRefundMinor,
    "KLYX_FINANCE_REFUND_AMOUNT_INVALID"
  );
  if (additional === 0) throw new Error("KLYX_FINANCE_REFUND_ZERO");
  return cumulativeRefundAllocation(state, state.refundedMinor + additional);
}

export function netTransferredMinor(state: FinancialState): number {
  return state.transferredMinor - state.reversedMinor;
}

export function currentProviderLiabilityMinor(state: FinancialState): number {
  return (
    state.breakdown.providerLiabilityMinor -
    state.providerLiabilityRefundedMinor
  );
}

export function requiredReversalMinor(state: FinancialState): number {
  return Math.max(
    0,
    netTransferredMinor(state) - currentProviderLiabilityMinor(state)
  );
}

export function outstandingSettlementMinor(state: FinancialState): number {
  return Math.max(
    0,
    currentProviderLiabilityMinor(state) - netTransferredMinor(state)
  );
}

export function settleProviderLiability(
  state: FinancialState,
  input: { operationId: string; amountMinor?: number; cause?: string }
): FinancialState {
  assertFinancialState(state, { allowPendingReversal: true });
  if (requiredReversalMinor(state) > 0) {
    throw new Error("KLYX_FINANCE_REVERSAL_REQUIRED_BEFORE_SETTLEMENT");
  }

  const outstanding = outstandingSettlementMinor(state);
  const amount = input.amountMinor ?? outstanding;
  safeNonNegativeInteger(amount, "KLYX_FINANCE_SETTLEMENT_AMOUNT_INVALID");
  if (amount === 0) throw new Error("KLYX_FINANCE_SETTLEMENT_ZERO");
  if (amount > outstanding) {
    throw new Error("KLYX_FINANCE_SETTLEMENT_EXCEEDS_LIABILITY");
  }

  const appended = appendEvents(state, input.operationId, [
    {
      type: "transfer",
      amountMinor: amount,
      cause: input.cause ?? "provider_settlement",
      details: {},
    },
  ]);
  const result = {
    ...appended,
    transferredMinor: state.transferredMinor + amount,
  };
  assertFinancialState(result);
  return result;
}

export function reverseTransfer(
  state: FinancialState,
  input: { operationId: string; amountMinor: number; cause?: string }
): FinancialState {
  assertFinancialState(state, { allowPendingReversal: true });
  const amount = safeNonNegativeInteger(
    input.amountMinor,
    "KLYX_FINANCE_REVERSAL_AMOUNT_INVALID"
  );
  if (amount === 0) throw new Error("KLYX_FINANCE_REVERSAL_ZERO");
  if (amount > netTransferredMinor(state)) {
    throw new Error("KLYX_FINANCE_REVERSAL_EXCEEDS_TRANSFERRED");
  }

  const appended = appendEvents(state, input.operationId, [
    {
      type: "reversal",
      amountMinor: amount,
      cause: input.cause ?? "transfer_reversal",
      details: {},
    },
  ]);
  const result = { ...appended, reversedMinor: state.reversedMinor + amount };
  assertFinancialState(result, {
    allowPendingReversal: requiredReversalMinor(result) > 0,
  });
  return result;
}

export function refundCharge(
  state: FinancialState,
  input: {
    operationId: string;
    amountMinor: number;
    cause?: string;
    autoReverseTransfer?: boolean;
  }
): FinancialState {
  assertFinancialState(state, { allowPendingReversal: true });
  if (requiredReversalMinor(state) > 0) {
    throw new Error("KLYX_FINANCE_REVERSAL_REQUIRED_BEFORE_REFUND");
  }

  const amount = safeNonNegativeInteger(
    input.amountMinor,
    "KLYX_FINANCE_REFUND_AMOUNT_INVALID"
  );
  if (amount === 0) throw new Error("KLYX_FINANCE_REFUND_ZERO");
  if (state.refundedMinor + amount > state.breakdown.grossMinor) {
    throw new Error("KLYX_FINANCE_REFUND_EXCEEDS_CHARGE");
  }

  const target = cumulativeRefundAllocation(state, state.refundedMinor + amount);
  const delta: RefundAllocation = {
    refundMinor: amount,
    commissionRefundMinor:
      target.commissionRefundMinor - state.commissionRefundedMinor,
    providerLiabilityRefundMinor:
      target.providerLiabilityRefundMinor - state.providerLiabilityRefundedMinor,
    providerTaxRefundMinor:
      target.providerTaxRefundMinor - state.providerTaxRefundedMinor,
    platformTaxRefundMinor:
      target.platformTaxRefundMinor - state.platformTaxRefundedMinor,
  };

  const liabilityAfterRefund =
    state.breakdown.providerLiabilityMinor - target.providerLiabilityRefundMinor;
  const reversalNeeded = Math.max(
    0,
    netTransferredMinor(state) - liabilityAfterRefund
  );
  const autoReverse = input.autoReverseTransfer ?? true;
  const entries: Array<
    Omit<FinancialEvent, "id" | "operationId" | "sequence" | "currency">
  > = [];

  if (reversalNeeded > 0 && autoReverse) {
    entries.push({
      type: "reversal",
      amountMinor: reversalNeeded,
      cause: "refund_required_transfer_reversal",
      details: { refundOperation: input.operationId },
    });
  }

  entries.push({
    type: "refund",
    amountMinor: amount,
    cause: input.cause ?? "charge_refund",
    details: {
      commissionRefundMinor: delta.commissionRefundMinor,
      providerLiabilityRefundMinor: delta.providerLiabilityRefundMinor,
      providerTaxRefundMinor: delta.providerTaxRefundMinor,
      platformTaxRefundMinor: delta.platformTaxRefundMinor,
      autoReversedTransferMinor: autoReverse ? reversalNeeded : 0,
    },
  });

  const appended = appendEvents(state, input.operationId, entries);
  const result: FinancialState = {
    ...appended,
    refundedMinor: target.refundMinor,
    commissionRefundedMinor: target.commissionRefundMinor,
    providerLiabilityRefundedMinor: target.providerLiabilityRefundMinor,
    providerTaxRefundedMinor: target.providerTaxRefundMinor,
    platformTaxRefundedMinor: target.platformTaxRefundMinor,
    reversedMinor: state.reversedMinor + (autoReverse ? reversalNeeded : 0),
  };

  assertFinancialState(result, { allowPendingReversal: !autoReverse });
  return result;
}

export function fullRefundCharge(
  state: FinancialState,
  input: {
    operationId: string;
    cause?: string;
    autoReverseTransfer?: boolean;
  }
): FinancialState {
  const remaining = state.breakdown.grossMinor - state.refundedMinor;
  if (remaining <= 0) throw new Error("KLYX_FINANCE_ALREADY_FULLY_REFUNDED");
  return refundCharge(state, {
    operationId: input.operationId,
    amountMinor: remaining,
    cause: input.cause ?? "full_charge_refund",
    autoReverseTransfer: input.autoReverseTransfer,
  });
}

export function projectPayout(
  state: FinancialState,
  projectionId: string
): PayoutProjection {
  assertFinancialState(state);
  const id = requiredText(
    projectionId,
    "KLYX_FINANCE_PAYOUT_PROJECTION_ID_REQUIRED"
  );
  return {
    id: `${state.transactionId}:${id}:payout:${state.events.length}`,
    transactionId: state.transactionId,
    type: "payout",
    currency: state.currency,
    amountMinor: netTransferredMinor(state),
    basisSequence: state.events.length,
  };
}

export function assertFinancialState(
  state: FinancialState,
  options: { allowPendingReversal?: boolean } = {}
): void {
  if (state.version !== 1) throw new Error("KLYX_FINANCE_STATE_VERSION_INVALID");
  requiredText(state.transactionId, "KLYX_FINANCE_TRANSACTION_ID_REQUIRED");
  normalizeFinanceCurrency(state.currency);

  [
    state.breakdown.grossMinor,
    state.breakdown.commissionMinor,
    state.breakdown.platformTaxMinor,
    state.breakdown.providerTaxMinor,
    state.breakdown.platformNetMinor,
    state.breakdown.providerLiabilityMinor,
    state.refundedMinor,
    state.commissionRefundedMinor,
    state.providerLiabilityRefundedMinor,
    state.providerTaxRefundedMinor,
    state.platformTaxRefundedMinor,
    state.transferredMinor,
    state.reversedMinor,
  ].forEach((amount) =>
    safeNonNegativeInteger(amount, "KLYX_FINANCE_STATE_AMOUNT_INVALID")
  );

  if (
    state.breakdown.commissionMinor +
      state.breakdown.providerLiabilityMinor +
      state.breakdown.providerTaxMinor !==
    state.breakdown.grossMinor
  ) {
    throw new Error("KLYX_FINANCE_GROSS_CONSERVATION_FAILED");
  }
  if (
    state.breakdown.platformNetMinor + state.breakdown.platformTaxMinor !==
    state.breakdown.commissionMinor
  ) {
    throw new Error("KLYX_FINANCE_COMMISSION_CONSERVATION_FAILED");
  }
  if (state.refundedMinor > state.breakdown.grossMinor) {
    throw new Error("KLYX_FINANCE_REFUND_EXCEEDS_CHARGE");
  }
  if (state.reversedMinor > state.transferredMinor) {
    throw new Error("KLYX_FINANCE_REVERSAL_EXCEEDS_TRANSFERRED");
  }
  if (!options.allowPendingReversal && requiredReversalMinor(state) > 0) {
    throw new Error("KLYX_FINANCE_REQUIRED_REVERSAL_UNRESOLVED");
  }

  const target = cumulativeRefundAllocation(state, state.refundedMinor);
  if (
    target.commissionRefundMinor !== state.commissionRefundedMinor ||
    target.providerLiabilityRefundMinor !== state.providerLiabilityRefundedMinor ||
    target.providerTaxRefundMinor !== state.providerTaxRefundedMinor ||
    target.platformTaxRefundMinor !== state.platformTaxRefundedMinor
  ) {
    throw new Error("KLYX_FINANCE_REFUND_ALLOCATION_MISMATCH");
  }

  if (new Set(state.operationIds).size !== state.operationIds.length) {
    throw new Error("KLYX_FINANCE_OPERATION_DUPLICATE");
  }

  state.events.forEach((entry, index) => {
    if (entry.sequence !== index + 1) {
      throw new Error("KLYX_FINANCE_EVENT_SEQUENCE_INVALID");
    }
    if (entry.currency !== state.currency) {
      throw new Error("KLYX_FINANCE_EVENT_CURRENCY_MISMATCH");
    }
    safeNonNegativeInteger(
      entry.amountMinor,
      "KLYX_FINANCE_EVENT_AMOUNT_INVALID"
    );
  });
}
