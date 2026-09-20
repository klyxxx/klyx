import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type FinancialMovementType =
  | "charge"
  | "commission"
  | "provider_liability"
  | "transfer"
  | "reversal"
  | "refund"
  | "payout";

export type FinancialBeneficiaryKind =
  | "platform"
  | "client"
  | "provider"
  | "external";

export type FinancialLedgerSource =
  | "payment_projection"
  | "settlement"
  | "refund"
  | "payout_observation"
  | "reconciliation"
  | "historical_backfill"
  | "manual";

export type FinancialStripeObjectIds = {
  stripeAccountId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripeTransferReversalId?: string | null;
  stripeRefundId?: string | null;
  stripePayoutId?: string | null;
};

export type AppendFinancialLedgerEventInput = FinancialStripeObjectIds & {
  movementKey: string;
  eventKey: string;
  movementType: FinancialMovementType;
  amountMinor: number;
  currency: string;
  bookingId: string;
  beneficiaryKind: FinancialBeneficiaryKind;
  beneficiaryRef: string;
  cause: string;
  source: FinancialLedgerSource;
  previousState?: string | null;
  newState: string;
  occurredAt: string;
  details?: Record<string, unknown>;
};

export type FinancialReconciliationState =
  | "reconciliation"
  | "human_review"
  | "resolved";

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function uuidText(value: string, code: string): string {
  const normalized = requiredText(value, code);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    throw new Error(code);
  }
  return normalized;
}

function currencyCode(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("KLYX_FINANCIAL_LEDGER_CURRENCY_INVALID");
  }
  return currency;
}

function nonNegativeInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("KLYX_FINANCIAL_LEDGER_AMOUNT_INVALID");
  }
  return value;
}

export async function appendFinancialLedgerEvent(
  input: AppendFinancialLedgerEventInput
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_append_financial_ledger_event",
    {
      p_movement_key: requiredText(
        input.movementKey,
        "KLYX_FINANCIAL_LEDGER_MOVEMENT_KEY_REQUIRED"
      ),
      p_event_key: requiredText(
        input.eventKey,
        "KLYX_FINANCIAL_LEDGER_EVENT_KEY_REQUIRED"
      ),
      p_movement_type: input.movementType,
      p_amount_minor: nonNegativeInteger(input.amountMinor),
      p_currency: currencyCode(input.currency),
      p_booking_id: requiredText(
        input.bookingId,
        "KLYX_FINANCIAL_LEDGER_BOOKING_REQUIRED"
      ),
      p_beneficiary_kind: input.beneficiaryKind,
      p_beneficiary_ref: requiredText(
        input.beneficiaryRef,
        "KLYX_FINANCIAL_LEDGER_BENEFICIARY_REQUIRED"
      ),
      p_cause: requiredText(
        input.cause,
        "KLYX_FINANCIAL_LEDGER_CAUSE_REQUIRED"
      ),
      p_source: input.source,
      p_previous_state: input.previousState ?? null,
      p_new_state: requiredText(
        input.newState,
        "KLYX_FINANCIAL_LEDGER_STATE_REQUIRED"
      ),
      p_occurred_at: requiredText(
        input.occurredAt,
        "KLYX_FINANCIAL_LEDGER_TIMESTAMP_REQUIRED"
      ),
      p_stripe_account_id: input.stripeAccountId ?? null,
      p_stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      p_stripe_charge_id: input.stripeChargeId ?? null,
      p_stripe_transfer_id: input.stripeTransferId ?? null,
      p_stripe_transfer_reversal_id:
        input.stripeTransferReversalId ?? null,
      p_stripe_refund_id: input.stripeRefundId ?? null,
      p_stripe_payout_id: input.stripePayoutId ?? null,
      p_details: input.details ?? {},
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) {
    throw new Error("KLYX_FINANCIAL_LEDGER_EVENT_NOT_WRITABLE");
  }

  return data;
}

