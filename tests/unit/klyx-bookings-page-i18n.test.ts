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
  it("keeps all certified dictionaries complete", () => {
    for (const locale of KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_BOOKINGS_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxBookingsPage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside certified page locales", () => {
    expect(resolveKlyxBookingsPageLocale("es")).toBe("fr");
    expect(translateKlyxBookingsPage("es", "title")).toBe("Mes réservations");
  });

  it("translates stable booking states and canonical service labels", () => {
    expect(formatKlyxBookingStatus("en", "payment_pending")).toBe(
      "Payment to complete"
    );
    expect(formatKlyxBookingStatus("nl", "refund_failed")).toBe(
      "Terugbetaling moet worden gecontroleerd"
    );
    expect(formatKlyxBookingService("de", "Ménage à domicile")).toBe(
      "Reinigung"
    );
    expect(formatKlyxBookingService("en", "Plomberie premium")).toBe(
      "Plomberie premium"
    );
  });

  it("localizes money and grouped slot counts without changing values", () => {
    expect(formatKlyxBookingSlotCount("fr", 2)).toBe("2 créneaux");
    expect(formatKlyxBookingSlotCount("en", 1)).toBe("1 time slot");
    expect(formatKlyxBookingAmount("en", null, "EUR")).toBe(
      "Price to be confirmed"
    );
    expect(formatKlyxBookingAmount("de", 3500, "BAD-CURRENCY")).toContain(
      "Währung nicht verfügbar"
    );
  });

  it("keeps explicit booking and payment confirmation boundaries in every locale", () => {
    for (const locale of KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES) {
      const boundary = translateKlyxBookingsPage(
        locale,
        "explicitConfirmationBoundary"
      );
      expect(boundary.length).toBeGreaterThan(40);
    }

    expect(
      translateKlyxBookingsPage("en", "explicitConfirmationBoundary")
    ).toContain("explicit confirmation");
    expect(
      translateKlyxBookingsPage("de", "providerSafety")
    ).toContain("keine Zahlung automatisch");
  });
});
