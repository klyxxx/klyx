import { describe, expect, it } from "vitest";

import { classifySettlementRecoveryObservation } from "@/lib/booking-settlement-recovery";

const base = {
  settlementState: "held",
  claimExpired: false,
  refundActive: false,
  refundTerminal: false,
  transferCount: 0,
  reversalCount: 0,
  transferValid: false,
  reversalValid: false,
  dbTransferPresent: false,
  dbReversalPresent: false,
  conflicts: [] as string[],
};

describe("settlement recovery classifier", () => {
  it("reconciles one valid Stripe Transfer instead of creating another", () => {
    expect(
      classifySettlementRecoveryObservation({
        ...base,
        settlementState: "release_claimed",
        transferCount: 1,
        transferValid: true,
      })
    ).toEqual({
      action: "reconcile_release",
      reasonCodes: ["STRIPE_TRANSFER_OBSERVED"],
    });
  });

  it("reopens only an expired claim after Stripe proves there is no Transfer", () => {
    expect(
      classifySettlementRecoveryObservation({
        ...base,
        settlementState: "release_claimed",
        claimExpired: true,
      })
    ).toEqual({
      action: "reconcile_no_transfer",
      reasonCodes: ["EXPIRED_CLAIM_NO_STRIPE_TRANSFER"],
    });

    expect(
      classifySettlementRecoveryObservation({
        ...base,
        settlementState: "release_claimed",
        claimExpired: false,
      }).action
    ).toBe("observe_pending");
  });

  it("fails closed on duplicate Transfers and reversals", () => {
    expect(
      classifySettlementRecoveryObservation({
        ...base,
        transferCount: 2,
      }).action
    ).toBe("review_required");

    expect(
      classifySettlementRecoveryObservation({
        ...base,
        refundActive: true,
        transferCount: 1,
        transferValid: true,
        reversalCount: 2,
      }).action
    ).toBe("review_required");
  });

  it("reconciles an observed reversal independently of release retry", () => {
    expect(
      classifySettlementRecoveryObservation({
        ...base,
        settlementState: "refund_pending",
        refundActive: true,
        refundTerminal: false,
        transferCount: 1,
        transferValid: true,
        reversalCount: 1,
        reversalValid: true,
        dbTransferPresent: true,
      }).action
    ).toBe("reconcile_reversal");
  });

  it("never treats a terminal refund with an unreversed Transfer as safe", () => {
    const result = classifySettlementRecoveryObservation({
      ...base,
      settlementState: "refund_pending",
      refundActive: true,
      refundTerminal: true,
      transferCount: 1,
      transferValid: true,
      dbTransferPresent: true,
    });

    expect(result.action).toBe("review_required");
    expect(result.reasonCodes).toContain(
      "TERMINAL_REFUND_WITH_UNREVERSED_TRANSFER"
    );
  });

  it("can reconcile a terminal refund with no provider Transfer", () => {
    expect(
      classifySettlementRecoveryObservation({
        ...base,
        settlementState: "refund_pending",
        refundActive: true,
        refundTerminal: true,
      }).action
    ).toBe("reconcile_refund_without_transfer");
  });

  it("keeps human review sticky", () => {
    const result = classifySettlementRecoveryObservation({
      ...base,
      settlementState: "review_required",
      transferCount: 1,
      transferValid: true,
    });

    expect(result.action).toBe("review_required");
    expect(result.reasonCodes).toContain("SETTLEMENT_REVIEW_IS_STICKY");
  });

  it("fails closed on any immutable Stripe truth divergence", () => {
    const result = classifySettlementRecoveryObservation({
      ...base,
      transferCount: 1,
      transferValid: false,
      conflicts: ["TRANSFER_SOURCE_TRANSACTION_MISMATCH"],
    });

    expect(result.action).toBe("review_required");
    expect(result.reasonCodes).toContain(
      "TRANSFER_SOURCE_TRANSACTION_MISMATCH"
    );
  });
});
