// KLYX_GROUP_REFUND_CURRENCY_PHASE_5G
import "server-only";

import type Stripe from "stripe";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_GROUP_REFUND_HELPER_12_90
// KLYX_GROUP_REFUND_MONOTONE_RECONCILIATION_16_11
// KLYX_GROUP_REFUND_PARTIAL_REVIEW_16_12
// KLYX_GROUP_REFUND_AGGREGATE_RECONCILIATION_16_13

type GroupRow = {
  id: string;
  market_request_id: string | null;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  payment_mode: string | null;
  total_amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refund_status: string | null;
  cancellation_resolved_by: string | null;
};

type ChildRow = {
  id: string;
  status: string;
  amount_total: number | null;
  currency: string | null;
  payment_mode: string | null;
};

type RefundState = "refunded" | "failed" | "processing" | "review_required";

function refundIntentId(refund: Stripe.Refund): string | null {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ?? null;
}

function normalizeRefundStatus(refund: Stripe.Refund): "refunded" | "failed" | "processing" {
  if (refund.status === "succeeded") return "refunded";
  if (refund.status === "failed" || refund.status === "canceled") return "failed";
  return "processing";
}

async function findGroup(refund: Stripe.Refund): Promise<GroupRow | null> {
  const metadataId = refund.metadata?.booking_group_id?.trim() ?? "";

  if (metadataId) {
    const { data, error } = await supabaseAdmin
      .from("booking_groups")
      .select("id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, payment_mode, total_amount_cents, currency, stripe_payment_intent_id, stripe_refund_id, refund_status, cancellation_resolved_by")
      .eq("id", metadataId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as unknown as GroupRow;
  }

  const intentId = refundIntentId(refund);
  if (!intentId) return null;

  const { data, error } = await supabaseAdmin
    .from("booking_groups")
    .select("id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, payment_mode, total_amount_cents, currency, stripe_payment_intent_id, stripe_refund_id, refund_status, cancellation_resolved_by")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as unknown as GroupRow) : null;
}

async function loadChildren(groupId: string): Promise<ChildRow[]> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, status, amount_total, currency, payment_mode")
    .eq("booking_group_id", groupId)
    .order("group_position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ChildRow[];
}

async function groupRefundIsTerminal(groupId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("booking_groups")
    .select("refund_status")
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.refund_status === "refunded";
}

