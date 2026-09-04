import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const createRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/create/route.ts"),
  "utf8"
);
const statusRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/status/route.ts"),
  "utf8"
);

describe("booking transactional email contract", () => {
  it("notifies the provider only after booking creation has succeeded", () => {
    const bookingInsertIndex = createRoute.indexOf('.from("bookings")');
    const bookingErrorIndex = createRoute.indexOf(
      "if (bookingError)",
      bookingInsertIndex
    );
    const afterIndex = createRoute.indexOf(
      "after(async () =>",
      bookingErrorIndex
    );
    const emailIndex = createRoute.indexOf(
      "await sendKlyxProfileTransactionalEmail({",
      afterIndex
    );
    const responseIndex = createRoute.indexOf(
      "return NextResponse.json({",
      emailIndex
    );

    expect(bookingInsertIndex).toBeGreaterThanOrEqual(0);
    expect(bookingErrorIndex).toBeGreaterThan(bookingInsertIndex);
    expect(afterIndex).toBeGreaterThan(bookingErrorIndex);
    expect(emailIndex).toBeGreaterThan(afterIndex);
    expect(responseIndex).toBeGreaterThan(emailIndex);
    expect(createRoute).toContain("bookingRequestedEmail({");
    expect(createRoute).toContain("profileId: providerId");
  });

  it("keeps accepted, rejected, cancelled and refund emails inside after()", () => {
    const durableEventIndex = statusRoute.indexOf(
      '.from("booking_status_events")'
    );
    const afterIndex = statusRoute.indexOf(
      "after(async () =>",
      durableEventIndex
    );
    const responseIndex = statusRoute.indexOf(
      "return NextResponse.json({",
      afterIndex
    );
    const deferredBlock = statusRoute.slice(afterIndex, responseIndex);

    expect(durableEventIndex).toBeGreaterThanOrEqual(0);
    expect(afterIndex).toBeGreaterThan(durableEventIndex);
    expect(responseIndex).toBeGreaterThan(afterIndex);
    expect(deferredBlock).toContain("bookingAcceptedEmail(booking.id)");
    expect(deferredBlock).toContain("bookingRejectedEmail(booking.id)");
    expect(deferredBlock).toContain("bookingCancelledEmail({");
    expect(deferredBlock).toContain("refundConfirmedEmail(booking.id)");
    expect(deferredBlock).toContain("refundStartedEmail(booking.id)");
    expect(
      deferredBlock.match(/sendKlyxProfileTransactionalEmail\(\{/g)
        ?.length
    ).toBe(4);
  });

  it("does not move Stripe refund execution into email delivery", () => {
    const refundIndex = statusRoute.indexOf("await refundPaidBooking({");
    const afterIndex = statusRoute.indexOf("after(async () =>", refundIndex);
    const firstEmailIndex = statusRoute.indexOf(
      "sendKlyxProfileTransactionalEmail",
      afterIndex
    );

    expect(refundIndex).toBeGreaterThanOrEqual(0);
    expect(afterIndex).toBeGreaterThan(refundIndex);
    expect(firstEmailIndex).toBeGreaterThan(afterIndex);
  });
});
