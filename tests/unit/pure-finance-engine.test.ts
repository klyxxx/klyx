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
} from "../../lib/pure-finance-engine";

const currencies: CurrencyCatalog = [
  { code: "EUR", minorUnitExponent: 2 },
  { code: "USD", minorUnitExponent: 2 },
  { code: "JPY", minorUnitExponent: 0 },
  { code: "KWD", minorUnitExponent: 3 },
];

function baseState() {
  return createFinancialState({
    transactionId: "tx-001",
    currency: "EUR",
    grossMinor: 10_000,
    commission: { basisPoints: 1_500 },
  });
}

describe("pure money primitives", () => {
  it("supports 0/2/3-decimal currencies with canonical half-up rounding", () => {
    expect(decimalToMinorUnits("123.5", "JPY", currencies)).toBe(124);
    expect(decimalToMinorUnits("10.005", "EUR", currencies)).toBe(1001);
    expect(decimalToMinorUnits("12.3455", "KWD", currencies)).toBe(12346);
    expect(minorUnitsToDecimal(124, "JPY", currencies)).toBe("124");
    expect(minorUnitsToDecimal(1001, "EUR", currencies)).toBe("10.01");
    expect(minorUnitsToDecimal(12346, "KWD", currencies)).toBe("12.346");
  });

  it("rounds rationals and basis points deterministically", () => {
    expect(roundFinanceRational(5n, 2n)).toBe(3);
    expect(roundFinanceRational(-5n, 2n)).toBe(-3);
    expect(calculateBasisPointsAmount(999, 1500)).toBe(150);
    expect(calculateBasisPointsAmount(1, 4999)).toBe(0);
    expect(calculateBasisPointsAmount(1, 5000)).toBe(1);
  });

  it("fails closed on missing/duplicate currency policy", () => {
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
});

describe("pure FX", () => {
  it("converts exact rational major-unit FX across different minor-unit exponents", () => {
    expect(
      convertMoney(
        { amountMinor: 1000, currency: "EUR" },
        "USD",
        {
          id: "eur-usd",
          sourceCurrency: "EUR",
          targetCurrency: "USD",
          numerator: "11",
          denominator: "10",
        },
        currencies
      )
    ).toEqual({ amountMinor: 1100, currency: "USD" });

    expect(
      convertMoney(
        { amountMinor: 1000, currency: "USD" },
        "JPY",
        {
          id: "usd-jpy",
          sourceCurrency: "USD",
          targetCurrency: "JPY",
          numerator: "150",
          denominator: "1",
        },
        currencies
      )
    ).toEqual({ amountMinor: 1500, currency: "JPY" });
  });

  it("requires explicit FX truth and rejects mismatches", () => {
    expect(() =>
      convertMoney({ amountMinor: 100, currency: "EUR" }, "USD", null, currencies)
    ).toThrow("KLYX_FINANCE_FX_RATE_REQUIRED");

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
  });
});

describe("commission, taxes and provider liability", () => {
  it("conserves the charge exactly", () => {
    const result = calculateFinancialBreakdown({
      grossMinor: 10_000,
      commission: { basisPoints: 1_500, fixedMinor: 25 },
      taxes: [
        {
          id: "platform-vat",
          basis: "commission",
          bearer: "platform",
          basisPoints: 2_100,
        },
        {
          id: "provider-withholding",
          basis: "gross",
          bearer: "provider",
          basisPoints: 500,
        },
      ],
    });

    expect(result).toMatchObject({
      grossMinor: 10_000,
      commissionMinor: 1_525,
      platformTaxMinor: 320,
      providerTaxMinor: 500,
      platformNetMinor: 1_205,
      providerLiabilityMinor: 7_975,
    });
    expect(
      result.commissionMinor + result.providerTaxMinor + result.providerLiabilityMinor
    ).toBe(result.grossMinor);
    expect(result.platformNetMinor + result.platformTaxMinor).toBe(
      result.commissionMinor
    );
  });

  it("rejects impossible economics", () => {
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
            id: "bad-tax",
            basis: "gross",
            bearer: "platform",
            basisPoints: 500,
          },
        ],
      })
    ).toThrow("KLYX_FINANCE_PLATFORM_TAX_EXCEEDS_COMMISSION");
  });
});

