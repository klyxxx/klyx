import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type CanonicalFinancialMovement =
  | "charge"
  | "commission"
  | "provider_liability"
  | "transfer"
  | "reversal"
  | "refund"
  | "payout";

export type CanonicalFinancialBeneficiary =
  | "platform"
  | "client"
  | "provider"
  | "external";

export type CanonicalFinancialSource =
  | "payment"
  | "settlement"
  | "refund"
  | "payout"
  | "reconciliation"
  | "migration";

type BookingAccountingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type SettlementAccountingRow = {
  booking_id: string;
  provider_profile_id: string;
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

function normalizeCurrency(value: string | null | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("KLYX_CANONICAL_LEDGER_CURRENCY_REQUIRED");
  }
  return currency;
}

function positiveInteger(value: number | null | undefined, code: string): number {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(code);
  }
  return amount;
}

async function profileAccountId(profileId: string | null): Promise<string | null> {
  if (!profileId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.account_id ? String(data.account_id) : null;
}

export async function appendCanonicalFinancialMovement(input: {
  eventKey: string;
  movementType: CanonicalFinancialMovement;
  amountCents: number;
  currency: string;
  bookingId?: string | null;
  bookingIds?: string[];
  beneficiaryType: CanonicalFinancialBeneficiary;
  beneficiaryAccountId?: string | null;
  beneficiaryProfileId?: string | null;
  cause: string;
  previousState?: string | null;
  newState?: string | null;
  source: CanonicalFinancialSource;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripeTransferReversalId?: string | null;
  stripeRefundId?: string | null;
  stripePayoutId?: string | null;
  stripeBalanceTransactionId?: string | null;
  settlementReference?: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const amountCents = positiveInteger(
    input.amountCents,
    "KLYX_CANONICAL_LEDGER_AMOUNT_INVALID"
  );

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_append_financial_ledger_entry",
    {
      p_event_key: input.eventKey,
      p_movement_type: input.movementType,
      p_amount_cents: amountCents,
      p_currency: normalizeCurrency(input.currency),
      p_booking_id: input.bookingId ?? null,
      p_booking_ids: input.bookingIds ?? [],
      p_beneficiary_type: input.beneficiaryType,
      p_beneficiary_account_id: input.beneficiaryAccountId ?? null,
      p_beneficiary_profile_id: input.beneficiaryProfileId ?? null,
      p_cause: input.cause,
      p_previous_state: input.previousState ?? null,
      p_new_state: input.newState ?? null,
      p_source: input.source,
      p_stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      p_stripe_charge_id: input.stripeChargeId ?? null,
      p_stripe_transfer_id: input.stripeTransferId ?? null,
      p_stripe_transfer_reversal_id:
        input.stripeTransferReversalId ?? null,
      p_stripe_refund_id: input.stripeRefundId ?? null,
      p_stripe_payout_id: input.stripePayoutId ?? null,
      p_stripe_balance_transaction_id:
        input.stripeBalanceTransactionId ?? null,
      p_settlement_reference: input.settlementReference ?? null,
      p_occurred_at: input.occurredAt ?? new Date().toISOString(),
      p_metadata: input.metadata ?? {},
    }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_CANONICAL_LEDGER_APPEND_FAILED");

  return String(data);
}

async function loadBookingAccounting(
  bookingId: string
): Promise<BookingAccountingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, payment_status, payment_mode, amount_total, currency, platform_fee_amount, provider_amount, stripe_checkout_session_id, stripe_payment_intent_id"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_CANONICAL_LEDGER_BOOKING_NOT_FOUND");

  return data as BookingAccountingRow;
}

async function loadSettlementAccounting(
  bookingId: string
): Promise<SettlementAccountingRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, state"
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as SettlementAccountingRow) : null;
}

