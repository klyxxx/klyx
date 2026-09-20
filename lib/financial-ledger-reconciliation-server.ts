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
  ledger: LedgerRow[];
}> {
  const [bookingResult, settlementResult, ledgerResult] = await Promise.all([
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
  ]);

  if (bookingResult.error) throw new Error(bookingResult.error.message);
  if (!bookingResult.data) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_BOOKING_NOT_FOUND");
  }
  if (settlementResult.error) throw new Error(settlementResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);

  return {
    booking: bookingResult.data as BookingRow,
    settlement: settlementResult.data
      ? (settlementResult.data as SettlementRow)
      : null,
    ledger: (ledgerResult.data ?? []) as LedgerRow[],
  };
}

function compareLocalTruth(input: {
  booking: BookingRow;
  settlement: SettlementRow | null;
  ledger: LedgerRow[];
}): Divergence[] {
  const { booking, settlement, ledger } = input;
  const divergences: Divergence[] = [];
  const charge = firstOfType(ledger, "charge");
  const commission = firstOfType(ledger, "commission");
  const liability = firstOfType(ledger, "provider_liability");
  const transfers = rowsOfType(ledger, "transfer");
  const reversals = rowsOfType(ledger, "reversal");
  const refunds = rowsOfType(ledger, "refund");

  const bookingCurrency = currency(booking.currency);
  const gross = Math.max(Number(booking.amount_total ?? 0), 0);
  const fee = Math.max(
    Number(booking.platform_fee_amount ?? booking.application_fee_amount ?? 0),
    0
  );
  const provider = Math.max(Number(booking.provider_amount ?? 0), 0);
  const refunded = Math.max(Number(booking.refunded_amount_cents ?? 0), 0);

  if (["paid", "refunded"].includes(booking.payment_status ?? "")) {
    pushMismatch(divergences, {
      mismatch: !charge,
      state: "reconciliation",
      dimension: "ledger",
      reasonCode: "paid_booking_missing_charge_movement",
      expected: { paymentStatus: booking.payment_status, gross, bookingCurrency },
      actual: { charge: null },
    });
  }

  if (charge) {
    pushMismatch(divergences, {
      mismatch: charge.amount_cents !== gross || currency(charge.currency) !== bookingCurrency,
      dimension: "ledger",
      reasonCode: "charge_booking_economics_mismatch",
      expected: { amountCents: gross, currency: bookingCurrency },
      actual: { amountCents: charge.amount_cents, currency: charge.currency },
    });
  }

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
      mismatch: settlement.state === "released" && !settlement.stripe_transfer_id,
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

  return divergences;
}

