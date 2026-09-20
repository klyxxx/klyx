import "server-only";

import Stripe from "stripe";

import {
  openFinancialReconciliationCase,
  transitionFinancialReconciliationCase,
} from "@/lib/canonical-financial-ledger";
import { supabaseAdmin } from "@/lib/supabase-admin";

type LedgerRow = {
  id: string;
  movement_type: string;
  amount_cents: number;
  currency: string;
  beneficiary_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_transfer_reversal_id: string | null;
  stripe_refund_id: string | null;
  stripe_payout_id: string | null;
  stripe_balance_transaction_id: string | null;
  previous_state: string | null;
  new_state: string | null;
  occurred_at: string;
  entry_hash: string;
};

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  payment_status: string | null;
  refund_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
  refunded_amount_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
};

type SettlementRow = {
  booking_id: string;
  provider_profile_id: string;
  stripe_account_id: string;
  payment_mode: string;
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
  code: string;
  detail: string;
};

export type CanonicalFinancialReconciliationResult =
  | {
      status: "consistent";
      bookingId: string;
      ledgerEntries: number;
    }
  | {
      status: "human_review";
      bookingId: string;
      caseId: string;
      divergences: Divergence[];
    };

function requiredStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_STRIPE_KEY_REQUIRED");
  }
  return key;
}

function normalizeCurrency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function sumMovement(rows: LedgerRow[], movement: string): number {
  return rows
    .filter((row) => row.movement_type === movement)
    .reduce((sum, row) => sum + Number(row.amount_cents), 0);
}

function idsForMovement(
  rows: LedgerRow[],
  movement: string,
  field:
    | "stripe_transfer_id"
    | "stripe_transfer_reversal_id"
    | "stripe_refund_id"
    | "stripe_payout_id"
): string[] {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.movement_type === movement)
        .map((row) => row[field]?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

async function loadBooking(bookingId: string): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, payment_status, refund_status, payment_mode, amount_total, currency, platform_fee_amount, provider_amount, refunded_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_refund_id"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_FINANCIAL_RECONCILIATION_BOOKING_NOT_FOUND");
  return data as BookingRow;
}

async function loadSettlement(bookingId: string): Promise<SettlementRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, state"
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as SettlementRow) : null;
}

async function loadLedger(bookingId: string): Promise<LedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from("financial_ledger_entries")
    .select(
      "id, movement_type, amount_cents, currency, beneficiary_account_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, stripe_refund_id, stripe_payout_id, stripe_balance_transaction_id, previous_state, new_state, occurred_at, entry_hash"
    )
    .eq("booking_id", bookingId)
    .order("sequence_id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerRow[];
}

async function canonicalStripeAccountForAccount(
  accountId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("account_stripe_connect_identities")
    .select("stripe_account_id, identity_state")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.identity_state !== "linked") return null;
  return data.stripe_account_id ? String(data.stripe_account_id) : null;
}

function add(
  divergences: Divergence[],
  condition: boolean,
  code: string,
  detail: string
): void {
  if (condition) divergences.push({ code, detail });
}

function ledgerSnapshot(rows: LedgerRow[]) {
  return {
    entryCount: rows.length,
    movements: {
      charge: sumMovement(rows, "charge"),
      commission: sumMovement(rows, "commission"),
      providerLiability: sumMovement(rows, "provider_liability"),
      transfer: sumMovement(rows, "transfer"),
      reversal: sumMovement(rows, "reversal"),
      refund: sumMovement(rows, "refund"),
      payout: sumMovement(rows, "payout"),
    },
    transferIds: idsForMovement(rows, "transfer", "stripe_transfer_id"),
    reversalIds: idsForMovement(
      rows,
      "reversal",
      "stripe_transfer_reversal_id"
    ),
    refundIds: idsForMovement(rows, "refund", "stripe_refund_id"),
    payoutIds: idsForMovement(rows, "payout", "stripe_payout_id"),
    terminalHash: rows.at(-1)?.entry_hash ?? null,
  };
}

