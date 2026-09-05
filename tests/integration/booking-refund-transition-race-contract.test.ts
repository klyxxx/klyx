import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase/migrations/20260905234500_klyx_booking_refund_transition_guard.sql"
);
const statusRoutePath = path.join(
  root,
  "app/api/bookings/status/route.ts"
);
const trackingRoutePath = path.join(
  root,
  "app/api/bookings/tracking/route.ts"
);

const migration = fs.readFileSync(migrationPath, "utf8");
const statusRoute = fs.readFileSync(statusRoutePath, "utf8");
const trackingRoute = fs.readFileSync(trackingRoutePath, "utf8");

describe("booking refund transition race contract", () => {
  it("starts paid-booking cancellation refunds before the final status CAS", () => {
    expect(statusRoute).toContain("await refundPaidBooking({");
    expect(statusRoute).toContain('.eq("status", booking.status)');
  });

  it("keeps tracking completion guarded by accepted booking state", () => {
    expect(trackingRoute).toContain('.eq("status", "accepted")');
    expect(trackingRoute).toContain('status: "completed"');
  });

  it("blocks stale refund claims after booking status already moved", () => {
    expect(migration).toContain("KLYX_BOOKING_REFUND_STALE_STATUS");
    expect(migration).toContain("new.refund_status = 'processing'");
    expect(migration).toContain("old.status is distinct from 'accepted'");
  });

  it("blocks lifecycle and tracking progress while refund is active", () => {
    expect(migration).toContain("KLYX_BOOKING_REFUND_STATUS_CONFLICT");
    expect(migration).toContain("KLYX_BOOKING_REFUND_TRACKING_CONFLICT");
    expect(migration).toContain("new.status is distinct from 'cancelled'");
    expect(migration).toContain("new.service_status is distinct from old.service_status");
    expect(migration).toContain("new.provider_finished_at is distinct from old.provider_finished_at");
    expect(migration).toContain("new.client_confirmed_at is distinct from old.client_confirmed_at");
  });

  it("protects the invariant at the database boundary", () => {
    expect(migration).toContain("before update of status, service_status, refund_status");
    expect(migration).toContain("on public.bookings");
    expect(migration).toContain("for each row");
    expect(migration).toContain("klyx_guard_booking_refund_transition_16_21");
  });
});
