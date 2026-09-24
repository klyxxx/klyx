import { describe, expect, it } from "vitest";

import {
  assertFinancialState,
  calculateBasisPointsAmount,
  calculateFinancialBreakdown,
  convertMoney,
  createFinancialState,
  currentProviderLiabilityMinor,
  decimalToMinorUnits,
  fullRefundCharge,
  minorUnitsToDecimal,
  netTransferredMinor,
  outstandingSettlementMinor,
  previewRefundAllocation,
  projectPayout,
  refundCharge,
  requiredReversalMinor,
  reverseTransfer,
  roundFinanceRational,
  settleProviderLiability,
  type CurrencyCatalog,
  type FinancialState,
} from "../../lib/finance-core";

const currencies: CurrencyCatalog = [
  { code: "EUR", minorUnitExponent: 2 },
  { code: "USD", minorUnitExponent: 2 },
  { code: "JPY", minorUnitExponent: 0 },
  { code: "KWD", minorUnitExponent: 3 },
];

function baseState(overrides: Partial<Parameters<typeof createFinancialState>[0]> = {}) {
  return createFinancialState({
    transactionId: "tx-001",
    currency: "EUR",
    grossMinor: 10_000,
    commission: { basisPoints: 1_500 },
    taxes: [],
    ...overrides,
  });
}

function eventTypes(state: FinancialState) {
  return state.events.map((entry) => entry.type);
}

describe("KLYX pure finance currency and rounding primitives", () => {
  it("supports zero-decimal, two-decimal and three-decimal policies without a built-in currency list", () => {
    expect(decimalToMinorUnits("123.4", "JPY", currencies)).toBe(123);
    expect(decimalToMinorUnits("123.5", "JPY", currencies)).toBe(124);
    expect(decimalToMinorUnits("10.005", "EUR", currencies)).toBe(1001);
    expect(decimalToMinorUnits("12.3454", "KWD", currencies)).toBe(12345);
    expect(decimalToMinorUnits("12.3455", "KWD", currencies)).toBe(12346);

    expect(minorUnitsToDecimal(124, "JPY", currencies)).toBe("124");
    expect(minorUnitsToDecimal(1001, "EUR", currencies)).toBe("10.01");
    expect(minorUnitsToDecimal(12346, "KWD", currencies)).toBe("12.346");
  });

  it("uses canonical half-up rounding for positive and negative rationals", () => {
    expect(roundFinanceRational(5n, 2n)).toBe(3);
    expect(roundFinanceRational(4n, 2n)).toBe(2);
    expect(roundFinanceRational(-5n, 2n)).toBe(-3);
    expect(roundFinanceRational(-4n, 2n)).toBe(-2);
  });

  it("calculates basis points with integer arithmetic only", () => {
    expect(calculateBasisPointsAmount(999, 1500)).toBe(150);
    expect(calculateBasisPointsAmount(1, 5000)).toBe(1);
    expect(calculateBasisPointsAmount(1, 4999)).toBe(0);
  });

  it("fails closed when a currency policy is missing or duplicated", () => {
    expect(() => decimalToMinorUnits("1", "CHF", currencies)).toThrow(
      "KLYX_FINANCE_CURRENCY_POLICY_MISSING"
    );
    expect(() =>
      decimalToMinorUnits("1", "EUR", [
        ...currencies,
        { code: "eur", minorUnitExponent: 2 },
      ])
    ).toThrow("KLYX_FINANCE_CURRENCY_POLICY_DUPLICATE");
  });

  it("rejects invalid decimal and unsafe money inputs", () => {
    expect(() => decimalToMinorUnits("NaN", "EUR", currencies)).toThrow(
      "KLYX_FINANCE_DECIMAL_INVALID"
    );
    expect(() => minorUnitsToDecimal(1.2, "EUR", currencies)).toThrow(
      "KLYX_FINANCE_MINOR_UNITS_INVALID"
    );
    expect(() => roundFinanceRational(1n, 0n)).toThrow(
      "KLYX_FINANCE_DENOMINATOR_INVALID"
    );
  });
});

