import { describe, expect, it } from "vitest";

import { certifyControlledPureFinanceShadowEvidence } from "../../lib/pure-finance/controlled-shadow-evidence";

describe("KLYX controlled pure-finance shadow evidence", () => {
  it("passes only when every current-runtime booking is coherent and runtime-parity true", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "coherent",
          evidenceClass: "current_runtime",
          runtimeParity: true,
          reasonCodes: [],
        },
        {
          bookingId: "22222222-2222-4222-8222-222222222222",
          status: "not_applicable",
          evidenceClass: "not_applicable",
          runtimeParity: false,
          reasonCodes: [],
        },
      ],
    });

    expect(result).toEqual({
      gateStatus: "pass",
      requestedCount: 2,
      applicableCount: 1,
      currentRuntimeCount: 1,
      legacyHistoricalCount: 0,
      legacyCoherentCount: 0,
      legacyHumanReviewCount: 0,
      coherentCount: 1,
      humanReviewCount: 0,
      notApplicableCount: 1,
      executionFailureCount: 0,
      runtimeParityCount: 1,
      shadowFailureRateBps: 0,
      reasonHistogram: {},
    });
  });

  it("fails closed on any current-runtime divergence or execution failure", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "human_review",
          evidenceClass: "current_runtime",
          runtimeParity: false,
          reasonCodes: ["PURE_FINANCE_RUNTIME_TRANSFER_AMOUNT_MISMATCH"],
        },
        {
          bookingId: "22222222-2222-4222-8222-222222222222",
          status: "execution_failed",
          evidenceClass: "current_runtime",
          runtimeParity: false,
          reasonCodes: ["PURE_FINANCE_RUNTIME_SHADOW_EXECUTION_FAILED"],
        },
      ],
    });

    expect(result.gateStatus).toBe("fail_closed");
    expect(result.shadowFailureRateBps).toBe(10_000);
    expect(result.reasonHistogram).toEqual({
      PURE_FINANCE_RUNTIME_SHADOW_EXECUTION_FAILED: 1,
      PURE_FINANCE_RUNTIME_TRANSFER_AMOUNT_MISMATCH: 1,
    });
  });

  it("keeps legacy findings visible but returns insufficient evidence without current-runtime proof", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "coherent",
          evidenceClass: "legacy_historical",
          runtimeParity: true,
          reasonCodes: [],
        },
        {
          bookingId: "22222222-2222-4222-8222-222222222222",
          status: "human_review",
          evidenceClass: "legacy_historical",
          runtimeParity: false,
          reasonCodes: ["PURE_FINANCE_RUNTIME_CHARGE_CARDINALITY"],
        },
        {
          bookingId: "33333333-3333-4333-8333-333333333333",
          status: "not_applicable",
          evidenceClass: "not_applicable",
          runtimeParity: false,
          reasonCodes: ["PURE_FINANCE_RUNTIME_TEST_ONLY_PAYMENT_MODE"],
        },
      ],
    });

    expect(result.gateStatus).toBe("insufficient_evidence");
    expect(result.applicableCount).toBe(0);
    expect(result.currentRuntimeCount).toBe(0);
    expect(result.legacyHistoricalCount).toBe(2);
    expect(result.legacyCoherentCount).toBe(1);
    expect(result.legacyHumanReviewCount).toBe(1);
    expect(result.coherentCount).toBe(0);
    expect(result.humanReviewCount).toBe(0);
    expect(result.shadowFailureRateBps).toBeNull();
    expect(result.reasonHistogram).toEqual({
      PURE_FINANCE_RUNTIME_CHARGE_CARDINALITY: 1,
      PURE_FINANCE_RUNTIME_TEST_ONLY_PAYMENT_MODE: 1,
    });
  });

  it("fails closed on a current-runtime coherent/parity contradiction", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "coherent",
          evidenceClass: "current_runtime",
          runtimeParity: false,
          reasonCodes: [],
        },
      ],
    });

    expect(result.gateStatus).toBe("fail_closed");
    expect(result.reasonHistogram).toEqual({
      PURE_FINANCE_RUNTIME_PARITY_FALSE_WITH_COHERENT_STATUS: 1,
    });
  });

  it("rejects duplicate booking evidence", () => {
    expect(() =>
      certifyControlledPureFinanceShadowEvidence({
        observations: [
          {
            bookingId: "11111111-1111-4111-8111-111111111111",
            status: "coherent",
            evidenceClass: "current_runtime",
            runtimeParity: true,
            reasonCodes: [],
          },
          {
            bookingId: "11111111-1111-4111-8111-111111111111",
            status: "coherent",
            evidenceClass: "current_runtime",
            runtimeParity: true,
            reasonCodes: [],
          },
        ],
      })
    ).toThrow("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_DUPLICATE");
  });
});
