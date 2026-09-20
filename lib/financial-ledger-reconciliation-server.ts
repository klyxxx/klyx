import "server-only";

import Stripe from "stripe";

import {
  openFinancialReconciliationCase,
  type FinancialReconciliationState,
} from "@/lib/financial-ledger-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type LedgerRow = {
  id: string;
  movement_key: string;
  movement_type:
    | "charge"
    | "commission"
    | "provider_liability"
    | "transfer"
    | "reversal"
    | "refund"
    | "payout";
  amount_cents: number;
  currency: string;
  booking_id: string;
  beneficiary_kind: string;
  beneficiary_ref: string;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  stripe_refund_id: string | null;
  stripe_payout_id: string | null;
  cause: string;
  new_state: string;
  occurred_at: string;
};

type BookingRow = {
  id: string;
  payment_status: string | null;
  refund_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  application_fee_amount: number | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
  refunded_amount_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type SettlementRow = {
  booking_id: string;
  stripe_account_id: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  state: string;
};

type GroupSettlementMemberRow = {
  id: string;
  group_settlement_id: string;
  batch_id: string;
  provider_profile_id: string;
  provider_account_id: string;
  stripe_account_id: string;
  booking_ids: unknown;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  state: string;
  stripe_transfer_id: string | null;
  released_amount_cents: number;
  reversed_amount_cents: number;
  refunded_gross_amount_cents: number;
};

type GroupSettlementParentRow = {
  id: string;
  batch_id: string;
  client_profile_id: string;
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  state: string;
};

type GroupBookingEconomicsRow = {
  booking_id: string;
  client_profile_id: string;
  provider_profile_id: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number;
};

type GroupBookingAllocationRow = {
  booking_id: string;
  amount_cents: number;
};

type GroupTruth = {
  matchCount: number;
  member: GroupSettlementMemberRow | null;
  parent: GroupSettlementParentRow | null;
  economics: GroupBookingEconomicsRow | null;
  releasedAllocation: number;
  reversedAllocation: number;
  refundedAllocation: number;
};

type StripeLedgerField =
  | "stripe_payment_intent_id"
  | "stripe_transfer_id"
  | "stripe_transfer_reversal_id"
  | "stripe_refund_id"
  | "stripe_payout_id";

type Divergence = {
  state: Exclude<FinancialReconciliationState, "resolved">;
  dimension: string;
  reasonCode: string;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
};

export type CentralFinancialReconciliationResult = {
  bookingId: string;
  status: "coherent" | "reconciliation" | "human_review";
  divergences: Array<{
    caseId: string;
    state: "reconciliation" | "human_review";
    dimension: string;
    reasonCode: string;
  }>;
};

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_STRIPE_KEY_REQUIRED");
  }
  return new Stripe(key);
}

function currency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function firstOfType(rows: LedgerRow[], type: LedgerRow["movement_type"]) {
  return rows.find((row) => row.movement_type === type) ?? null;
}

function rowsOfType(rows: LedgerRow[], type: LedgerRow["movement_type"]) {
  return rows.filter((row) => row.movement_type === type);
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

function sumAmounts(rows: LedgerRow[]): number {
  return rows.reduce(
    (sum, row) => sum + Math.max(Number(row.amount_cents), 0),
    0
  );
}

function allocationCurrency(rows: LedgerRow[]): string | null {
  const currencies = uniqueText(rows.map((row) => currency(row.currency)));
  return currencies.length === 1 ? currencies[0] : null;
}

async function loadStripeObjectAllocations(
  field: StripeLedgerField,
  objectIdValue: string,
  movementType: LedgerRow["movement_type"]
): Promise<LedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from("financial_ledger_current")
    .select(
      "id, movement_key, movement_type, amount_cents, currency, booking_id, beneficiary_kind, beneficiary_ref, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, stripe_refund_id, stripe_payout_id, cause, new_state, occurred_at"
    )
    .eq(field, objectIdValue)
    .eq("movement_type", movementType);

  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerRow[];
}