describe("KLYX pure finance FX", () => {
  it("converts major-unit FX ratios exactly across equal exponents", () => {
    expect(
      convertMoney(
        { amountMinor: 10_00, currency: "EUR" },
        "USD",
        {
          id: "fx-eur-usd",
          sourceCurrency: "EUR",
          targetCurrency: "USD",
          numerator: "11",
          denominator: "10",
        },
        currencies
      )
    ).toEqual({ amountMinor: 11_00, currency: "USD" });
  });

  it("accounts for different minor-unit exponents", () => {
    expect(
      convertMoney(
        { amountMinor: 10_00, currency: "USD" },
        "JPY",
        {
          id: "fx-usd-jpy",
          sourceCurrency: "USD",
          targetCurrency: "JPY",
          numerator: "150",
          denominator: "1",
        },
        currencies
      )
    ).toEqual({ amountMinor: 1500, currency: "JPY" });

    expect(
      convertMoney(
        { amountMinor: 1000, currency: "JPY" },
        "KWD",
        {
          id: "fx-jpy-kwd",
          sourceCurrency: "JPY",
          targetCurrency: "KWD",
          numerator: "2",
          denominator: "1000",
        },
        currencies
      )
    ).toEqual({ amountMinor: 2000, currency: "KWD" });
  });

  it("requires an explicit rate for cross-currency conversion", () => {
    expect(() =>
      convertMoney({ amountMinor: 100, currency: "EUR" }, "USD", null, currencies)
    ).toThrow("KLYX_FINANCE_FX_RATE_REQUIRED");
  });

  it("rejects mismatched or non-rational FX inputs", () => {
    expect(() =>
      convertMoney(
        { amountMinor: 100, currency: "EUR" },
        "USD",
        {
          id: "wrong",
          sourceCurrency: "JPY",
          targetCurrency: "USD",
          numerator: "1",
          denominator: "1",
        },
        currencies
      )
    ).toThrow("KLYX_FINANCE_FX_CURRENCY_MISMATCH");

    expect(() =>
      convertMoney(
        { amountMinor: 100, currency: "EUR" },
        "USD",
        {
          id: "bad",
          sourceCurrency: "EUR",
          targetCurrency: "USD",
          numerator: "1.1",
          denominator: "1",
        },
        currencies
      )
    ).toThrow("KLYX_FINANCE_FX_NUMERATOR_INVALID");
  });
});

describe("KLYX pure finance commission, taxes and liability", () => {
  it("computes commission, platform tax and provider withholding deterministically", () => {
    const breakdown = calculateFinancialBreakdown({
      grossMinor: 10_000,
      commission: { basisPoints: 1_500, fixedMinor: 25 },
      taxes: [
        {
          id: "vat-platform",
          basis: "commission",
          bearer: "platform",
          basisPoints: 2_100,
        },
        {
          id: "withholding-provider",
          basis: "gross",
          bearer: "provider",
          basisPoints: 500,
        },
      ],
    });

    expect(breakdown).toMatchObject({
      grossMinor: 10_000,
      commissionMinor: 1_525,
      platformTaxMinor: 320,
      providerTaxMinor: 500,
      platformNetMinor: 1_205,
      providerLiabilityMinor: 7_975,
    });
    expect(
      breakdown.commissionMinor +
        breakdown.providerTaxMinor +
        breakdown.providerLiabilityMinor
    ).toBe(breakdown.grossMinor);
    expect(breakdown.platformNetMinor + breakdown.platformTaxMinor).toBe(
      breakdown.commissionMinor
    );
  });

  it("rejects commission or taxes that make the economics impossible", () => {
    expect(() =>
      calculateFinancialBreakdown({
        grossMinor: 100,
        commission: { basisPoints: 10_000, fixedMinor: 1 },
      })
    ).toThrow("KLYX_FINANCE_COMMISSION_EXCEEDS_GROSS");

    expect(() =>
      calculateFinancialBreakdown({
        grossMinor: 100,
        commission: { basisPoints: 100 },
        taxes: [
          {
            id: "too-much-platform-tax",
            basis: "gross",
            bearer: "platform",
            basisPoints: 500,
          },
        ],
      })
    ).toThrow("KLYX_FINANCE_PLATFORM_TAX_EXCEEDS_COMMISSION");
  });

  it("rejects duplicate tax identifiers", () => {
    expect(() =>
      calculateFinancialBreakdown({
        grossMinor: 1000,
        commission: { basisPoints: 1000 },
        taxes: [
          { id: "tax", basis: "gross", bearer: "provider", basisPoints: 100 },
          { id: "tax", basis: "gross", bearer: "provider", basisPoints: 100 },
        ],
      })
    ).toThrow("KLYX_FINANCE_TAX_ID_DUPLICATE");
  });
});

