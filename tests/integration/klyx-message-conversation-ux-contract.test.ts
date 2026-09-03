import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX message conversation UX contract", () => {
  const source = read("app/messages/[bookingId]/page.tsx");

  it("keeps the conversation role-aware and returns to Messages", () => {
    expect(source).toContain("getActiveProfileAccount");
    expect(source).not.toContain("getActiveClientProfile");
    expect(source).toContain('href="/messages"');
    expect(source).not.toContain('href="/dashboard"');
  });

  it("resolves universal providers before authorizing or sending messages", () => {
    expect(source).toContain("KLYX_MESSAGE_CONVERSATION_UNIVERSAL_PROVIDER");
    expect(source).toContain("provider_id: string | null");
    expect(source).toContain(
      '"id, parent_id, provider_id, babysitter_id, booking_date, start_time, end_time, status"'
    );
    expect(source).toContain(
      "return booking.provider_id ?? booking.babysitter_id;"
    );
    expect(source).toContain(
      "const providerProfileId = getBookingProviderProfileId(typedBooking);"
    );
    expect(source).toContain("providerProfileId === activeProfileId");
    expect(source).toContain(
      "const providerProfileId = getBookingProviderProfileId(booking);"
    );
    expect(source).toContain("? providerProfileId");
  });

  it("keeps the conversation in the single-blue KLYX visual language", () => {
    expect(source).toContain("bg-blue-600");
    expect(source).toContain("text-blue-100");
    expect(source).toContain("focus:border-blue-600/45");
    expect(source).not.toContain("violet-");
    expect(source).not.toContain("indigo-");
    expect(source).not.toContain("placehold.co");
  });

  it("reserves the mobile shell and safe area for the composer", () => {
    expect(source).toContain("KLYX_MESSAGE_CONVERSATION_MOBILE_SAFE_VIEWPORT");
    expect(source).toContain(
      "h-[calc(100dvh_-_10rem_-_env(safe-area-inset-bottom))]"
    );
    expect(source).toContain("lg:h-[calc(100vh-4rem)]");
    expect(source).toContain("min-h-0 flex-1");
    expect(source).toContain("flex shrink-0 items-end");
  });

  it("preserves realtime messaging and explicit send behavior", () => {
    expect(source).toContain('.channel(`booking-messages-${bookingId}`)');
    expect(source).toContain('event: "INSERT"');
    expect(source).toContain('.from("messages").insert({');
    expect(source).toContain("event.currentTarget.form?.requestSubmit()");
    expect(source).toContain("KLYX_MESSAGE_RATE_LIMITED");
  });
});
