import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/status/route.ts"),
  "utf8"
);

describe("booking status notification latency", () => {
  it("keeps refund and durable status writes before deferring fail-open notifications", () => {
    expect(route).toContain('import { after, NextResponse } from "next/server"');

    const refundIndex = route.indexOf("await refundPaidBooking({");
    const bookingUpdateIndex = route.indexOf('.from("bookings")', refundIndex);
    const statusEventIndex = route.indexOf('.from("booking_status_events")', bookingUpdateIndex);
    const afterIndex = route.indexOf("after(async () =>", statusEventIndex);
    const responseIndex = route.indexOf("return NextResponse.json({", afterIndex);

    expect(refundIndex).toBeGreaterThanOrEqual(0);
    expect(bookingUpdateIndex).toBeGreaterThan(refundIndex);
    expect(statusEventIndex).toBeGreaterThan(bookingUpdateIndex);
    expect(afterIndex).toBeGreaterThan(statusEventIndex);
    expect(responseIndex).toBeGreaterThan(afterIndex);

    const deferredBlock = route.slice(afterIndex, responseIndex);
    expect(deferredBlock).toContain('type: "booking_accepted"');
    expect(deferredBlock).toContain('type: "booking_rejected"');
    expect(deferredBlock).toContain('type: "booking_cancelled"');
    expect(deferredBlock).toContain('type: "system"');
    expect(deferredBlock.match(/await createNotification\(\{/g)).toHaveLength(4);
  });
});