function bookingAllocation(
  rows: GroupBookingAllocationRow[] | null | undefined,
  bookingId: string
): number {
  return Number(
    rows?.find((row) => row.booking_id === bookingId)?.amount_cents ?? 0
  );
}

function pushMismatch(
  divergences: Divergence[],
  input: Omit<Divergence, "state"> & {
    state?: Divergence["state"];
    mismatch: boolean;
  }
) {
  if (!input.mismatch) return;
  divergences.push({
    state: input.state ?? "human_review",
    dimension: input.dimension,
    reasonCode: input.reasonCode,
    expected: input.expected,
    actual: input.actual,
  });
}

async function loadLocalTruth(bookingId: string): Promise<{
  booking: BookingRow;
  settlement: SettlementRow | null;
  group: GroupTruth;
  ledger: LedgerRow[];
}> {
  const [
    bookingResult,
    settlementResult,
    ledgerResult,
    groupMemberResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select(
        "id, payment_status, refund_status, payment_mode, amount_total, currency, application_fee_amount, platform_fee_amount, provider_amount, refunded_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id"
      )
      .eq("id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("booking_settlements")
      .select(
        "booking_id, stripe_account_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, state"
      )
      .eq("booking_id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("financial_ledger_current")
      .select(
        "id, movement_key, movement_type, amount_cents, currency, booking_id, beneficiary_kind, beneficiary_ref, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, stripe_refund_id, stripe_payout_id, cause, new_state, occurred_at"
      )
      .eq("booking_id", bookingId),
    supabaseAdmin
      .from("platform_held_group_settlement_members")
      .select(
        "id, group_settlement_id, batch_id, provider_profile_id, provider_account_id, stripe_account_id, booking_ids, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, state, stripe_transfer_id, released_amount_cents, reversed_amount_cents, refunded_gross_amount_cents"
      )
      .contains("booking_ids", [bookingId])
      .limit(2),
  ]);

  if (bookingResult.error) throw new Error(bookingResult.error.message);
  if (!bookingResult.data) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_BOOKING_NOT_FOUND");
  }
  if (settlementResult.error) throw new Error(settlementResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (groupMemberResult.error) throw new Error(groupMemberResult.error.message);

  const groupMembers =
    (groupMemberResult.data ?? []) as GroupSettlementMemberRow[];

  let group: GroupTruth = {
    matchCount: groupMembers.length,
    member: null,
    parent: null,
    economics: null,
    releasedAllocation: 0,
    reversedAllocation: 0,
    refundedAllocation: 0,
  };

  if (groupMembers.length === 1) {
    const member = groupMembers[0];

    const [
      parentResult,
      economicsResult,
      releasedResult,
      reversedResult,
      refundedResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("platform_held_group_settlements")
        .select(
          "id, batch_id, client_profile_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, state"
        )
        .eq("id", member.group_settlement_id)
        .maybeSingle(),
      supabaseAdmin.rpc("klyx_group_member_booking_economics", {
        p_member_id: member.id,
      }),
      supabaseAdmin.rpc("klyx_group_member_provider_allocations", {
        p_member_id: member.id,
        p_total_amount_cents: Math.max(
          Number(member.released_amount_cents ?? 0),
          0
        ),
      }),
      supabaseAdmin.rpc("klyx_group_member_provider_allocations", {
        p_member_id: member.id,
        p_total_amount_cents: Math.max(
          Number(member.reversed_amount_cents ?? 0),
          0
        ),
      }),
      supabaseAdmin.rpc("klyx_group_member_amount_allocations", {
        p_member_id: member.id,
        p_total_amount_cents: Math.max(
          Number(member.refunded_gross_amount_cents ?? 0),
          0
        ),
      }),
    ]);

    if (parentResult.error) throw new Error(parentResult.error.message);
    if (economicsResult.error) throw new Error(economicsResult.error.message);
    if (releasedResult.error) throw new Error(releasedResult.error.message);
    if (reversedResult.error) throw new Error(reversedResult.error.message);
    if (refundedResult.error) throw new Error(refundedResult.error.message);

    const economicsRows =
      (economicsResult.data ?? []) as GroupBookingEconomicsRow[];
    const releasedRows =
      (releasedResult.data ?? []) as GroupBookingAllocationRow[];
    const reversedRows =
      (reversedResult.data ?? []) as GroupBookingAllocationRow[];
    const refundedRows =
      (refundedResult.data ?? []) as GroupBookingAllocationRow[];

    group = {
      matchCount: 1,
      member,
      parent: parentResult.data as GroupSettlementParentRow | null,
      economics:
        economicsRows.find((row) => row.booking_id === bookingId) ?? null,
      releasedAllocation: bookingAllocation(releasedRows, bookingId),
      reversedAllocation: bookingAllocation(reversedRows, bookingId),
      refundedAllocation: bookingAllocation(refundedRows, bookingId),
    };
  }

  return {
    booking: bookingResult.data as BookingRow,
    settlement: settlementResult.data
      ? (settlementResult.data as SettlementRow)
      : null,
    group,
    ledger: (ledgerResult.data ?? []) as LedgerRow[],
  };
}

