import "server-only";

import type Stripe from "stripe";

import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import {
  providerPaymentsReadyEmail,
} from "@/lib/email/lifecycle-templates";
import {
  sendBookingPaymentFailedEmail,
  sendBookingPaymentSucceededEmails,
  sendBookingRefundConfirmedEmail,
  sendBookingRefundFailedEmail,
  sendGroupPaymentFailedEmail,
  sendGroupPaymentSucceededEmails,
  sendGroupRefundConfirmedEmails,
  sendGroupRefundFailedEmails,
  sendGroupRefundStartedEmails,
  sendSplitPaymentExpiredEmail,
  sendSplitPaymentFailedEmail,
  sendSplitPaymentSucceededEmails,
  sendSplitRefundStatusEmail,
} from "@/lib/email/payment-event-emails";
import { logServerWarning } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BookingPaymentEmailRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  payment_status: string | null;
};

type GroupPaymentEmailRow = {
  id: string;
  client_profile_id: string;
  provider_profile_id: string;
  payment_status: string | null;
  refund_status: string | null;
};

type SplitPaymentEmailRow = {
  id: string;
  client_profile_id: string;
  provider_profile_id: string;
  booking_ids: unknown;
  status: string;
  refund_status: string;
};

function warn(code: string): void {
  logServerWarning({
    event: "stripe_transactional_email_hook_failed",
    code,
  });
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && Boolean(item.trim())
  );
}

function refundPaymentIntentId(refund: Stripe.Refund): string | null {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ?? null;
}

async function bookingFromSession(
  session: Stripe.Checkout.Session
): Promise<BookingPaymentEmailRow | null> {
  const bookingId = session.metadata?.booking_id?.trim();

  let query = supabaseAdmin
    .from("bookings")
    .select("id, parent_id, provider_id, babysitter_id, payment_status");

  query = bookingId
    ? query.eq("id", bookingId)
    : query.eq("stripe_checkout_session_id", session.id);

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as BookingPaymentEmailRow) : null;
}

async function bookingFromIntent(
  intent: Stripe.PaymentIntent
): Promise<BookingPaymentEmailRow | null> {
  const bookingId = intent.metadata?.booking_id?.trim();

  let query = supabaseAdmin
    .from("bookings")
    .select("id, parent_id, provider_id, babysitter_id, payment_status");

  query = bookingId
    ? query.eq("id", bookingId)
    : query.eq("stripe_payment_intent_id", intent.id);

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as BookingPaymentEmailRow) : null;
}

async function bookingFromRefund(
  refund: Stripe.Refund,
  intentId: string | null
): Promise<BookingPaymentEmailRow | null> {
  const bookingId = refund.metadata?.booking_id?.trim();
  if (!bookingId && !intentId) return null;

  let query = supabaseAdmin
    .from("bookings")
    .select("id, parent_id, provider_id, babysitter_id, payment_status");

  query = bookingId
    ? query.eq("id", bookingId)
    : query.eq("stripe_payment_intent_id", intentId as string);

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as BookingPaymentEmailRow) : null;
}

async function groupFromSession(
  session: Stripe.Checkout.Session
): Promise<GroupPaymentEmailRow | null> {
  const groupId = session.metadata?.booking_group_id?.trim();

  let query = supabaseAdmin
    .from("booking_groups")
    .select(
      "id, client_profile_id, provider_profile_id, payment_status, refund_status"
    );

  query = groupId
    ? query.eq("id", groupId)
    : query.eq("stripe_checkout_session_id", session.id);

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as GroupPaymentEmailRow) : null;
}

async function groupFromIntentId(
  intentId: string
): Promise<GroupPaymentEmailRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_groups")
    .select(
      "id, client_profile_id, provider_profile_id, payment_status, refund_status"
    )
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as GroupPaymentEmailRow) : null;
}

async function splitUnitById(
  unitId: string
): Promise<SplitPaymentEmailRow | null> {
  const { data, error } = await supabaseAdmin
    .from("split_booking_payment_units")
    .select(
      "id, client_profile_id, provider_profile_id, booking_ids, status, refund_status"
    )
    .eq("id", unitId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as SplitPaymentEmailRow) : null;
}

async function splitUnitFromIntentId(
  intentId: string
): Promise<SplitPaymentEmailRow | null> {
  const { data, error } = await supabaseAdmin
    .from("split_booking_payment_units")
    .select(
      "id, client_profile_id, provider_profile_id, booking_ids, status, refund_status"
    )
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as SplitPaymentEmailRow) : null;
}

async function sendBookingStateEmail(
  booking: BookingPaymentEmailRow
): Promise<void> {
  if (booking.payment_status === "paid") {
    await sendBookingPaymentSucceededEmails({
      bookingId: booking.id,
      clientProfileId: booking.parent_id,
      providerProfileId: booking.provider_id ?? booking.babysitter_id,
    });
  }

  if (booking.payment_status === "failed") {
    await sendBookingPaymentFailedEmail({
      bookingId: booking.id,
      clientProfileId: booking.parent_id,
    });
  }
}

async function sendGroupStateEmail(
  group: GroupPaymentEmailRow
): Promise<void> {
  if (group.payment_status === "paid") {
    await sendGroupPaymentSucceededEmails({
      groupId: group.id,
      clientProfileId: group.client_profile_id,
      providerProfileId: group.provider_profile_id,
    });
  }

  if (group.payment_status === "failed") {
    await sendGroupPaymentFailedEmail({
      groupId: group.id,
      clientProfileId: group.client_profile_id,
    });
  }
}

