import { describe, expect, it } from "vitest";

import {
  certifyPureFinanceCutover,
  projectPureFinanceCutoverChain,
  type ObservedCanonicalLedgerMovement,
  type PureFinanceCutoverCertificationInput,
} from "../../lib/pure-finance-engine";

const baseWithoutObserved: Omit<
  PureFinanceCutoverCertificationInput,
  "observed"
> = {
  transactionId: "cutover-tx-001",
  bookingId: "11111111-1111-4111-8111-111111111111",
  currency: "EUR",
  grossMinor: 10_000,
  commission: { basisPoints: 1_500 },
  projectionContext: {
    platformBeneficiaryRef: "klyx-platform",
    clientBeneficiaryRef: "account-client-1",
    providerBeneficiaryRef: "account-provider-1",
  },
  commands: [
    { type: "settle", operationId: "settle-1", amountMinor: 7_000 },
    { type: "refund", operationId: "refund-1", amountMinor: 2_000 },
    { type: "reverse", operationId: "reverse-1", amountMinor: 800 },
    { type: "settle", operationId: "settle-2", amountMinor: 800 },
    { type: "project_payout", projectionId: "payout-1" },
  ],
};

function coherentInput(): PureFinanceCutoverCertificationInput {
  const observed = projectPureFinanceCutoverChain(baseWithoutObserved);
  return { ...baseWithoutObserved, observed };
}

function replaceMovement(
  movements: readonly ObservedCanonicalLedgerMovement[],
  movementKey: string,
  patch: Partial<ObservedCanonicalLedgerMovement>
): ObservedCanonicalLedgerMovement[] {
  return movements.map((movement) =>
    movement.movementKey === movementKey ? { ...movement, ...patch } : movement
  );
}

