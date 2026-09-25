import "server-only";

import { openFinancialReconciliationCase } from "@/lib/financial-ledger-server";
import {
  certifyPureFinanceRuntimeShadow,
  type PureFinanceRuntimeObservedMovement,
  type PureFinanceRuntimeShadowDivergence,
} from "@/lib/pure-finance/runtime-shadow";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MOVEMENT_TYPES = new Set([
  "charge",
  "commission",
  "provider_liability",
  "transfer",
  "reversal",
  "refund",
  "payout",
]);

type BookingRow = {
  id: string;
  parent_id: string | null;
  provider_id: string | null;
  babysitter_id: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  application_fee_amount: number | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
};

type LedgerRow = {
  movement_key: string;
  movement_type: string;
  amount_minor: number;
  currency: string;
  beneficiary_kind: string;
  beneficiary_ref: string;
  cause: string;
  source: string;
  new_state: string;
  occurred_at: string;
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

type ProfileAccountRow = {
  account_id: string | null;
};

export type PureFinanceRuntimeShadowResult = {
  bookingId: string;
  scope: "full_chain";
  status: "coherent" | "human_review" | "not_applicable";
  runtimeParity: boolean;
  observedMovementCount: number;
  mutationMovementCount: number;
  caseIds: readonly string[];
  reasonCodes: readonly string[];
};

function nonNegative(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function preflightDivergence(
  reasonCode: string,
  expected: Readonly<Record<string, string | number | boolean | null>>,
  actual: Readonly<Record<string, string | number | boolean | null>>
): PureFinanceRuntimeShadowDivergence {
  return { reasonCode, movementKey: null, expected, actual };
}

async function loadFrozenEconomics(booking: BookingRow): Promise<{
  currency: string;
  grossMinor: number;
  commissionMinor: number;
  providerLiabilityMinor: number;
  divergences: PureFinanceRuntimeShadowDivergence[];
}> {
  const divergences: PureFinanceRuntimeShadowDivergence[] = [];

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
    divergences.push(
      preflightDivergence(
        "PURE_FINANCE_GROUP_MEMBERSHIP_AMBIGUOUS",
        { memberCount: 1 },
        { memberCount: groupMembers.length }
      )
    );

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
    divergences.push(
      preflightDivergence(
        "PURE_FINANCE_GROUP_ECONOMICS_MISSING",
        { bookingId: booking.id, present: true },
        { bookingId: booking.id, present: false }
      )
    );

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

async function profileAccountId(profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ProfileAccountRow | null)?.account_id ?? null;
}

function isEffectiveLedgerRow(row: LedgerRow): boolean {
  const state = row.new_state.trim().toLowerCase();
  const cause = row.cause.trim().toLowerCase();
  if (state.includes("failed")) return false;
  if (cause === "payment_failed" || cause === "refund_failed") return false;
  return true;
}

function observedMovement(row: LedgerRow): PureFinanceRuntimeObservedMovement {
  if (!MOVEMENT_TYPES.has(row.movement_type)) {
    throw new Error("KLYX_PURE_FINANCE_SHADOW_MOVEMENT_TYPE_INVALID");
  }
  if (
    row.beneficiary_kind !== "platform" &&
    row.beneficiary_kind !== "client" &&
    row.beneficiary_kind !== "provider" &&
    row.beneficiary_kind !== "external"
  ) {
    throw new Error("KLYX_PURE_FINANCE_SHADOW_BENEFICIARY_KIND_INVALID");
  }

  return {
    movementKey: row.movement_key,
    movementType: row.movement_type as PureFinanceRuntimeObservedMovement["movementType"],
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    beneficiaryKind: row.beneficiary_kind,
    beneficiaryRef: row.beneficiary_ref,
    cause: row.cause,
    source: row.source,
    newState: row.new_state,
    occurredAt: row.occurred_at,
  };
}

export async function verifyPureFinanceRuntimeShadow(input: {
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
        "id, parent_id, provider_id, babysitter_id, payment_status, payment_mode, amount_total, currency, application_fee_amount, platform_fee_amount, provider_amount"
      )
      .eq("id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("financial_ledger_current")
      .select(
        "movement_key, movement_type, amount_minor, currency, beneficiary_kind, beneficiary_ref, cause, source, new_state, occurred_at"
      )
      .eq("booking_id", bookingId),
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
      scope: "full_chain",
      status: "not_applicable",
      runtimeParity: false,
      observedMovementCount: 0,
      mutationMovementCount: 0,
      caseIds: [],
      reasonCodes: [],
    };
  }

  const rawLedger = (ledgerResult.data ?? []) as LedgerRow[];
  const effectiveLedger = rawLedger.filter(isEffectiveLedgerRow);
  const observed = effectiveLedger.map(observedMovement);
  const frozen = await loadFrozenEconomics(booking);
  const providerProfileId = booking.provider_id ?? booking.babysitter_id ?? null;
  const [clientAccountId, providerAccountId] = await Promise.all([
    profileAccountId(booking.parent_id),
    profileAccountId(providerProfileId),
  ]);

  const preflight = [...frozen.divergences];
  if (!providerAccountId) {
    preflight.push(
      preflightDivergence(
        "PURE_FINANCE_RUNTIME_PROVIDER_ACCOUNT_UNRESOLVED",
        { authority: "accounts.id", resolved: true },
        { authority: "accounts.id", resolved: false }
      )
    );
  }

  const hasRefund = observed.some((row) => row.movementType === "refund");
  if (hasRefund && !clientAccountId) {
    preflight.push(
      preflightDivergence(
        "PURE_FINANCE_RUNTIME_CLIENT_ACCOUNT_UNRESOLVED",
        { authority: "accounts.id", resolved: true },
        { authority: "accounts.id", resolved: false }
      )
    );
  }

  const shadow = certifyPureFinanceRuntimeShadow({
    transactionId: `booking:${bookingId}:runtime-shadow`,
    bookingId,
    currency: frozen.currency,
    grossMinor: frozen.grossMinor,
    commissionMinor: frozen.commissionMinor,
    providerLiabilityMinor: frozen.providerLiabilityMinor,
    expectedBeneficiaries: {
      platform: "klyx",
      client:
        clientAccountId ?? `unresolved-profile:${booking.parent_id ?? "null"}`,
      provider:
        providerAccountId ?? `unresolved-profile:${providerProfileId ?? "null"}`,
    },
    observed,
  });

  const divergences = [...preflight, ...shadow.divergences];
  const caseIds: string[] = [];

  for (const [index, divergence] of divergences.entries()) {
    const caseId = await openFinancialReconciliationCase({
      caseKey: `financial:${bookingId}:pure_finance_runtime:${divergence.reasonCode}:${index}`,
      bookingId,
      state: "human_review",
      dimension: "pure_finance_runtime",
      reasonCode: divergence.reasonCode,
      expected: {
        ...divergence.expected,
        movementKey: divergence.movementKey,
      },
      actual: {
        ...divergence.actual,
        movementKey: divergence.movementKey,
      },
      cause: "pure_finance_runtime_shadow_divergence",
    });
    caseIds.push(caseId);
  }

  return {
    bookingId,
    scope: "full_chain",
    status: divergences.length === 0 ? "coherent" : "human_review",
    runtimeParity: divergences.length === 0 && shadow.runtimeParity,
    observedMovementCount: shadow.observedMovementCount,
    mutationMovementCount: shadow.mutationMovementCount,
    caseIds,
    reasonCodes: divergences.map((row) => row.reasonCode),
  };
}

// Compatibility alias for callers deployed before the full-chain shadow.
export const verifyPureFinanceRecognitionShadow = verifyPureFinanceRuntimeShadow;
