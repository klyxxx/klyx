import { describe, expect, it } from "vitest";

import { certifyControlledPureFinanceShadowEvidence } from "@/lib/pure-finance/controlled-shadow-evidence";

describe("KLYX controlled pure-finance shadow evidence", () => {
  it("passes only when every applicable booking is coherent and runtime-parity true", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "coherent",
          runtimeParity: true,
          reasonCodes: [],
        },
        {
          bookingId: "22222222-2222-4222-8222-222222222222",
          status: "not_applicable",
          runtimeParity: false,
          reasonCodes: [],
        },
      ],
    });

    expect(result).toEqual({
      gateStatus: "pass",
      requestedCount: 2,
      applicableCount: 1,
      coherentCount: 1,
      humanReviewCount: 0,
      notApplicableCount: 1,
      executionFailureCount: 0,
      runtimeParityCount: 1,
      shadowFailureRateBps: 0,
      reasonHistogram: {},
    });
  });

  it("fails closed on any runtime divergence or execution failure", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "human_review",
          runtimeParity: false,
          reasonCodes: ["PURE_FINANCE_RUNTIME_TRANSFER_AMOUNT_MISMATCH"],
        },
        {
          bookingId: "22222222-2222-4222-8222-222222222222",
          status: "execution_failed",
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

  it("returns insufficient evidence when no requested booking is applicable", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "not_applicable",
          runtimeParity: false,
          reasonCodes: [],
        },
      ],
    });

    expect(result.gateStatus).toBe("insufficient_evidence");
    expect(result.shadowFailureRateBps).toBeNull();
  });

  it("fails closed on a coherent/parity contradiction", () => {
    const result = certifyControlledPureFinanceShadowEvidence({
      observations: [
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          status: "coherent",
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
            runtimeParity: true,
            reasonCodes: [],
          },
          {
            bookingId: "11111111-1111-4111-8111-111111111111",
            status: "coherent",
            runtimeParity: true,
            reasonCodes: [],
          },
        ],
      })
    ).toThrow("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_DUPLICATE");
  });
});