async function recordGroupRefundAudit(params: {
  groupId: string;
  actorProfileId: string;
  action: "refund_succeeded" | "refund_failed";
  reason: string;
  stripeRefundId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("booking_group_cancellation_events")
    .upsert(
      {
        booking_group_id: params.groupId,
        actor_profile_id: params.actorProfileId,
        actor_role: "system",
        action: params.action,
        reason: params.reason,
        stripe_refund_id: params.stripeRefundId,
      },
      {
        onConflict: "booking_group_id,action,stripe_refund_id",
        ignoreDuplicates: true,
      }
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return true;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("booking_group_cancellation_events")
    .select("id")
    .eq("booking_group_id", params.groupId)
    .eq("action", params.action)
    .eq("stripe_refund_id", params.stripeRefundId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  return Boolean(existing);
}

async function notify(params: {
  group: GroupRow;
  userId: string;
  bookingId: string | null;
  title: string;
  message: string;
  key: string;
}) {
  const { error } = await supabaseAdmin
    .from("user_notifications")
    .upsert(
      {
        user_id: params.userId,
        booking_id: params.bookingId,
        market_request_id: params.group.market_request_id,
        type: "system",
        title: params.title,
        message: params.message,
        href: `/booking-groups/${params.group.id}`,
        deduplication_key: params.key,
      },
      {
        onConflict: "deduplication_key",
        ignoreDuplicates: true,
      }
    );

  if (error) console.error("Group refund notification:", error.message);
}

function groupTotal(group: GroupRow): number {
  const total = Number(group.total_amount_cents);
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("KLYX_GROUP_REFUND_GROSS_AMOUNT_INVALID");
  }
  return total;
}

function refundAmountLabel(amount: number, currency: string): string {
  const code = String(currency ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code)
    ? `${(amount / 100).toFixed(2)} ${code}`
    : (amount / 100).toFixed(2);
}

function distributeRefundAmount(
  children: ChildRow[],
  total: number,
  refundAmount: number
): Array<{ child: ChildRow; share: number }> {
  if (children.length === 0) throw new Error("KLYX_GROUP_REFUND_CHILDREN_MISSING");

  let distributed = 0;
  return children.map((child, index) => {
    const gross = Math.max(Number(child.amount_total ?? 0), 0);
    const share =
      index === children.length - 1
        ? Math.max(refundAmount - distributed, 0)
        : Math.floor((refundAmount * gross) / total);

    distributed += share;
    return { child, share };
  });
}

async function persistSucceededRefundLedger(params: {
  group: GroupRow;
  children: ChildRow[];
  refund: Stripe.Refund;
  intentId: string | null;
}) {
  const total = groupTotal(params.group);

  for (const { child, share } of distributeRefundAmount(params.children, total, params.refund.amount)) {
    await upsertFinancialLedgerEntry({
      bookingId: child.id,
      entryKey: `booking:${child.id}:group-refund:${params.refund.id}`,
      entryType: "refund_succeeded",
      status: "succeeded",
      currency: child.currency ?? params.group.currency,
      grossAmountCents: Math.max(Number(child.amount_total ?? 0), 0),
      refundAmountCents: share,
      paymentMode: child.payment_mode ?? params.group.payment_mode,
      stripePaymentIntentId: params.intentId,
      stripeRefundId: params.refund.id,
    });
  }
}

async function aggregateSucceededRefunds(
  children: ChildRow[],
  intentId: string | null
): Promise<number> {
  const childIds = children.map((child) => child.id);
  if (childIds.length === 0) return 0;

  let query = supabaseAdmin
    .from("booking_financial_ledger")
    .select("refund_amount_cents, stripe_payment_intent_id")
    .in("booking_id", childIds)
    .eq("entry_type", "refund_succeeded")
    .eq("status", "succeeded");

  if (intentId) query = query.eq("stripe_payment_intent_id", intentId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).reduce(
    (sum, row) => sum + Math.max(Number(row.refund_amount_cents ?? 0), 0),
    0
  );
}

async function finalizeRefundedGroup(params: {
  group: GroupRow;
  children: ChildRow[];
  refund: Stripe.Refund;
  now: string;
}) {
  const actorId = params.group.cancellation_resolved_by ?? params.group.client_profile_id;
  const events = params.children
    .filter((child) => !["cancelled", "rejected"].includes(child.status))
    .map((child) => ({
      booking_id: child.id,
      actor_id: actorId,
      previous_status: child.status,
      new_status: "cancelled",
      note: "Mission groupee annulee apres remboursement Stripe cumule confirme.",
    }));

  if (events.length > 0) {
    const { error } = await supabaseAdmin.from("booking_status_events").insert(events);
    if (error) throw new Error(error.message);
  }

  for (const child of params.children) {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        service_status: "cancelled",
        payment_status: "refunded",
        refund_status: "succeeded",
        stripe_refund_id: params.refund.id,
        refunded_amount_cents: Math.max(Number(child.amount_total ?? 0), 0),
        refunded_at: params.now,
        updated_at: params.now,
      })
      .eq("id", child.id)
      .neq("payment_status", "refunded");

    if (error) throw new Error(error.message);
  }

  const auditRecorded = await recordGroupRefundAudit({
    groupId: params.group.id,
    actorProfileId: actorId,
    action: "refund_succeeded",
    reason: "Remboursement Stripe groupe cumule confirme.",
    stripeRefundId: params.refund.id,
  });

  if (!auditRecorded) throw new Error("KLYX_GROUP_REFUND_SUCCESS_AUDIT_MISSING");

  const firstBookingId = params.children[0]?.id ?? null;
  const amountLabel = refundAmountLabel(groupTotal(params.group), params.group.currency);

  await Promise.all([
    notify({
      group: params.group,
      userId: params.group.client_profile_id,
      bookingId: firstBookingId,
      title: "Mission groupee remboursee",
      message: `Stripe a confirme le remboursement cumule de ${amountLabel} pour toute la mission.`,
      key: `booking-group:${params.group.id}:refund-success:client`,
    }),
    notify({
      group: params.group,
      userId: params.group.provider_profile_id,
      bookingId: firstBookingId,
      title: "Mission groupee annulee",
      message: "Le remboursement groupe a ete confirme. Tous les creneaux sont annules.",
      key: `booking-group:${params.group.id}:refund-success:provider`,
    }),
  ]);
}

