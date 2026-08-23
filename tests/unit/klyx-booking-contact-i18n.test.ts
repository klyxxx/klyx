import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_BOOKING_CONTACT_MESSAGE_KEYS,
  KLYX_BOOKING_CONTACT_TRANSLATED_LOCALES,
  bookingContactReasonMessage,
  resolveKlyxBookingContactLocale,
  translateKlyxBookingContact,
} from "@/lib/klyx-booking-contact-i18n";

describe("KLYX booking contact i18n", () => {
  it("keeps all certified dictionaries complete", () => {
    for (const locale of KLYX_BOOKING_CONTACT_TRANSLATED_LOCALES) {
      for (const key of KLYX_BOOKING_CONTACT_MESSAGE_KEYS) {
        expect(translateKlyxBookingContact(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside certified page locales", () => {
    expect(resolveKlyxBookingContactLocale("es")).toBe("fr");
    expect(translateKlyxBookingContact("es", "protectedTitle")).toBe(
      "Contact protégé"
    );
  });

  it("derives denied-contact copy from stable reason codes", () => {
    expect(
      bookingContactReasonMessage("en", "own_unverified_phone", "Alex")
    ).toContain("Verify your number by SMS");
    expect(
      bookingContactReasonMessage("nl", "other_private_phone", "Alex")
    ).toContain("Alex");
    expect(
      bookingContactReasonMessage("de", "contact_expired", "Alex")
    ).toContain("beendet");
  });

  it("falls back safely for unknown server reasons", () => {
    expect(bookingContactReasonMessage("en", "internal_detail", "Alex")).toBe(
      "Contact unavailable."
    );
  });
});
