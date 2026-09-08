import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const stripeLifecycleHook = fs.readFileSync(
  path.join(process.cwd(), "lib/email/stripe-lifecycle-hook.ts"),
  "utf8"
);
const paymentEventEmails = fs.readFileSync(
  path.join(process.cwd(), "lib/email/payment-event-emails.ts"),
  "utf8"
);

describe("standalone refund transactional email contract", () => {
  it("routes terminal standalone refunds to the existing deduplicated booking emails", () => {
    const refundHandlerIndex = stripeLifecycleHook.indexOf(
      "async function sendRefundEmail"
    );
    const groupIndex = stripeLifecycleHook.indexOf(
      "const group =",
      refundHandlerIndex
    );
    const bookingIndex = stripeLifecycleHook.indexOf(
      "const booking = await bookingFromRefund(refund, intentId);",
      groupIndex
    );
    const confirmedIndex = stripeLifecycleHook.indexOf(
      "await sendBookingRefundConfirmedEmail({",
      bookingIndex
    );
    const failedIndex = stripeLifecycleHook.indexOf(
      "await sendBookingRefundFailedEmail({",
      confirmedIndex
    );

    expect(refundHandlerIndex).toBeGreaterThanOrEqual(0);
    expect(groupIndex).toBeGreaterThan(refundHandlerIndex);
    expect(bookingIndex).toBeGreaterThan(groupIndex);
    expect(confirmedIndex).toBeGreaterThan(bookingIndex);
    expect(failedIndex).toBeGreaterThan(confirmedIndex);
    expect(stripeLifecycleHook).toContain('refund.status === "succeeded"');
    expect(stripeLifecycleHook).toContain(
      'refund.status === "failed" || refund.status === "canceled"'
    );
    expect(paymentEventEmails).toContain(
      "deduplicationKey: `booking:${input.bookingId}:refund-succeeded:client`"
    );
    expect(paymentEventEmails).toContain(
      "deduplicationKey: `booking:${input.bookingId}:refund-failed:client`"
    );
  });
});
