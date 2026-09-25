import { describe, expect, it } from "vitest";

import {
  certifyPureFinanceRuntimeShadow,
  type PureFinanceRuntimeObservedMovement,
} from "../../lib/pure-finance/runtime-shadow";

const transactionId = "booking:11111111-1111-4111-8111-111111111111:runtime-shadow";
const bookingId = "11111111-1111-4111-8111-111111111111";
const provider = "22222222-2222-4222-8222-222222222222";
const client = "33333333-3333-4333-8333-333333333333";

function row(
  movement: Partial<PureFinanceRuntimeObservedMovement> &
    Pick<
      PureFinanceRuntimeObservedMovement,
      "movementKey" | "movementType" | "amountMinor"
    >
): PureFinanceRuntimeObservedMovement {
  const defaultsByType: Record<
    PureFinanceRuntimeObservedMovement["movementType"],
    Pick<
      PureFinanceRuntimeObservedMovement,
      "beneficiaryKind" | "beneficiaryRef" | "cause" | "source" | "newState"
    >
  > = {
    charge: {
      beneficiaryKind: "platform",
      beneficiaryRef: "klyx",
      cause: "payment_succeeded",
      source: "payment_projection",
      newState: "succeeded",
    },
    commission: {
      beneficiaryKind: "platform",
      beneficiaryRef: "klyx",
      cause: "payment_commission_recognized",
      source: "payment_projection",
      newState: "recognized",
    },
    provider_liability: {
      beneficiaryKind: "provider",
      beneficiaryRef: provider,
      cause: "provider_liability_recognized",
      source: "payment_projection",
      newState: "recognized",
    },
    transfer: {
      beneficiaryKind: "provider",
      beneficiaryRef: provider,
      cause: "settlement_release",
      source: "settlement",
      newState: "released",
    },
    reversal: {
      beneficiaryKind: "platform",
      beneficiaryRef: "klyx",
      cause: "provider_transfer_reversal",
      source: "settlement",
      newState: "reversed",
    },
    refund: {
      beneficiaryKind: "client",
      beneficiaryRef: client,
      cause: "refund_succeeded",
      source: "refund",
      newState: "succeeded",
    },
    payout: {
      beneficiaryKind: "provider",
      beneficiaryRef: provider,
      cause: "stripe_payout_observed",
      source: "payout_observation",
      newState: "paid",
    },
  };

  return {
    currency: "USD",
    occurredAt: "2026-09-25T12:00:00.000Z",
    ...defaultsByType[movement.movementType],
    ...movement,
  };
}

function coherentObserved(): PureFinanceRuntimeObservedMovement[] {
  return [
    row({ movementKey: "charge", movementType: "charge", amountMinor: 10_000 }),
    row({
      movementKey: "commission",
      movementType: "commission",
      amountMinor: 1_500,
    }),
    row({
      movementKey: "liability",
      movementType: "provider_liability",
      amountMinor: 8_500,
    }),
    row({
      movementKey: "transfer",
      movementType: "transfer",
      amountMinor: 8_500,
      occurredAt: "2026-09-25T12:01:00.000Z",
    }),
    row({
      movementKey: "reversal",
      movementType: "reversal",
      amountMinor: 850,
      occurredAt: "2026-09-25T12:02:00.000Z",
    }),
    row({
      movementKey: "refund",
      movementType: "refund",
      amountMinor: 1_000,
      occurredAt: "2026-09-25T12:03:00.000Z",
    }),
    row({
      movementKey: "payout",
      movementType: "payout",
      amountMinor: 7_650,
      occurredAt: "2026-09-25T12:04:00.000Z",
    }),
  ];
}

function certify(observed: PureFinanceRuntimeObservedMovement[]) {
  return certifyPureFinanceRuntimeShadow({
    transactionId,
    bookingId,
    currency: "USD",
    grossMinor: 10_000,
    commissionMinor: 1_500,
    providerLiabilityMinor: 8_500,
    expectedBeneficiaries: {
      platform: "klyx",
      client,
      provider,
    },
    observed,
  });
}

describe("pure finance full runtime shadow", () => {
  it("certifies recognition, transfer, reversal, refund and payout deterministically", () => {
    const first = certify(coherentObserved());
    const second = certify(coherentObserved());

    expect(first).toEqual(second);
    expect(first.status).toBe("coherent");
    expect(first.runtimeParity).toBe(true);
    expect(first.divergences).toEqual([]);
    expect(first.finalTransferredMinor).toBe(8_500);
    expect(first.finalReversedMinor).toBe(850);
    expect(first.finalRefundedMinor).toBe(1_000);
  });

  it("fails closed when a refund requires an unobserved reversal", () => {
    const observed = coherentObserved().filter(
      (movement) => movement.movementType !== "reversal" && movement.movementType !== "payout"
    );
    const result = certify(observed);

    expect(result.runtimeParity).toBe(false);
    expect(result.divergences.map((row) => row.reasonCode)).toContain(
      "PURE_FINANCE_RUNTIME_REQUIRED_REVERSAL_MISSING"
    );
  });

  it("detects payout amount divergence at the observed point in the chain", () => {
    const observed = coherentObserved().map((movement) =>
      movement.movementType === "payout"
        ? { ...movement, amountMinor: 7_649 }
        : movement
    );
    const result = certify(observed);

    expect(result.runtimeParity).toBe(false);
    expect(result.divergences.map((row) => row.reasonCode)).toContain(
      "PURE_FINANCE_RUNTIME_PAYOUT_MISMATCH"
    );
  });

  it("detects a canonical beneficiary mismatch", () => {
    const observed = coherentObserved().map((movement) =>
      movement.movementType === "refund"
        ? { ...movement, beneficiaryRef: provider }
        : movement
    );
    const result = certify(observed);

    expect(result.runtimeParity).toBe(false);
    expect(result.divergences.map((row) => row.reasonCode)).toContain(
      "PURE_FINANCE_RUNTIME_BENEFICIARY_MISMATCH"
    );
  });

  it("supports zero-decimal currencies because all values are already minor units", () => {
    const observed = [
      row({
        movementKey: "charge-jpy",
        movementType: "charge",
        amountMinor: 10_000,
        currency: "JPY",
      }),
      row({
        movementKey: "commission-jpy",
        movementType: "commission",
        amountMinor: 1_000,
        currency: "JPY",
      }),
      row({
        movementKey: "liability-jpy",
        movementType: "provider_liability",
        amountMinor: 9_000,
        currency: "JPY",
      }),
    ];

    const result = certifyPureFinanceRuntimeShadow({
      transactionId: "booking:jpy:runtime-shadow",
      bookingId,
      currency: "JPY",
      grossMinor: 10_000,
      commissionMinor: 1_000,
      providerLiabilityMinor: 9_000,
      expectedBeneficiaries: { platform: "klyx", client, provider },
      observed,
    });

    expect(result.status).toBe("coherent");
    expect(result.runtimeParity).toBe(true);
  });
});
