import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX transactional email lifecycle contract", () => {
  it("covers account/profile creation and profile deletion only after successful mutations", () => {
    const profiles = source("app/api/profiles/manage/route.ts");
    const accountDelete = source("app/api/account/delete/route.ts");

    expect(profiles).toContain("accountCreatedEmail");
    expect(profiles).toContain("profileCreatedEmail");
    expect(profiles).toContain("profileDeletedEmail");
    expect(profiles.indexOf("const { data: profileId, error }")).toBeLessThan(
      profiles.lastIndexOf("accountCreatedEmail({")
    );
    expect(profiles.indexOf('await supabase.rpc("klyx_delete_profile"')).toBeLessThan(
      profiles.lastIndexOf("profileDeletedEmail()")
    );

    expect(accountDelete).toContain("profileDeletedEmail");
    expect(accountDelete).not.toContain("accountDeletedEmail");
    expect(accountDelete).not.toContain("supabaseAdmin.auth.admin.deleteUser(user.id)");
    expect(accountDelete.indexOf('"klyx_delete_profile"')).toBeLessThan(
      accountDelete.indexOf("profileDeletedEmail()")
    );
  });

  it("covers booking, grouped, split and provider Stripe payment lifecycle events", () => {
    const webhook = source("app/api/stripe/webhook/route.ts");
    const hook = source("lib/email/stripe-lifecycle-hook.ts");
    const delivery = source("lib/email/payment-event-emails.ts");

    expect(webhook).toContain("sendStripeLifecycleEmails");
    expect(hook).toContain('event.type === "checkout.session.completed"');
    expect(hook).toContain('event.type === "checkout.session.async_payment_succeeded"');
    expect(hook).toContain('event.type === "checkout.session.async_payment_failed"');
    expect(hook).toContain('event.type === "checkout.session.expired"');
    expect(hook).toContain('event.type === "payment_intent.succeeded"');
    expect(hook).toContain('event.type === "payment_intent.payment_failed"');
    expect(hook).toContain('event.type === "account.updated"');

    expect(delivery).toContain("sendBookingPaymentSucceededEmails");
    expect(delivery).toContain("sendBookingPaymentFailedEmail");
    expect(delivery).toContain("sendGroupPaymentSucceededEmails");
    expect(delivery).toContain("sendGroupPaymentFailedEmail");
    expect(delivery).toContain("sendSplitPaymentSucceededEmails");
    expect(delivery).toContain("sendSplitPaymentFailedEmail");
    expect(delivery).toContain("sendSplitPaymentExpiredEmail");
    expect(hook).toContain("providerPaymentsReadyEmail");
  });

  it("covers refund processing, success and failure for normal, grouped and split payments", () => {
    const hook = source("lib/email/stripe-lifecycle-hook.ts");
    const delivery = source("lib/email/payment-event-emails.ts");
    const refunds = source("lib/stripe-refunds.ts");

    expect(hook).toContain('event.type === "refund.created"');
    expect(hook).toContain('event.type === "refund.updated"');
    expect(hook).toContain('event.type === "refund.failed"');
    expect(hook).toContain('event.type === "charge.refunded"');

    expect(delivery).toContain("sendBookingRefundConfirmedEmail");
    expect(delivery).toContain("sendBookingRefundFailedEmail");
    expect(delivery).toContain("sendGroupRefundStartedEmails");
    expect(delivery).toContain("sendGroupRefundConfirmedEmails");
    expect(delivery).toContain("sendGroupRefundFailedEmails");
    expect(delivery).toContain("sendSplitRefundStatusEmail");

    expect(hook).toContain('group.refund_status === "processing"');
    expect(hook).toContain('group.refund_status === "refunded"');
    expect(hook).toContain('group.refund_status === "failed"');
    expect(refunds).toContain("sendBookingRefundConfirmedEmail");
    expect(refunds).toContain("sendBookingRefundFailedEmail");
  });

  it("covers mission completion, review receipt and dispute opening", () => {
    const tracking = source("app/api/bookings/tracking/route.ts");
    const reviews = source("app/api/reviews/route.ts");
    const groupReviews = source("app/api/group-reviews/route.ts");
    const disputes = source("app/api/disputes/route.ts");

    expect(tracking).toContain("reviewRequestEmail(booking.id)");
    expect(reviews).toContain("reviewReceivedEmail");
    expect(reviews).toContain("if (!existing)");
    expect(groupReviews).toContain("reviewReceivedEmail");
    expect(groupReviews).toContain("if (!existing)");
    expect(disputes).toContain("disputeOpenedEmail");
    expect(disputes).toContain("profileId: profile.id");
    expect(disputes).toContain("profileId: againstProfileId");
  });

  it("deduplicates every important transactional route with stable business keys", () => {
    const profiles = source("app/api/profiles/manage/route.ts");
    const accountDelete = source("app/api/account/delete/route.ts");
    const bookingCreate = source("app/api/bookings/create/route.ts");
    const bookingStatus = source("app/api/bookings/status/route.ts");
    const quotes = source("app/api/quotes/route.ts");
    const reviews = source("app/api/reviews/route.ts");
    const groupReviews = source("app/api/group-reviews/route.ts");
    const disputes = source("app/api/disputes/route.ts");

    for (const route of [
      profiles,
      accountDelete,
      bookingCreate,
      bookingStatus,
      quotes,
      reviews,
      groupReviews,
      disputes,
    ]) {
      expect(route).toContain("sendKlyxDeduplicatedEmail");
    }

    expect(profiles).toContain("account:${user.id}:created:owner");
    expect(profiles).toContain("profile:${profileId}:created:owner");
    expect(profiles).toContain("profile:${body.profileId}:deleted:owner");
    expect(accountDelete).not.toContain("account:${user.id}:deleted:owner");
    expect(accountDelete).toContain("profile:${deletePlan.targetProfileId}:deleted:owner");
    expect(bookingCreate).toContain("booking:${booking.id}:requested:provider");
    expect(bookingStatus).toContain("booking:${booking.id}:accepted:client");
    expect(bookingStatus).toContain("booking:${booking.id}:rejected:client");
    expect(quotes).toContain("quote:${quoteId}:requested:provider");
    expect(quotes).toContain("quote:${quoteId}:${action}:${email.profileId}");
    expect(reviews).toContain("review:${review.id}:received:provider");
    expect(groupReviews).toContain("review:${review.id}:received:provider");
    expect(disputes).toContain("dispute:${dispute.id}:opened:${profile.id}");
    expect(disputes).toContain("dispute:${dispute.id}:opened:${againstProfileId}");
  });

  it("keeps the registry fail-open, private and free of persisted raw direct addresses", () => {
    const registry = source("lib/email/deduplicated-delivery.ts");
    const migration = source(
      "supabase/migrations/20260904220000_klyx_transactional_email_delivery_registry.sql"
    );
    const paymentEmails = source("lib/email/payment-event-emails.ts");

    expect(registry).toContain("transactional_email_deliveries");
    expect(registry).toContain("deduplication_key");
    expect(registry).toContain("STALE_SENDING_MS");
    expect(registry).toContain('createHash("sha256")');
    expect(registry).toContain("recipient_email: null");
    expect(registry).toContain("recipient_email_hash: recipientEmailHash(input.to)");
    expect(registry).toContain("KLYX_EMAIL_REGISTRY_CLAIM_UNEXPECTED_FAILURE");
    expect(registry).toContain("KLYX_EMAIL_REGISTRY_FINALIZE_UNEXPECTED_FAILURE");
    expect(migration).toContain("deduplication_key text not null unique");
    expect(migration).toContain("recipient_email_hash text null");
    expect(migration).toContain("enable row level security");
    expect(paymentEmails).toContain("sendKlyxDeduplicatedEmail");
    expect(paymentEmails).toContain("payment-succeeded:client");
    expect(paymentEmails).toContain("payment-failed:client");
    expect(paymentEmails).toContain("refund-succeeded:client");
    expect(paymentEmails).toContain("refund-failed:client");
  });
});