export async function recordCanonicalChargeAccounting(input: {
  bookingId: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  cause?: string;
  occurredAt?: string;
}): Promise<void> {
  const [booking, settlement] = await Promise.all([
    loadBookingAccounting(input.bookingId),
    loadSettlementAccounting(input.bookingId),
  ]);

  const providerProfileId =
    settlement?.provider_profile_id ??
    booking.provider_id ??
    booking.babysitter_id;

  if (!providerProfileId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_REQUIRED");
  }

  const providerAccountId = await profileAccountId(providerProfileId);
  if (!providerAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_ACCOUNT_REQUIRED");
  }

  const gross = positiveInteger(
    settlement?.gross_amount_cents ?? booking.amount_total,
    "KLYX_CANONICAL_LEDGER_GROSS_INVALID"
  );
  const fee = Number(
    settlement?.platform_fee_cents ?? booking.platform_fee_amount ?? 0
  );
  const providerAmount = Number(
    settlement?.provider_amount_cents ??
      booking.provider_amount ??
      gross - fee
  );

  if (
    !Number.isSafeInteger(fee) ||
    fee < 0 ||
    !Number.isSafeInteger(providerAmount) ||
    providerAmount < 0 ||
    fee + providerAmount !== gross
  ) {
    throw new Error("KLYX_CANONICAL_LEDGER_ECONOMICS_DIVERGENCE");
  }

  const currency = normalizeCurrency(settlement?.currency ?? booking.currency);
  const checkoutSessionId =
    input.stripeCheckoutSessionId ??
    settlement?.stripe_checkout_session_id ??
    booking.stripe_checkout_session_id;
  const paymentIntentId =
    input.stripePaymentIntentId ??
    settlement?.stripe_payment_intent_id ??
    booking.stripe_payment_intent_id;
  const chargeId = input.stripeChargeId ?? settlement?.stripe_charge_id ?? null;
  const externalIdentity =
    paymentIntentId ?? checkoutSessionId ?? chargeId ?? input.bookingId;
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const previousState = input.previousState ?? "payment_pending";
  const newState = input.newState ?? "paid";
  const cause = input.cause ?? "booking_payment_confirmed";

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:charge:${externalIdentity}`,
    movementType: "charge",
    amountCents: gross,
    currency,
    bookingId: input.bookingId,
    beneficiaryType: "platform",
    cause,
    previousState,
    newState,
    source: "payment",
    stripeCheckoutSessionId: checkoutSessionId,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    settlementReference: settlement
      ? `booking_settlement:${input.bookingId}`
      : null,
    occurredAt,
    metadata: {
      paymentMode: booking.payment_mode,
      accountingComponent: "gross_charge",
    },
  });

  if (fee > 0) {
    await appendCanonicalFinancialMovement({
      eventKey: `booking:${input.bookingId}:commission:${externalIdentity}`,
      movementType: "commission",
      amountCents: fee,
      currency,
      bookingId: input.bookingId,
      beneficiaryType: "platform",
      cause: "klyx_commission_recognized",
      previousState,
      newState,
      source: "payment",
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      settlementReference: settlement
        ? `booking_settlement:${input.bookingId}`
        : null,
      occurredAt,
      metadata: {
        paymentMode: booking.payment_mode,
        accountingComponent: "platform_commission",
      },
    });
  }

  if (providerAmount > 0) {
    await appendCanonicalFinancialMovement({
      eventKey: `booking:${input.bookingId}:provider-liability:${externalIdentity}`,
      movementType: "provider_liability",
      amountCents: providerAmount,
      currency,
      bookingId: input.bookingId,
      beneficiaryType: "provider",
      beneficiaryAccountId: providerAccountId,
      beneficiaryProfileId: providerProfileId,
      cause: "provider_liability_recognized",
      previousState,
      newState,
      source: "payment",
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      settlementReference: settlement
        ? `booking_settlement:${input.bookingId}`
        : null,
      occurredAt,
      metadata: {
        paymentMode: booking.payment_mode,
        accountingComponent: "provider_liability",
      },
    });
  }
}

export async function recordCanonicalTransfer(input: {
  bookingId: string;
  transferId: string;
  amountCents: number;
  currency: string;
  providerProfileId: string;
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  reconciled?: boolean;
}): Promise<void> {
  const providerAccountId = await profileAccountId(input.providerProfileId);
  if (!providerAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_ACCOUNT_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:transfer:${input.transferId}`,
    movementType: "transfer",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryType: "provider",
    beneficiaryAccountId: providerAccountId,
    beneficiaryProfileId: input.providerProfileId,
    cause: input.reconciled
      ? "provider_transfer_reconciled"
      : "provider_transfer_released",
    previousState: input.previousState ?? "release_claimed",
    newState: input.newState ?? "released",
    source: input.reconciled ? "reconciliation" : "settlement",
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    stripeTransferId: input.transferId,
    settlementReference: `booking_settlement:${input.bookingId}`,
    metadata: { reconciled: Boolean(input.reconciled) },
  });
}

