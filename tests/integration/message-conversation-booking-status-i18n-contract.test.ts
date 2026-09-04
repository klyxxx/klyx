import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const conversationPage = readFileSync(
  join(process.cwd(), "app/messages/[bookingId]/page.tsx"),
  "utf8"
);

describe("message conversation booking status i18n contract", () => {
  it("renders the booking status through the shared booking-detail formatter", () => {
    expect(conversationPage).toContain(
      'import { formatKlyxBookingDetailStatus } from "@/lib/klyx-booking-detail-i18n";'
    );
    expect(conversationPage).toContain(
      "formatKlyxBookingDetailStatus(locale, booking.status)"
    );
    expect(conversationPage).not.toContain("\n            {booking.status}\n");
  });

  it("does not change the conversation read, realtime or send workflow", () => {
    expect(conversationPage).toContain('.from("bookings")');
    expect(conversationPage).toContain('.from("messages")');
    expect(conversationPage).toContain('event: "INSERT"');
    expect(conversationPage).toContain("booking_id: booking.id");
    expect(conversationPage).toContain("sender_id: currentUserId");
    expect(conversationPage).toContain("receiver_id: receiverId");
  });
});