describe("KLYX pure finance canonical ledger", () => {
  it("starts with charge → commission → provider liability", () => {
    const state = baseState();
    expect(eventTypes(state)).toEqual([
      "charge",
      "commission",
      "provider_liability",
    ]);
    expect(state.breakdown).toMatchObject({
      grossMinor: 10_000,
      commissionMinor: 1_500,
      providerLiabilityMinor: 8_500,
    });
    expect(outstandingSettlementMinor(state)).toBe(8_500);
    assertFinancialState(state);
  });

  it("settles provider liability without exceeding it", () => {
    let state = baseState();
    state = settleProviderLiability(state, {
      operationId: "settle-1",
      amountMinor: 3_000,
    });
    expect(netTransferredMinor(state)).toBe(3_000);
    expect(outstandingSettlementMinor(state)).toBe(5_500);

    state = settleProviderLiability(state, { operationId: "settle-2" });
    expect(netTransferredMinor(state)).toBe(8_500);
    expect(outstandingSettlementMinor(state)).toBe(0);
    expect(eventTypes(state).slice(-2)).toEqual(["transfer", "transfer"]);

    expect(() =>
      settleProviderLiability(state, {
        operationId: "settle-too-much",
        amountMinor: 1,
      })
    ).toThrow("KLYX_FINANCE_SETTLEMENT_ZERO");
  });

  it("supports explicit transfer reversals", () => {
    let state = settleProviderLiability(baseState(), {
      operationId: "settle-all",
    });
    state = reverseTransfer(state, {
      operationId: "reverse-1",
      amountMinor: 1_000,
    });

    expect(netTransferredMinor(state)).toBe(7_500);
    expect(outstandingSettlementMinor(state)).toBe(1_000);
    expect(state.events.at(-1)?.type).toBe("reversal");
  });

  it("rejects over-transfer and over-reversal", () => {
    const state = baseState();
    expect(() =>
      settleProviderLiability(state, {
        operationId: "too-much",
        amountMinor: 8_501,
      })
    ).toThrow("KLYX_FINANCE_SETTLEMENT_EXCEEDS_LIABILITY");

    const settled = settleProviderLiability(state, {
      operationId: "settle",
      amountMinor: 100,
    });
    expect(() =>
      reverseTransfer(settled, {
        operationId: "reverse-too-much",
        amountMinor: 101,
      })
    ).toThrow("KLYX_FINANCE_REVERSAL_EXCEEDS_TRANSFERRED");
  });
});

