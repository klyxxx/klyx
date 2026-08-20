import { describe, expect, it } from "vitest";

import { detectRequestedDay } from "@/lib/universal-service-request";

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
