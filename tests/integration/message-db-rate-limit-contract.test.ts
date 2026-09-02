import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = readRepoFile(
  "supabase/migrations/20260821231000_klyx_message_insert_abuse_guard.sql"
);
const page = readRepoFile("app/messages/[bookingId]/page.tsx");
const rootPage = readRepoFile("app/messages/page.tsx");
const overviewRoute = readRepoFile("app/api/messages/overview/route.ts");
const conversationI18n = readRepoFile(
  "lib/klyx-message-conversation-i18n.ts"
);
const golden = readRepoFile("scripts/golden-path-message-rate-limit.mjs");
const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");

describe("KLYX direct-message database abuse guard", () => {
  it("keeps direct browser messaging protected inside PostgreSQL", () => {
    expect(page).toContain('.from("messages")');
    expect(page).toContain(".insert({");
    expect(migration).toContain("before insert on public.messages");
    expect(migration).toContain("klyx_enforce_message_insert_policy");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("'message_send'");
    expect(migration).toContain("30,");
    expect(migration).toContain("60");
    expect(migration).toContain("KLYX_MESSAGE_RATE_LIMITED");
  });

  it("hashes the authenticated account with SHA-256 before persistence", () => {
    expect(migration).toContain("sha256(");
    expect(migration).toContain("'klyx-rate-limit:' || v_actor_id::text");
    expect(migration).toContain("encode(");
    expect(migration).not.toContain("insert into public.api_rate_limits");
    expect(migration).toContain("public.klyx_consume_api_rate_limit(");
  });

  it("enforces message content boundaries below the UI", () => {
    expect(migration).toContain("klyx_messages_nonblank_check");
    expect(migration).toContain("char_length(btrim(message)) >= 1");
    expect(migration).toContain("klyx_messages_length_check");
    expect(migration).toContain("char_length(message) <= 2000");
    expect(migration).toContain("new.is_read := false");
  });

  it("does not expose the trigger function as a browser RPC", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_enforce_message_insert_policy()"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.klyx_enforce_message_insert_policy()"
    );
    expect(migration).toContain("to service_role");
  });

  it("maps database failures to safe localized message-composer errors", () => {
    expect(page).toContain('error.message.includes("KLYX_MESSAGE_RATE_LIMITED")');
    expect(page).toContain('? "rateLimited"');
    expect(page).toContain(': "sendError"');
    expect(page).not.toContain("throw new Error(error.message);");

    expect(conversationI18n).toContain(
      'rateLimited: "Trop de messages envoyés. Réessaie dans une minute."'
    );
    expect(conversationI18n).toContain(
      'sendError: "Impossible d\'envoyer le message."'
    );
    expect(conversationI18n).toContain(
      'rateLimited: "Too many messages sent. Try again in one minute."'
    );
  });

  it("keeps the root messages overview outside the composer and send-rate-limit surface", () => {
    expect(rootPage).toContain("KLYX_MESSAGES_OVERVIEW_READ_ONLY");
    expect(rootPage).toContain('fetch("/api/messages/overview"');
    expect(rootPage).not.toContain('.from("messages")');
    expect(rootPage).not.toContain(".insert({");
    expect(rootPage).not.toContain('error.message.includes("KLYX_MESSAGE_RATE_LIMITED")');
    expect(rootPage).not.toContain("Impossible d'envoyer le message.");

    expect(overviewRoute).toContain('.from("messages")');
    expect(overviewRoute).not.toContain(".insert({");
    expect(overviewRoute).not.toContain("KLYX_MESSAGE_RATE_LIMITED");
  });

  it("proves direct Supabase enforcement and canonical notification continuity in Golden", () => {
    expect(golden).toContain('from("messages")');
    expect(golden).toContain("MESSAGE_LIMIT = 30");
    expect(golden).toContain("KLYX_MESSAGE_RATE_LIMITED");
    expect(golden).toContain("newMessagesForcedUnread: true");
    expect(golden).toContain("messageNotificationsVerified: MESSAGE_LIMIT");
    expect(golden).toContain('from("user_notifications")');
    expect(golden).not.toContain('from("notifications")');
    expect(golden).toContain("directSupabaseClientProtected: true");
    expect(workflow).toContain(
      "node scripts/golden-path-message-rate-limit.mjs"
    );
    expect(workflow).toContain('      - "app/messages/**"');
  });
});