export async function reconcileCanonicalFinancialTruth(
  bookingId: string
): Promise<CanonicalFinancialReconciliationResult> {
  const [booking, settlement, ledger] = await Promise.all([
    loadBooking(bookingId),
    loadSettlement(bookingId),
    loadLedger(bookingId),
  ]);

  const stripe = new Stripe(requiredStripeKey());
  const divergences: Divergence[] = [];
  const expectedCurrency = normalizeCurrency(
    settlement?.currency ?? booking.currency
  );
  const expectedGross = Number(
    settlement?.gross_amount_cents ?? booking.amount_total ?? 0
  );
  const expectedFee = Number(
    settlement?.platform_fee_cents ?? booking.platform_fee_amount ?? 0
  );
  const expectedProvider = Number(
    settlement?.provider_amount_cents ??
      booking.provider_amount ??
      Math.max(expectedGross - expectedFee, 0)
  );

  const ledgerCurrencies = Array.from(
    new Set(ledger.map((row) => normalizeCurrency(row.currency)))
  );

  add(
    divergences,
    expectedGross <= 0,
    "expected_gross_invalid",
    "KLYX booking/settlement gross amount is missing or invalid."
  );
  add(
    divergences,
    expectedFee < 0 ||
      expectedProvider < 0 ||
      expectedFee + expectedProvider !== expectedGross,
    "klyx_economics_divergence",
    "KLYX commission plus provider liability does not equal gross."
  );
  add(
    divergences,
    ledgerCurrencies.length > 1 ||
      (ledgerCurrencies.length === 1 &&
        ledgerCurrencies[0] !== expectedCurrency),
    "ledger_currency_divergence",
    "Canonical ledger currency differs from booking/settlement currency."
  );

  if (booking.payment_status === "paid" || booking.payment_status === "refunded") {
    add(
      divergences,
      sumMovement(ledger, "charge") !== expectedGross,
      "ledger_charge_divergence",
      "Canonical charge total does not equal KLYX gross."
    );
    add(
      divergences,
      sumMovement(ledger, "commission") !== expectedFee,
      "ledger_commission_divergence",
      "Canonical commission total does not equal KLYX commission."
    );
    add(
      divergences,
      sumMovement(ledger, "provider_liability") !== expectedProvider,
      "ledger_provider_liability_divergence",
      "Canonical provider liability does not equal KLYX provider amount."
    );
  }

  const paymentIntentId =
    settlement?.stripe_payment_intent_id ??
    booking.stripe_payment_intent_id ??
    ledger.find((row) => row.stripe_payment_intent_id)
      ?.stripe_payment_intent_id ??
    null;

  let stripePaymentSnapshot: Record<string, unknown> = {};
  if (paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const chargeId = stripeObjectId(intent.latest_charge);

    stripePaymentSnapshot = {
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: intent.status,
      livemode: intent.livemode,
      chargeId,
    };

    add(
      divergences,
      intent.amount !== expectedGross,
      "stripe_payment_amount_divergence",
      "Stripe PaymentIntent amount differs from KLYX gross."
    );
    add(
      divergences,
      intent.currency.toUpperCase() !== expectedCurrency,
      "stripe_payment_currency_divergence",
      "Stripe PaymentIntent currency differs from KLYX currency."
    );
    add(
      divergences,
      (booking.payment_status === "paid" ||
        booking.payment_status === "refunded") &&
        intent.status !== "succeeded",
      "stripe_payment_state_divergence",
      "KLYX says paid/refunded while Stripe PaymentIntent is not succeeded."
    );
    add(
      divergences,
      Boolean(
        settlement?.stripe_charge_id &&
          chargeId &&
          settlement.stripe_charge_id !== chargeId
      ),
      "stripe_charge_identity_divergence",
      "Stripe latest charge differs from Settlement charge identity."
    );
  } else if (
    booking.payment_status === "paid" ||
    booking.payment_status === "refunded"
  ) {
    divergences.push({
      code: "stripe_payment_identity_missing",
      detail: "Paid KLYX booking has no Stripe PaymentIntent identity.",
    });
  }

  let stripeTransferSnapshot: Record<string, unknown> = {};
  if (settlement?.stripe_transfer_id) {
    const transfer = await stripe.transfers.retrieve(
      settlement.stripe_transfer_id
    );
    const destinationId = stripeObjectId(transfer.destination);
    const sourceId = stripeObjectId(transfer.source_transaction);

    stripeTransferSnapshot = {
      transferId: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency.toUpperCase(),
      destinationId,
      sourceTransactionId: sourceId,
      livemode: transfer.livemode,
      amountReversed: transfer.amount_reversed,
    };

    add(
      divergences,
      transfer.amount !== expectedProvider,
      "stripe_transfer_amount_divergence",
      "Stripe Transfer amount differs from provider liability."
    );
    add(
      divergences,
      transfer.currency.toUpperCase() !== expectedCurrency,
      "stripe_transfer_currency_divergence",
      "Stripe Transfer currency differs from KLYX currency."
    );
    add(
      divergences,
      destinationId !== settlement.stripe_account_id,
      "stripe_transfer_destination_divergence",
      "Stripe Transfer destination differs from frozen Settlement destination."
    );
    add(
      divergences,
      Boolean(
        settlement.stripe_charge_id &&
          sourceId &&
          sourceId !== settlement.stripe_charge_id
      ),
      "stripe_transfer_source_divergence",
      "Stripe Transfer source differs from frozen Settlement charge."
    );

    const transferIds = idsForMovement(
      ledger,
      "transfer",
      "stripe_transfer_id"
    );
    add(
      divergences,
      !transferIds.includes(transfer.id),
      "ledger_transfer_missing",
      "Settlement/Stripe Transfer exists but canonical ledger has no matching transfer."
    );
    add(
      divergences,
      sumMovement(ledger, "transfer") !== expectedProvider,
      "ledger_transfer_amount_divergence",
      "Canonical transfer amount differs from provider liability."
    );
  }

  let stripeReversalSnapshot: Record<string, unknown> = {};
  if (
    settlement?.stripe_transfer_id &&
    settlement.stripe_transfer_reversal_id
  ) {
    const reversals = await stripe.transfers.listReversals(
      settlement.stripe_transfer_id,
      { limit: 100 }
    );
    const reversal =
      reversals.data.find(
        (candidate) =>
          candidate.id === settlement.stripe_transfer_reversal_id
      ) ?? null;

    if (!reversal) {
      divergences.push({
        code: "stripe_reversal_identity_missing",
        detail: "Settlement reversal identity is absent from Stripe.",
      });
    } else {
      stripeReversalSnapshot = {
        reversalId: reversal.id,
        amount: reversal.amount,
        balanceTransactionId: stripeObjectId(reversal.balance_transaction),
      };

    const reversalIds = idsForMovement(
      ledger,
      "reversal",
      "stripe_transfer_reversal_id"
    );

    add(
      divergences,
      !reversalIds.includes(reversal.id),
      "ledger_reversal_missing",
      "Settlement/Stripe reversal exists but canonical ledger has no matching reversal."
    );
      add(
        divergences,
        sumMovement(ledger, "reversal") !== reversal.amount,
        "ledger_reversal_amount_divergence",
        "Canonical reversal amount differs from Stripe reversal amount."
      );
    }
  }

  let stripeRefundSnapshot: Record<string, unknown> = {};
  const refundId =
    booking.stripe_refund_id ??
    idsForMovement(ledger, "refund", "stripe_refund_id").at(-1) ??
    null;

  if (refundId) {
    const refund = await stripe.refunds.retrieve(refundId);
    stripeRefundSnapshot = {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency.toUpperCase(),
      status: refund.status,
      paymentIntentId: stripeObjectId(refund.payment_intent),
    };

    const expectedRefund = Number(booking.refunded_amount_cents ?? 0);
    add(
      divergences,
      refund.currency.toUpperCase() !== expectedCurrency,
      "stripe_refund_currency_divergence",
      "Stripe refund currency differs from KLYX currency."
    );
    add(
      divergences,
      booking.refund_status === "succeeded" && refund.status !== "succeeded",
      "stripe_refund_state_divergence",
      "KLYX refund is succeeded while Stripe refund is not succeeded."
    );
    add(
      divergences,
      booking.refund_status === "succeeded" &&
        sumMovement(ledger, "refund") !== expectedRefund,
      "ledger_refund_amount_divergence",
      "Canonical refund total differs from KLYX refunded amount."
    );
  }

  const payoutSnapshots: Array<Record<string, unknown>> = [];
  const payoutRows = ledger.filter(
    (row) => row.movement_type === "payout" && row.stripe_payout_id
  );
  const payoutGroups = new Map<
    string,
    { amount: number; accountId: string | null }
  >();

  for (const row of payoutRows) {
    const payoutId = row.stripe_payout_id!;
    const current = payoutGroups.get(payoutId) ?? {
      amount: 0,
      accountId: row.beneficiary_account_id,
    };
    current.amount += Number(row.amount_cents);
    if (current.accountId !== row.beneficiary_account_id) {
      divergences.push({
        code: "ledger_payout_beneficiary_divergence",
        detail: "One Stripe payout id is allocated to multiple KLYX beneficiary accounts.",
      });
    }
    payoutGroups.set(payoutId, current);
  }

  for (const [payoutId, allocation] of payoutGroups) {
    if (!allocation.accountId) {
      divergences.push({
        code: "ledger_payout_account_missing",
        detail: "Payout ledger allocation is missing canonical beneficiary account.",
      });
      continue;
    }

    const stripeAccountId = await canonicalStripeAccountForAccount(
      allocation.accountId
    );
    if (!stripeAccountId) {
      divergences.push({
        code: "ledger_payout_stripe_identity_missing",
        detail: "Payout beneficiary has no linked canonical Stripe identity.",
      });
      continue;
    }

    const payout = await stripe.payouts.retrieve(
      payoutId,
      {},
      { stripeAccount: stripeAccountId }
    );

    payoutSnapshots.push({
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency.toUpperCase(),
      status: payout.status,
      allocatedAmount: allocation.amount,
      stripeAccountId,
    });

    add(
      divergences,
      payout.currency.toUpperCase() !== expectedCurrency,
      "stripe_payout_currency_divergence",
      "Stripe payout currency differs from KLYX ledger currency."
    );
    add(
      divergences,
      allocation.amount > payout.amount,
      "ledger_payout_overallocation",
      "KLYX payout allocation exceeds remote Stripe payout amount."
    );
  }

  const settlementSnapshot = settlement
    ? {
        paymentMode: settlement.payment_mode,
        state: settlement.state,
        grossAmountCents: settlement.gross_amount_cents,
        platformFeeCents: settlement.platform_fee_cents,
        providerAmountCents: settlement.provider_amount_cents,
        currency: settlement.currency,
        stripeAccountId: settlement.stripe_account_id,
        stripePaymentIntentId: settlement.stripe_payment_intent_id,
        stripeChargeId: settlement.stripe_charge_id,
        stripeTransferId: settlement.stripe_transfer_id,
        stripeTransferReversalId:
          settlement.stripe_transfer_reversal_id,
      }
    : {
        paymentMode: booking.payment_mode,
        state: null,
        grossAmountCents: booking.amount_total,
        platformFeeCents: booking.platform_fee_amount,
        providerAmountCents: booking.provider_amount,
        currency: booking.currency,
      };

  if (divergences.length === 0) {
    return {
      status: "consistent",
      bookingId,
      ledgerEntries: ledger.length,
    };
  }

  const uniqueCodes = Array.from(
    new Set(divergences.map((item) => item.code))
  ).sort();
  const caseKey = [
    "financial",
    bookingId,
    "ledger-stripe-settlement",
    uniqueCodes.join("+"),
  ].join(":");

  const caseId = await openFinancialReconciliationCase({
    caseKey,
    bookingId,
    divergenceCode: uniqueCodes[0] ?? "financial_truth_divergence",
    reason: "Ledger KLYX, Stripe et Settlement ne convergent pas.",
    ledgerSnapshot: ledgerSnapshot(ledger),
    stripeSnapshot: {
      payment: stripePaymentSnapshot,
      transfer: stripeTransferSnapshot,
      reversal: stripeReversalSnapshot,
      refund: stripeRefundSnapshot,
      payouts: payoutSnapshots,
    },
    settlementSnapshot,
  });

  await transitionFinancialReconciliationCase({
    caseId,
    eventKey: `${caseKey}:detected`,
    newStatus: "reconciliation",
    reasonCode: "financial_truth_divergence_detected",
    details: { divergences },
  });

  await transitionFinancialReconciliationCase({
    caseId,
    eventKey: `${caseKey}:human-review`,
    newStatus: "human_review",
    reasonCode: "financial_truth_requires_human_review",
    details: {
      divergences,
      automaticCorrectionPerformed: false,
    },
  });

  return {
    status: "human_review",
    bookingId,
    caseId,
    divergences,
  };
}
