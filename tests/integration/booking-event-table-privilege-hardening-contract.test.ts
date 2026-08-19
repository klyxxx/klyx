import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819194000_klyx_booking_event_table_privileges.sql";

const bookingEventTables = [
  "booking_status_events",
  "booking_tracking_events",
] as const;

describe("booking event table privilege hardening contract", () => {
  it("keeps participant timelines read-only for authenticated clients", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_BOOKING_EVENT_TABLE_PRIVILEGES_12B_12N"
    );

    for (const table of bookingEventTables) {
      expect(source).toContain(
        `revoke all privileges on table public.${table}\n  from public, anon, authenticated;`
      );
      expect(source).toContain(
        `grant select on table public.${table}\n  to authenticated;`
      );
      expect(source).toContain(
        `grant all privileges on table public.${table}\n  to service_role;`
      );
    }
  });

  it("documents the Realtime read requirement for tracking events", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "Supabase Realtime"
    );
    expect(source).toContain(
      "Existing participant RLS remains authoritative"
    );
  });
});
