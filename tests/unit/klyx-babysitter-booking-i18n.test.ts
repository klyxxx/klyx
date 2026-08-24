import { describe, expect, it } from "vitest";
import {
  formatKlyxBabysitterBookingAvailability,
  formatKlyxBabysitterBookingHourlyPrice,
  formatKlyxBabysitterBookingUnavailableDay,
  getKlyxBabysitterBookingDayLabel,
  getKlyxBabysitterBookingDictionary,
  KLYX_BABYSITTER_BOOKING_MESSAGE_KEYS,
  KLYX_BABYSITTER_BOOKING_TRANSLATED_LOCALES,
  resolveKlyxBabysitterBookingLocale,
} from "@/lib/klyx-babysitter-booking-i18n";

describe("KLYX babysitter booking i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_BABYSITTER_BOOKING_TRANSLATED_LOCALES) {
      const dictionary = getKlyxBabysitterBookingDictionary(locale);
      for (const key of KLYX_BABYSITTER_BOOKING_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
      expect(getKlyxBabysitterBookingDayLabel(locale, 1).length).toBeGreaterThan(0);
      expect(formatKlyxBabysitterBookingHourlyPrice(locale, 12.5)).toContain("12.50");
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxBabysitterBookingLocale("es")).toBe("fr");
    expect(getKlyxBabysitterBookingDictionary("es")).toEqual(
      getKlyxBabysitterBookingDictionary("fr")
    );
    expect(getKlyxBabysitterBookingDayLabel("es", 0)).toBe("Dimanche");
  });

  it("formats availability without changing slot values", () => {
    const slots = [{ start_time: "08:30:00", end_time: "12:45:00" }];
    expect(formatKlyxBabysitterBookingAvailability("en", 1, slots)).toContain("08:30–12:45");
    expect(formatKlyxBabysitterBookingUnavailableDay("nl", 2)).toContain("Dinsdag");
  });
});
