import "server-only";

import {
  certifyControlledPureFinanceShadowEvidence,
  type ControlledPureFinanceShadowObservation,
  type ControlledPureFinanceShadowEvidence,
} from "@/lib/pure-finance/controlled-shadow-evidence";
import {
  verifyPureFinanceRuntimeShadow,
  type PureFinanceRuntimeShadowResult,
} from "@/lib/pure-finance-shadow-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_CONTROLLED_PURE_FINANCE_SHADOW_BOOKINGS = 25;

export type ControlledPureFinanceShadowBookingResult = {
  bookingId: string;
  status:
    | PureFinanceRuntimeShadowResult["status"]
    | "execution_failed";
  evidenceClass:
    | PureFinanceRuntimeShadowResult["evidenceClass"]
    | "current_runtime";
  evidenceBasis:
    | PureFinanceRuntimeShadowResult["evidenceBasis"]
    | "execution_failed";
  runtimeParity: boolean;
  observedMovementCount: number;
  mutationMovementCount: number;
  caseIds: readonly string[];
  reasonCodes: readonly string[];
};

export type ControlledPureFinanceShadowBatchResult = {
  scope: "controlled_real_runtime";
  authority: "shadow_only";
  writerReplacementAuthorized: false;
  liveActivationAuthorized: false;
  evidence: ControlledPureFinanceShadowEvidence;
  bookings: readonly ControlledPureFinanceShadowBookingResult[];
};

function validateBookingIds(input: readonly string[]): string[] {
  if (input.length === 0) {
    throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKINGS_REQUIRED");
  }
  if (input.length > MAX_CONTROLLED_PURE_FINANCE_SHADOW_BOOKINGS) {
    throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_TOO_MANY_BOOKINGS");
  }

  const normalized = input.map((value) => value.trim());
  const seen = new Set<string>();
  for (const bookingId of normalized) {
    if (!UUID_RE.test(bookingId)) {
      throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_INVALID");
    }
    if (seen.has(bookingId)) {
      throw new Error("KLYX_PURE_FINANCE_CONTROLLED_SHADOW_BOOKING_DUPLICATE");
    }
    seen.add(bookingId);
  }
  return normalized;
}

function observationFromResult(
  result: ControlledPureFinanceShadowBookingResult
): ControlledPureFinanceShadowObservation {
  return {
    bookingId: result.bookingId,
    status: result.status,
    evidenceClass: result.evidenceClass,
    runtimeParity: result.runtimeParity,
    reasonCodes: result.reasonCodes,
  };
}

export async function verifyControlledPureFinanceRuntimeShadow(input: {
  bookingIds: readonly string[];
}): Promise<ControlledPureFinanceShadowBatchResult> {
  const bookingIds = validateBookingIds(input.bookingIds);
  const bookings: ControlledPureFinanceShadowBookingResult[] = [];

  // Deliberately sequential: this is a controlled evidence run, not a production
  // scanner. It avoids burst pressure and makes each booking independently auditable.
  for (const bookingId of bookingIds) {
    try {
      const result = await verifyPureFinanceRuntimeShadow({ bookingId });
      bookings.push({
        bookingId,
        status: result.status,
        evidenceClass: result.evidenceClass,
        evidenceBasis: result.evidenceBasis,
        runtimeParity: result.runtimeParity,
        observedMovementCount: result.observedMovementCount,
        mutationMovementCount: result.mutationMovementCount,
        caseIds: result.caseIds,
        reasonCodes: result.reasonCodes,
      });
    } catch {
      // Unknown execution failures are conservatively treated as current-runtime
      // evidence so they can never be hidden behind the legacy exclusion.
      bookings.push({
        bookingId,
        status: "execution_failed",
        evidenceClass: "current_runtime",
        evidenceBasis: "execution_failed",
        runtimeParity: false,
        observedMovementCount: 0,
        mutationMovementCount: 0,
        caseIds: [],
        reasonCodes: ["PURE_FINANCE_RUNTIME_SHADOW_EXECUTION_FAILED"],
      });
    }
  }

  const evidence = certifyControlledPureFinanceShadowEvidence({
    observations: bookings.map(observationFromResult),
  });

  return {
    scope: "controlled_real_runtime",
    authority: "shadow_only",
    writerReplacementAuthorized: false,
    liveActivationAuthorized: false,
    evidence,
    bookings,
  };
}
