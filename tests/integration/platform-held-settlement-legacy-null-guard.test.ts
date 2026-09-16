import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX platform-held legacy NULL payment-mode guard", () => {
  it("keeps legacy NULL payment_mode bookings outside platform-held paid triggers", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260916140000_klyx_platform_held_legacy_null_guard.sql"
      )
    );

    expect(migration).toContain(
      "create or replace function public.klyx_guard_platform_held_booking_economics()"
    );
    expect(migration).toContain(
      "if coalesce(new.payment_mode, '') <> 'platform_held' or coalesce(new.payment_status, '') <> 'paid' then return new; end if;"
    );

    expect(migration).toContain(
      "create or replace function public.klyx_mark_platform_held_booking_paid()"
    );
    expect(migration).toContain(
      "if coalesce(new.payment_mode, '') <> 'platform_held' or coalesce(new.payment_status, '') <> 'paid' or coalesce(old.payment_status, '') = 'paid' then return new; end if;"
    );

    expect(migration).not.toContain(
      "if new.payment_mode <> 'platform_held'"
    );
  });

  it("preserves fail-closed settlement requirements for actual platform-held paid bookings", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260916140000_klyx_platform_held_legacy_null_guard.sql"
      )
    );

    expect(migration).toContain(
      "raise exception 'KLYX_PLATFORM_HELD_SETTLEMENT_MISSING'"
    );
    expect(migration).toContain(
      "raise exception 'KLYX_PLATFORM_HELD_PAYMENT_INTENT_REQUIRED'"
    );
    expect(migration).toContain(
      "raise exception 'KLYX_PLATFORM_HELD_PAID_SETTLEMENT_NOT_WRITABLE'"
    );
    expect(migration).toContain(
      "where booking_id = new.id and state in ('pending_payment', 'held')"
    );
  });
});
