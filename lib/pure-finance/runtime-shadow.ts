import {
  createFinancialState,
  projectPayout,
  refundCharge,
  requiredReversalMinor,
  reverseTransfer,
  settleProviderLiability,
} from "./engine";
import {
  requiredFinanceText,
  safeNonNegativeFinanceInteger,
} from "./math";
import { normalizeFinanceCurrency } from "./money";
import type { FinancialMovementType } from "./types";

export type RuntimeShadowBeneficiaryKind =
  | "platform"
  | "client"
  | "provider"
  | "external";

export type PureFinanceRuntimeObservedMovement = {
  movementKey: string;
  movementType: FinancialMovementType | "payout";
  amountMinor: number;
  currency: string;
  beneficiaryKind: RuntimeShadowBeneficiaryKind;
  beneficiaryRef: string;
  cause: string;
  source: string;
  newState: string;
  occurredAt: string;
};

export type PureFinanceRuntimeShadowDivergence = {
  reasonCode: string;
  movementKey: string | null;
  expected: Readonly<Record<string, string | number | boolean | null>>;
  actual: Readonly<Record<string, string | number | boolean | null>>;
};

export type PureFinanceRuntimeShadowInput = {
  transactionId: string;
  bookingId: string;
  currency: string;
  grossMinor: number;
  commissionMinor: number;
  providerLiabilityMinor: number;
  expectedBeneficiaries: {
    platform: string;
    client: string;
    provider: string;
  };
  observed: readonly PureFinanceRuntimeObservedMovement[];
};

export type PureFinanceRuntimeShadowCertification = {
  status: "coherent" | "divergent";
  runtimeParity: boolean;
  transactionId: string;
  bookingId: string;
  observedMovementCount: number;
  mutationMovementCount: number;
  finalTransferredMinor: number;
  finalReversedMinor: number;
  finalRefundedMinor: number;
  divergences: readonly PureFinanceRuntimeShadowDivergence[];
};

const SOURCE_BY_MOVEMENT: Readonly<
  Record<PureFinanceRuntimeObservedMovement["movementType"], readonly string[]>
> = {
  charge: ["payment_projection", "settlement", "historical_backfill"],
  commission: ["payment_projection", "historical_backfill"],
  provider_liability: [
    "payment_projection",
    "settlement",
    "historical_backfill",
  ],
  transfer: ["payment_projection", "settlement", "historical_backfill"],
  reversal: ["settlement", "refund", "historical_backfill"],
  refund: ["refund", "historical_backfill"],
  payout: ["payout_observation", "historical_backfill"],
};

const MUTATION_ORDER: Readonly<
  Record<"transfer" | "reversal" | "refund" | "payout", number>
> = {
  transfer: 0,
  reversal: 1,
  refund: 2,
  payout: 3,
};

function deterministicErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "KLYX_FINANCE_RUNTIME_SHADOW_UNKNOWN";
  const code = error.message.trim();
  return code || "KLYX_FINANCE_RUNTIME_SHADOW_UNKNOWN";
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeMovement(
  movement: PureFinanceRuntimeObservedMovement
): PureFinanceRuntimeObservedMovement {
  return {
    movementKey: requiredFinanceText(
      movement.movementKey,
      "KLYX_FINANCE_RUNTIME_SHADOW_MOVEMENT_KEY_REQUIRED"
    ),
    movementType: movement.movementType,
    amountMinor: safeNonNegativeFinanceInteger(
      movement.amountMinor,
      "KLYX_FINANCE_RUNTIME_SHADOW_AMOUNT_INVALID"
    ),
    currency: normalizeFinanceCurrency(movement.currency),
    beneficiaryKind: movement.beneficiaryKind,
    beneficiaryRef: requiredFinanceText(
      movement.beneficiaryRef,
      "KLYX_FINANCE_RUNTIME_SHADOW_BENEFICIARY_REQUIRED"
    ),
    cause: requiredFinanceText(
      movement.cause,
      "KLYX_FINANCE_RUNTIME_SHADOW_CAUSE_REQUIRED"
    ),
    source: requiredFinanceText(
      movement.source,
      "KLYX_FINANCE_RUNTIME_SHADOW_SOURCE_REQUIRED"
    ),
    newState: requiredFinanceText(
      movement.newState,
      "KLYX_FINANCE_RUNTIME_SHADOW_STATE_REQUIRED"
    ),
    occurredAt: requiredFinanceText(
      movement.occurredAt,
      "KLYX_FINANCE_RUNTIME_SHADOW_OCCURRED_AT_REQUIRED"
    ),
  };
}

function beneficiaryForMovement(
  movementType: PureFinanceRuntimeObservedMovement["movementType"],
  expected: PureFinanceRuntimeShadowInput["expectedBeneficiaries"]
): { kind: RuntimeShadowBeneficiaryKind; ref: string } {
  switch (movementType) {
    case "charge":
    case "commission":
    case "reversal":
      return { kind: "platform", ref: expected.platform };
    case "refund":
      return { kind: "client", ref: expected.client };
    case "provider_liability":
    case "transfer":
    case "payout":
      return { kind: "provider", ref: expected.provider };
  }
}