function compareLocalTruth(input: {
  booking: BookingRow;
  settlement: SettlementRow | null;
  group: GroupTruth;
  ledger: LedgerRow[];
}): Divergence[] {
  const { booking, settlement, group, ledger } = input;
  const divergences: Divergence[] = [];
  const charge = firstOfType(ledger, "charge");
  const commission = firstOfType(ledger, "commission");
  const liability = firstOfType(ledger, "provider_liability");
  const transfers = rowsOfType(ledger, "transfer");
  const reversals = rowsOfType(ledger, "reversal");
  const refunds = rowsOfType(ledger, "refund");

  const groupMode = booking.payment_mode === "platform_held_group";

  pushMismatch(divergences, {
    mismatch: groupMode && group.matchCount !== 1,
    state: "human_review",
    dimension: "settlement",
    reasonCode: "group_settlement_booking_membership_ambiguous",
    expected: { groupMemberMatches: 1 },
    actual: { groupMemberMatches: group.matchCount },
  });

  pushMismatch(divergences, {
    mismatch:
      !groupMode &&
      group.matchCount > 0,
    state: "human_review",
    dimension: "settlement",
    reasonCode: "group_settlement_payment_mode_mismatch",
    expected: { paymentMode: booking.payment_mode },
    actual: { groupMemberMatches: group.matchCount },
  });

  if (groupMode) {
    pushMismatch(divergences, {
      mismatch: !group.parent || !group.economics,
      state: "human_review",
      dimension: "settlement",
      reasonCode: "group_settlement_booking_economics_missing",
      expected: { bookingId: booking.id },
      actual: {
        parentFound: Boolean(group.parent),
        economicsFound: Boolean(group.economics),
      },
    });
  }

  const bookingCurrency = currency(
    group.economics?.booking_id === booking.id
      ? group.member?.currency
      : booking.currency
  );
  const gross = Math.max(
    Number(group.economics?.gross_amount_cents ?? booking.amount_total ?? 0),
    0
  );
  const fee = Math.max(
    Number(
      group.economics?.platform_fee_cents ??
        booking.platform_fee_amount ??
        booking.application_fee_amount ??
        0
    ),
    0
  );
  const provider = Math.max(
    Number(
      group.economics?.provider_amount_cents ??
        booking.provider_amount ??
        0
    ),
    0
  );
  const refunded = groupMode
    ? Math.max(Number(group.refundedAllocation), 0)
    : Math.max(Number(booking.refunded_amount_cents ?? 0), 0);

  const paid = ["paid", "refunded"].includes(booking.payment_status ?? "");

  pushMismatch(divergences, {
    mismatch: paid && !charge,
    state: "reconciliation",
    dimension: "ledger",
    reasonCode: "paid_booking_missing_charge_movement",
    expected: { paymentStatus: booking.payment_status, gross, bookingCurrency },
    actual: { charge: null },
  });

  if (charge) {
    pushMismatch(divergences, {
      mismatch:
        charge.amount_cents !== gross ||
        currency(charge.currency) !== bookingCurrency,
      dimension: "ledger",
      reasonCode: "charge_booking_economics_mismatch",
      expected: { amountCents: gross, currency: bookingCurrency },
      actual: {
        amountCents: charge.amount_cents,
        currency: charge.currency,
      },
    });
  }

  pushMismatch(divergences, {
    mismatch: paid && !commission,
    state: "reconciliation",
    dimension: "ledger",
    reasonCode: "paid_booking_missing_commission_movement",
    expected: { amountCents: fee, currency: bookingCurrency },
    actual: { commission: null },
  });

  if (commission) {
    pushMismatch(divergences, {
      mismatch:
        commission.amount_cents !== fee ||
        currency(commission.currency) !== bookingCurrency,
      dimension: "ledger",
      reasonCode: "commission_booking_economics_mismatch",
      expected: { amountCents: fee, currency: bookingCurrency },
      actual: {
        amountCents: commission.amount_cents,
        currency: commission.currency,
      },
    });
  }

  pushMismatch(divergences, {
    mismatch: paid && provider > 0 && !liability,
    state: "reconciliation",
    dimension: "ledger",
    reasonCode: "paid_booking_missing_provider_liability_movement",
    expected: { amountCents: provider, currency: bookingCurrency },
    actual: { providerLiability: null },
  });

  if (liability) {
    pushMismatch(divergences, {
      mismatch:
        liability.amount_cents !== provider ||
        currency(liability.currency) !== bookingCurrency,
      dimension: "ledger",
      reasonCode: "provider_liability_booking_economics_mismatch",
      expected: { amountCents: provider, currency: bookingCurrency },
      actual: {
        amountCents: liability.amount_cents,
        currency: liability.currency,
        state: liability.new_state,
      },
    });
  }

  const succeededRefundAmount = refunds
    .filter((row) => ["succeeded", "refunded"].includes(row.new_state))
    .reduce((sum, row) => sum + Math.max(Number(row.amount_cents), 0), 0);

  pushMismatch(divergences, {
    mismatch: succeededRefundAmount !== refunded,
    state: "reconciliation",
    dimension: "ledger",
    reasonCode: "refund_aggregate_booking_mismatch",
    expected: { refundedAmountCents: refunded },
    actual: { refundedAmountCents: succeededRefundAmount },
  });

  if (settlement) {
    pushMismatch(divergences, {
      mismatch:
        settlement.gross_amount_cents !== gross ||
        settlement.platform_fee_cents !== fee ||
        settlement.provider_amount_cents !== provider ||
        currency(settlement.currency) !== bookingCurrency,
      dimension: "settlement",
      reasonCode: "settlement_booking_economics_mismatch",
      expected: {
        gross,
        fee,
        provider,
        currency: bookingCurrency,
      },
      actual: {
        gross: settlement.gross_amount_cents,
        fee: settlement.platform_fee_cents,
        provider: settlement.provider_amount_cents,
        currency: settlement.currency,
      },
    });

    if (settlement.stripe_transfer_id) {
      const matchingTransfer = transfers.find(
        (row) => row.stripe_transfer_id === settlement.stripe_transfer_id
      );
      pushMismatch(divergences, {
        mismatch: !matchingTransfer,
        state: "reconciliation",
        dimension: "settlement",
        reasonCode: "settlement_transfer_missing_in_ledger",
        expected: { stripeTransferId: settlement.stripe_transfer_id },
        actual: {
          transferIds: transfers.map((row) => row.stripe_transfer_id),
        },
      });
    }

    if (settlement.stripe_transfer_reversal_id) {
      const matchingReversal = reversals.find(
        (row) =>
          row.stripe_transfer_reversal_id ===
          settlement.stripe_transfer_reversal_id
      );
      pushMismatch(divergences, {
        mismatch: !matchingReversal,
        state: "reconciliation",
        dimension: "settlement",
        reasonCode: "settlement_reversal_missing_in_ledger",
        expected: {
          stripeTransferReversalId: settlement.stripe_transfer_reversal_id,
        },
        actual: {
          reversalIds: reversals.map(
            (row) => row.stripe_transfer_reversal_id
          ),
        },
      });
    }

    pushMismatch(divergences, {
      mismatch:
        settlement.state === "released" && !settlement.stripe_transfer_id,
      dimension: "settlement",
      reasonCode: "released_settlement_without_transfer_truth",
      expected: { state: "released", transferIdRequired: true },
      actual: {
        state: settlement.state,
        stripeTransferId: settlement.stripe_transfer_id,
      },
    });

    pushMismatch(divergences, {
      mismatch:
        settlement.state === "refunded" &&
        Boolean(settlement.stripe_transfer_id) &&
        !settlement.stripe_transfer_reversal_id,
      dimension: "settlement",
      reasonCode: "refunded_settlement_without_reversal_truth",
      expected: { reversalRequired: true },
      actual: {
        stripeTransferId: settlement.stripe_transfer_id,
        stripeTransferReversalId: settlement.stripe_transfer_reversal_id,
      },
    });
  }

  if (group.member && group.parent && group.economics) {
    pushMismatch(divergences, {
      mismatch:
        currency(group.member.currency) !== bookingCurrency ||
        currency(group.parent.currency) !== bookingCurrency,
      dimension: "settlement",
      reasonCode: "group_settlement_booking_currency_mismatch",
      expected: { currency: bookingCurrency },
      actual: {
        memberCurrency: group.member.currency,
        parentCurrency: group.parent.currency,
      },
    });

    if (group.parent.stripe_charge_id && charge) {
      pushMismatch(divergences, {
        mismatch:
          charge.stripe_charge_id !== group.parent.stripe_charge_id ||
          charge.stripe_payment_intent_id !==
            group.parent.stripe_payment_intent_id,
        dimension: "settlement",
        reasonCode: "group_settlement_charge_missing_in_ledger",
        expected: {
          stripeChargeId: group.parent.stripe_charge_id,
          stripePaymentIntentId: group.parent.stripe_payment_intent_id,
        },
        actual: {
          stripeChargeId: charge.stripe_charge_id,
          stripePaymentIntentId: charge.stripe_payment_intent_id,
        },
      });
    }

    if (group.member.stripe_transfer_id) {
      const bookingTransferAmount = transfers
        .filter(
          (row) =>
            row.stripe_transfer_id === group.member?.stripe_transfer_id
        )
        .reduce(
          (sum, row) => sum + Math.max(Number(row.amount_cents), 0),
          0
        );

      pushMismatch(divergences, {
        mismatch: bookingTransferAmount !== group.releasedAllocation,
        state: "reconciliation",
        dimension: "settlement",
        reasonCode: "group_settlement_transfer_booking_allocation_mismatch",
        expected: {
          amountCents: group.releasedAllocation,
          stripeTransferId: group.member.stripe_transfer_id,
        },
        actual: { amountCents: bookingTransferAmount },
      });
    }

    pushMismatch(divergences, {
      mismatch:
        Number(group.member.released_amount_cents) > 0 &&
        !group.member.stripe_transfer_id,
      state: "human_review",
      dimension: "settlement",
      reasonCode: "group_settlement_released_without_transfer_truth",
      expected: {
        releasedAmountCents: group.member.released_amount_cents,
        transferIdRequired: true,
      },
      actual: { stripeTransferId: group.member.stripe_transfer_id },
    });

    const bookingReversalAmount = reversals.reduce(
      (sum, row) => sum + Math.max(Number(row.amount_cents), 0),
      0
    );

    pushMismatch(divergences, {
      mismatch: bookingReversalAmount !== group.reversedAllocation,
      state: "reconciliation",
      dimension: "settlement",
      reasonCode: "group_settlement_reversal_booking_allocation_mismatch",
      expected: { amountCents: group.reversedAllocation },
      actual: { amountCents: bookingReversalAmount },
    });
  }

  return divergences;
}