describe("canonical charge → commission → provider liability → transfer → reversal → refund", () => {
  it("creates canonical initial movements", () => {
    const state = baseState();
    expect(state.events.map((entry) => entry.type)).toEqual([
      "charge",
      "commission",
      "provider_liability",
    ]);
    expect(outstandingSettlementMinor(state)).toBe(8_500);
    assertFinancialState(state);
  });

  it("supports partial and full settlement without over-transfer", () => {
    let state = settleProviderLiability(baseState(), {
      operationId: "settle-1",
      amountMinor: 3_000,
    });
    expect(netTransferredMinor(state)).toBe(3_000);
    expect(outstandingSettlementMinor(state)).toBe(5_500);

    state = settleProviderLiability(state, { operationId: "settle-2" });
    expect(netTransferredMinor(state)).toBe(8_500);
    expect(outstandingSettlementMinor(state)).toBe(0);

    expect(() =>
      settleProviderLiability(state, {
        operationId: "settle-too-much",
        amountMinor: 1,
      })
    ).toThrow("KLYX_FINANCE_SETTLEMENT_EXCEEDS_LIABILITY");
  });

  it("supports explicit reversal", () => {
    let state = settleProviderLiability(baseState(), { operationId: "settle" });
    state = reverseTransfer(state, {
      operationId: "reverse",
      amountMinor: 1_000,
    });
    expect(netTransferredMinor(state)).toBe(7_500);
    expect(outstandingSettlementMinor(state)).toBe(1_000);
    expect(state.events.at(-1)?.type).toBe("reversal");
  });

  it("auto-reverses provider overpayment before refund", () => {
    let state = settleProviderLiability(baseState(), { operationId: "settle" });
    state = refundCharge(state, {
      operationId: "partial-refund",
      amountMinor: 2_000,
    });
    expect(state.events.slice(-2).map((entry) => entry.type)).toEqual([
      "reversal",
      "refund",
    ]);
    expect(requiredReversalMinor(state)).toBe(0);
    expect(netTransferredMinor(state)).toBe(currentProviderLiabilityMinor(state));
    assertFinancialState(state);
  });

  it("full refund after settlement preserves canonical transfer → reversal → refund order", () => {
    let state = settleProviderLiability(baseState(), { operationId: "settle" });
    state = fullRefundCharge(state, { operationId: "full-refund" });
    expect(state.events.slice(-3).map((entry) => entry.type)).toEqual([
      "transfer",
      "reversal",
      "refund",
    ]);
    expect(state.refundedMinor).toBe(10_000);
    expect(currentProviderLiabilityMinor(state)).toBe(0);
    expect(netTransferredMinor(state)).toBe(0);
  });

  it("supports manual repair when automatic reversal is disabled", () => {
    const settled = settleProviderLiability(baseState(), { operationId: "settle" });
    const refunded = refundCharge(settled, {
      operationId: "refund-no-auto",
      amountMinor: 2_000,
      autoReverseTransfer: false,
    });
    const required = requiredReversalMinor(refunded);
    expect(required).toBeGreaterThan(0);

    const repaired = reverseTransfer(refunded, {
      operationId: "manual-reversal",
      amountMinor: required,
    });
    expect(requiredReversalMinor(repaired)).toBe(0);
    assertFinancialState(repaired);
  });
});

describe("partial refund determinism", () => {
  it("cumulative allocation always conserves each refund", () => {
    let state = createFinancialState({
      transactionId: "refund-conservation",
      currency: "EUR",
      grossMinor: 101,
      commission: { basisPoints: 1500 },
      taxes: [
        {
          id: "provider-tax",
          basis: "gross",
          bearer: "provider",
          basisPoints: 500,
        },
      ],
    });

    for (const amount of [17, 23, 61]) {
      const target = previewRefundAllocation(state, amount);
      expect(
        target.commissionRefundMinor +
          target.providerLiabilityRefundMinor +
          target.providerTaxRefundMinor
      ).toBe(state.refundedMinor + amount);
      state = refundCharge(state, {
        operationId: `refund-${state.refundedMinor}-${amount}`,
        amountMinor: amount,
      });
    }

    expect(state.refundedMinor).toBe(101);
    expect(state.commissionRefundedMinor).toBe(state.breakdown.commissionMinor);
    expect(state.providerLiabilityRefundedMinor).toBe(
      state.breakdown.providerLiabilityMinor
    );
    expect(state.providerTaxRefundedMinor).toBe(state.breakdown.providerTaxMinor);
  });

  it("many partial refunds equal one full refund exactly", () => {
    const initial = createFinancialState({
      transactionId: "refund-equivalence",
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

    let partial = initial;
    for (const [index, amount] of [1_111, 2_222, 3_333, 3_333].entries()) {
      partial = refundCharge(partial, {
        operationId: `partial-${index}`,
        amountMinor: amount,
      });
    }
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
});

describe("payout projection and reproducibility", () => {
  it("projects payout from net transfer truth without mutating state", () => {
    const state = settleProviderLiability(baseState(), {
      operationId: "settle",
      amountMinor: 4_000,
    });
    const before = JSON.stringify(state);
    expect(projectPayout(state, "projection-1")).toEqual({
      id: `tx-001:projection-1:payout:${state.events.length}`,
      transactionId: "tx-001",
      type: "payout",
      currency: "EUR",
      amountMinor: 4_000,
      basisSequence: state.events.length,
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("replays identical commands into byte-identical state", () => {
    const replay = () => {
      let state = createFinancialState({
        transactionId: "replay",
        currency: "USD",
        grossMinor: 12_345,
        commission: { basisPoints: 1_275, fixedMinor: 9 },
        taxes: [
          {
            id: "platform-tax",
            basis: "commission",
            bearer: "platform",
            basisPoints: 1_900,
          },
          {
            id: "provider-tax",
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
    const state = settleProviderLiability(baseState(), {
      operationId: "same",
      amountMinor: 100,
    });
    expect(() =>
      settleProviderLiability(state, {
        operationId: "same",
        amountMinor: 100,
      })
    ).toThrow("KLYX_FINANCE_OPERATION_DUPLICATE");
  });
});

describe("broad deterministic matrices", () => {
  it("conserves every minor unit across many gross/commission combinations", () => {
    for (let gross = 1; gross <= 2_000; gross += 37) {
      for (const bps of [0, 1, 125, 999, 1500, 3333, 5000, 10000]) {
        const result = calculateFinancialBreakdown({
          grossMinor: gross,
          commission: { basisPoints: bps },
        });
        expect(result.commissionMinor + result.providerLiabilityMinor).toBe(gross);
        assertFinancialState(
          createFinancialState({
            transactionId: `matrix-${gross}-${bps}`,
            currency: "JPY",
            grossMinor: gross,
            commission: { basisPoints: bps },
          })
        );
      }
    }
  });

  it("full refunds conserve awkward values across taxes and rounding", () => {
    for (let gross = 1; gross <= 1_000; gross += 29) {
      const initial = createFinancialState({
        transactionId: `refund-${gross}`,
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
