import "server-only";

import {
  sendKlyxProfileTransactionalEmail,
} from "@/lib/email/resend";
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
    sendKlyxProfileTransactionalEmail({
      profileId: input.clientProfileId,
      ...paymentReceivedEmail(input.bookingId),
    }),
  ];

  if (input.providerProfileId) {
    deliveries.push(
      sendKlyxProfileTransactionalEmail({
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
  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...paymentFailedEmail(input.bookingId),
  });
}

export async function sendBookingRefundConfirmedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...refundConfirmedEmail(input.bookingId),
  });
}

export async function sendBookingRefundFailedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxProfileTransactionalEmail({
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
    sendKlyxProfileTransactionalEmail({
      profileId: input.clientProfileId,
      ...groupPaymentReceivedClientEmail(input.groupId),
    }),
    sendKlyxProfileTransactionalEmail({
      profileId: input.providerProfileId,
      ...groupPaymentReceivedProviderEmail(input.groupId),
    }),
  ]);
}

export async function sendGroupPaymentFailedEmail(input: {
  groupId: string;
  clientProfileId: string;
}) {
  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...groupPaymentFailedEmail(input.groupId),
  });
}

export async function sendGroupRefundConfirmedEmails(input: {
  groupId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxProfileTransactionalEmail({
      profileId: input.clientProfileId,
      ...groupRefundConfirmedClientEmail(input.groupId),
    }),
    sendKlyxProfileTransactionalEmail({
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
    sendKlyxProfileTransactionalEmail({
      profileId: input.clientProfileId,
      ...email,
    }),
    sendKlyxProfileTransactionalEmail({
      profileId: input.providerProfileId,
      ...email,
    }),
  ]);
}

export async function sendSplitPaymentSucceededEmails(input: {
  bookingId: string;
  clientProfileId: string;
  providerProfileId: string;
}) {
  await Promise.all([
    sendKlyxProfileTransactionalEmail({
      profileId: input.clientProfileId,
      ...splitPaymentReceivedClientEmail(input.bookingId),
    }),
    sendKlyxProfileTransactionalEmail({
      profileId: input.providerProfileId,
      ...splitPaymentReceivedProviderEmail(input.bookingId),
    }),
  ]);
}

export async function sendSplitPaymentFailedEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...splitPaymentFailedEmail(input.bookingId),
  });
}

export async function sendSplitPaymentExpiredEmail(input: {
  bookingId: string;
  clientProfileId: string;
}) {
  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...splitPaymentExpiredEmail(input.bookingId),
  });
}

export async function sendSplitRefundStatusEmail(input: {
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

  await sendKlyxProfileTransactionalEmail({
    profileId: input.clientProfileId,
    ...content,
  });
}
