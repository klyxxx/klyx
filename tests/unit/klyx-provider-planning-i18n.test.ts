import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_PLANNING_MESSAGE_KEYS,
  KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES,
  formatKlyxProviderPlanningDuration,
  getKlyxProviderPlanningDictionary,
  getKlyxProviderPlanningIntlLocale,
  resolveKlyxProviderPlanningLocale,
  translateKlyxProviderPlanning,
  translateKlyxProviderPlanningStatus,
  translateKlyxProviderPlanningWarning,
} from "@/lib/klyx-provider-planning-i18n";

const bookings = [
  {
    id: "booking-a",
    startTime: "09:00:00",
    endTime: "10:00:00",
  },
  {
    id: "booking-b",
    startTime: "10:15:00",
    endTime: "11:00:00",
  },
];

describe("KLYX provider planning i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderPlanningDictionary(locale);

      for (const key of KLYX_PROVIDER_PLANNING_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderPlanningLocale("es")).toBe("fr");
    expect(translateKlyxProviderPlanning("es", "refresh")).toBe(
      "Actualiser l’analyse"
    );
    expect(getKlyxProviderPlanningIntlLocale("es")).toBe("fr-BE");
  });

  it("localizes known booking statuses and preserves unknown statuses", () => {
    expect(translateKlyxProviderPlanningStatus("en", "pending")).toBe(
      "Pending"
    );
    expect(translateKlyxProviderPlanningStatus("nl", "accepted")).toBe(
      "Bevestigd"
    );
    expect(translateKlyxProviderPlanningStatus("de", "completed")).toBe(
      "Abgeschlossen"
    );
    expect(translateKlyxProviderPlanningStatus("en", "future_status")).toBe(
      "future_status"
    );
  });

  it("keeps duration formatting stable", () => {
    expect(formatKlyxProviderPlanningDuration(25)).toBe("25 min");
    expect(formatKlyxProviderPlanningDuration(120)).toBe("2 h");
    expect(formatKlyxProviderPlanningDuration(135)).toBe("2 h 15 min");
  });

  it("rebuilds known dynamic warnings from booking data", () => {
    const overlap = translateKlyxProviderPlanningWarning(
      "en",
      {
        code: "overlap",
        title: "Chevauchement détecté",
        detail: "server detail",
        bookingIds: ["booking-a", "booking-b"],
      },
      bookings,
      105
    );

    expect(overlap.title).toBe("Overlap detected");
    expect(overlap.detail).toContain("09:00–10:00");
    expect(overlap.detail).toContain("10:15–11:00");

    const shortBreak = translateKlyxProviderPlanningWarning(
      "de",
      {
        code: "short_break",
        title: "Pause très courte",
        detail: "server detail",
        bookingIds: ["booking-a", "booking-b"],
      },
      bookings,
      105
    );

    expect(shortBreak.title).toBe("Sehr kurze Pause");
    expect(shortBreak.detail).toContain("15");
  });

  it("distinguishes the two stable outside-availability warnings", () => {
    const unavailableDay = translateKlyxProviderPlanningWarning(
      "nl",
      {
        code: "outside_availability",
        title: "Aucune disponibilité habituelle",
        detail: "server detail",
        bookingIds: ["booking-a"],
      },
      bookings,
      60
    );

    expect(unavailableDay.title).toBe("Geen gebruikelijke beschikbaarheid");

    const outsideHours = translateKlyxProviderPlanningWarning(
      "en",
      {
        code: "outside_availability",
        title: "Mission hors disponibilité",
        detail: "server detail",
        bookingIds: ["booking-a"],
      },
      bookings,
      60
    );

    expect(outsideHours.title).toBe("Job outside availability");
    expect(outsideHours.detail).toContain("09:00–10:00");
  });

  it("keeps unknown future warnings verbatim", () => {
    expect(
      translateKlyxProviderPlanningWarning(
        "en",
        {
          code: "future_warning",
          title: "Future title",
          detail: "Future detail",
          bookingIds: [],
        },
        bookings,
        0
      )
    ).toEqual({
      title: "Future title",
      detail: "Future detail",
    });
  });
});
