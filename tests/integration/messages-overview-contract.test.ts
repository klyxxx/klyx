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

  it("scopes the overview through the authenticated server boundary and reads only conversation data", () => {
    const overview = read("app/messages/page.tsx");
    const route = read("app/api/messages/overview/route.ts");

    expect(overview).toContain('fetch("/api/messages/overview"');
    expect(overview).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(overview).not.toContain('.from("messages")');
    expect(overview).not.toContain('.from("bookings")');
    expect(overview).not.toContain('.from("profiles")');

    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain("const profileId = profile.id");
    expect(route).toContain('.from("messages")');
    expect(route).toContain('.from("bookings")');
    expect(route).toContain('.from("profiles")');
    expect(route).toContain("sender_id.eq.${profileId},receiver_id.eq.${profileId}");
    expect(route).toContain('.order("created_at", { ascending: false })');
    expect(route).toContain(".limit(200)");
    expect(route).toContain("otherParticipantId(booking, profileId) !== null");
  });

  it("resolves modern provider_id bookings before the legacy babysitter_id fallback", () => {
    const route = read("app/api/messages/overview/route.ts");

    expect(route).toContain("KLYX_MESSAGES_UNIVERSAL_PROVIDER_PARTICIPANTS_2026_09_02");
    expect(route).toContain("provider_id: string | null");
    expect(route).toContain("babysitter_id: string | null");
    expect(route).toContain(
      '"id, parent_id, provider_id, babysitter_id, booking_date, start_time, end_time, status"'
    );
    expect(route).toContain(
      "return booking.provider_id ?? booking.babysitter_id ?? null;"
    );
    expect(route).toContain('.filter((id): id is string => Boolean(id))');
  });

  it("keeps the overview mutation-free and leaves read-state changes to the conversation", () => {
    const overview = read("app/messages/page.tsx");
    const route = read("app/api/messages/overview/route.ts");

    expect(overview).not.toContain(".insert(");
    expect(overview).not.toContain(".update(");
    expect(overview).not.toContain(".delete(");
    expect(overview).not.toContain(".upsert(");
    expect(overview).not.toContain(".channel(");
    expect(overview).not.toContain("markMessagesAsRead");
    expect(route).not.toContain(".insert(");
    expect(route).not.toContain(".update(");
    expect(route).not.toContain(".delete(");
    expect(route).not.toContain(".upsert(");
    expect(overview).not.toContain("stripe");
    expect(overview).not.toContain("refund");
    expect(overview).not.toContain("payment");
  });

  it("opens the existing dynamic conversation explicitly per booking", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).toContain('href={"/messages/" + primaryConversation.booking.id}');
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

  it("uses the focused KLYX destination language without dashboard card stacking", () => {
    const overview = read("app/messages/page.tsx");

    expect(overview).toContain("KLYX_MESSAGES_DESTINATION_2026_09_02");
    expect(overview).toContain("const primaryConversation = useMemo(");
    expect(overview).toContain(
      "conversations.find((conversation) => conversation.unreadCount > 0)"
    );
    expect(overview).toContain("remainingConversations");
    expect(overview).toContain('className="klyx-button inline-flex min-h-11');
    expect(overview).toContain("border-y border-border");
    expect(overview).not.toContain("shadow-sm");
    expect(overview).not.toContain("border-red-500");
    expect(overview).not.toContain("bg-red-500");
  });
});
