import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_BOOKINGS_PAGE_MESSAGE_KEYS,
  KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES,
  formatKlyxBookingAmount,
  formatKlyxBookingService,
  formatKlyxBookingSlotCount,
  formatKlyxBookingStatus,
  resolveKlyxBookingsPageLocale,
  translateKlyxBookingsPage,
} from "@/lib/klyx-bookings-page-i18n";

describe("KLYX bookings page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_BOOKINGS_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxBookingsPage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(resolveKlyxBookingsPageLocale("es")).toBe("fr");
    expect(translateKlyxBookingsPage("es", "title")).toBe("Mes réservations");
  });

  it("translates stable booking status codes instead of server labels", () => {
    expect(formatKlyxBookingStatus("en", "payment_pending")).toBe(
      "Payment to complete"
    );
    expect(formatKlyxBookingStatus("nl", "refund_failed")).toBe(
      "Terugbetaling moet worden gecontroleerd"
    );
    expect(formatKlyxBookingStatus("de", "cancellation_decision")).toBe(
      "Entscheidung erforderlich"
    );
    expect(formatKlyxBookingStatus("en", "future_state")).toBe("future state");
  });

  it("translates only recognized initial KLYX service labels", () => {
    expect(formatKlyxBookingService("en", "Ménage")).toBe("Cleaning");
    expect(formatKlyxBookingService("nl", "Déménagement")).toBe("Verhuizing");
    expect(formatKlyxBookingService("de", "Baby-sitting")).toBe("Babysitting");
    expect(formatKlyxBookingService("en", "Plomberie experte")).toBe(
      "Plomberie experte"
    );
  });

  it("localizes slot counts and amounts without inventing currencies", () => {
    expect(formatKlyxBookingSlotCount("fr", 1)).toBe("1 créneau");
    expect(formatKlyxBookingSlotCount("en", 2)).toBe("2 time slots");
    expect(formatKlyxBookingAmount("de", null, "EUR")).toBe(
      "Preis noch zu bestätigen"
    );
    expect(formatKlyxBookingAmount("en", 1250, "not-a-code")).toContain(
      "currency unavailable"
    );
  });
});
