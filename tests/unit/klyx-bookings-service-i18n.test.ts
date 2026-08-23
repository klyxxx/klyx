import {
  describe,
  expect,
  it,
} from "vitest";

import { formatKlyxBookingServiceFromSlug } from "@/lib/klyx-bookings-service-i18n";

describe("KLYX bookings service slug i18n", () => {
  it("translates canonical services from stable slugs", () => {
    expect(
      formatKlyxBookingServiceFromSlug("en", "cleaning", "Ménage")
    ).toBe("Cleaning");
    expect(
      formatKlyxBookingServiceFromSlug(
        "nl",
        "menage-a-domicile",
        "Ménage à domicile"
      )
    ).toBe("Schoonmaak");
    expect(
      formatKlyxBookingServiceFromSlug("de", "moving", "Déménagement")
    ).toBe("Umzug");
  });

  it("preserves custom service names when a custom slug is present", () => {
    expect(
      formatKlyxBookingServiceFromSlug(
        "en",
        "premium-plumbing",
        "Plomberie premium"
      )
    ).toBe("Plomberie premium");
  });

  it("falls back to the historical label compatibility path when slug is absent", () => {
    expect(
      formatKlyxBookingServiceFromSlug("en", null, "Ménage")
    ).toBe("Cleaning");
  });
});
