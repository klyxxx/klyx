import {
  assertFinancialState,
} from "./engine";
import {
  requiredFinanceText,
  safeNonNegativeFinanceInteger,
} from "./math";
import { normalizeFinanceCurrency } from "./money";
import type {
  FinancialEvent,
  FinancialMovementType,
  FinancialState,
  PayoutProjection,
} from "./types";

export type CanonicalLedgerMovementType = FinancialMovementType | "payout";

export type CanonicalLedgerBeneficiaryKind =
  | "platform"
  | "client"
  | "provider";

export type CanonicalLedgerProjectionSource =
  | "payment_projection"
  | "settlement"
  | "refund";

export type CanonicalLedgerProjectionContext = {
  bookingId: string;
  platformBeneficiaryRef: string;
  clientBeneficiaryRef: string;
  providerBeneficiaryRef: string;
};

export type CanonicalLedgerProjectionEvent = {
  version: 1;
  transactionId: string;
  bookingId: string;
  eventKey: string;
  movementKey: string;
  movementType: CanonicalLedgerMovementType;
  amountMinor: number;
  currency: string;
  beneficiaryKind: CanonicalLedgerBeneficiaryKind;
  beneficiaryRef: string;
  cause: string;
  source: CanonicalLedgerProjectionSource;
  newState: string;
  operationId: string;
  sequence: number;
  pureFinanceEventId?: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
};

type NormalizedProjectionContext = CanonicalLedgerProjectionContext;

function normalizeProjectionContext(
  context: CanonicalLedgerProjectionContext
): NormalizedProjectionContext {
  return {
    bookingId: requiredFinanceText(
      context.bookingId,
      "KLYX_FINANCE_LEDGER_BOOKING_REQUIRED"
    ),
    platformBeneficiaryRef: requiredFinanceText(
      context.platformBeneficiaryRef,
      "KLYX_FINANCE_LEDGER_PLATFORM_REQUIRED"
    ),
    clientBeneficiaryRef: requiredFinanceText(
      context.clientBeneficiaryRef,
      "KLYX_FINANCE_LEDGER_CLIENT_REQUIRED"
    ),
    providerBeneficiaryRef: requiredFinanceText(
      context.providerBeneficiaryRef,
      "KLYX_FINANCE_LEDGER_PROVIDER_REQUIRED"
    ),
  };
}

function beneficiaryForEvent(
  event: FinancialEvent,
  context: NormalizedProjectionContext
): Pick<CanonicalLedgerProjectionEvent, "beneficiaryKind" | "beneficiaryRef"> {
  switch (event.type) {
    case "charge":
    case "commission":
    case "reversal":
      return {
        beneficiaryKind: "platform",
        beneficiaryRef: context.platformBeneficiaryRef,
      };
    case "provider_liability":
    case "transfer":
      return {
        beneficiaryKind: "provider",
        beneficiaryRef: context.providerBeneficiaryRef,
      };
    case "refund":
      return {
        beneficiaryKind: "client",
        beneficiaryRef: context.clientBeneficiaryRef,
      };
  }
}

function sourceForEvent(event: FinancialEvent): CanonicalLedgerProjectionSource {
  switch (event.type) {
    case "charge":
    case "commission":
    case "provider_liability":
      return "payment_projection";
    case "transfer":
      return "settlement";
    case "reversal":
      return event.details.refundOperation ? "refund" : "settlement";
    case "refund":
      return "refund";
  }
}

function stateForEvent(event: FinancialEvent): string {
  switch (event.type) {
    case "charge":
    case "commission":
    case "provider_liability":
      return "recognized";
    case "transfer":
      return "released";
    case "reversal":
      return "reversed";
    case "refund":
      return "refunded";
  }
}

function movementKeyForEvent(
  transactionId: string,
  event: FinancialEvent
): string {
  if (
    event.type === "charge" ||
    event.type === "commission" ||
    event.type === "provider_liability"
  ) {
    return `pure-finance:${transactionId}:${event.type}`;
  }

  return `pure-finance:${transactionId}:${event.type}:${event.operationId}`;
}

export function projectFinancialStateToCanonicalLedger(
  state: FinancialState,
  context: CanonicalLedgerProjectionContext
): readonly CanonicalLedgerProjectionEvent[] {
  assertFinancialState(state, { allowPendingReversal: true });
  const normalized = normalizeProjectionContext(context);

  return state.events.map((event) => {
    const beneficiary = beneficiaryForEvent(event, normalized);
    return {
      version: 1,
      transactionId: state.transactionId,
      bookingId: normalized.bookingId,
      eventKey: `pure-finance:${event.id}`,
      movementKey: movementKeyForEvent(state.transactionId, event),
      movementType: event.type,
      amountMinor: event.amountMinor,
      currency: state.currency,
      beneficiaryKind: beneficiary.beneficiaryKind,
      beneficiaryRef: beneficiary.beneficiaryRef,
      cause: event.cause,
      source: sourceForEvent(event),
      newState: stateForEvent(event),
      operationId: event.operationId,
      sequence: event.sequence,
      pureFinanceEventId: event.id,
      details: {
        ...event.details,
        pureFinanceEventId: event.id,
        pureFinanceOperationId: event.operationId,
        pureFinanceSequence: event.sequence,
      },
    };
  });
}

export function projectPayoutToCanonicalLedger(
  payout: PayoutProjection,
  context: CanonicalLedgerProjectionContext
): CanonicalLedgerProjectionEvent {
  const normalized = normalizeProjectionContext(context);
  const transactionId = requiredFinanceText(
    payout.transactionId,
    "KLYX_FINANCE_TRANSACTION_ID_REQUIRED"
  );
  const payoutId = requiredFinanceText(
    payout.id,
    "KLYX_FINANCE_PAYOUT_PROJECTION_ID_REQUIRED"
  );
  const amountMinor = safeNonNegativeFinanceInteger(
    payout.amountMinor,
    "KLYX_FINANCE_PAYOUT_AMOUNT_INVALID"
  );
  const currency = normalizeFinanceCurrency(payout.currency);
  const sequence = safeNonNegativeFinanceInteger(
    payout.basisSequence,
    "KLYX_FINANCE_PAYOUT_SEQUENCE_INVALID"
  );

  return {
    version: 1,
    transactionId,
    bookingId: normalized.bookingId,
    eventKey: `pure-finance:${payoutId}`,
    movementKey: `pure-finance:${transactionId}:payout:${payoutId}`,
    movementType: "payout",
    amountMinor,
    currency,
    beneficiaryKind: "provider",
    beneficiaryRef: normalized.providerBeneficiaryRef,
    cause: "payout_projected",
    source: "settlement",
    newState: "projected",
    operationId: payoutId,
    sequence,
    details: {
      payoutProjectionId: payoutId,
      pureFinanceBasisSequence: sequence,
    },
  };
}