describe("KLYX pure finance partial and full refunds", () => {
  it("allocates partial refunds cumulatively with exact conservation", () => {
    let state = createFinancialState({
      transactionId: "tx-refund",
      currency: "EUR",
      grossMinor: 101,
      commission: { basisPoints: 1_500 },
      taxes: [
        {
          id: "provider-tax",
          basis: "gross",
          bearer: "provider",
          basisPoints: 500,
        },
      ],
    });

    const firstTarget = previewRefundAllocation(state, 17);
    expect(
      firstTarget.commissionRefundMinor +
        firstTarget.providerLiabilityRefundMinor +
        firstTarget.providerTaxRefundMinor
    ).toBe(17);

    state = refundCharge(state, {
      operationId: "refund-1",
      amountMinor: 17,
    });
    state = refundCharge(state, {
      operationId: "refund-2",
      amountMinor: 23,
    });
    state = refundCharge(state, {
      operationId: "refund-3",
      amountMinor: 61,
    });

    expect(state.refundedMinor).toBe(101);
    expect(state.commissionRefundedMinor).toBe(state.breakdown.commissionMinor);
    expect(state.providerLiabilityRefundedMinor).toBe(
      state.breakdown.providerLiabilityMinor
    );
    expect(state.providerTaxRefundedMinor).toBe(state.breakdown.providerTaxMinor);
    expect(currentProviderLiabilityMinor(state)).toBe(0);
    assertFinancialState(state);
  });

  it("a sequence of partial refunds reaches the exact same accounting result as one full refund", () => {
    const initial = createFinancialState({
      transactionId: "tx-equivalence",
      currency: "EUR",
      grossMinor: 9_999,
      commission: { basisPoints: 1_733, fixedMinor: 7 },
      taxes: [
        {
          id: "platform-tax",
          basis: "commission",
          bearer: "platform",
          basisPoints: 2_100,
        },
        {
          id: "provider-tax",
          basis: "gross",
          bearer: "provider",
          basisPoints: 375,
        },
      ],
    });

    let partial = refundCharge(initial, {
      operationId: "partial-a",
      amountMinor: 1_111,
    });
    partial = refundCharge(partial, {
      operationId: "partial-b",
      amountMinor: 2_222,
    });
    partial = refundCharge(partial, {
      operationId: "partial-c",
      amountMinor: 3_333,
    });
    partial = refundCharge(partial, {
      operationId: "partial-d",
      amountMinor: 3_333,
    });

    const full = fullRefundCharge(initial, { operationId: "full" });
    expect({
      refundedMinor: partial.refundedMinor,
      commissionRefundedMinor: partial.commissionRefundedMinor,
      providerLiabilityRefundedMinor: partial.providerLiabilityRefundedMinor,
      providerTaxRefundedMinor: partial.providerTaxRefundedMinor,
      platformTaxRefundedMinor: partial.platformTaxRefundedMinor,
    }).toEqual({
      refundedMinor: full.refundedMinor,
      commissionRefundedMinor: full.commissionRefundedMinor,
      providerLiabilityRefundedMinor: full.providerLiabilityRefundedMinor,
      providerTaxRefundedMinor: full.providerTaxRefundedMinor,
      platformTaxRefundedMinor: full.platformTaxRefundedMinor,
    });
  });

  it("automatically reverses only the provider overpayment required by a refund", () => {
    let state = settleProviderLiability(baseState(), {
      operationId: "settle-all",
    });
    state = refundCharge(state, {
      operationId: "partial-refund",
      amountMinor: 2_000,
    });

    expect(state.events.at(-2)?.type).toBe("reversal");
    expect(state.events.at(-1)?.type).toBe("refund");
    expect(requiredReversalMinor(state)).toBe(0);
    expect(netTransferredMinor(state)).toBe(currentProviderLiabilityMinor(state));
    assertFinancialState(state);
  });

  it("supports full refund after full settlement with canonical transfer → reversal → refund order", () => {
    let state = settleProviderLiability(baseState(), {
      operationId: "settle-all",
    });
    state = fullRefundCharge(state, { operationId: "refund-all" });

    expect(eventTypes(state).slice(-3)).toEqual([
      "transfer",
      "reversal",
      "refund",
    ]);
    expect(state.refundedMinor).toBe(state.breakdown.grossMinor);
    expect(netTransferredMinor(state)).toBe(0);
    expect(currentProviderLiabilityMinor(state)).toBe(0);
    expect(requiredReversalMinor(state)).toBe(0);
  });

  it("can expose a pending reversal explicitly when automatic reversal is disabled", () => {
    const settled = settleProviderLiability(baseState(), {
      operationId: "settle-all",
    });
    const refunded = refundCharge(settled, {
      operationId: "refund-no-auto-reversal",
      amountMinor: 2_000,
      autoReverseTransfer: false,
    });

    expect(requiredReversalMinor(refunded)).toBeGreaterThan(0);
    const repaired = reverseTransfer(refunded, {
      operationId: "manual-reversal",
      amountMinor: requiredReversalMinor(refunded),
    });
    expect(requiredReversalMinor(repaired)).toBe(0);
    assertFinancialState(repaired);
  });

  it("rejects refunds beyond the original charge", () => {
    const state = baseState();
    expect(() =>
      refundCharge(state, {
        operationId: "refund-too-much",
        amountMinor: 10_001,
      })
    ).toThrow("KLYX_FINANCE_REFUND_EXCEEDS_CHARGE");
  });
});

