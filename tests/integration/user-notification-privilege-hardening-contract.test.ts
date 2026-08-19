import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819195500_klyx_user_notification_privileges.sql";
const readRoutePath =
  "app/api/notifications/read/route.ts";

describe("user notification privilege hardening contract", () => {
  it("keeps the notification feed owner-scoped and read-only in the browser", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_USER_NOTIFICATION_PRIVILEGES_12B_12O"
    );
    expect(source).toContain(
      "revoke all privileges on table public.user_notifications\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      'drop policy if exists "klyx_user_notifications_all"'
    );
    expect(source).toContain(
      'create policy "klyx_user_notifications_select"'
    );
    expect(source).toContain(
      "for select\n  to authenticated\n  using (public.klyx_owns_profile(user_id));"
    );
    expect(source).toContain(
      "grant select on table public.user_notifications\n  to authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.user_notifications\n  to service_role;"
    );
  });

  it("keeps read-state mutations behind the server boundary", () => {
    const route = readFileSync(
      join(process.cwd(), readRoutePath),
      "utf8"
    );

    expect(route).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(route).toContain(
      '.from("user_notifications")'
    );
    expect(route).toContain(
      '.eq("user_id", profile.id)'
    );
  });
});
