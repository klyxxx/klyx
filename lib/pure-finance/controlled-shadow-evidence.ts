export type ControlledPureFinanceShadowObservationStatus =
  | "coherent"
  | "human_review"
  | "not_applicable"
  | "execution_failed";

export type ControlledPureFinanceShadowObservation = {
  bookingId: string;
  status: ControlledPureFinanceShadowObservationStatus;
  runtimeParity: boolean;
  reasonCodes: readonly string[];
};

export type ControlledPureFinanceShadowEvidence = {
  gateStatus: "pass" | "fail_closed" | "insufficient_evidence";
  requestedCount: number;
  applicableCount: number;
  coherentCount: number;
  humanReviewCount: number;
  notApplicableCount: number;
  executionFailureCount: number;
  runtimeParityCount: number;
  shadowFailureRateBps: number | null;
  reasonHistogram: Readonly<Record<string, number>>;
};

function basisPoints(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.floor((numerator * 10_000) / denominator);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function certifyControlledPureFinanceShadowEvidence(input: {
  observations: readonly ControlledPureFinanceShadowObservation[];
}): ControlledPureFinanceShadowEvidence {
  if (input.observations.length === 0) {
    throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_EVIDENCE_REQUIRED");
  }

  const seen = new Set<string>();
  const reasons = new Map<string, number>();
  let coherentCount = 0;
  let humanReviewCount = 0;
  let notApplicableCount = 0;
  let executionFailureCount = 0;
  let runtimeParityCount = 0;
  let parityContradictionCount = 0;

  for (const observation of input.observations) {
    const bookingId = observation.bookingId.trim();
    if (!bookingId) {
      throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_REQUIRED");
    }
    if (seen.has(bookingId)) {
      throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_DUPLICATE");
    }
    seen.add(bookingId);

    if (observation.status === "coherent") coherentCount += 1;
    if (observation.status === "human_review") humanReviewCount += 1;
    if (observation.status === "not_applicable") notApplicableCount += 1;
    if (observation.status === "execution_failed") executionFailureCount += 1;
    if (observation.runtimeParity) runtimeParityCount += 1;

    if (observation.status === "coherent" && !observation.runtimeParity) {
      parityContradictionCount += 1;
      reasons.set(
        "PURE_FINANCE_RUNTIME_PARITY_FALSE_WITH_COHERENT_STATUS",
        (reasons.get("PURE_FINANCE_RUNTIME_PARITY_FALSE_WITH_COHERENT_STATUS") ?? 0) + 1
      );
    }

    for (const rawReason of observation.reasonCodes) {
      const reason = rawReason.trim();
      if (!reason) continue;
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  const requestedCount = input.observations.length;
  const applicableCount = requestedCount - notApplicableCount;
  const failedCount =
    humanReviewCount + executionFailureCount + parityContradictionCount;

  let gateStatus: ControlledPureFinanceShadowEvidence["gateStatus"];
  if (applicableCount === 0) {
    gateStatus = "insufficient_evidence";
  } else if (failedCount > 0 || runtimeParityCount !== coherentCount) {
    gateStatus = "fail_closed";
  } else {
    gateStatus = "pass";
  }

  return {
    gateStatus,
    requestedCount,
    applicableCount,
    coherentCount,
    humanReviewCount,
    notApplicableCount,
    executionFailureCount,
    runtimeParityCount,
    shadowFailureRateBps: basisPoints(failedCount, applicableCount),
    reasonHistogram: Object.fromEntries(
      [...reasons.entries()].sort(([left], [right]) => compareText(left, right))
    ),
  };
}