async function sendSplitStateEmail(
  unit: SplitPaymentEmailRow
): Promise<void> {
  const bookingId = stringArray(unit.booking_ids)[0];
  if (!bookingId) return;

  if (unit.status === "paid") {
    await sendSplitPaymentSucceededEmails({
      unitId: unit.id,
      bookingId,
      clientProfileId: unit.client_profile_id,
      providerProfileId: unit.provider_profile_id,
    });
  }

  if (unit.status === "failed") {
    await sendSplitPaymentFailedEmail({
      unitId: unit.id,
      bookingId,
      clientProfileId: unit.client_profile_id,
    });
  }

  if (unit.status === "expired") {
    await sendSplitPaymentExpiredEmail({
      unitId: unit.id,
      bookingId,
      clientProfileId: unit.client_profile_id,
    });
  }
}

async function sendCheckoutEmail(
  session: Stripe.Checkout.Session
): Promise<void> {
  const splitUnitId = session.metadata?.split_payment_unit_id?.trim();
  if (splitUnitId) {
    const unit = await splitUnitById(splitUnitId);
    if (unit) await sendSplitStateEmail(unit);
    return;
  }

  if (session.metadata?.booking_group_id) {
    const group = await groupFromSession(session);
    if (group) await sendGroupStateEmail(group);
    return;
  }

  const booking = await bookingFromSession(session);
  if (booking) await sendBookingStateEmail(booking);
}

async function sendIntentEmail(
  intent: Stripe.PaymentIntent
): Promise<void> {
  const splitUnitId = intent.metadata?.split_payment_unit_id?.trim();
  if (splitUnitId) {
    const unit = await splitUnitById(splitUnitId);
    if (unit) await sendSplitStateEmail(unit);
    return;
  }

  if (intent.metadata?.booking_group_id) {
    const group = await groupFromIntentId(intent.id);
    if (group) await sendGroupStateEmail(group);
    return;
  }

  const booking = await bookingFromIntent(intent);
  if (booking) await sendBookingStateEmail(booking);
}

async function sendRefundEmail(refund: Stripe.Refund): Promise<void> {
  const intentId = refundPaymentIntentId(refund);
  const splitUnitId = refund.metadata?.split_payment_unit_id?.trim();

  const splitUnit = splitUnitId
    ? await splitUnitById(splitUnitId)
    : intentId
      ? await splitUnitFromIntentId(intentId)
      : null;

  if (splitUnit) {
    const bookingId = stringArray(splitUnit.booking_ids)[0];
    if (!bookingId) return;

    const status =
      splitUnit.refund_status === "refunded"
        ? "succeeded"
        : splitUnit.refund_status === "partially_refunded"
          ? "partial"
          : splitUnit.refund_status === "failed"
            ? "failed"
            : "processing";

    await sendSplitRefundStatusEmail({
      unitId: splitUnit.id,
      refundId: refund.id,
      bookingId,
      clientProfileId: splitUnit.client_profile_id,
      status,
    });
    return;
  }

  const groupId = refund.metadata?.booking_group_id?.trim();
  const group = groupId
    ? await (async () => {
        const { data, error } = await supabaseAdmin
          .from("booking_groups")
          .select(
            "id, client_profile_id, provider_profile_id, payment_status, refund_status"
          )
          .eq("id", groupId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data ? (data as GroupPaymentEmailRow) : null;
      })()
    : intentId
      ? await groupFromIntentId(intentId)
      : null;

  if (group) {
    if (group.refund_status === "processing") {
      await sendGroupRefundStartedEmails({
        groupId: group.id,
        refundId: refund.id,
        clientProfileId: group.client_profile_id,
        providerProfileId: group.provider_profile_id,
      });
    }

    if (group.refund_status === "refunded") {
      await sendGroupRefundConfirmedEmails({
        groupId: group.id,
        clientProfileId: group.client_profile_id,
        providerProfileId: group.provider_profile_id,
      });
    }

    if (group.refund_status === "failed") {
      await sendGroupRefundFailedEmails({
        groupId: group.id,
        clientProfileId: group.client_profile_id,
        providerProfileId: group.provider_profile_id,
      });
    }
    return;
  }

  const booking = await bookingFromRefund(refund, intentId);
  if (!booking) return;

  if (refund.status === "succeeded") {
    await sendBookingRefundConfirmedEmail({
      bookingId: booking.id,
      clientProfileId: booking.parent_id,
    });
  }

  if (refund.status === "failed" || refund.status === "canceled") {
    await sendBookingRefundFailedEmail({
      bookingId: booking.id,
      clientProfileId: booking.parent_id,
    });
  }
}

async function sendProviderReadyEmail(account: Stripe.Account): Promise<void> {
  if (
    !account.details_submitted ||
    !account.charges_enabled ||
    !account.payouts_enabled
  ) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return;

  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `profile:${data.id}:stripe-payments-ready`,
    templateKey: "provider.stripe_ready",
    profileId: data.id,
    ...providerPaymentsReadyEmail(),
  });
}

export async function sendStripeLifecycleEmails(
  event: Stripe.Event
): Promise<void> {
  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await sendCheckoutEmail(
        event.data.object as Stripe.Checkout.Session
      );
      return;
    }

    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      await sendIntentEmail(
        event.data.object as Stripe.PaymentIntent
      );
      return;
    }

    if (
      event.type === "refund.created" ||
      event.type === "refund.updated" ||
      event.type === "refund.failed"
    ) {
      await sendRefundEmail(event.data.object as Stripe.Refund);
      return;
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      for (const refund of charge.refunds?.data ?? []) {
        await sendRefundEmail(refund);
      }
      return;
    }

    if (event.type === "account.updated") {
      await sendProviderReadyEmail(event.data.object as Stripe.Account);
    }
  } catch {
    warn("KLYX_STRIPE_EMAIL_HOOK_UNEXPECTED_FAILURE");
  }
}
