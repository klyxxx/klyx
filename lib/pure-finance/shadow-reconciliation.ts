import { createFinancialState } from "./engine";
import { projectFinancialStateToCanonicalLedger } from "./ledger-projection";
import {
  requiredFinanceText,
  safeNonNegativeFinanceInteger,
} from "./math";
import { normalizeFinanceCurrency } from "./money";

export type PureFinanceObservedRecognition = {
  amountMinor: number;
  currency: string;
};

export type PureFinanceRecognitionShadowInput = {
  transactionId: string;
  bookingId: string;
  currency: string;
  grossMinor: number;
  commissionMinor: number;
  providerLiabilityMinor: number;
  observed: {
    charge: PureFinanceObservedRecognition | null;
    commission: PureFinanceObservedRecognition | null;
    providerLiability: PureFinanceObservedRecognition | null;
  };
};

export type PureFinanceShadowDivergence = {
  reasonCode: string;
  expected: Readonly<Record<string, string | number | boolean | null>>;
  actual: Readonly<Record<string, string | number | boolean | null>>;
};

export type PureFinanceRecognitionShadowResult = {
  status: "coherent" | "divergent";
  transactionId: string;
  bookingId: string;
  divergences: readonly PureFinanceShadowDivergence[];
};

function deterministicErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "KLYX_FINANCE_SHADOW_UNKNOWN_ERROR";
  const code = error.message.trim();
  return code || "KLYX_FINANCE_SHADOW_UNKNOWN_ERROR";
}

function compareObservedRecognition(input: {
  movementType: "charge" | "commission" | "provider_liability";
  expectedAmountMinor: number;
  expectedCurrency: string;
  observed: PureFinanceObservedRecognition | null;
}): PureFinanceShadowDivergence | null {
  const label = input.movementType.toUpperCase();

  if (!input.observed) {
    return {
      reasonCode: `PURE_FINANCE_${label}_MISSING`,
      expected: {
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
      },
      actual: {
        amountMinor: null,
        currency: null,
      },
    };
  }

  let actualCurrency = "";
  try {
    actualCurrency = normalizeFinanceCurrency(input.observed.currency);
  } catch (error) {
    return {
      reasonCode: `PURE_FINANCE_${label}_MISMATCH`,
      expected: {
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
      },
      actual: {
        amountMinor: input.observed.amountMinor,
        currency: input.observed.currency,
        invalidCurrency: deterministicErrorCode(error),
      },
    };
  }

  const actualAmountMinor = safeNonNegativeFinanceInteger(
    input.observed.amountMinor,
    `KLYX_FINANCE_SHADOW_${label}_AMOUNT_INVALID`
  );

  if (
    actualAmountMinor === input.expectedAmountMinor &&
    actualCurrency === input.expectedCurrency
  ) {
    return null;
  }

  return {
    reasonCode: `PURE_FINANCE_${label}_MISMATCH`,
    expected: {
      amountMinor: input.expectedAmountMinor,
      currency: input.expectedCurrency,
    },
    actual: {
      amountMinor: actualAmountMinor,
      currency: actualCurrency,
    },
  };
}

export function comparePureFinanceRecognitionShadow(
  input: PureFinanceRecognitionShadowInput
): PureFinanceRecognitionShadowResult {
  const transactionId = requiredFinanceText(
    input.transactionId,
    "KLYX_FINANCE_TRANSACTION_ID_REQUIRED"
  );
  const bookingId = requiredFinanceText(
    input.bookingId,
    "KLYX_FINANCE_LEDGER_BOOKING_REQUIRED"
  );

  const divergences: PureFinanceShadowDivergence[] = [];

  try {
    const currency = normalizeFinanceCurrency(input.currency);
    const grossMinor = safeNonNegativeFinanceInteger(
      input.grossMinor,
      "KLYX_FINANCE_SHADOW_GROSS_INVALID"
    );
    const commissionMinor = safeNonNegativeFinanceInteger(
      input.commissionMinor,
      "KLYX_FINANCE_SHADOW_COMMISSION_INVALID"
    );
    const providerLiabilityMinor = safeNonNegativeFinanceInteger(
      input.providerLiabilityMinor,
      "KLYX_FINANCE_SHADOW_PROVIDER_LIABILITY_INVALID"
    );

    const state = createFinancialState({
      transactionId,
      currency,
      grossMinor,
      commission: {
        basisPoints: 0,
        fixedMinor: commissionMinor,
      },
    });

    if (state.breakdown.providerLiabilityMinor !== providerLiabilityMinor) {
      divergences.push({
        reasonCode: "PURE_FINANCE_PROVIDER_LIABILITY_SOURCE_MISMATCH",
        expected: {
          providerLiabilityMinor: state.breakdown.providerLiabilityMinor,
          grossMinor: state.breakdown.grossMinor,
          commissionMinor: state.breakdown.commissionMinor,
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

    const projected = projectFinancialStateToCanonicalLedger(state, {
      bookingId,
      platformBeneficiaryRef: "klyx-platform",
      clientBeneficiaryRef: "klyx-client-shadow",
      providerBeneficiaryRef: "klyx-provider-shadow",
    });

    for (const definition of [
      {
        movementType: "charge" as const,
        observed: input.observed.charge,
      },
      {
        movementType: "commission" as const,
        observed: input.observed.commission,
      },
      {
        movementType: "provider_liability" as const,
        observed: input.observed.providerLiability,
      },
    ]) {
      const event = projected.find(
        (row) => row.movementType === definition.movementType
      );

      if (!event) {
        divergences.push({
          reasonCode: "PURE_FINANCE_PROJECTION_INCOMPLETE",
          expected: {
            movementType: definition.movementType,
            present: true,
          },
          actual: {
            movementType: definition.movementType,
            present: false,
          },
        });
        continue;
      }

      const mismatch = compareObservedRecognition({
        movementType: definition.movementType,
        expectedAmountMinor: event.amountMinor,
        expectedCurrency: event.currency,
        observed: definition.observed,
      });

      if (mismatch) divergences.push(mismatch);
    }
  } catch (error) {
    divergences.push({
      reasonCode: "PURE_FINANCE_SHADOW_UNREPLAYABLE",
      expected: {
        deterministicReplay: true,
      },
      actual: {
        deterministicReplay: false,
        errorCode: deterministicErrorCode(error),
      },
    });
  }

  return {
    status: divergences.length === 0 ? "coherent" : "divergent",
    transactionId,
    bookingId,
    divergences,
  };
}
