import "server-only";

import Stripe from "stripe";

import { reconcilePlatformHeldGroupRefundFromStripe } from "@/lib/platform-held-group-settlement-server";
import { requireKlyxFinancialStripeRuntime } from "@/lib/klyx-financial-stripe-runtime";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FLOW = "platform_held_group_multiexecutor" as const;
const PAYMENT_MODE = "platform_held_group" as const;

type ParentRow = {
  id: string;
  batch_id: string;
  client_profile_id: string;
  currency: string;
  gross_amount_cents: number;
  transfer_group: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  state: string;
};

type MemberRow = {
  id: string;
  booking_ids: unknown;
};

function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && Boolean(entry.trim())
  );
}

function groupSettlementId(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.group_settlement_id?.trim() ?? "";
}

function isGroupHeldMetadata(metadata: Stripe.Metadata | null | undefined) {
  return (
    metadata?.klyx_flow === FLOW &&
    metadata?.payment_mode === PAYMENT_MODE &&
    Boolean(metadata?.group_settlement_id?.trim()) &&
    Boolean(metadata?.split_batch_id?.trim())
  );
}

async function loadParent(parentId: string): Promise<ParentRow> {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlements")
    .select(
      "id, batch_id, client_profile_id, currency, gross_amount_cents, transfer_group, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, state"
    )
    .eq("id", parentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_GROUP_HELD_PARENT_NOT_FOUND");
  return data as ParentRow;
}

async function assertParentRuntime(
  parent: ParentRow,
  observedLivemode: boolean
): Promise<boolean> {
  const runtime = await requireKlyxFinancialStripeRuntime({
    clientProfileId: parent.client_profile_id,
  });
  const expectedLive = runtime.mode !== "test";

  if (observedLivemode !== expectedLive) {
    throw new Error("KLYX_GROUP_HELD_WEBHOOK_LIVEMODE_MISMATCH");
  }

  return expectedLive;
}

async function markChildBookingsPaid(parentId: string) {
  const { data, error } = await supabaseAdmin
    .from("platform_held_group_settlement_members")
    .select("id, booking_ids")
    .eq("group_settlement_id", parentId);

  if (error) throw new Error(error.message);

  const bookingIds = Array.from(
    new Set(
      ((data ?? []) as MemberRow[]).flatMap((member) =>
        stringArray(member.booking_ids)
      )
    )
  );

  if (bookingIds.length === 0) {
    throw new Error("KLYX_GROUP_HELD_CHILD_BOOKINGS_MISSING");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_mode: PAYMENT_MODE,
      payment_failure_code: null,
      payment_failure_message: null,
      payment_failed_at: null,
      paid_at: now,
      updated_at: now,
    })
    .in("id", bookingIds);

  if (updateError) throw new Error(updateError.message);
}

