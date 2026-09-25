import {
  fullRefundCharge,
  projectPayout,
  refundCharge,
  reverseTransfer,
  settleProviderLiability,
  createFinancialState,
} from "./engine";
import {
  projectFinancialStateToCanonicalLedger,
  projectPayoutToCanonicalLedger,
  type CanonicalLedgerBeneficiaryKind,
  type CanonicalLedgerMovementType,
  type CanonicalLedgerProjectionContext,
  type CanonicalLedgerProjectionEvent,
  type CanonicalLedgerProjectionSource,
} from "./ledger-projection";
import { safeNonNegativeFinanceInteger } from "./math";
import { normalizeFinanceCurrency } from "./money";
import type { CommissionPolicy, TaxRule } from "./types";

export type PureFinanceCutoverCommand =
  | {
      type: "settle";
      operationId: string;
      amountMinor?: number;
      cause?: string;
    }
  | {
      type: "reverse";
      operationId: string;
      amountMinor: number;
      cause?: string;
    }
  | {
      type: "refund";
      operationId: string;
      amountMinor: number;
      cause?: string;
      autoReverseTransfer?: boolean;
    }
  | {
      type: "full_refund";
      operationId: string;
      cause?: string;
      autoReverseTransfer?: boolean;
    }
  | {
      type: "project_payout";
      projectionId: string;
    };

export type ObservedCanonicalLedgerMovement = {
  movementKey: string;
  movementType: CanonicalLedgerMovementType;
  amountMinor: number;
  currency: string;
  beneficiaryKind: CanonicalLedgerBeneficiaryKind;
  beneficiaryRef: string;
  cause: string;
  source: CanonicalLedgerProjectionSource;
  newState: string;
};

export type PureFinanceCutoverDivergence = {
  reasonCode: string;
  movementKey: string | null;
  expected: Readonly<Record<string, string | number | boolean | null>>;
  actual: Readonly<Record<string, string | number | boolean | null>>;
};

export type PureFinanceCutoverCertificationResult = {
  status: "coherent" | "divergent";
  cutoverReady: boolean;
  transactionId: string;
  bookingId: string;
  expectedMovementCount: number;
  observedMovementCount: number;
  expected: readonly ObservedCanonicalLedgerMovement[];
  divergences: readonly PureFinanceCutoverDivergence[];
};

export type PureFinanceCutoverCertificationInput = {
  transactionId: string;
  bookingId: string;
  currency: string;
  grossMinor: number;
  commission: CommissionPolicy;
  taxes?: readonly TaxRule[];
  projectionContext: Omit<CanonicalLedgerProjectionContext, "bookingId">;
  commands?: readonly PureFinanceCutoverCommand[];
  observed: readonly ObservedCanonicalLedgerMovement[];
};

function deterministicErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "KLYX_FINANCE_CUTOVER_UNKNOWN_ERROR";
  const code = error.message.trim();
  return code || "KLYX_FINANCE_CUTOVER_UNKNOWN_ERROR";
}

function normalizeProjectedMovement(
  event: CanonicalLedgerProjectionEvent
): ObservedCanonicalLedgerMovement {
  return {
    movementKey: event.movementKey,
    movementType: event.movementType,
    amountMinor: event.amountMinor,
    currency: event.currency,
    beneficiaryKind: event.beneficiaryKind,
    beneficiaryRef: event.beneficiaryRef,
    cause: event.cause,
    source: event.source,
    newState: event.newState,
  };
}

function normalizeObservedMovement(
  movement: ObservedCanonicalLedgerMovement
): ObservedCanonicalLedgerMovement {
  return {
    movementKey: movement.movementKey.trim(),
    movementType: movement.movementType,
    amountMinor: safeNonNegativeFinanceInteger(
      movement.amountMinor,
      "KLYX_FINANCE_CUTOVER_OBSERVED_AMOUNT_INVALID"
    ),
    currency: normalizeFinanceCurrency(movement.currency),
    beneficiaryKind: movement.beneficiaryKind,
    beneficiaryRef: movement.beneficiaryRef.trim(),
    cause: movement.cause.trim(),
    source: movement.source,
    newState: movement.newState.trim(),
  };
}

