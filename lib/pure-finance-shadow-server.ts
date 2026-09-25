import "server-only";

import { openFinancialReconciliationCase } from "@/lib/financial-ledger-server";
import {
  comparePureFinanceRecognitionShadow,
  type PureFinanceObservedRecognition,
  type PureFinanceShadowDivergence,
} from "@/lib/pure-finance/shadow-reconciliation";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BookingRow = {
  id: string;
  payment_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  application_fee_amount: number | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
};

type RecognitionLedgerRow = {
  movement_type: "charge" | "commission" | "provider_liability";
  amount_minor: number;
  currency: string;
};

type GroupMemberRow = {
  id: string;
  currency: string;
};

type GroupEconomicsRow = {
  booking_id: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
};

export type PureFinanceRuntimeShadowResult = {
  bookingId: string;
  status: "coherent" | "human_review" | "not_applicable";
  caseIds: readonly string[];
  reasonCodes: readonly string[];
};

function nonNegative(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function recognitionRows(
  rows: readonly RecognitionLedgerRow[],
  type: RecognitionLedgerRow["movement_type"]
): RecognitionLedgerRow[] {
  return rows.filter((row) => row.movement_type === type);
}

function observedRecognition(
  rows: readonly RecognitionLedgerRow[],
  type: RecognitionLedgerRow["movement_type"],
  divergences: PureFinanceShadowDivergence[]
): PureFinanceObservedRecognition | null {
  const matching = recognitionRows(rows, type);
  if (matching.length > 1) {
    divergences.push({
      reasonCode: `PURE_FINANCE_${type.toUpperCase()}_CARDINALITY`,
      expected: { count: 1, movementType: type },
      actual: { count: matching.length, movementType: type },
    });
  }

  const row = matching[0];
  return row
    ? {
        amountMinor: Number(row.amount_minor),
        currency: row.currency,
      }
    : null;
}

async function loadFrozenEconomics(booking: BookingRow): Promise<{
  currency: string;
  grossMinor: number;
  commissionMinor: number;
  providerLiabilityMinor: number;
  divergences: PureFinanceShadowDivergence[];
}> {
  const divergences: PureFinanceShadowDivergence[] = [];

  if (booking.payment_mode !== "platform_held_group") {
    return {
      currency: booking.currency ?? "",
      grossMinor: nonNegative(booking.amount_total),
      commissionMinor: nonNegative(
        booking.platform_fee_amount ?? booking.application_fee_amount
      ),
      providerLiabilityMinor: nonNegative(booking.provider_amount),
      divergences,
    };
  }

  const { data: members, error: memberError } = await supabaseAdmin
    .from("platform_held_group_settlement_members")
    .select("id, currency")
    .contains("booking_ids", [booking.id])
    .limit(2);

  if (memberError) throw new Error(memberError.message);

  const groupMembers = (members ?? []) as GroupMemberRow[];
  if (groupMembers.length !== 1) {
    divergences.push({
      reasonCode: "PURE_FINANCE_GROUP_MEMBERSHIP_AMBIGUOUS",
      expected: { memberCount: 1 },
      actual: { memberCount: groupMembers.length },
    });

    return {
      currency: booking.currency ?? "",
      grossMinor: nonNegative(booking.amount_total),
      commissionMinor: nonNegative(
        booking.platform_fee_amount ?? booking.application_fee_amount
      ),
      providerLiabilityMinor: nonNegative(booking.provider_amount),
      divergences,
    };
  }

  const member = groupMembers[0];
  const { data: economicsData, error: economicsError } = await supabaseAdmin.rpc(
    "klyx_group_member_booking_economics",
    { p_member_id: member.id }
  );

  if (economicsError) throw new Error(economicsError.message);

  const economics = ((economicsData ?? []) as GroupEconomicsRow[]).find(
    (row) => row.booking_id === booking.id
  );

  if (!economics) {
    divergences.push({
      reasonCode: "PURE_FINANCE_GROUP_ECONOMICS_MISSING",
      expected: { bookingId: booking.id, present: true },
      actual: { bookingId: booking.id, present: false },
    });

    return {
      currency: member.currency ?? booking.currency ?? "",
      grossMinor: nonNegative(booking.amount_total),
      commissionMinor: nonNegative(
        booking.platform_fee_amount ?? booking.application_fee_amount
      ),
      providerLiabilityMinor: nonNegative(booking.provider_amount),
      divergences,
    };
  }

  return {
    currency: member.currency,
    grossMinor: nonNegative(economics.gross_amount_cents),
    commissionMinor: nonNegative(economics.platform_fee_cents),
    providerLiabilityMinor: nonNegative(economics.provider_amount_cents),
    divergences,
  };
}

export async function verifyPureFinanceRecognitionShadow(input: {
  bookingId: string;
}): Promise<PureFinanceRuntimeShadowResult> {
  const bookingId = input.bookingId.trim();
  if (!UUID_RE.test(bookingId)) {
    throw new Error("KLYX_PURE_FINANCE_SHADOW_BOOKING_INVALID");
  }

  const [bookingResult, ledgerResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(
        "id, payment_status, payment_mode, amount_total, currency, application_fee_amount, platform_fee_amount, provider_amount"
      )
      .eq("id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("financial_ledger_current")
      .select("movement_type, amount_minor, currency")
      .eq("booking_id", bookingId)
      .in("movement_type", ["charge", "commission", "provider_liability"]),
  ]);

  if (bookingResult.error) throw new Error(bookingResult.error.message);
  if (!bookingResult.data) {
    throw new Error("KLYX_PURE_FINANCE_SHADOW_BOOKING_NOT_FOUND");
  }
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);

  const booking = bookingResult.data as BookingRow;
  if (!["paid", "refunded"].includes(booking.payment_status ?? "")) {
    return {
      bookingId,
      status: "not_applicable",
      caseIds: [],
      reasonCodes: [],
    };
  }

  const frozen = await loadFrozenEconomics(booking);
  const ledger = (ledgerResult.data ?? []) as RecognitionLedgerRow[];
  const preflight = [...frozen.divergences];

  const charge = observedRecognition(ledger, "charge", preflight);
  const commission = observedRecognition(ledger, "commission", preflight);
  const providerLiability = observedRecognition(
    ledger,
    "provider_liability",
    preflight
  );

  const shadow = comparePureFinanceRecognitionShadow({
    transactionId: `booking:${bookingId}:recognition`,
    bookingId,
    currency: frozen.currency,
    grossMinor: frozen.grossMinor,
    commissionMinor: frozen.commissionMinor,
    providerLiabilityMinor: frozen.providerLiabilityMinor,
    observed: {
      charge,
      commission,
      providerLiability,
    },
  });

  const divergences = [...preflight, ...shadow.divergences];
  const caseIds: string[] = [];

  for (const divergence of divergences) {
    const caseId = await openFinancialReconciliationCase({
      caseKey: `financial:${bookingId}:pure_finance:${divergence.reasonCode}`,
      bookingId,
      state: "human_review",
      dimension: "pure_finance",
      reasonCode: divergence.reasonCode,
      expected: { ...divergence.expected },
      actual: { ...divergence.actual },
      cause: "pure_finance_shadow_divergence",
    });
    caseIds.push(caseId);
  }

  return {
    bookingId,
    status: divergences.length === 0 ? "coherent" : "human_review",
    caseIds,
    reasonCodes: divergences.map((row) => row.reasonCode),
  };
}
