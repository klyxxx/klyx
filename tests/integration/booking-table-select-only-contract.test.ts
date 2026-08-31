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
const activeBookingPages = ["app/providers/[id]/book/page.tsx"] as const;
const babysitterCompatibilityPage = "app/babysitters/[id]/page.tsx";
const legacyBookingPage = "app/book/page.tsx";

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

  it("keeps active booking UI pages off raw booking inserts", () => {
    for (const pagePath of activeBookingPages) {
      const source = readFileSync(
        join(process.cwd(), pagePath),
        "utf8"
      );

      expect(source).toContain('/api/bookings/create');
      expect(source).not.toContain('.from("bookings")');
    }
  });

  it("keeps compatibility booking routes off raw booking inserts", () => {
    const babysitterSource = readFileSync(
      join(process.cwd(), babysitterCompatibilityPage),
      "utf8"
    );
    const legacySource = readFileSync(
      join(process.cwd(), legacyBookingPage),
      "utf8"
    );

    expect(babysitterSource).toContain(
      "KLYX_BABYSITTER_BOOKING_COMPATIBILITY_ROUTE"
    );
    expect(babysitterSource).toContain('query.set("service", "babysitting")');
    expect(babysitterSource).toContain(
      'redirect(`/providers/${encodeURIComponent(id)}/book?${query.toString()}`)'
    );
    expect(babysitterSource).not.toContain('.from("bookings")');
    expect(babysitterSource).not.toContain('/api/bookings/create');

    expect(legacySource).toContain("KLYX_LEGACY_BOOK_COMPATIBILITY_ROUTE");
    expect(legacySource).toContain('params.set("service", "babysitting")');
    expect(legacySource).toContain(
      'redirect(`/recommendations?${params.toString()}`)'
    );
    expect(legacySource).not.toContain('.from("bookings")');
    expect(legacySource).not.toContain('/api/bookings/create');
  });
});