export async function recordCanonicalReversal(input: {
  bookingId: string;
  transferId: string;
  reversalId: string;
  amountCents: number;
  currency: string;
  providerProfileId: string;
  previousState?: string | null;
  newState?: string | null;
  reconciled?: boolean;
}): Promise<void> {
  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:reversal:${input.reversalId}`,
    movementType: "reversal",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryType: "platform",
    beneficiaryProfileId: input.providerProfileId,
    cause: input.reconciled
      ? "provider_transfer_reversal_reconciled"
      : "provider_transfer_reversed_for_refund",
    previousState: input.previousState ?? "released",
    newState: input.newState ?? "refund_pending",
    source: input.reconciled ? "reconciliation" : "settlement",
    stripeTransferId: input.transferId,
    stripeTransferReversalId: input.reversalId,
    settlementReference: `booking_settlement:${input.bookingId}`,
    metadata: { reconciled: Boolean(input.reconciled) },
  });
}

export async function recordCanonicalRefund(input: {
  bookingId: string;
  refundId: string;
  amountCents: number;
  currency: string;
  clientProfileId: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  previousState?: string | null;
  newState?: string | null;
}): Promise<void> {
  const clientAccountId = await profileAccountId(input.clientProfileId);
  if (!clientAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_CLIENT_ACCOUNT_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:refund:${input.refundId}`,
    movementType: "refund",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryType: "client",
    beneficiaryAccountId: clientAccountId,
    beneficiaryProfileId: input.clientProfileId,
    cause: "customer_refund_succeeded",
    previousState: input.previousState ?? "paid",
    newState: input.newState ?? "refunded",
    source: "refund",
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeChargeId: input.stripeChargeId ?? null,
    stripeRefundId: input.refundId,
  });
}


