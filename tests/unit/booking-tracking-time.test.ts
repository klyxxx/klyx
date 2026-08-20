import { describe, expect, it } from "vitest";

import { getBookingTrackingTimingError } from "@/lib/booking-tracking-time";

const beforeStart = new Date("2026-08-21T08:00:00.000Z"); // 10:00 Europe/Brussels
const atStart = new Date("2026-08-21T09:00:00.000Z"); // 11:00 Europe/Brussels

describe("booking tracking timing policy", () => {
  it("blocks en_route before the booking day", () => {
    expect(
      getBookingTrackingTimingError({
        bookingDate: "2026-08-22",
        startTime: "11:00",
        action: "en_route",
        now: beforeStart,
      })
    ).toBe("Le suivi de mission ne peut pas commencer avant le jour prévu.");
  });

  it("allows en_route and arrived on the booking day before start time", () => {
    for (const action of ["en_route", "arrived"] as const) {
      expect(
        getBookingTrackingTimingError({
          bookingDate: "2026-08-21",
          startTime: "11:00",
          action,
          now: beforeStart,
        })
      ).toBeNull();
    }
  });

  it("blocks in_progress before the scheduled start time", () => {
    expect(
      getBookingTrackingTimingError({
        bookingDate: "2026-08-21",
        startTime: "11:00",
        action: "in_progress",
        now: beforeStart,
      })
    ).toBe(
      "La prestation ne peut pas commencer ou être terminée avant l’heure prévue."
    );
  });

  it("allows in_progress exactly at the scheduled start time", () => {
    expect(
      getBookingTrackingTimingError({
        bookingDate: "2026-08-21",
        startTime: "11:00",
        action: "in_progress",
        now: atStart,
      })
    ).toBeNull();
  });

  it("blocks finish and client confirmation before start", () => {
    for (const action of ["provider_finished", "client_confirmed"] as const) {
      expect(
        getBookingTrackingTimingError({
          bookingDate: "2026-08-21",
          startTime: "11:00",
          action,
          now: beforeStart,
        })
      ).not.toBeNull();
    }
  });

  it("allows finish and client confirmation after the booking start", () => {
    const afterStart = new Date("2026-08-21T10:00:00.000Z");

    for (const action of ["provider_finished", "client_confirmed"] as const) {
      expect(
        getBookingTrackingTimingError({
          bookingDate: "2026-08-21",
          startTime: "11:00",
          action,
          now: afterStart,
        })
      ).toBeNull();
    }
  });

  it("fails closed on invalid booking date or time", () => {
    expect(
      getBookingTrackingTimingError({
        bookingDate: "not-a-date",
        startTime: "11:00",
        action: "en_route",
        now: beforeStart,
      })
    ).toBe("La date ou l’heure de cette réservation est invalide.");

    expect(
      getBookingTrackingTimingError({
        bookingDate: "2026-08-21",
        startTime: "99:99",
        action: "in_progress",
        now: beforeStart,
      })
    ).toBe("La date ou l’heure de cette réservation est invalide.");
  });
});
