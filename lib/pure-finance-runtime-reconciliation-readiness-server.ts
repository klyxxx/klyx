import "server-only";

import {
  classifyPureFinanceRuntimeEvidence,
  type PureFinanceRuntimeEvidenceBasis,
} from "@/lib/pure-finance/runtime-evidence-classification";
import { supabaseAdmin } from "@/lib/supabase-admin";

type OpenReconciliationRow = {
  id: string;
  booking_id: string | null;
  dimension: string;
  reason_code: string;
  state: string;
  cause: string;
};

type BookingEvidenceRow = {
  id: string;
  payment_status: string | null;
  payment_mode: string | null;
  paid_at: string | null;
};

type LedgerEvidenceRow = {
  booking_id: string;
  source: string;
  new_state: string;
  cause: string;
};

type LedgerBoundaryRow = {
  recorded_at: string;
};

type FinancialCriticalSignalRow = {
  signal_key: string;
  source_type: string;
  source_ref: string;
};

type OpsCriticalSignalRow = {
  signal_key: string;
};

export type LegacyShadowEvidenceBasis = Extract<
  PureFinanceRuntimeEvidenceBasis,
  | "paid_before_central_ledger"
  | "historical_backfill_only"
  | "test_only_payment_mode"
>;

export type LegacyShadowEvidenceCase = {
  caseId: string;
  bookingId: string;
  basis: LegacyShadowEvidenceBasis;
};

export type FinancialRuntimeBlockingTruth = {
  blockingCaseIds: readonly string[];
  legacyHistoricalCases: readonly LegacyShadowEvidenceCase[];
  blockingCriticalSignalKeys: readonly string[];
  legacyHistoricalSignalKeys: readonly string[];
};

function isEffectiveLedgerRow(row: LedgerEvidenceRow): boolean {
  const state = row.new_state.trim().toLowerCase();
  const cause = row.cause.trim().toLowerCase();
  if (state.includes("failed")) return false;
  if (cause === "payment_failed" || cause === "refund_failed") return false;
  return true;
}

function classifyLegacyShadowCase(input: {
  reconciliation: OpenReconciliationRow;
  booking: BookingEvidenceRow | null;
  ledger: readonly LedgerEvidenceRow[];
  centralLedgerFirstRecordedAt: string | null;
}): LegacyShadowEvidenceBasis | null {
  const { reconciliation, booking } = input;

  if (
    reconciliation.dimension !== "pure_finance_runtime" ||
    reconciliation.cause !== "pure_finance_runtime_shadow_divergence" ||
    !reconciliation.reason_code.startsWith("PURE_FINANCE_RUNTIME_") ||
    !reconciliation.booking_id ||
    !booking
  ) {
    return null;
  }

  const effectiveLedger = input.ledger.filter(isEffectiveLedgerRow);
  const classification = classifyPureFinanceRuntimeEvidence({
    paymentStatus: booking.payment_status,
    paymentMode: booking.payment_mode,
    paidAt: booking.paid_at,
    effectiveLedgerSources: effectiveLedger.map((row) => row.source),
    centralLedgerFirstRecordedAt: input.centralLedgerFirstRecordedAt,
  });

  if (classification.evidenceClass === "legacy_historical") {
    return classification.evidenceBasis as LegacyShadowEvidenceBasis;
  }

  // Old shadow cases created before TEST-only observations were classified as
  // not_applicable must remain visible, but they are not production evidence.
  if (classification.evidenceBasis === "test_only_payment_mode") {
    return "test_only_payment_mode";
  }

  // payment_not_final, missing evidence and every current-runtime observation
  // remain blocking. Ambiguity is never converted into a legacy exemption.
  return null;
}

