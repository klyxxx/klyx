import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/tracking/route.ts"),
  "utf8"
);

describe("booking tracking notification latency", () => {
  it("keeps durable tracking writes before deferring fail-open notifications", () => {
    expect(route).toContain('import { after, NextResponse } from "next/server"');

    const providerFinishedIndex = route.indexOf('if (action === "provider_finished")');
    const providerEventIndex = route.indexOf("await addTrackingEvent({", providerFinishedIndex);
    const providerAfterIndex = route.indexOf("after(async () =>", providerEventIndex);
    const providerNotificationIndex = route.indexOf("await createNotification({", providerAfterIndex);

    expect(providerEventIndex).toBeGreaterThan(providerFinishedIndex);
    expect(providerAfterIndex).toBeGreaterThan(providerEventIndex);
    expect(providerNotificationIndex).toBeGreaterThan(providerAfterIndex);

    const clientConfirmedIndex = route.indexOf('if (action === "client_confirmed")');
    const statusEventIndex = route.indexOf('.from("booking_status_events")', clientConfirmedIndex);
    const clientAfterIndex = route.indexOf("after(async () =>", statusEventIndex);
    const groupSyncIndex = route.indexOf("await syncBookingGroupLifecycle(", clientAfterIndex);

    expect(statusEventIndex).toBeGreaterThan(clientConfirmedIndex);
    expect(clientAfterIndex).toBeGreaterThan(statusEventIndex);
    expect(groupSyncIndex).toBeGreaterThan(clientAfterIndex);

    const transitionEventIndex = route.lastIndexOf("await addTrackingEvent({");
    const transitionAfterIndex = route.indexOf("after(async () =>", transitionEventIndex);
    const responseIndex = route.indexOf("return NextResponse.json({", transitionAfterIndex);

    expect(transitionAfterIndex).toBeGreaterThan(transitionEventIndex);
    expect(responseIndex).toBeGreaterThan(transitionAfterIndex);
  });
});