async function reconcilePaidSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (!isGroupHeldMetadata(session.metadata)) {
    throw new Error("KLYX_GROUP_HELD_SESSION_METADATA_INVALID");
  }
  if (session.payment_status !== "paid") {
    throw new Error("KLYX_GROUP_HELD_SESSION_NOT_PAID");
  }

  const parentId = groupSettlementId(session.metadata);
  const parent = await loadParent(parentId);
  const expectedLive = await assertParentRuntime(parent, session.livemode);

  if (
    session.metadata?.split_batch_id !== parent.batch_id ||
    session.metadata?.settlement_transfer_group !== parent.transfer_group ||
    parent.stripe_checkout_session_id !== session.id ||
    Number(session.amount_total) !== Number(parent.gross_amount_cents) ||
    session.currency?.toUpperCase() !== parent.currency
  ) {
    throw new Error("KLYX_GROUP_HELD_SESSION_TRUTH_MISMATCH");
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (!paymentIntentId) {
    throw new Error("KLYX_GROUP_HELD_PAYMENT_INTENT_REQUIRED");
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  if (intent.livemode !== expectedLive) {
    throw new Error("KLYX_GROUP_HELD_PAYMENT_INTENT_LIVEMODE_MISMATCH");
  }
  if (
    intent.status !== "succeeded" ||
    !isGroupHeldMetadata(intent.metadata) ||
    intent.metadata.group_settlement_id !== parent.id ||
    intent.metadata.split_batch_id !== parent.batch_id ||
    intent.transfer_group !== parent.transfer_group ||
    intent.amount !== Number(parent.gross_amount_cents) ||
    intent.currency.toUpperCase() !== parent.currency
  ) {
    throw new Error("KLYX_GROUP_HELD_PAYMENT_INTENT_TRUTH_MISMATCH");
  }

  const latestCharge = intent.latest_charge;
  if (!latestCharge) throw new Error("KLYX_GROUP_HELD_CHARGE_REQUIRED");

  const charge =
    typeof latestCharge === "string"
      ? await stripe.charges.retrieve(latestCharge)
      : latestCharge;

  if (
    charge.livemode !== expectedLive ||
    !charge.paid ||
    charge.amount !== Number(parent.gross_amount_cents) ||
    charge.currency.toUpperCase() !== parent.currency
  ) {
    throw new Error("KLYX_GROUP_HELD_CHARGE_TRUTH_MISMATCH");
  }

  const { data, error } = await supabaseAdmin.rpc(
    "klyx_mark_platform_held_group_paid",
    {
      p_group_settlement_id: parent.id,
      p_checkout_session_id: session.id,
      p_payment_intent_id: intent.id,
      p_charge_id: charge.id,
      p_amount_cents: intent.amount,
      p_currency: intent.currency.toUpperCase(),
    }
  );

  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("KLYX_GROUP_HELD_PAID_STATE_NOT_WRITABLE");

  await markChildBookingsPaid(parent.id);
}

async function releaseFailedCheckout(
  parentId: string,
  checkoutSessionId: string | null
) {
  if (!checkoutSessionId) return;

  const { error } = await supabaseAdmin.rpc(
    "klyx_release_expired_platform_held_group_checkout",
    {
      p_group_settlement_id: parentId,
      p_checkout_session_id: checkoutSessionId,
    }
  );

  if (error) throw new Error(error.message);
}

export async function handlePlatformHeldGroupStripeWebhookEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<boolean> {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!isGroupHeldMetadata(session.metadata)) return false;

    if (session.payment_status === "paid") {
      await reconcilePaidSession(stripe, session);
    }
    return true;
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!isGroupHeldMetadata(session.metadata)) return false;

    const parent = await loadParent(groupSettlementId(session.metadata));
    await assertParentRuntime(parent, session.livemode);

    await releaseFailedCheckout(parent.id, session.id);
    return true;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (!isGroupHeldMetadata(intent.metadata)) return false;

    const sessions = await stripe.checkout.sessions.list({
      payment_intent: intent.id,
      limit: 1,
    });
    const session = sessions.data[0];
    if (!session) {
      throw new Error("KLYX_GROUP_HELD_CHECKOUT_SESSION_REQUIRED");
    }

    await reconcilePaidSession(stripe, session);
    return true;
  }

  if (
    event.type === "refund.created" ||
    event.type === "refund.updated" ||
    event.type === "refund.failed"
  ) {
    const refund = event.data.object as Stripe.Refund;
    return reconcilePlatformHeldGroupRefundFromStripe(refund);
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    let handled = false;

    for (const refund of charge.refunds?.data ?? []) {
      const reconciled = await reconcilePlatformHeldGroupRefundFromStripe(
        refund
      );
      handled = handled || reconciled;
    }

    return handled;
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (!isGroupHeldMetadata(intent.metadata)) return false;

    const parent = await loadParent(groupSettlementId(intent.metadata));
    await assertParentRuntime(parent, intent.livemode);

    const sessions = await stripe.checkout.sessions.list({
      payment_intent: intent.id,
      limit: 1,
    });
    await releaseFailedCheckout(parent.id, sessions.data[0]?.id ?? null);
    return true;
  }

  return false;
}
