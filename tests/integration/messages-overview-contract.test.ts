import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX messages overview contract", () => {
  it("restores /messages as an overview instead of the dynamic conversation route", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).toContain("KLYX_MESSAGES_OVERVIEW_READ_ONLY");
    expect(overview).toContain("export default function MessagesPage");
    expect(overview).not.toContain("useParams");
    expect(overview).not.toContain("Conversation introuvable.");
    expect(overview).not.toContain("ConversationPage");
  });

  it("scopes the overview to the active profile and reads only conversation data", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).toContain("getActiveClientProfile");
    expect(overview).toContain('.from("messages")');
    expect(overview).toContain('.from("bookings")');
    expect(overview).toContain('.from("profiles")');
    expect(overview).toContain("sender_id.eq.${profileId},receiver_id.eq.${profileId}");
    expect(overview).toContain('.order("created_at", { ascending: false })');
    expect(overview).toContain(".limit(200)");
    expect(overview).toContain(
      "booking.parent_id === profileId || booking.babysitter_id === profileId"
    );
  });

  it("keeps the overview mutation-free and leaves read-state changes to the conversation", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).not.toContain(".insert(");
    expect(overview).not.toContain(".update(");
    expect(overview).not.toContain(".delete(");
    expect(overview).not.toContain(".upsert(");
    expect(overview).not.toContain(".channel(");
    expect(overview).not.toContain("markMessagesAsRead");
    expect(overview).not.toContain("stripe");
    expect(overview).not.toContain("refund");
    expect(overview).not.toContain("payment");
  });

  it("opens the existing dynamic conversation explicitly per booking", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).toContain('href={"/messages/" + conversation.booking.id}');
    expect(overview).toContain("conversation.unreadCount > 0");
    expect(overview).toContain("conversation.latestMessage.message");
  });

  it("keeps the dynamic conversation as the separate mutation-aware surface", () => {
    const conversation = read("app/messages/[bookingId]/page.tsx");

    expect(conversation).toContain("useParams");
    expect(conversation).toContain("markMessagesAsRead");
    expect(conversation).toContain(".update({ is_read: true })");
    expect(conversation).toContain('.from("messages").insert({');
  });

  it("uses the shared locale provider and typed messages dictionary", () => {
    const overview = read("app/messages/page.tsx");
    const helper = read("lib/klyx-messages-page-i18n.ts");

    expect(overview).toContain("useKlyxLocale");
    expect(overview).toContain("translateKlyxMessagesPage");
    expect(helper).toContain("KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES");
    expect(helper).toContain('return hasKlyxMessagesPageTranslation(locale)');
    expect(helper).toContain(': "fr";');
  });

  it("does not expose raw backend error messages in the overview UI", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).not.toContain("error.message");
    expect(overview).toContain(
      'setErrorMessage(translateKlyxMessagesPage(locale, "loadError"))'
    );
  });
});
