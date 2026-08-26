import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "app/api/bookings/status/route.ts"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

function between(start: string, end: string) {
  const startIndex = route.indexOf(start);
  const endIndex = route.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return route.slice(startIndex, endIndex);
}

describe("KLYX refund creation side-effect boundary", () => {
  it("keeps the Stripe idempotency key and records only pre-acceptance failures", () => {
    const stripeCreate = between(
      "async function createStripeRefundOrRecordFailure",
      "async function refundPaidBooking"
    );

    expect(stripeCreate).toContain("stripe.refunds.create");
    expect(stripeCreate).toContain(
      "idempotencyKey: `klyx-booking-refund-${booking.id}`"
    );
    expect(stripeCreate).toContain("recordRefundCreationFailure");
    expect(stripeCreate).toMatch(
      /refund\.status\s*===\s*"failed"[\s\S]*refund\.status\s*===\s*"canceled"/
    );
  });

  it("keeps post-Stripe booking and ledger persistence outside any failure catch", () => {
    const paidRefund = between(
      "async function refundPaidBooking",
      "export async function POST"
    );

    expect(paidRefund).toContain("createStripeRefundOrRecordFailure");
    expect(paidRefund).toContain("stripe_refund_id: refund.id");
    expect(paidRefund).toContain("upsertFinancialLedgerEntry");
    expect(paidRefund).not.toContain("catch (");
    expect(paidRefund).not.toContain('refund_status: "failed"');
    expect(paidRefund).not.toContain(":refund-failed`");
  });

  it("writes a failure ledger only if processing-to-failed still wins atomically", () => {
    const failureRecorder = between(
      "async function recordRefundCreationFailure",
      "async function createStripeRefundOrRecordFailure"
    );

    expect(failureRecorder).toMatch(
      /refund_status:\s*"failed"[\s\S]*\.eq\(\s*"refund_status",\s*"processing"\s*\)[\s\S]*\.select\(\s*"id"\s*\)[\s\S]*\.maybeSingle\(\)/
    );
    expect(failureRecorder).toMatch(
      /if\s*\(!failedBooking\)\s*\{\s*return;\s*\}/
    );
    expect(failureRecorder).toContain(
      "entryKey: `booking:${booking.id}:refund-failed`"
    );
  });

  it("does not mask the original Stripe error if failure bookkeeping itself fails", () => {
    const stripeCreate = between(
      "async function createStripeRefundOrRecordFailure",
      "async function refundPaidBooking"
    );

    expect(stripeCreate).toContain(
      '"refund_creation_failure_record_failed"'
    );
    expect(stripeCreate).toMatch(
      /catch\s*\(recordError\)[\s\S]*logServerError[\s\S]*throw\s+error;/
    );
  });
});