export async function recordCanonicalPaymentFromLegacyLedger(input: {
  bookingId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number | null;
  currency: string;
  paymentMode?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  const booking = await loadBookingAccounting(input.bookingId);
  const settlement = await loadSettlementAccounting(input.bookingId);
  const providerProfileId =
    settlement?.provider_profile_id ??
    booking.provider_id ??
    booking.babysitter_id;

  if (!providerProfileId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_REQUIRED");
  }

  const providerAccountId = await profileAccountId(providerProfileId);
  if (!providerAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_ACCOUNT_REQUIRED");
  }

  const gross = positiveInteger(
    settlement?.gross_amount_cents ?? input.grossAmountCents,
    "KLYX_CANONICAL_LEDGER_GROSS_INVALID"
  );
  const fee = Number(
    settlement?.platform_fee_cents ?? input.platformFeeCents ?? 0
  );
  const providerAmount = Number(
    settlement?.provider_amount_cents ??
      input.providerAmountCents ??
      Math.max(gross - fee, 0)
  );

  if (
    !Number.isSafeInteger(fee) ||
    fee < 0 ||
    !Number.isSafeInteger(providerAmount) ||
    providerAmount < 0 ||
    fee + providerAmount !== gross
  ) {
    throw new Error("KLYX_CANONICAL_LEDGER_ECONOMICS_DIVERGENCE");
  }

  const currency = normalizeCurrency(
    settlement?.currency ?? input.currency ?? booking.currency
  );
  const checkoutSessionId =
    input.stripeCheckoutSessionId ??
    settlement?.stripe_checkout_session_id ??
    booking.stripe_checkout_session_id;
  const paymentIntentId =
    input.stripePaymentIntentId ??
    settlement?.stripe_payment_intent_id ??
    booking.stripe_payment_intent_id;
  const externalIdentity =
    paymentIntentId ?? checkoutSessionId ?? input.bookingId;
  const settlementReference = settlement
    ? `booking_settlement:${input.bookingId}`
    : null;
  const paymentMode =
    settlement?.payment_mode ?? input.paymentMode ?? booking.payment_mode;

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:charge:${externalIdentity}`,
    movementType: "charge",
    amountCents: gross,
    currency,
    bookingId: input.bookingId,
    beneficiaryType: "platform",
    cause: "booking_payment_confirmed",
    previousState: "payment_pending",
    newState: "paid",
    source: "payment",
    stripeCheckoutSessionId: checkoutSessionId,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: settlement?.stripe_charge_id ?? null,
    settlementReference,
    metadata: { paymentMode, bridge: "booking_financial_ledger" },
  });

  if (fee > 0) {
    await appendCanonicalFinancialMovement({
      eventKey: `booking:${input.bookingId}:commission:${externalIdentity}`,
      movementType: "commission",
      amountCents: fee,
      currency,
      bookingId: input.bookingId,
      beneficiaryType: "platform",
      cause: "klyx_commission_recognized",
      previousState: "payment_pending",
      newState: "paid",
      source: "payment",
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: settlement?.stripe_charge_id ?? null,
      settlementReference,
      metadata: { paymentMode, bridge: "booking_financial_ledger" },
    });
  }

  if (providerAmount > 0) {
    await appendCanonicalFinancialMovement({
      eventKey: `booking:${input.bookingId}:provider-liability:${externalIdentity}`,
      movementType: "provider_liability",
      amountCents: providerAmount,
      currency,
      bookingId: input.bookingId,
      beneficiaryType: "provider",
      beneficiaryAccountId: providerAccountId,
      beneficiaryProfileId: providerProfileId,
      cause: "provider_liability_recognized",
      previousState: "payment_pending",
      newState: "paid",
      source: "payment",
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: settlement?.stripe_charge_id ?? null,
      settlementReference,
      metadata: { paymentMode, bridge: "booking_financial_ledger" },
    });
  }
}

export async function recordCanonicalRefundFromLegacyLedger(input: {
  bookingId: string;
  refundAmountCents: number;
  currency: string;
  stripePaymentIntentId?: string | null;
  stripeRefundId: string;
}): Promise<void> {
  const booking = await loadBookingAccounting(input.bookingId);
  const clientAccountId = await profileAccountId(booking.parent_id);

  if (!clientAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_CLIENT_ACCOUNT_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:refund:${input.stripeRefundId}`,
    movementType: "refund",
    amountCents: input.refundAmountCents,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryType: "client",
    beneficiaryAccountId: clientAccountId,
    beneficiaryProfileId: booking.parent_id,
    cause: "customer_refund_succeeded",
    previousState: "paid",
    newState: "refund_confirmed",
    source: "refund",
    stripePaymentIntentId:
      input.stripePaymentIntentId ?? booking.stripe_payment_intent_id,
    stripeRefundId: input.stripeRefundId,
    metadata: { bridge: "booking_financial_ledger" },
  });
}


export async function recordCanonicalAggregateTransfer(input: {
  bookingIds: string[];
  transferId: string;
  amountCents: number;
  currency: string;
  providerAccountId: string;
  providerProfileId: string;
  stripeChargeId?: string | null;
  settlementReference: string;
  reconciled?: boolean;
}): Promise<void> {
  const bookingIds = Array.from(
    new Set(input.bookingIds.map((value) => value.trim()).filter(Boolean))
  );

  if (bookingIds.length === 0) {
    throw new Error("KLYX_CANONICAL_LEDGER_BOOKING_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `group-transfer:${input.transferId}`,
    movementType: "transfer",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingIds,
    beneficiaryType: "provider",
    beneficiaryAccountId: input.providerAccountId,
    beneficiaryProfileId: input.providerProfileId,
    cause: input.reconciled
      ? "group_provider_transfer_reconciled"
      : "group_provider_transfer_released",
    previousState: "release_claimed",
    newState: "released",
    source: input.reconciled ? "reconciliation" : "settlement",
    stripeChargeId: input.stripeChargeId ?? null,
    stripeTransferId: input.transferId,
    settlementReference: input.settlementReference,
    metadata: {
      reconciled: Boolean(input.reconciled),
      aggregateBookingCount: bookingIds.length,
    },
  });
}

