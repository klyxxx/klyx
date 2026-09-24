import { calculateFinancialBreakdown } from "./economics";
import {
  requiredFinanceText,
  safeFinanceIntegerFromBigInt,
  safeNonNegativeFinanceInteger,
} from "./math";
import { normalizeFinanceCurrency } from "./money";
import type {
  CommissionPolicy,
  FinancialEvent,
  FinancialMovementType,
  FinancialState,
  PayoutProjection,
  RefundAllocation,
  TaxRule,
} from "./types";

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
    amountMinor: safeNonNegativeFinanceInteger(
      input.amountMinor,
      "KLYX_FINANCE_EVENT_AMOUNT_INVALID"
    ),
    currency: normalizeFinanceCurrency(input.currency),
    cause: requiredFinanceText(input.cause, "KLYX_FINANCE_EVENT_CAUSE_REQUIRED"),
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
  const normalizedOperationId = requiredFinanceText(
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
  const transactionId = requiredFinanceText(
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
  safeNonNegativeFinanceInteger(total, "KLYX_FINANCE_ALLOCATION_TOTAL_INVALID");
  const totalWeight = buckets.reduce((sum, bucket) => {
    safeNonNegativeFinanceInteger(
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
      floor: safeFinanceIntegerFromBigInt(product / denominator),
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
  const additional = safeNonNegativeFinanceInteger(
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
  safeNonNegativeFinanceInteger(amount, "KLYX_FINANCE_SETTLEMENT_AMOUNT_INVALID");
  if (amount === 0) {
    if (outstanding === 0 && input.amountMinor !== undefined) {
      throw new Error("KLYX_FINANCE_SETTLEMENT_EXCEEDS_LIABILITY");
    }
    throw new Error("KLYX_FINANCE_SETTLEMENT_ZERO");
  }
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
  const amount = safeNonNegativeFinanceInteger(
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

  const amount = safeNonNegativeFinanceInteger(
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
  const id = requiredFinanceText(
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
  requiredFinanceText(state.transactionId, "KLYX_FINANCE_TRANSACTION_ID_REQUIRED");
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
    safeNonNegativeFinanceInteger(amount, "KLYX_FINANCE_STATE_AMOUNT_INVALID")
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
    safeNonNegativeFinanceInteger(
      entry.amountMinor,
      "KLYX_FINANCE_EVENT_AMOUNT_INVALID"
    );
  });
}
