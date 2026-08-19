import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819211000_klyx_message_column_privileges.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const messagePages = [
  "app/messages/page.tsx",
  "app/messages/[bookingId]/page.tsx",
] as const;

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

  it("preserves the existing RLS row boundary and Realtime client requirements", () => {
    const baseline = readFileSync(
      join(process.cwd(), baselinePath),
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

    for (const pagePath of messagePages) {
      const page = readFileSync(
        join(process.cwd(), pagePath),
        "utf8"
      );

      expect(page).toContain('.from("messages")');
      expect(page).toContain('.update({ is_read: true })');
      expect(page).toContain("is_read: false");
      expect(page).toContain('table: "messages"');
    }
  });
});