function movementPriority(
  movement: PureFinanceRuntimeObservedMovement
): number {
  if (
    movement.movementType === "transfer" ||
    movement.movementType === "reversal" ||
    movement.movementType === "refund" ||
    movement.movementType === "payout"
  ) {
    return MUTATION_ORDER[movement.movementType];
  }
  return -1;
}

function sortedMutations(
  rows: readonly PureFinanceRuntimeObservedMovement[]
): PureFinanceRuntimeObservedMovement[] {
  return rows
    .filter(
      (row) =>
        row.movementType === "transfer" ||
        row.movementType === "reversal" ||
        row.movementType === "refund" ||
        row.movementType === "payout"
    )
    .sort((left, right) => {
      const timeOrder = compareText(left.occurredAt, right.occurredAt);
      if (timeOrder !== 0) return timeOrder;
      const priorityOrder = movementPriority(left) - movementPriority(right);
      if (priorityOrder !== 0) return priorityOrder;
      return compareText(left.movementKey, right.movementKey);
    });
}

function pushMovementSemanticsDivergences(
  movement: PureFinanceRuntimeObservedMovement,
  input: PureFinanceRuntimeShadowInput,
  divergences: PureFinanceRuntimeShadowDivergence[]
): void {
  const expectedCurrency = normalizeFinanceCurrency(input.currency);
  if (movement.currency !== expectedCurrency) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_CURRENCY_MISMATCH",
      movementKey: movement.movementKey,
      expected: { currency: expectedCurrency },
      actual: { currency: movement.currency },
    });
  }

  const expectedBeneficiary = beneficiaryForMovement(
    movement.movementType,
    input.expectedBeneficiaries
  );
  if (
    movement.beneficiaryKind !== expectedBeneficiary.kind ||
    movement.beneficiaryRef !== expectedBeneficiary.ref
  ) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_BENEFICIARY_MISMATCH",
      movementKey: movement.movementKey,
      expected: {
        beneficiaryKind: expectedBeneficiary.kind,
        beneficiaryRef: expectedBeneficiary.ref,
      },
      actual: {
        beneficiaryKind: movement.beneficiaryKind,
        beneficiaryRef: movement.beneficiaryRef,
      },
    });
  }

  if (!SOURCE_BY_MOVEMENT[movement.movementType].includes(movement.source)) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_SOURCE_INVALID",
      movementKey: movement.movementKey,
      expected: {
        sourceAllowed: SOURCE_BY_MOVEMENT[movement.movementType].join(","),
      },
      actual: { source: movement.source },
    });
  }
}

function checkRecognition(
  rows: readonly PureFinanceRuntimeObservedMovement[],
  movementType: "charge" | "commission" | "provider_liability",
  amountMinor: number,
  input: PureFinanceRuntimeShadowInput,
  divergences: PureFinanceRuntimeShadowDivergence[]
): void {
  const matching = rows.filter((row) => row.movementType === movementType);
  if (matching.length !== 1) {
    divergences.push({
      reasonCode: `PURE_FINANCE_RUNTIME_${movementType.toUpperCase()}_CARDINALITY`,
      movementKey: null,
      expected: { count: 1, movementType },
      actual: { count: matching.length, movementType },
    });
  }

  for (const row of matching) {
    pushMovementSemanticsDivergences(row, input, divergences);
  }

  const observed = matching[0];
  if (!observed) return;
  const expectedCurrency = normalizeFinanceCurrency(input.currency);
  if (
    observed.amountMinor !== amountMinor ||
    observed.currency !== expectedCurrency
  ) {
    divergences.push({
      reasonCode: `PURE_FINANCE_RUNTIME_${movementType.toUpperCase()}_MISMATCH`,
      movementKey: observed.movementKey,
      expected: { amountMinor, currency: expectedCurrency },
      actual: {
        amountMinor: observed.amountMinor,
        currency: observed.currency,
      },
    });
  }
}