export async function openFinancialReconciliationCase(input: {
  caseKey: string;
  bookingId: string;
  state: Exclude<FinancialReconciliationState, "resolved">;
  dimension: string;
  reasonCode: string;
  expected?: Record<string, unknown>;
  actual?: Record<string, unknown>;
  cause?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_open_financial_reconciliation_case",
    {
      p_case_key: requiredText(
        input.caseKey,
        "KLYX_FINANCIAL_RECONCILIATION_CASE_KEY_REQUIRED"
      ),
      p_booking_id: requiredText(
        input.bookingId,
        "KLYX_FINANCIAL_RECONCILIATION_BOOKING_REQUIRED"
      ),
      p_state: input.state,
      p_dimension: requiredText(
        input.dimension,
        "KLYX_FINANCIAL_RECONCILIATION_DIMENSION_REQUIRED"
      ),
      p_reason_code: requiredText(
        input.reasonCode,
        "KLYX_FINANCIAL_RECONCILIATION_REASON_REQUIRED"
      ),
      p_expected: input.expected ?? {},
      p_actual: input.actual ?? {},
      p_cause: input.cause ?? "financial_truth_divergence",
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_CASE_NOT_WRITABLE");
  }

  return data;
}

export async function recordFinancialReconciliationDecision(input: {
  caseId: string;
  eventKey: string;
  state: FinancialReconciliationState;
  cause: string;
  actorRef: string;
  details?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_record_financial_reconciliation_decision",
    {
      p_case_id: requiredText(
        input.caseId,
        "KLYX_FINANCIAL_RECONCILIATION_CASE_REQUIRED"
      ),
      p_event_key: requiredText(
        input.eventKey,
        "KLYX_FINANCIAL_RECONCILIATION_EVENT_KEY_REQUIRED"
      ),
      p_state: input.state,
      p_cause: requiredText(
        input.cause,
        "KLYX_FINANCIAL_RECONCILIATION_CAUSE_REQUIRED"
      ),
      p_actor_ref: requiredText(
        input.actorRef,
        "KLYX_FINANCIAL_RECONCILIATION_ACTOR_REQUIRED"
      ),
      p_details: input.details ?? {},
    }
  );

  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_EVENT_NOT_WRITABLE");
  }

  const { data: persistedEvent, error: persistedEventError } =
    await supabaseAdmin
      .from("financial_reconciliation_events")
      .select("state, cause, actor_type")
      .eq("id", data)
      .maybeSingle();

  if (persistedEventError) {
    throw new Error(persistedEventError.message);
  }

  if (
    persistedEvent?.state === "human_review" &&
    persistedEvent.cause === "immutable_reconciliation_event_key_conflict" &&
    persistedEvent.actor_type === "system"
  ) {
    throw new Error("KLYX_FINANCIAL_RECONCILIATION_EVENT_CONFLICT");
  }

  return data;
}

export async function recordObservedStripePayout(input: {
  bookingId: string;
  providerAccountId: string;
  amountMinor: number;
  currency: string;
  stripeAccountId: string;
  stripePayoutId: string;
  payoutState: string;
  previousState?: string | null;
  occurredAt: string;
  cause?: string;
}): Promise<string> {
  const payoutId = requiredText(
    input.stripePayoutId,
    "KLYX_FINANCIAL_LEDGER_PAYOUT_ID_REQUIRED"
  );
  const providerAccountId = uuidText(
    input.providerAccountId,
    "KLYX_FINANCIAL_LEDGER_PROVIDER_ACCOUNT_REQUIRED"
  );
  const stripeAccountId = requiredText(
    input.stripeAccountId,
    "KLYX_FINANCIAL_LEDGER_STRIPE_ACCOUNT_REQUIRED"
  );

  const { data: canonicalStripeIdentity, error: identityError } =
    await supabaseAdmin
      .from("account_stripe_connect_identities")
      .select("stripe_account_id, identity_state")
      .eq("account_id", providerAccountId)
      .maybeSingle();

  if (identityError) throw new Error(identityError.message);

  if (
    canonicalStripeIdentity?.identity_state !== "linked" ||
    canonicalStripeIdentity.stripe_account_id !== stripeAccountId
  ) {
    throw new Error("KLYX_FINANCIAL_LEDGER_PAYOUT_IDENTITY_MISMATCH");
  }

  return appendFinancialLedgerEvent({
    movementKey: `booking:${input.bookingId}:payout:${payoutId}`,
    eventKey: `stripe-payout:${payoutId}:${input.bookingId}:${input.payoutState}`,
    movementType: "payout",
    amountMinor: input.amountMinor,
    currency: input.currency,
    bookingId: input.bookingId,
    beneficiaryKind: "provider",
    beneficiaryRef: providerAccountId,
    cause: input.cause ?? "stripe_payout_observed",
    source: "payout_observation",
    previousState: input.previousState ?? null,
    newState: input.payoutState,
    occurredAt: input.occurredAt,
    stripeAccountId,
    stripePayoutId: payoutId,
  });
}
