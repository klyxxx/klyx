import "server-only";

import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import {
  groupRefundStartedClientEmail,
  groupRefundStartedProviderEmail,
} from "@/lib/email/group-refund-templates";
import {
  paymentFailedEmail,
  paymentReceivedEmail,
  refundConfirmedEmail,
} from "@/lib/email/templates";
import {
  groupPaymentFailedEmail,
  groupPaymentReceivedClientEmail,
  groupPaymentReceivedProviderEmail,
  groupRefundConfirmedClientEmail,
  groupRefundConfirmedProviderEmail,
  groupRefundFailedEmail,
  paymentReceivedProviderEmail,
  refundFailedEmail,
  splitPaymentExpiredEmail,
  splitPaymentFailedEmail,
  splitPaymentReceivedClientEmail,
  splitPaymentReceivedProviderEmail,
  splitRefundConfirmedEmail,
  splitRefundFailedEmail,
  splitRefundStartedEmail,
} from "@/lib/email/lifecycle-templates";

export async function sendBookingPaymentSucceededEmails(input: {
  bookingId: string;
  clientProfileId: string;
  providerProfileId?: string | null;
}) {
  const deliveries = [
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking:${input.bookingId}:payment-succeeded:client`,
      templateKey: "booking.payment_succeeded.client",
      profileId: input.clientProfileId,
      ...paymentReceivedEmail(input.bookingId),
    }),
  ];

  if (input.providerProfileId) {
    deliveries.push(
      sendKlyxDeduplicatedEmail({
        deduplicationKey: `booking:${input.bookingId}:payment-succeeded:provider`,
        templateKey: "booking.payment_succeeded.provider",
        profileId: input.providerProfileId,
        ...paymentReceivedProviderEmail(input.bookingId),
      })
    );
  }

  await Promise.all(deliveries);
}

export async function sendBookingPaymentFailedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `booking:${input.bookingId}:payment-failed:client`,
    templateKey: "booking.payment_failed.client",
    profileId: input.clientProfileId,
    ...paymentFailedEmail(input.bookingId),
  });
}

export async function sendBookingRefundConfirmedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `booking:${input.bookingId}:refund-succeeded:client`,
    templateKey: "booking.refund_succeeded.client",
    profileId: input.clientProfileId,
    ...refundConfirmedEmail(input.bookingId),
  });
}

export async function sendBookingRefundFailedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `booking:${input.bookingId}:refund-failed:client`,
    templateKey: "booking.refund_failed.client",
    profileId: input.clientProfileId,
    ...refundFailedEmail(input.bookingId),
  });
}

export async function sendGroupPaymentSucceededEmails(input: {
  groupId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:payment-succeeded:client`,
      templateKey: "booking_group.payment_succeeded.client",
      profileId: input.clientProfileId,
      ...groupPaymentReceivedClientEmail(input.groupId),
    }),
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:payment-succeeded:provider`,
      templateKey: "booking_group.payment_succeeded.provider",
      profileId: input.providerProfileId,
      ...groupPaymentReceivedProviderEmail(input.groupId),
    }),
  ]);
}

export async function sendGroupPaymentFailedEmail(input: {
  groupId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `booking-group:${input.groupId}:payment-failed:client`,
    templateKey: "booking_group.payment_failed.client",
    profileId: input.clientProfileId,
    ...groupPaymentFailedEmail(input.groupId),
  });
}

export async function sendGroupRefundStartedEmails(input: {
  groupId: string;
  refundId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund:${input.refundId}:processing:client`,
      templateKey: "booking_group.refund_processing.client",
      profileId: input.clientProfileId,
      ...groupRefundStartedClientEmail(input.groupId),
    }),
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund:${input.refundId}:processing:provider`,
      templateKey: "booking_group.refund_processing.provider",
      profileId: input.providerProfileId,
      ...groupRefundStartedProviderEmail(input.groupId),
    }),
  ]);
}

export async function sendGroupRefundConfirmedEmails(input: {
  groupId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund-succeeded:client`,
      templateKey: "booking_group.refund_succeeded.client",
      profileId: input.clientProfileId,
      ...groupRefundConfirmedClientEmail(input.groupId),
    }),
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund-succeeded:provider`,
      templateKey: "booking_group.refund_succeeded.provider",
      profileId: input.providerProfileId,
      ...groupRefundConfirmedProviderEmail(input.groupId),
    }),
  ]);
}

export async function sendGroupRefundFailedEmails(input: {
  groupId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  const email = groupRefundFailedEmail(input.groupId);

  await Promise.all([
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund-failed:client`,
      templateKey: "booking_group.refund_failed.client",
      profileId: input.clientProfileId,
      ...email,
    }),
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `booking-group:${input.groupId}:refund-failed:provider`,
      templateKey: "booking_group.refund_failed.provider",
      profileId: input.providerProfileId,
      ...email,
    }),
  ]);
}

export async function sendSplitPaymentSucceededEmails(input: {
  unitId: string;
  bookingId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `split-unit:${input.unitId}:payment-succeeded:client`,
      templateKey: "split_payment.payment_succeeded.client",
      profileId: input.clientProfileId,
      ...splitPaymentReceivedClientEmail(input.bookingId),
    }),
    sendKlyxDeduplicatedEmail({
      deduplicationKey: `split-unit:${input.unitId}:payment-succeeded:provider`,
      templateKey: "split_payment.payment_succeeded.provider",
      profileId: input.providerProfileId,
      ...splitPaymentReceivedProviderEmail(input.bookingId),
    }),
  ]);
}

export async function sendSplitPaymentFailedEmail(input: {
  unitId: string;
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `split-unit:${input.unitId}:payment-failed:client`,
    templateKey: "split_payment.payment_failed.client",
    profileId: input.clientProfileId,
    ...splitPaymentFailedEmail(input.bookingId),
  });
}

export async function sendSplitPaymentExpiredEmail(input: {
  unitId: string;
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `split-unit:${input.unitId}:payment-expired:client`,
    templateKey: "split_payment.payment_expired.client",
    profileId: input.clientProfileId,
    ...splitPaymentExpiredEmail(input.bookingId),
  });
}

export async function sendSplitRefundStatusEmail(input: {
  unitId: string;
  refundId: string;
  bookingId: string;
  clientProfileId: string;
  status: "processing" | "partial" | "succeeded" | "failed";
}) {
  const content =
    input.status === "processing"
      ? splitRefundStartedEmail(input.bookingId)
      : input.status === "failed"
        ? splitRefundFailedEmail(input.bookingId)
        : splitRefundConfirmedEmail({
            bookingId: input.bookingId,
            partial: input.status === "partial",
          });

  await sendKlyxDeduplicatedEmail({
    deduplicationKey: `split-unit:${input.unitId}:refund:${input.refundId}:${input.status}:client`,
    templateKey: `split_refund.${input.status}.client`,
    profileId: input.clientProfileId,
    ...content,
  });
}