describe("pure finance full-chain cutover certification", () => {
  it("certifies charge → commission → liability → transfer → reversal → refund → payout", () => {
    const input = coherentInput();
    const result = certifyPureFinanceCutover(input);

    expect(result.status).toBe("coherent");
    expect(result.cutoverReady).toBe(true);
    expect(result.divergences).toEqual([]);
    expect(result.expectedMovementCount).toBe(result.observedMovementCount);

    const types = new Set(result.expected.map((movement) => movement.movementType));
    for (const type of [
      "charge",
      "commission",
      "provider_liability",
      "transfer",
      "reversal",
      "refund",
      "payout",
    ]) {
      expect(types.has(type as never)).toBe(true);
    }
  });

  it("is byte-reproducible for identical inputs", () => {
    const input = coherentInput();
    expect(JSON.stringify(certifyPureFinanceCutover(input))).toBe(
      JSON.stringify(certifyPureFinanceCutover(input))
    );
    expect(JSON.stringify(projectPureFinanceCutoverChain(baseWithoutObserved))).toBe(
      JSON.stringify(projectPureFinanceCutoverChain(baseWithoutObserved))
    );
  });

  it("fails closed on a missing canonical movement", () => {
    const input = coherentInput();
    const missingKey = input.observed.find(
      (movement) => movement.movementType === "refund"
    )?.movementKey;
    expect(missingKey).toBeTruthy();

    const result = certifyPureFinanceCutover({
      ...input,
      observed: input.observed.filter(
        (movement) => movement.movementKey !== missingKey
      ),
    });

    expect(result.cutoverReady).toBe(false);
    expect(result.divergences).toContainEqual(
      expect.objectContaining({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_MISSING",
        movementKey: missingKey,
      })
    );
  });

  it("fails closed on duplicate canonical truth", () => {
    const input = coherentInput();
    const transfer = input.observed.find(
      (movement) => movement.movementType === "transfer"
    );
    expect(transfer).toBeTruthy();

    const result = certifyPureFinanceCutover({
      ...input,
      observed: [...input.observed, transfer!],
    });

    expect(result.cutoverReady).toBe(false);
    expect(result.divergences).toContainEqual(
      expect.objectContaining({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_DUPLICATE",
        movementKey: transfer!.movementKey,
      })
    );
  });

  it("detects amount, currency, beneficiary, cause, source and state mismatch", () => {
    const input = coherentInput();
    const refund = input.observed.find(
      (movement) => movement.movementType === "refund"
    );
    expect(refund).toBeTruthy();

    const observed = replaceMovement(input.observed, refund!.movementKey, {
      amountMinor: refund!.amountMinor + 1,
      currency: "USD",
      beneficiaryKind: "platform",
      beneficiaryRef: "wrong-beneficiary",
      cause: "wrong-cause",
      source: "settlement",
      newState: "wrong-state",
    });
    const result = certifyPureFinanceCutover({ ...input, observed });

    expect(result.cutoverReady).toBe(false);
    expect(result.divergences).toContainEqual(
      expect.objectContaining({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_MISMATCH",
        movementKey: refund!.movementKey,
      })
    );
  });

  it("rejects unexpected movements", () => {
    const input = coherentInput();
    const extra: ObservedCanonicalLedgerMovement = {
      movementKey: "unexpected:movement",
      movementType: "transfer",
      amountMinor: 1,
      currency: "EUR",
      beneficiaryKind: "provider",
      beneficiaryRef: "account-provider-1",
      cause: "unexpected",
      source: "settlement",
      newState: "released",
    };
    const result = certifyPureFinanceCutover({
      ...input,
      observed: [...input.observed, extra],
    });

    expect(result.cutoverReady).toBe(false);
    expect(result.divergences).toContainEqual(
      expect.objectContaining({
        reasonCode: "PURE_FINANCE_CUTOVER_MOVEMENT_UNEXPECTED",
        movementKey: extra.movementKey,
      })
    );
  });

  it("turns an impossible command sequence into deterministic unreplayable evidence", () => {
    const impossible = {
      ...baseWithoutObserved,
      commands: [
        {
          type: "settle" as const,
          operationId: "over-settle",
          amountMinor: 9_000,
        },
      ],
    };

    const result = certifyPureFinanceCutover({
      ...impossible,
      observed: [],
    });

    expect(result.status).toBe("divergent");
    expect(result.cutoverReady).toBe(false);
    expect(result.divergences).toEqual([
      expect.objectContaining({
        reasonCode: "PURE_FINANCE_CUTOVER_UNREPLAYABLE",
        actual: expect.objectContaining({
          errorCode: "KLYX_FINANCE_SETTLEMENT_EXCEEDS_LIABILITY",
        }),
      }),
    ]);
  });

  it("certifies a fully settled then fully refunded chain with zero payout projection", () => {
    const fixture: Omit<PureFinanceCutoverCertificationInput, "observed"> = {
      ...baseWithoutObserved,
      transactionId: "cutover-full-refund",
      commands: [
        { type: "settle", operationId: "settle-all" },
        { type: "full_refund", operationId: "refund-all" },
        { type: "project_payout", projectionId: "payout-after-refund" },
      ],
    };
    const observed = projectPureFinanceCutoverChain(fixture);
    const result = certifyPureFinanceCutover({ ...fixture, observed });
    const payout = result.expected.find(
      (movement) => movement.movementType === "payout"
    );

    expect(result.cutoverReady).toBe(true);
    expect(payout?.amountMinor).toBe(0);
    expect(
      result.expected.some(
        (movement) =>
          movement.movementType === "reversal" && movement.source === "refund"
      )
    ).toBe(true);
  });

  it("keeps zero-decimal currencies as injected minor-unit truth", () => {
    const fixture: Omit<PureFinanceCutoverCertificationInput, "observed"> = {
      ...baseWithoutObserved,
      transactionId: "cutover-jpy",
      currency: "JPY",
      grossMinor: 1_001,
      commission: { basisPoints: 1_500 },
      commands: [
        { type: "settle", operationId: "settle-jpy", amountMinor: 500 },
        { type: "project_payout", projectionId: "payout-jpy" },
      ],
    };
    const observed = projectPureFinanceCutoverChain(fixture);
    const result = certifyPureFinanceCutover({ ...fixture, observed });

    expect(result.cutoverReady).toBe(true);
    expect(result.expected.every((movement) => movement.currency === "JPY")).toBe(
      true
    );
  });
});
