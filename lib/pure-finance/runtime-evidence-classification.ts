export type PureFinanceRuntimeEvidenceClass =
  | "current_runtime"
  | "legacy_historical"
  | "not_applicable";

export type PureFinanceRuntimeEvidenceBasis =
  | "current_runtime"
  | "paid_before_central_ledger"
  | "historical_backfill_only"
  | "payment_not_final"
  | "test_only_payment_mode";

export type PureFinanceRuntimeEvidenceClassification = {
  evidenceClass: PureFinanceRuntimeEvidenceClass;
  evidenceBasis: PureFinanceRuntimeEvidenceBasis;
};

function timestampBefore(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const leftMillis = Date.parse(left);
  const rightMillis = Date.parse(right);
  return (
    Number.isFinite(leftMillis) &&
    Number.isFinite(rightMillis) &&
    leftMillis < rightMillis
  );
}

export function classifyPureFinanceRuntimeEvidence(input: {
  paymentStatus: string | null;
  paymentMode: string | null;
  paidAt: string | null;
  effectiveLedgerSources: readonly string[];
  centralLedgerFirstRecordedAt: string | null;
}): PureFinanceRuntimeEvidenceClassification {
  if (!["paid", "refunded"].includes(input.paymentStatus ?? "")) {
    return {
      evidenceClass: "not_applicable",
      evidenceBasis: "payment_not_final",
    };
  }

  if (input.paymentMode === "platform_test_only") {
    return {
      evidenceClass: "not_applicable",
      evidenceBasis: "test_only_payment_mode",
    };
  }

  if (
    timestampBefore(
      input.paidAt,
      input.centralLedgerFirstRecordedAt
    )
  ) {
    return {
      evidenceClass: "legacy_historical",
      evidenceBasis: "paid_before_central_ledger",
    };
  }

  if (
    input.effectiveLedgerSources.length > 0 &&
    input.effectiveLedgerSources.every(
      (source) => source === "historical_backfill"
    )
  ) {
    return {
      evidenceClass: "legacy_historical",
      evidenceBasis: "historical_backfill_only",
    };
  }

  return {
    evidenceClass: "current_runtime",
    evidenceBasis: "current_runtime",
  };
}