function compareTextOrder(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedMovements(
  movements: readonly ObservedCanonicalLedgerMovement[]
): ObservedCanonicalLedgerMovement[] {
  return [...movements].sort((left, right) => {
    const key = compareTextOrder(left.movementKey, right.movementKey);
    if (key !== 0) return key;
    return compareTextOrder(left.movementType, right.movementType);
  });
}

function movementRecord(
  movement: ObservedCanonicalLedgerMovement
): Readonly<Record<string, string | number | boolean | null>> {
  return {
    movementType: movement.movementType,
    amountMinor: movement.amountMinor,
    currency: movement.currency,
    beneficiaryKind: movement.beneficiaryKind,
    beneficiaryRef: movement.beneficiaryRef,
    cause: movement.cause,
    source: movement.source,
    newState: movement.newState,
  };
}

function sameMovement(
  expected: ObservedCanonicalLedgerMovement,
  actual: ObservedCanonicalLedgerMovement
): boolean {
  return (
    expected.movementType === actual.movementType &&
    expected.amountMinor === actual.amountMinor &&
    expected.currency === actual.currency &&
    expected.beneficiaryKind === actual.beneficiaryKind &&
    expected.beneficiaryRef === actual.beneficiaryRef &&
    expected.cause === actual.cause &&
    expected.source === actual.source &&
    expected.newState === actual.newState
  );
}

export function projectPureFinanceCutoverChain(
  input: Omit<PureFinanceCutoverCertificationInput, "observed">
): readonly ObservedCanonicalLedgerMovement[] {
  let state = createFinancialState({
    transactionId: input.transactionId,
    currency: input.currency,
    grossMinor: input.grossMinor,
    commission: input.commission,
    taxes: input.taxes,
  });

  const context: CanonicalLedgerProjectionContext = {
    bookingId: input.bookingId,
    ...input.projectionContext,
  };
  const payoutEvents: CanonicalLedgerProjectionEvent[] = [];

  for (const command of input.commands ?? []) {
    switch (command.type) {
      case "settle":
        state = settleProviderLiability(state, {
          operationId: command.operationId,
          amountMinor: command.amountMinor,
          cause: command.cause,
        });
        break;
      case "reverse":
        state = reverseTransfer(state, {
          operationId: command.operationId,
          amountMinor: command.amountMinor,
          cause: command.cause,
        });
        break;
      case "refund":
        state = refundCharge(state, {
          operationId: command.operationId,
          amountMinor: command.amountMinor,
          cause: command.cause,
          autoReverseTransfer: command.autoReverseTransfer,
        });
        break;
      case "full_refund":
        state = fullRefundCharge(state, {
          operationId: command.operationId,
          cause: command.cause,
          autoReverseTransfer: command.autoReverseTransfer,
        });
        break;
      case "project_payout":
        payoutEvents.push(
          projectPayoutToCanonicalLedger(
            projectPayout(state, command.projectionId),
            context
          )
        );
        break;
    }
  }

  return sortedMovements([
    ...projectFinancialStateToCanonicalLedger(state, context).map(
      normalizeProjectedMovement
    ),
    ...payoutEvents.map(normalizeProjectedMovement),
  ]);
}

export function certifyPureFinanceCutover(
  input: PureFinanceCutoverCertificationInput
): PureFinanceCutoverCertificationResult {
  const divergences: PureFinanceCutoverDivergence[] = [];
  let expected: readonly ObservedCanonicalLedgerMovement[] = [];
  let observed: readonly ObservedCanonicalLedgerMovement[] = [];

  try {
    expected = projectPureFinanceCutoverChain(input);
    observed = sortedMovements(input.observed.map(normalizeObservedMovement));
  } catch (error) {
    divergences.push({
      reasonCode: "PURE_FINANCE_CUTOVER_UNREPLAYABLE",
      movementKey: null,
      expected: { deterministicReplay: true },
      actual: {
        deterministicReplay: false,
        errorCode: deterministicErrorCode(error),
      },
    });

    return {
      status: "divergent",
      cutoverReady: false,
      transactionId: input.transactionId,
      bookingId: input.bookingId,
      expectedMovementCount: expected.length,
      observedMovementCount: input.observed.length,
      expected,
      divergences,
    };
  }

  const expectedByKey = new Map<string, ObservedCanonicalLedgerMovement>();
  for (const movement of expected) {
    if (expectedByKey.has(movement.movementKey)) {
      divergences.push({
        reasonCode: "PURE_FINANCE_CUTOVER_EXPECTED_KEY_DUPLICATE",
        movementKey: movement.movementKey,
        expected: { unique: true },
        actual: { unique: false },
      });
    } else {
      expectedByKey.set(movement.movementKey, movement);
    }
  }

  const observedByKey = new Map<string, ObservedCanonicalLedgerMovement[]>();
  for (const movement of observed) {
    const bucket = observedByKey.get(movement.movementKey) ?? [];
    bucket.push(movement);
    observedByKey.set(movement.movementKey, bucket);
  }

  for (const expectedMovement of expected) {
    const matches = observedByKey.get(expectedMovement.movementKey) ?? [];
    if (matches.length === 0) {
      divergences.push({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_MISSING",
        movementKey: expectedMovement.movementKey,
        expected: movementRecord(expectedMovement),
        actual: { present: false },
      });
      continue;
    }
    if (matches.length > 1) {
      divergences.push({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_DUPLICATE",
        movementKey: expectedMovement.movementKey,
        expected: { count: 1 },
        actual: { count: matches.length },
      });
      continue;
    }

    const actual = matches[0];
    if (!sameMovement(expectedMovement, actual)) {
      divergences.push({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_MISMATCH",
        movementKey: expectedMovement.movementKey,
        expected: movementRecord(expectedMovement),
        actual: movementRecord(actual),
      });
    }
  }

  for (const [movementKey, matches] of observedByKey) {
    if (!expectedByKey.has(movementKey)) {
      divergences.push({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_UNEXPECTED",
        movementKey,
        expected: { present: false },
        actual: {
          present: true,
          count: matches.length,
        },
      });
    }
  }

  divergences.sort((left, right) => {
    const leftKey = left.movementKey ?? "";
    const rightKey = right.movementKey ?? "";
    const keyOrder = compareTextOrder(leftKey, rightKey);
    if (keyOrder !== 0) return keyOrder;
    return compareTextOrder(left.reasonCode, right.reasonCode);
  });

  const coherent = divergences.length === 0;
  return {
    status: coherent ? "coherent" : "divergent",
    cutoverReady: coherent,
    transactionId: input.transactionId,
    bookingId: input.bookingId,
    expectedMovementCount: expected.length,
    observedMovementCount: observed.length,
    expected,
    divergences,
  };
}
