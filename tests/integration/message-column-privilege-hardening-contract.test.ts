import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819211000_klyx_message_column_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const overviewPath = "app/messages/page.tsx";
const overviewRoutePath = "app/api/messages/overview/route.ts";
const conversationPath = "app/messages/[bookingId]/page.tsx";

describe("message column privilege hardening contract", () => {
  it("keeps authenticated message access at the minimum required columns", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_MESSAGE_COLUMN_PRIVILEGES_12B_12T"
    );
    expect(source).toContain(
      "revoke all privileges on table public.messages\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant select on table public.messages\n  to authenticated;"
    );
    expect(source).toContain(
      "grant insert (booking_id, sender_id, receiver_id, message, is_read)\n  on table public.messages\n  to authenticated;"
    );
    expect(source).toContain(
      "grant update (is_read)\n  on table public.messages\n  to authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.messages\n  to service_role;"
    );
  });

  it("removes anonymous execution from the message participant helper", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "public.klyx_valid_message_participants(uuid, uuid, uuid)\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "public.klyx_valid_message_participants(uuid, uuid, uuid)\n  to authenticated, service_role;"
    );
  });

  it("preserves the existing RLS row boundary and dynamic conversation Realtime requirements", () => {
    const baseline = readFileSync(
      join(process.cwd(), baselinePath),
      "utf8"
    );
    const conversation = readFileSync(
      join(process.cwd(), conversationPath),
      "utf8"
    );

    expect(baseline).toContain(
      'CREATE POLICY "klyx_messages_select"'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_messages_insert"'
    );
    expect(baseline).toContain(
      'CREATE POLICY "klyx_messages_update"'
    );

    expect(conversation).toContain('.from("messages")');
    expect(conversation).toContain('.update({ is_read: true })');
    expect(conversation).toContain("is_read: false");
    expect(conversation).toContain('table: "messages"');
  });

  it("keeps the root overview read-only and moves privileged reads behind explicit authenticated scoping", () => {
    const overview = readFileSync(
      join(process.cwd(), overviewPath),
      "utf8"
    );
    const route = readFileSync(
      join(process.cwd(), overviewRoutePath),
      "utf8"
    );

    expect(overview).toContain("KLYX_MESSAGES_OVERVIEW_READ_ONLY");
    expect(overview).toContain('fetch("/api/messages/overview"');
    expect(overview).not.toContain('.from("messages")');
    expect(overview).not.toContain('.update({ is_read: true })');
    expect(overview).not.toContain(".insert({");
    expect(overview).not.toContain('.channel(');
    expect(overview).not.toContain('table: "messages"');

    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain('.from("messages")');
    expect(route).toContain("sender_id.eq.${profileId},receiver_id.eq.${profileId}");
    expect(route).toContain(
      "booking.parent_id === profileId || booking.babysitter_id === profileId"
    );
    expect(route).not.toContain(".insert({");
    expect(route).not.toContain(".update(");
  });
});