describe("KLYX pure finance payout projection", () => {
  it("projects payout from net transferred truth without mutating ledger state", () => {
    const state = settleProviderLiability(baseState(), {
      operationId: "settle-partial",
      amountMinor: 4_000,
    });
    const before = JSON.stringify(state);
    const projection = projectPayout(state, "projection-1");

    expect(projection).toEqual({
      id: `tx-001:projection-1:payout:${state.events.length}`,
      transactionId: "tx-001",
      type: "payout",
      currency: "EUR",
      amountMinor: 4_000,
      basisSequence: state.events.length,
    });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("KLYX pure finance determinism and reproducibility", () => {
  it("replays identical commands into byte-identical JSON state", () => {
    const replay = () => {
      let state = createFinancialState({
        transactionId: "tx-replay",
        currency: "USD",
        grossMinor: 12_345,
        commission: { basisPoints: 1_275, fixedMinor: 9 },
        taxes: [
          {
            id: "tax-a",
            basis: "commission",
            bearer: "platform",
            basisPoints: 1_900,
          },
          {
            id: "tax-b",
            basis: "gross",
            bearer: "provider",
            basisPoints: 275,
          },
        ],
      });
      state = settleProviderLiability(state, {
        operationId: "settlement",
        amountMinor: 5_000,
      });
      state = refundCharge(state, {
        operationId: "refund",
        amountMinor: 2_345,
      });
      return state;
    };

    expect(JSON.stringify(replay())).toBe(JSON.stringify(replay()));
  });

  it("rejects replay of the same operation id", () => {
    const settled = settleProviderLiability(baseState(), {
      operationId: "same-id",
      amountMinor: 100,
    });
    expect(() =>
      settleProviderLiability(settled, {
        operationId: "same-id",
        amountMinor: 100,
      })
    ).toThrow("KLYX_FINANCE_OPERATION_DUPLICATE");
  });

  it("preserves cent-level conservation across a broad deterministic matrix", () => {
    for (let gross = 1; gross <= 2_000; gross += 37) {
      for (const bps of [0, 1, 125, 999, 1500, 3333, 5000, 10000]) {
        const breakdown = calculateFinancialBreakdown({
          grossMinor: gross,
          commission: { basisPoints: bps },
        });
        expect(
          breakdown.commissionMinor + breakdown.providerLiabilityMinor
        ).toBe(gross);

        const state = createFinancialState({
          transactionId: `matrix-${gross}-${bps}`,
          currency: "JPY",
          grossMinor: gross,
          commission: { basisPoints: bps },
        });
        assertFinancialState(state);
      }
    }
  });

  it("full-refund conservation holds across many awkward minor-unit totals", () => {
    for (let gross = 1; gross <= 1_000; gross += 29) {
      const initial = createFinancialState({
        transactionId: `refund-matrix-${gross}`,
        currency: "KWD",
        grossMinor: gross,
        commission: { basisPoints: 1_733 },
        taxes: [
          {
            id: "provider-tax",
            basis: "gross",
            bearer: "provider",
            basisPoints: 211,
          },
        ],
      });
      const full = fullRefundCharge(initial, { operationId: "full" });
      expect(
        full.commissionRefundedMinor +
          full.providerLiabilityRefundedMinor +
          full.providerTaxRefundedMinor
      ).toBe(gross);
      expect(currentProviderLiabilityMinor(full)).toBe(0);
      assertFinancialState(full);
    }
  });
});