async function compareStripeTruth(input: {
  stripe: Stripe;
  booking: BookingRow;
  settlement: SettlementRow | null;
  group: GroupTruth;
  ledger: LedgerRow[];
}): Promise<Divergence[]> {
  const { stripe, booking, settlement, group, ledger } = input;
  const divergences: Divergence[] = [];

  const chargeRows = rowsOfType(ledger, "charge");
  const paymentIntentId =
    settlement?.stripe_payment_intent_id ??
    group.parent?.stripe_payment_intent_id ??
    booking.stripe_payment_intent_id ??
    chargeRows.find((row) => row.stripe_payment_intent_id)
      ?.stripe_payment_intent_id ??
    null;

  if (paymentIntentId) {
    try {
      const [intent, allocations] = await Promise.all([
        stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"],
        }),
        loadStripeObjectAllocations(
          "stripe_payment_intent_id",
          paymentIntentId,
          "charge"
        ),
      ]);
      const remoteChargeId = objectId(intent.latest_charge);
      const allocationAmount = sumAmounts(allocations);
      const allocationCurrencyCode = allocationCurrency(allocations);
      const allocationChargeIds = uniqueText(
        allocations.map((row) => row.stripe_charge_id)
      );

      pushMismatch(divergences, {
        mismatch:
          allocations.length === 0 ||
          allocationAmount !== intent.amount ||
          allocationCurrencyCode !== currency(intent.currency),
        dimension: "stripe",
        reasonCode: "stripe_payment_intent_ledger_aggregate_mismatch",
        expected: {
          amountCents: allocationAmount,
          currency: allocationCurrencyCode,
          stripePaymentIntentId: paymentIntentId,
          bookingAllocations: allocations.length,
        },
        actual: {
          amountCents: intent.amount,
          currency: intent.currency,
          stripePaymentIntentId: intent.id,
        },
      });

      if (remoteChargeId) {
        pushMismatch(divergences, {
          mismatch:
            allocationChargeIds.length > 1 ||
            (allocationChargeIds.length === 1 &&
              allocationChargeIds[0] !== remoteChargeId),
          dimension: "stripe",
          reasonCode: "stripe_charge_ledger_aggregate_id_mismatch",
          expected: { stripeChargeIds: allocationChargeIds },
          actual: { stripeChargeId: remoteChargeId },
        });
      }

      const frozenChargeId =
        settlement?.stripe_charge_id ??
        group.parent?.stripe_charge_id ??
        null;

      if (frozenChargeId) {
        pushMismatch(divergences, {
          mismatch: remoteChargeId !== frozenChargeId,
          dimension: "stripe",
          reasonCode: "stripe_charge_settlement_id_mismatch",
          expected: { stripeChargeId: frozenChargeId },
          actual: { stripeChargeId: remoteChargeId },
        });
      }
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_payment_intent_unavailable",
        expected: { stripePaymentIntentId: paymentIntentId },
        actual: {
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "unknown",
        },
      });
    }
  }

  const transferIds = uniqueText([
    settlement?.stripe_transfer_id,
    group.member?.stripe_transfer_id,
    ...rowsOfType(ledger, "transfer").map(
      (row) => row.stripe_transfer_id
    ),
  ]);

  for (const transferId of transferIds) {
    try {
      const [transfer, allocations] = await Promise.all([
        stripe.transfers.retrieve(transferId),
        loadStripeObjectAllocations(
          "stripe_transfer_id",
          transferId,
          "transfer"
        ),
      ]);
      const allocationAmount = sumAmounts(allocations);
      const allocationCurrencyCode = allocationCurrency(allocations);
      const allocationAccounts = uniqueText(
        allocations.map((row) => row.stripe_account_id)
      );
      const destination = objectId(transfer.destination);

      pushMismatch(divergences, {
        mismatch:
          allocations.length === 0 ||
          allocationAmount !== transfer.amount ||
          allocationCurrencyCode !== currency(transfer.currency) ||
          allocationAccounts.length > 1 ||
          (allocationAccounts.length === 1 &&
            allocationAccounts[0] !== destination),
        dimension: "stripe",
        reasonCode: "stripe_transfer_ledger_aggregate_mismatch",
        expected: {
          amountCents: allocationAmount,
          currency: allocationCurrencyCode,
          stripeAccountIds: allocationAccounts,
          bookingAllocations: allocations.length,
        },
        actual: {
          amountCents: transfer.amount,
          currency: transfer.currency,
          destination,
          stripeTransferId: transfer.id,
        },
      });

      const settlementAmount =
        settlement?.stripe_transfer_id === transferId
          ? settlement.provider_amount_cents
          : group.member?.stripe_transfer_id === transferId
            ? Number(group.member.released_amount_cents)
            : null;

      if (settlementAmount != null) {
        pushMismatch(divergences, {
          mismatch: transfer.amount !== settlementAmount,
          dimension: "settlement",
          reasonCode: "stripe_transfer_settlement_amount_mismatch",
          expected: { amountCents: settlementAmount, stripeTransferId: transferId },
          actual: { amountCents: transfer.amount },
        });
      }
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_transfer_unavailable",
        expected: { stripeTransferId: transferId },
        actual: {
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "unknown",
        },
      });
    }
  }

  const reversalIds = uniqueText([
    settlement?.stripe_transfer_reversal_id,
    ...rowsOfType(ledger, "reversal").map(
      (row) => row.stripe_transfer_reversal_id
    ),
  ]);

  for (const reversalId of reversalIds) {
    const allocations = await loadStripeObjectAllocations(
      "stripe_transfer_reversal_id",
      reversalId,
      "reversal"
    );
    const parentTransferIds = uniqueText(
      allocations.map((row) => row.stripe_transfer_id)
    );

    if (parentTransferIds.length !== 1) {
      divergences.push({
        state: "human_review",
        dimension: "stripe",
        reasonCode: "stripe_reversal_parent_transfer_ambiguous",
        expected: { parentTransferCount: 1 },
        actual: {
          parentTransferIds,
          stripeTransferReversalId: reversalId,
        },
      });
      continue;
    }

    try {
      const reversals = await stripe.transfers.listReversals(
        parentTransferIds[0],
        { limit: 100 }
      );
      const reversal = reversals.data.find(
        (row) => row.id === reversalId
      );
      const allocationAmount = sumAmounts(allocations);
      const allocationCurrencyCode = allocationCurrency(allocations);

      pushMismatch(divergences, {
        mismatch:
          !reversal ||
          reversal.amount !== allocationAmount ||
          allocationCurrencyCode == null,
        state: reversal ? "human_review" : "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_reversal_ledger_aggregate_mismatch",
        expected: {
          amountCents: allocationAmount,
          currency: allocationCurrencyCode,
          stripeTransferReversalId: reversalId,
          bookingAllocations: allocations.length,
        },
        actual: {
          amountCents: reversal?.amount ?? null,
          stripeTransferReversalId: reversal?.id ?? null,
        },
      });
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_reversal_unavailable",
        expected: {
          stripeTransferId: parentTransferIds[0],
          stripeTransferReversalId: reversalId,
        },
        actual: {
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "unknown",
        },
      });
    }
  }

  const refundIds = uniqueText(
    rowsOfType(ledger, "refund").map(
      (row) => row.stripe_refund_id
    )
  );

  for (const refundId of refundIds) {
    try {
      const [refund, allocations] = await Promise.all([
        stripe.refunds.retrieve(refundId),
        loadStripeObjectAllocations(
          "stripe_refund_id",
          refundId,
          "refund"
        ),
      ]);
      const allocationAmount = sumAmounts(allocations);
      const allocationCurrencyCode = allocationCurrency(allocations);

      pushMismatch(divergences, {
        mismatch:
          allocations.length === 0 ||
          refund.amount !== allocationAmount ||
          (refund.currency
            ? currency(refund.currency) !== allocationCurrencyCode
            : allocationCurrencyCode == null),
        dimension: "stripe",
        reasonCode: "stripe_refund_ledger_aggregate_mismatch",
        expected: {
          amountCents: allocationAmount,
          currency: allocationCurrencyCode,
          stripeRefundId: refundId,
          bookingAllocations: allocations.length,
        },
        actual: {
          amountCents: refund.amount,
          currency: refund.currency,
          stripeRefundId: refund.id,
        },
      });
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_refund_unavailable",
        expected: { stripeRefundId: refundId },
        actual: {
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "unknown",
        },
      });
    }
  }

  const payoutIds = uniqueText(
    rowsOfType(ledger, "payout").map(
      (row) => row.stripe_payout_id
    )
  );

  for (const payoutId of payoutIds) {
    const allocations = await loadStripeObjectAllocations(
      "stripe_payout_id",
      payoutId,
      "payout"
    );
    const allocationAccounts = uniqueText(
      allocations.map((row) => row.stripe_account_id)
    );

    if (allocationAccounts.length !== 1) {
      divergences.push({
        state: "human_review",
        dimension: "stripe",
        reasonCode: "stripe_payout_account_ambiguous",
        expected: { stripeAccountCount: 1 },
        actual: {
          stripePayoutId: payoutId,
          stripeAccountIds: allocationAccounts,
        },
      });
      continue;
    }

    try {
      const payout = await stripe.payouts.retrieve(
        payoutId,
        {},
        { stripeAccount: allocationAccounts[0] }
      );
      const allocationAmount = sumAmounts(allocations);
      const allocationCurrencyCode = allocationCurrency(allocations);

      pushMismatch(divergences, {
        mismatch:
          allocations.length === 0 ||
          payout.amount !== allocationAmount ||
          currency(payout.currency) !== allocationCurrencyCode,
        dimension: "stripe",
        reasonCode: "stripe_payout_ledger_aggregate_mismatch",
        expected: {
          amountCents: allocationAmount,
          currency: allocationCurrencyCode,
          stripePayoutId: payoutId,
          stripeAccountId: allocationAccounts[0],
          bookingAllocations: allocations.length,
        },
        actual: {
          amountCents: payout.amount,
          currency: payout.currency,
          status: payout.status,
        },
      });
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_payout_unavailable",
        expected: {
          stripePayoutId: payoutId,
          stripeAccountId: allocationAccounts[0],
        },
        actual: {
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "unknown",
        },
      });
    }
  }

  return divergences;
}

