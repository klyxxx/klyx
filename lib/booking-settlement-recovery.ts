export type SettlementRecoveryAction =
  | "observe_healthy"
  | "observe_pending"
  | "observe_failed"
  | "reconcile_release"
  | "reconcile_no_transfer"
  | "reconcile_reversal"
  | "reconcile_refund_without_transfer"
  | "review_required";

export type SettlementRecoveryClassification = {
  action: SettlementRecoveryAction;
  reasonCodes: string[];
};

export type SettlementRecoveryObservation = {
  settlementState: string;
  claimExpired: boolean;
  refundActive: boolean;
  refundTerminal: boolean;
  transferCount: number;
  reversalCount: number;
  transferValid: boolean;
  reversalValid: boolean;
  dbTransferPresent: boolean;
  dbReversalPresent: boolean;
  conflicts?: string[];
};

export function classifySettlementRecoveryObservation(
  input: SettlementRecoveryObservation
): SettlementRecoveryClassification {
  const conflicts = [...new Set(input.conflicts ?? [])];

  if (input.settlementState === "review_required") {
    return {
      action: "review_required",
      reasonCodes: ["SETTLEMENT_REVIEW_IS_STICKY", ...conflicts],
    };
  }

  if (
    conflicts.length > 0 ||
    input.transferCount > 1 ||
    input.reversalCount > 1 ||
    (input.transferCount === 1 && !input.transferValid) ||
    (input.reversalCount === 1 && !input.reversalValid)
  ) {
    return {
      action: "review_required",
      reasonCodes: [
        ...conflicts,
        ...(input.transferCount > 1
          ? ["MULTIPLE_STRIPE_TRANSFERS"]
          : []),
        ...(input.reversalCount > 1
          ? ["MULTIPLE_STRIPE_REVERSALS"]
          : []),
        ...(input.transferCount === 1 && !input.transferValid
          ? ["STRIPE_TRANSFER_TRUTH_MISMATCH"]
          : []),
        ...(input.reversalCount === 1 && !input.reversalValid
          ? ["STRIPE_REVERSAL_TRUTH_MISMATCH"]
          : []),
      ],
    };
  }

  if (input.refundActive) {
    if (input.transferCount === 0) {
      if (input.dbTransferPresent) {
        return {
          action: "review_required",
          reasonCodes: ["DB_TRANSFER_MISSING_FROM_STRIPE"],
        };
      }

      if (input.refundTerminal) {
        return {
          action: "reconcile_refund_without_transfer",
          reasonCodes: ["REFUND_TERMINAL_WITHOUT_TRANSFER"],
        };
      }

      return {
        action: "observe_pending",
        reasonCodes: ["REFUND_PENDING_WITHOUT_TRANSFER"],
      };
    }

    if (input.reversalCount === 1) {
      return {
        action: "reconcile_reversal",
        reasonCodes: ["STRIPE_REVERSAL_OBSERVED"],
      };
    }

    if (input.dbReversalPresent) {
      return {
        action: "review_required",
        reasonCodes: ["DB_REVERSAL_MISSING_FROM_STRIPE"],
      };
    }

    if (input.refundTerminal) {
      return {
        action: "review_required",
        reasonCodes: ["TERMINAL_REFUND_WITH_UNREVERSED_TRANSFER"],
      };
    }

    return {
      action: "observe_pending",
      reasonCodes: ["TRANSFER_REVERSAL_PENDING"],
    };
  }

  if (input.transferCount === 1) {
    return {
      action: "reconcile_release",
      reasonCodes: ["STRIPE_TRANSFER_OBSERVED"],
    };
  }

  if (input.dbTransferPresent || input.settlementState === "released") {
    return {
      action: "review_required",
      reasonCodes: ["DB_RELEASE_MISSING_FROM_STRIPE"],
    };
  }

  if (input.settlementState === "release_claimed") {
    return input.claimExpired
      ? {
          action: "reconcile_no_transfer",
          reasonCodes: ["EXPIRED_CLAIM_NO_STRIPE_TRANSFER"],
        }
      : {
          action: "observe_pending",
          reasonCodes: ["ACTIVE_RELEASE_CLAIM"],
        };
  }

  return {
    action: "observe_healthy",
    reasonCodes: ["NO_DIVERGENCE_OBSERVED"],
  };
}