async function compareStripeTruth(input: {
  stripe: Stripe;
  booking: BookingRow;
  settlement: SettlementRow | null;
  ledger: LedgerRow[];
}): Promise<Divergence[]> {
  const { stripe, booking, settlement, ledger } = input;
  const divergences: Divergence[] = [];
  const bookingCurrency = currency(booking.currency);
  const gross = Math.max(Number(booking.amount_total ?? 0), 0);

  const chargeRows = rowsOfType(ledger, "charge");
  const paymentIntentId =
    settlement?.stripe_payment_intent_id ??
    booking.stripe_payment_intent_id ??
    chargeRows.find((row) => row.stripe_payment_intent_id)
      ?.stripe_payment_intent_id ??
    null;

  if (paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const remoteChargeId = objectId(intent.latest_charge);

      pushMismatch(divergences, {
        mismatch:
          intent.amount !== gross ||
          currency(intent.currency) !== bookingCurrency,
        dimension: "stripe",
        reasonCode: "stripe_payment_intent_economics_mismatch",
        expected: { amountCents: gross, currency: bookingCurrency },
        actual: { amountCents: intent.amount, currency: intent.currency },
      });

      if (settlement?.stripe_charge_id) {
        pushMismatch(divergences, {
          mismatch: remoteChargeId !== settlement.stripe_charge_id,
          dimension: "stripe",
          reasonCode: "stripe_charge_settlement_id_mismatch",
          expected: { stripeChargeId: settlement.stripe_charge_id },
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
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        },
      });
    }
  }

  if (settlement?.stripe_transfer_id) {
    try {
      const transfer = await stripe.transfers.retrieve(
        settlement.stripe_transfer_id
      );
      pushMismatch(divergences, {
        mismatch:
          transfer.amount !== settlement.provider_amount_cents ||
          currency(transfer.currency) !== currency(settlement.currency) ||
          objectId(transfer.destination) !== settlement.stripe_account_id,
        dimension: "stripe",
        reasonCode: "stripe_transfer_settlement_mismatch",
        expected: {
          amountCents: settlement.provider_amount_cents,
          currency: settlement.currency,
          destination: settlement.stripe_account_id,
        },
        actual: {
          amountCents: transfer.amount,
          currency: transfer.currency,
          destination: objectId(transfer.destination),
        },
      });

      if (settlement.stripe_transfer_reversal_id) {
        const reversals = await stripe.transfers.listReversals(transfer.id, {
          limit: 100,
        });
        const reversal = reversals.data.find(
          (row) => row.id === settlement.stripe_transfer_reversal_id
        );
        pushMismatch(divergences, {
          mismatch: !reversal,
          state: "reconciliation",
          dimension: "stripe",
          reasonCode: "stripe_reversal_missing",
          expected: {
            stripeTransferReversalId:
              settlement.stripe_transfer_reversal_id,
          },
          actual: {
            reversalIds: reversals.data.map((row) => row.id),
          },
        });
        if (reversal) {
          pushMismatch(divergences, {
            mismatch: reversal.amount !== settlement.provider_amount_cents,
            dimension: "stripe",
            reasonCode: "stripe_reversal_amount_mismatch",
            expected: { amountCents: settlement.provider_amount_cents },
            actual: { amountCents: reversal.amount },
          });
        }
      }
    } catch (error) {
      divergences.push({
        state: "reconciliation",
        dimension: "stripe",
        reasonCode: "stripe_transfer_unavailable",
        expected: { stripeTransferId: settlement.stripe_transfer_id },
        actual: {
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        },
      });
    }
  }

  for (const refundRow of rowsOfType(ledger, "refund")) {
    if (!refundRow.stripe_refund_id) continue;
    try {
      const refund = await stripe.refunds.retrieve(refundRow.stripe_refund_id);
      pushMismatch(divergences, {
        mismatch:
          refund.amount !== refundRow.amount_cents ||
          (refund.currency
            ? currency(refund.currency) !== currency(refundRow.currency)
            : false),
        dimension: "stripe",
        reasonCode: "stripe_refund_ledger_mismatch",
        expected: {
          amountCents: refundRow.amount_cents,
          currency: refundRow.currency,
          stripeRefundId: refundRow.stripe_refund_id,
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
        expected: { stripeRefundId: refundRow.stripe_refund_id },
        actual: {
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
        },
      });
    }
  }

  for (const payoutRow of rowsOfType(ledger, "payout")) {
    if (!payoutRow.stripe_payout_id || !payoutRow.stripe_account_id) continue;
    try {
      const payout = await stripe.payouts.retrieve(
        payoutRow.stripe_payout_id,
        {},
        { stripeAccount: payoutRow.stripe_account_id }
      );
      pushMismatch(divergences, {
        mismatch:
          payout.amount !== payoutRow.amount_cents ||
          currency(payout.currency) !== currency(payoutRow.currency),
        dimension: "stripe",
        reasonCode: "stripe_payout_ledger_mismatch",
        expected: {
          amountCents: payoutRow.amount_cents,
          currency: payoutRow.currency,
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
          stripePayoutId: payoutRow.stripe_payout_id,
          stripeAccountId: payoutRow.stripe_account_id,
        },
        actual: {
          error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
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