export async function recordCanonicalAggregateReversal(input: {
  bookingIds: string[];
  transferId: string;
  reversalId: string;
  amountCents: number;
  currency: string;
  providerAccountId: string;
  providerProfileId: string;
  settlementReference: string;
  reconciled?: boolean;
}): Promise<void> {
  const bookingIds = Array.from(
    new Set(input.bookingIds.map((value) => value.trim()).filter(Boolean))
  );

  if (bookingIds.length === 0) {
    throw new Error("KLYX_CANONICAL_LEDGER_BOOKING_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `group-reversal:${input.reversalId}`,
    movementType: "reversal",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingIds,
    beneficiaryType: "platform",
    beneficiaryAccountId: null,
    beneficiaryProfileId: input.providerProfileId,
    cause: input.reconciled
      ? "group_provider_transfer_reversal_reconciled"
      : "group_provider_transfer_reversed_for_refund",
    previousState: "released",
    newState: "refund_pending",
    source: input.reconciled ? "reconciliation" : "settlement",
    stripeTransferId: input.transferId,
    stripeTransferReversalId: input.reversalId,
    settlementReference: input.settlementReference,
    metadata: {
      providerAccountId: input.providerAccountId,
      reconciled: Boolean(input.reconciled),
      aggregateBookingCount: bookingIds.length,
    },
  });
}

export async function recordCanonicalPayoutAllocation(input: {
  bookingId: string;
  payoutId: string;
  amountCents: number;
  currency: string;
  providerProfileId: string;
  stripeBalanceTransactionId?: string | null;
  previousState?: string | null;
  newState?: string | null;
}): Promise<void> {
  const providerAccountId = await profileAccountId(input.providerProfileId);
  if (!providerAccountId) {
    throw new Error("KLYX_CANONICAL_LEDGER_PROVIDER_ACCOUNT_REQUIRED");
  }

  await appendCanonicalFinancialMovement({
    eventKey: `booking:${input.bookingId}:payout:${input.payoutId}`,
    movementType: "payout",
    amountCents: input.amountCents,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryType: "provider",
    beneficiaryAccountId: providerAccountId,
    beneficiaryProfileId: input.providerProfileId,
    cause: "stripe_bank_payout_observed",
    previousState: input.previousState ?? "released",
    newState: input.newState ?? "paid_out",
    source: "payout",
    stripePayoutId: input.payoutId,
    stripeBalanceTransactionId: input.stripeBalanceTransactionId ?? null,
  });
}

export async function openFinancialReconciliationCase(input: {
  caseKey: string;
  bookingId?: string | null;
  bookingIds?: string[];
  divergenceCode: string;
  reason: string;
  ledgerSnapshot: Record<string, unknown>;
  stripeSnapshot: Record<string, unknown>;
  settlementSnapshot: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_open_financial_reconciliation_case",
    {
      p_case_key: input.caseKey,
      p_booking_id: input.bookingId ?? null,
      p_booking_ids: input.bookingIds ?? [],
      p_divergence_code: input.divergenceCode,
      p_reason: input.reason,
      p_ledger_snapshot: input.ledgerSnapshot,
      p_stripe_snapshot: input.stripeSnapshot,
      p_settlement_snapshot: input.settlementSnapshot,
    }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_RECONCILIATION_CASE_NOT_WRITABLE");
  return String(data);
}

export async function transitionFinancialReconciliationCase(input: {
  caseId: string;
  eventKey: string;
  newStatus: "reconciliation" | "human_review" | "resolved";
  reasonCode: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_transition_financial_reconciliation_case",
    {
      p_case_id: input.caseId,
      p_event_key: input.eventKey,
      p_new_status: input.newStatus,
      p_reason_code: input.reasonCode,
      p_details: input.details ?? {},
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("KLYX_RECONCILIATION_CASE_TRANSITION_FAILED");
  }
}
