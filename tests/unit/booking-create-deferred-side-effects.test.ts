import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/create/route.ts"),
  "utf8"
);

describe("booking create deferred side effects", () => {
  it("keeps the booking insert on the request path and defers secondary writes", () => {
    expect(route).toContain('import { after, NextResponse } from "next/server"');

    const bookingInsertIndex = route.indexOf('.from("bookings")');
    const bookingErrorIndex = route.indexOf("if (bookingError)", bookingInsertIndex);
    const afterIndex = route.indexOf("after(async () =>", bookingErrorIndex);
    const eventIndex = route.indexOf('.from("booking_status_events")', afterIndex);
    const notificationIndex = route.indexOf("await createNotification({", eventIndex);
    const responseIndex = route.indexOf("return NextResponse.json({", notificationIndex);

    expect(bookingInsertIndex).toBeGreaterThanOrEqual(0);
    expect(bookingErrorIndex).toBeGreaterThan(bookingInsertIndex);
    expect(afterIndex).toBeGreaterThan(bookingErrorIndex);
    expect(eventIndex).toBeGreaterThan(afterIndex);
    expect(notificationIndex).toBeGreaterThan(eventIndex);
    expect(responseIndex).toBeGreaterThan(notificationIndex);

    const deferredBlock = route.slice(afterIndex, responseIndex);
    expect(deferredBlock).toContain('.from("booking_status_events")');
    expect(deferredBlock).toContain("await createNotification({");
  });
});
