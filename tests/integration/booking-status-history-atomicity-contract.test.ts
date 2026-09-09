import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260909181000_klyx_booking_status_history_atomicity.sql"
);
const statusRoutePath = path.join(
  process.cwd(),
  "app/api/bookings/status/route.ts"
);
const trackingRoutePath = path.join(
  process.cwd(),
  "app/api/bookings/tracking/route.ts"
);
const createRoutePath = path.join(
  process.cwd(),
  "app/api/bookings/create/route.ts"
);

const migration = fs.readFileSync(migrationPath, "utf8");
const statusRoute = fs.readFileSync(statusRoutePath, "utf8");
const trackingRoute = fs.readFileSync(trackingRoutePath, "utf8");
const createRoute = fs.readFileSync(createRoutePath, "utf8");

describe("single-booking status history atomicity", () => {
  it("records creation and status changes in the booking transaction", () => {
    expect(migration).toContain("klyx_record_single_booking_status_event_17_01");
    expect(migration).toContain("after insert on public.bookings");
    expect(migration).toContain("after update of status on public.bookings");
    expect(migration).toContain(
      "insert into public.booking_status_events"
    );
    expect(migration).toContain(
      "old.status is distinct from new.status"
    );
  });

  it("keeps grouped bookings on their dedicated lifecycle path", () => {
    expect(migration).toContain("if new.booking_group_id is not null then");
    expect(migration).toContain("when (new.booking_group_id is null)");
    expect(statusRoute).toContain("GROUP_STATUS_REQUIRED");
  });

  it("derives the immutable audit actor from server-owned booking facts", () => {
    expect(migration).toContain("v_actor_id := new.parent_id");
    expect(migration).toContain(
      "v_actor_id := coalesce(new.provider_id, new.babysitter_id)"
    );
    expect(migration).toContain("v_actor_id := new.cancelled_by");
    expect(migration).toContain(
      "Mission terminée et confirmée par le client."
    );
  });

  it("absorbs the existing post-transition event writes without duplicates", () => {
    expect(migration).toContain("klyx_dedupe_booking_status_event_17_01");
    expect(migration).toContain(
      "existing.previous_status is not distinct from new.previous_status"
    );
    expect(migration).toContain("existing.new_status = new.new_status");

    expect(createRoute).toContain('.from("booking_status_events")');
    expect(statusRoute).toContain('.from("booking_status_events")');
    expect(trackingRoute).toContain('.from("booking_status_events")');
  });

  it("adds no browser-facing execution capability", () => {
    expect(migration).toContain(
      "from public, anon, authenticated"
    );
    expect(migration).toContain("to service_role");
  });
});
