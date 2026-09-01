import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX message conversation i18n and safety contract", () => {
  it("uses the shared locale provider and typed conversation dictionary", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).toContain("KLYX_MESSAGE_CONVERSATION_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxMessageConversation");
    expect(page).toContain("getKlyxMessageConversationLocaleTag");
    expect(page).not.toContain('new Intl.DateTimeFormat("fr-BE"');
  });

  it("does not reflect raw booking, profile or message read errors", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).toContain("KLYX_MESSAGE_CONVERSATION_SAFE_ERRORS");
    expect(page).not.toContain("bookingError.message");
    expect(page).not.toContain("profileError.message");
    expect(page).not.toContain("messageError.message");
    expect(page).not.toContain("throw new Error(error.message)");
    expect(page).toContain('setErrorKey("loadError")');
  });

  it("preserves the participant boundary and explicit authentication redirect", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).toContain('router.replace("/login")');
    expect(page).toContain("typedBooking.parent_id === activeProfileId");
    expect(page).toContain("typedBooking.babysitter_id === activeProfileId");
    expect(page).toContain('setErrorKey("accessDenied")');
  });

  it("preserves read-state updates and the existing Realtime message channel", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).toContain("markMessagesAsRead");
    expect(page).toContain('.update({ is_read: true })');
    expect(page).toContain('.channel(`booking-messages-${bookingId}`)');
    expect(page).toContain('event: "INSERT"');
    expect(page).toContain('table: "messages"');
    expect(page).toContain("supabase.removeChannel(channel)");
  });

  it("preserves explicit send, unread insertion and the database rate-limit sentinel", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).toContain('supabase.from("messages").insert({');
    expect(page).toContain("is_read: false");
    expect(page).toContain("maxLength={2000}");
    expect(page).toContain('error.message.includes("KLYX_MESSAGE_RATE_LIMITED")');
    expect(page).toContain('? "rateLimited"');
    expect(page).toContain(': "sendError"');
  });

  it("does not add automatic retry, booking or payment behavior", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("refund");
    expect(page).not.toContain("payment_intent");
  });

  it("returns both conversation exits to the Messages overview", () => {
    const page = read("app/messages/[bookingId]/page.tsx");

    expect(page.match(/href="\/messages"/g)?.length).toBe(2);
    expect(page).not.toContain('href="/dashboard"');
    expect(page).toContain('t("backMessagesFull")');
  });
});