export function certifyPureFinanceRuntimeShadow(
  input: PureFinanceRuntimeShadowInput
): PureFinanceRuntimeShadowCertification {
  const transactionId = requiredFinanceText(
    input.transactionId,
    "KLYX_FINANCE_TRANSACTION_ID_REQUIRED"
  );
  const bookingId = requiredFinanceText(
    input.bookingId,
    "KLYX_FINANCE_LEDGER_BOOKING_REQUIRED"
  );
  const currency = normalizeFinanceCurrency(input.currency);
  const grossMinor = safeNonNegativeFinanceInteger(
    input.grossMinor,
    "KLYX_FINANCE_RUNTIME_SHADOW_GROSS_INVALID"
  );
  const commissionMinor = safeNonNegativeFinanceInteger(
    input.commissionMinor,
    "KLYX_FINANCE_RUNTIME_SHADOW_COMMISSION_INVALID"
  );
  const providerLiabilityMinor = safeNonNegativeFinanceInteger(
    input.providerLiabilityMinor,
    "KLYX_FINANCE_RUNTIME_SHADOW_PROVIDER_LIABILITY_INVALID"
  );

  const divergences: PureFinanceRuntimeShadowDivergence[] = [];
  let rows: PureFinanceRuntimeObservedMovement[] = [];
  let state = createFinancialState({
    transactionId,
    currency,
    grossMinor,
    commission: { basisPoints: 0, fixedMinor: commissionMinor },
  });

  if (state.breakdown.providerLiabilityMinor !== providerLiabilityMinor) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_PROVIDER_LIABILITY_SOURCE_MISMATCH",
      movementKey: null,
      expected: {
        providerLiabilityMinor: state.breakdown.providerLiabilityMinor,
        grossMinor,
        commissionMinor,
        currency,
      },
      actual: {
        providerLiabilityMinor,
        grossMinor,
        commissionMinor,
        currency,
      },
    });
  }

  try {
    rows = input.observed.map(normalizeMovement);
  } catch (error) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_OBSERVATION_INVALID",
      movementKey: null,
      expected: { validObservation: true },
      actual: {
        validObservation: false,
        errorCode: deterministicErrorCode(error),
      },
    });

    return {
      status: "divergent",
      runtimeParity: false,
      transactionId,
      bookingId,
      observedMovementCount: input.observed.length,
      mutationMovementCount: 0,
      finalTransferredMinor: state.transferredMinor,
      finalReversedMinor: state.reversedMinor,
      finalRefundedMinor: state.refundedMinor,
      divergences,
    };
  }

  checkRecognition(rows, "charge", grossMinor, input, divergences);
  checkRecognition(rows, "commission", commissionMinor, input, divergences);
  checkRecognition(
    rows,
    "provider_liability",
    providerLiabilityMinor,
    input,
    divergences
  );

  const mutations = sortedMutations(rows);
  for (const movement of mutations) {
    pushMovementSemanticsDivergences(movement, input, divergences);
    const operationId = `runtime:${movement.movementKey}`;

    try {
      switch (movement.movementType) {
        case "transfer":
          state = settleProviderLiability(state, {
            operationId,
            amountMinor: movement.amountMinor,
            cause: movement.cause,
          });
          break;
        case "reversal":
          state = reverseTransfer(state, {
            operationId,
            amountMinor: movement.amountMinor,
            cause: movement.cause,
          });
          break;
        case "refund":
          state = refundCharge(state, {
            operationId,
            amountMinor: movement.amountMinor,
            cause: movement.cause,
            autoReverseTransfer: false,
          });
          break;
        case "payout": {
          const projected = projectPayout(state, operationId);
          if (
            projected.amountMinor !== movement.amountMinor ||
            projected.currency !== movement.currency
          ) {
            divergences.push({
              reasonCode: "PURE_FINANCE_RUNTIME_PAYOUT_MISMATCH",
              movementKey: movement.movementKey,
              expected: {
                amountMinor: projected.amountMinor,
                currency: projected.currency,
              },
              actual: {
                amountMinor: movement.amountMinor,
                currency: movement.currency,
              },
            });
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      divergences.push({
        reasonCode: `PURE_FINANCE_RUNTIME_${movement.movementType.toUpperCase()}_UNREPLAYABLE`,
        movementKey: movement.movementKey,
        expected: { deterministicReplay: true },
        actual: {
          deterministicReplay: false,
          errorCode: deterministicErrorCode(error),
        },
      });
    }
  }

  const reversalRequired = requiredReversalMinor(state);
  if (reversalRequired > 0) {
    divergences.push({
      reasonCode: "PURE_FINANCE_RUNTIME_REQUIRED_REVERSAL_MISSING",
      movementKey: null,
      expected: { requiredReversalMinor: 0 },
      actual: { requiredReversalMinor: reversalRequired },
    });
  }

  divergences.sort((left, right) => {
    const leftKey = left.movementKey ?? "";
    const rightKey = right.movementKey ?? "";
    const keyOrder = compareText(leftKey, rightKey);
    if (keyOrder !== 0) return keyOrder;
    return compareText(left.reasonCode, right.reasonCode);
  });

  const coherent = divergences.length === 0;
  return {
    status: coherent ? "coherent" : "divergent",
    runtimeParity: coherent,
    transactionId,
    bookingId,
    observedMovementCount: rows.length,
    mutationMovementCount: mutations.length,
    finalTransferredMinor: state.transferredMinor,
    finalReversedMinor: state.reversedMinor,
    finalRefundedMinor: state.refundedMinor,
    divergences,
  };
}