export async function tryReconcileBookingGroupStripeRefund(
  refund: Stripe.Refund
): Promise<boolean> {
  const group = await findGroup(refund);
  if (!group) return false;

  const incomingIntentId = refundIntentId(refund);
  if (
    group.stripe_payment_intent_id &&
    incomingIntentId &&
    group.stripe_payment_intent_id !== incomingIntentId
  ) {
    return true;
  }

  if (group.refund_status === "refunded") return true;

  const intentId = incomingIntentId ?? group.stripe_payment_intent_id;
  const children = await loadChildren(group.id);
  const total = groupTotal(group);
  const normalized = normalizeRefundStatus(refund);

  if (normalized === "refunded") {
    await persistSucceededRefundLedger({ group, children, refund, intentId });
  }

  const succeededAmount = await aggregateSucceededRefunds(children, intentId);
  if (succeededAmount > total) {
    throw new Error("KLYX_GROUP_REFUND_AGGREGATE_EXCEEDS_TOTAL");
  }

  const fullyRefunded = succeededAmount === total;
  const hasSucceededPartial = succeededAmount > 0 && !fullyRefunded;

  let state: RefundState;
  if (fullyRefunded) state = "refunded";
  else if (hasSucceededPartial || group.refund_status === "review_required") state = "review_required";
  else state = normalized;

  const now = new Date().toISOString();
  const update = {
    stripe_refund_id: refund.id,
    refund_status: state,
    refunded_amount_cents: succeededAmount,
    refunded_at: state === "refunded" ? now : null,
    ...(state === "refunded"
      ? { status: "cancelled", payment_status: "refunded" }
      : {}),
    updated_at: now,
  };

  // SQL `<>` excludes NULL, so keep legacy rows eligible explicitly.
  let groupUpdate = supabaseAdmin
    .from("booking_groups")
    .update(update)
    .eq("id", group.id)
    .or("refund_status.is.null,refund_status.neq.refunded");

  if (state !== "refunded") {
    groupUpdate = groupUpdate.neq("payment_status", "refunded");
  }

  const { data: updatedGroup, error: groupError } = await groupUpdate
    .select("id")
    .maybeSingle();

  if (groupError) throw new Error(groupError.message);

  if (!updatedGroup) {
    if (await groupRefundIsTerminal(group.id)) return true;
    throw new Error("KLYX_GROUP_REFUND_STATE_UPDATE_LOST");
  }

  const firstBookingId = children[0]?.id ?? null;

  if (state === "review_required") {
    await notify({
      group,
      userId: group.client_profile_id,
      bookingId: firstBookingId,
      title: "Remboursement groupe a verifier",
      message:
        `Stripe a confirme ${refundAmountLabel(succeededAmount, group.currency)} sur ` +
        `${refundAmountLabel(total, group.currency)}. ` +
        "KLYX conserve la mission en verification jusqu'au remboursement complet.",
      key: `booking-group:${group.id}:refund-partial-review:client`,
    });
    return true;
  }

  if (state === "refunded") {
    await finalizeRefundedGroup({ group, children, refund, now });
    return true;
  }

  if (state === "failed") {
    const failure = refund.failure_reason || "Stripe n a pas finalise le remboursement groupe.";
    const auditRecorded = await recordGroupRefundAudit({
      groupId: group.id,
      actorProfileId: group.cancellation_resolved_by ?? group.client_profile_id,
      action: "refund_failed",
      reason: failure,
      stripeRefundId: refund.id,
    });

    if (!auditRecorded || (await groupRefundIsTerminal(group.id))) return true;

    await Promise.all([
      notify({
        group,
        userId: group.client_profile_id,
        bookingId: firstBookingId,
        title: "Remboursement groupe a verifier",
        message: failure,
        key: `booking-group:${group.id}:refund-failed:client`,
      }),
      notify({
        group,
        userId: group.provider_profile_id,
        bookingId: firstBookingId,
        title: "Remboursement groupe a verifier",
        message: failure,
        key: `booking-group:${group.id}:refund-failed:provider`,
      }),
    ]);
  }

  return true;
}
