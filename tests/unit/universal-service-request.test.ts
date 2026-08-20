import { describe, expect, it } from "vitest";

import {
  detectDurationHours,
  detectRequestedDay,
  detectRequestedTime,
} from "@/lib/universal-service-request";

const now = new Date("2026-08-21T12:00:00.000Z");

describe("universal service request date parsing", () => {
  it("parses après-demain before the nested demain keyword", () => {
    expect(
      detectRequestedDay(
        "J’ai besoin d’un ménage après-demain à Bruxelles.",
        now
      )
    ).toBe("2026-08-23");
  });

  it("keeps demain mapped to the next day", () => {
    expect(
      detectRequestedDay(
        "J’ai besoin d’un ménage demain à Bruxelles.",
        now
      )
    ).toBe("2026-08-22");
  });
});

describe("universal service request time and duration parsing", () => {
  it("keeps the start time distinct from an explicit duration", () => {
    const text =
      "J’ai besoin d’un ménage à Bruxelles à 10h pendant 2 heures.";

    expect(detectRequestedTime(text)).toBe("10:00:00");
    expect(detectDurationHours(text)).toBe(2);
  });

  it("prioritizes a contextual duration after a clock time", () => {
    expect(
      detectDurationHours(
        "Le prestataire arrive vers 9h pour 3 heures de ménage."
      )
    ).toBe(3);
  });

  it("does not treat an isolated appointment time as a duration", () => {
    expect(
      detectDurationHours("J’ai besoin du prestataire à 10h.")
    ).toBeNull();
  });

  it("derives duration from a simple time range", () => {
    expect(
      detectDurationHours("J’ai besoin du service de 10h à 12h.")
    ).toBe(2);
  });

  it("keeps a standalone duration usable", () => {
    expect(detectDurationHours("Durée estimée 2h.")).toBe(2);
  });
});
