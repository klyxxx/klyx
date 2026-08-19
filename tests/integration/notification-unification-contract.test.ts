import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819212500_klyx_notification_unification.sql";
const buttonPath =
  "app/components/NotificationButton.tsx";
const statusRoutePath =
  "app/api/bookings/status/route.ts";
const readRoutePath =
  "app/api/notifications/read/route.ts";

describe("notification unification contract", () => {
  it("uses user_notifications as the canonical badge + Realtime source", () => {
    const button = readFileSync(
      join(process.cwd(), buttonPath),
      "utf8"
    );

    expect(button).toContain('.from("user_notifications")');
    expect(button).toContain('table: "user_notifications"');
    expect(button).toContain('.is("read_at", null)');
    expect(button).not.toContain('.from("notifications")');
    expect(button).not.toContain('table: "notifications"');
  });

  it("moves booking-status trigger writes to the modern deduplicated store", () => {
    const migration = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(migration).toContain(
      "KLYX_NOTIFICATION_UNIFICATION_12B_12U"
    );
    expect(migration).toContain(
      "create or replace function public.notify_booking_status()"
    );
    expect(migration).toContain(
      "insert into public.user_notifications"
    );
    expect(migration).not.toContain(
      "insert into public.notifications"
    );
    expect(migration).toContain(
      "'booking:' || new.id::text || ':accepted'"
    );
    expect(migration).toContain(
      "'booking:' || new.id::text || ':rejected'"
    );
    expect(migration).toContain(
      "on conflict (deduplication_key) do nothing;"
    );
  });

  it("keeps trigger and legacy table browser access fail-closed", () => {
    const migration = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(migration).toContain(
      "revoke all privileges on function public.notify_booking_status()\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant execute on function public.notify_booking_status()\n  to service_role;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.notifications\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      'drop policy if exists "klyx_notifications_all"'
    );
    expect(migration).toContain(
      "grant all privileges on table public.notifications\n  to service_role;"
    );
  });

  it("shares booking notification deduplication keys with the server API", () => {
    const statusRoute = readFileSync(
      join(process.cwd(), statusRoutePath),
      "utf8"
    );
    const readRoute = readFileSync(
      join(process.cwd(), readRoutePath),
      "utf8"
    );

    expect(statusRoute).toContain(
      "`booking:${booking.id}:accepted`"
    );
    expect(statusRoute).toContain(
      "`booking:${booking.id}:rejected`"
    );
    expect(statusRoute).toContain(
      '.from("user_notifications")'
    );
    expect(readRoute).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(readRoute).toContain(
      '.from("user_notifications")'
    );
  });
});