export async function inspectFinancialRuntimeBlockingTruth(): Promise<FinancialRuntimeBlockingTruth> {
  const [reconciliationResult, boundaryResult, financialSignalResult, opsSignalResult] =
    await Promise.all([
      supabaseAdmin
        .from("financial_reconciliation_current")
        .select("id, booking_id, dimension, reason_code, state, cause")
        .in("state", ["reconciliation", "human_review"]),
      supabaseAdmin
        .from("financial_ledger_events")
        .select("recorded_at")
        .order("recorded_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("financial_monitoring_signals_current")
        .select("signal_key, source_type, source_ref")
        .eq("severity", "critical"),
      supabaseAdmin
        .from("ops_observability_signals_current")
        .select("signal_key")
        .eq("severity", "critical"),
    ]);

  if (reconciliationResult.error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_UNAVAILABLE", {
      cause: reconciliationResult.error,
    });
  }
  if (boundaryResult.error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_LEDGER_BOUNDARY_UNAVAILABLE", {
      cause: boundaryResult.error,
    });
  }
  if (financialSignalResult.error || opsSignalResult.error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CRITICAL_SIGNAL_UNAVAILABLE", {
      cause: financialSignalResult.error ?? opsSignalResult.error ?? undefined,
    });
  }

  const reconciliations =
    (reconciliationResult.data ?? []) as OpenReconciliationRow[];
  const pureFinanceBookingIds = [
    ...new Set(
      reconciliations
        .filter(
          (row) =>
            row.dimension === "pure_finance_runtime" &&
            row.cause === "pure_finance_runtime_shadow_divergence" &&
            row.reason_code.startsWith("PURE_FINANCE_RUNTIME_") &&
            Boolean(row.booking_id)
        )
        .map((row) => row.booking_id as string)
    ),
  ];

  const [bookingResult, ledgerResult] =
    pureFinanceBookingIds.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }]
      : await Promise.all([
          supabaseAdmin
            .from("bookings")
            .select("id, payment_status, payment_mode, paid_at")
            .in("id", pureFinanceBookingIds),
          supabaseAdmin
            .from("financial_ledger_current")
            .select("booking_id, source, new_state, cause")
            .in("booking_id", pureFinanceBookingIds),
        ]);

  if (bookingResult.error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_EVIDENCE_UNAVAILABLE", {
      cause: bookingResult.error,
    });
  }
  if (ledgerResult.error) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_EVIDENCE_UNAVAILABLE", {
      cause: ledgerResult.error,
    });
  }

  const bookingById = new Map(
    ((bookingResult.data ?? []) as BookingEvidenceRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const ledgerByBooking = new Map<string, LedgerEvidenceRow[]>();
  for (const row of (ledgerResult.data ?? []) as LedgerEvidenceRow[]) {
    const rows = ledgerByBooking.get(row.booking_id) ?? [];
    rows.push(row);
    ledgerByBooking.set(row.booking_id, rows);
  }

  const centralLedgerFirstRecordedAt =
    (boundaryResult.data as LedgerBoundaryRow | null)?.recorded_at ?? null;
  const blockingCaseIds: string[] = [];
  const legacyHistoricalCases: LegacyShadowEvidenceCase[] = [];

  for (const reconciliation of reconciliations) {
    const bookingId = reconciliation.booking_id;
    const basis = bookingId
      ? classifyLegacyShadowCase({
          reconciliation,
          booking: bookingById.get(bookingId) ?? null,
          ledger: ledgerByBooking.get(bookingId) ?? [],
          centralLedgerFirstRecordedAt,
        })
      : null;

    if (basis && bookingId) {
      legacyHistoricalCases.push({
        caseId: reconciliation.id,
        bookingId,
        basis,
      });
    } else {
      blockingCaseIds.push(reconciliation.id);
    }
  }

  const legacyCaseIds = new Set(
    legacyHistoricalCases.map((row) => row.caseId)
  );
  const blockingCriticalSignalKeys: string[] = [];
  const legacyHistoricalSignalKeys: string[] = [];

  for (const signal of
    (financialSignalResult.data ?? []) as FinancialCriticalSignalRow[]) {
    if (
      signal.source_type === "financial_reconciliation_case" &&
      legacyCaseIds.has(signal.source_ref)
    ) {
      legacyHistoricalSignalKeys.push(signal.signal_key);
    } else {
      blockingCriticalSignalKeys.push(signal.signal_key);
    }
  }

  for (const signal of (opsSignalResult.data ?? []) as OpsCriticalSignalRow[]) {
    blockingCriticalSignalKeys.push(signal.signal_key);
  }

  blockingCaseIds.sort();
  legacyHistoricalCases.sort((left, right) =>
    left.caseId.localeCompare(right.caseId)
  );
  blockingCriticalSignalKeys.sort();
  legacyHistoricalSignalKeys.sort();

  return {
    blockingCaseIds,
    legacyHistoricalCases,
    blockingCriticalSignalKeys,
    legacyHistoricalSignalKeys,
  };
}

export async function requireNoBlockingFinancialRuntimeTruth(): Promise<void> {
  const truth = await inspectFinancialRuntimeBlockingTruth();

  if (truth.blockingCaseIds.length > 0) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_RECONCILIATION_OPEN");
  }

  if (truth.blockingCriticalSignalKeys.length > 0) {
    throw new Error("KLYX_FINANCIAL_RUNTIME_CRITICAL_SIGNAL_OPEN");
  }
}