function caseKey(bookingId: string, divergence: Divergence): string {
  return [
    "financial",
    bookingId,
    divergence.dimension,
    divergence.reasonCode,
  ].join(":");
}

export async function reconcileCentralFinancialTruth(input: {
  bookingId: string;
}): Promise<CentralFinancialReconciliationResult> {
  const local = await loadLocalTruth(input.bookingId);
  const divergences = compareLocalTruth(local);
  const stripe = stripeClient();

  divergences.push(
    ...(await compareStripeTruth({
      stripe,
      booking: local.booking,
      settlement: local.settlement,
      group: local.group,
      ledger: local.ledger,
    }))
  );

  const recorded: CentralFinancialReconciliationResult["divergences"] = [];

  for (const divergence of divergences) {
    const caseId = await openFinancialReconciliationCase({
      caseKey: caseKey(input.bookingId, divergence),
      bookingId: input.bookingId,
      state: divergence.state,
      dimension: divergence.dimension,
      reasonCode: divergence.reasonCode,
      expected: divergence.expected,
      actual: divergence.actual,
      cause: "ledger_stripe_settlement_reconciliation",
    });

    recorded.push({
      caseId,
      state: divergence.state,
      dimension: divergence.dimension,
      reasonCode: divergence.reasonCode,
    });
  }

  const status = recorded.some((row) => row.state === "human_review")
    ? "human_review"
    : recorded.length > 0
      ? "reconciliation"
      : "coherent";

  return {
    bookingId: input.bookingId,
    status,
    divergences: recorded,
  };
}
