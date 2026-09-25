import { describe, expect, it } from "vitest";

import {
  createFinancialState,
  projectFinancialStateToCanonicalLedger,
  projectPayout,
  projectPayoutToCanonicalLedger,
  refundCharge,
  reverseTransfer,
  settleProviderLiability,
} from "../../lib/pure-finance-engine";

const context = {
  bookingId: "booking-001",
  platformBeneficiaryRef: "klyx",
  clientBeneficiaryRef: "account-client",
  providerBeneficiaryRef: "account-provider",
};

function initialState() {
  return createFinancialState({
    transactionId: "txn-ledger",
    currency: "EUR",
    grossMinor: 10_000,
    commission: { basisPoints: 1_500 },
  });
}

describe("pure finance canonical ledger projection", () => {
  it("projects the canonical chain without changing amounts or inventing beneficiaries", () => {
    let state = settleProviderLiability(initialState(), {
      operationId: "settlement-1",
      amountMinor: 8_500,
    });
    state = refundCharge(state, {
      operationId: "refund-1",
      amountMinor: 2_000,
    });

    const projection = projectFinancialStateToCanonicalLedger(state, context);

    expect(projection.map((entry) => entry.movementType)).toEqual([
      "charge",
      "commission",
      "provider_liability",
      "transfer",
      "reversal",
      "refund",
    ]);
    expect(projection.map((entry) => entry.amountMinor)).toEqual(
      state.events.map((entry) => entry.amountMinor)
    );
    expect(projection.map((entry) => entry.beneficiaryKind)).toEqual([
      "platform",
      "platform",
      "provider",
      "provider",
      "platform",
      "client",
    ]);
    expect(projection.map((entry) => entry.source)).toEqual([
      "payment_projection",
      "payment_projection",
      "payment_projection",
      "settlement",
      "refund",
      "refund",
    ]);
    expect(projection.map((entry) => entry.newState)).toEqual([
      "recognized",
      "recognized",
      "recognized",
      "released",
      "reversed",
      "refunded",
    ]);

    for (const [index, entry] of projection.entries()) {
      expect(entry.pureFinanceEventId).toBe(state.events[index].id);
      expect(entry.eventKey).toBe(`pure-finance:${state.events[index].id}`);
      expect(entry.currency).toBe("EUR");
      expect(entry.bookingId).toBe(context.bookingId);
    }
  });

  it("keeps an explicit non-refund reversal in settlement truth", () => {
    let state = settleProviderLiability(initialState(), {
      operationId: "settlement-1",
      amountMinor: 3_000,
    });
    state = reverseTransfer(state, {
      operationId: "manual-reversal",
      amountMinor: 500,
    });

    const reversal = projectFinancialStateToCanonicalLedger(state, context).at(-1);
    expect(reversal).toMatchObject({
      movementType: "reversal",
      beneficiaryKind: "platform",
      beneficiaryRef: "klyx",
      source: "settlement",
      newState: "reversed",
      amountMinor: 500,
    });
  });

  it("projects payout from pure net-transfer truth without mutation", () => {
    const state = settleProviderLiability(initialState(), {
      operationId: "settlement-1",
      amountMinor: 4_000,
    });
    const payout = projectPayout(state, "payout-1");
    const before = JSON.stringify(state);

    expect(projectPayoutToCanonicalLedger(payout, context)).toMatchObject({
      movementType: "payout",
      amountMinor: 4_000,
      currency: "EUR",
      beneficiaryKind: "provider",
      beneficiaryRef: "account-provider",
      cause: "payout_projected",
      source: "settlement",
      newState: "projected",
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("is byte-reproducible for identical state and projection context", () => {
    let state = settleProviderLiability(initialState(), {
      operationId: "settlement-1",
      amountMinor: 2_500,
    });
    state = refundCharge(state, {
      operationId: "refund-1",
      amountMinor: 777,
    });

    const first = projectFinancialStateToCanonicalLedger(state, context);
    const second = projectFinancialStateToCanonicalLedger(state, context);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("fails closed when canonical ledger identities are missing", () => {
    expect(() =>
      projectFinancialStateToCanonicalLedger(initialState(), {
        ...context,
        providerBeneficiaryRef: " ",
      })
    ).toThrow("KLYX_FINANCE_LEDGER_PROVIDER_REQUIRED");
  });
});
