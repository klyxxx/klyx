import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819213500_klyx_booking_table_select_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const bookingCreatePath =
  "app/api/bookings/create/route.ts";
const groupBookingCorePath =
  "app/api/market/requests/[id]/group-booking/group-booking-core.ts";
const bookingPages = [
  "app/providers/[id]/book/page.tsx",
  "app/book/page.tsx",
] as const;

describe("booking table select-only contract", () => {
  it("keeps authenticated browser access read-only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_BOOKING_TABLE_SELECT_ONLY_12B_12V"
    );
    expect(source).toContain(
      "revoke all privileges on table public.bookings\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant select on table public.bookings\n  to authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.bookings\n  to service_role;"
    );
    expect(source).toContain(
      'drop policy if exists "klyx_bookings_insert"\n  on public.bookings;'
    );
  });

  it("preserves the participant SELECT RLS boundary", () => {
    const baseline = readFileSync(
      join(process.cwd(), baselinePath),
      "utf8"
    );

    expect(baseline).toContain(
      'CREATE POLICY "klyx_bookings_select"'
    );
  });

  it("keeps direct booking creation behind supabaseAdmin", () => {
    const source = readFileSync(
      join(process.cwd(), bookingCreatePath),
      "utf8"
    );

    expect(source).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(source).toContain('.from("bookings")');
    expect(source).toContain(".insert({");
  });

  it("keeps multi-slot booking creation behind the admin RPC", () => {
    const source = readFileSync(
      join(process.cwd(), groupBookingCorePath),
      "utf8"
    );

    expect(source).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(source).toContain(
      "klyx_create_multi_slot_booking_group"
    );
    expect(source).toContain("await supabaseAdmin");
  });

  it("keeps booking UI pages off raw booking inserts", () => {
    for (const pagePath of bookingPages) {
      const source = readFileSync(
        join(process.cwd(), pagePath),
        "utf8"
      );

      expect(source).toContain('/api/bookings/create');
      expect(source).not.toContain('.from("bookings")');
    }
  });
});
