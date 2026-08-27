import { describe, expect, it } from "vitest";

import {
  MEMORY_PREFERENCE_LIMITS,
  parseMemoryPreferencesInput,
} from "@/lib/memory-preferences-input";

describe("memory preference input validation", () => {
  it("normalizes and deduplicates valid values", () => {
    expect(
      parseMemoryPreferencesInput({
        defaultCity: " Bruxelles ",
        defaultBudget: 125.555,
        preferredServiceSlugs: ["cleaning", "cleaning", "moving"],
        householdNotes: "  digicode à demander  ",
        schedulingNotes: " après 18h ",
        aiMemoryEnabled: false,
      })
    ).toEqual({
      defaultCity: "Bruxelles",
      defaultBudget: 125.56,
      preferredServiceSlugs: ["cleaning", "moving"],
      householdNotes: "digicode à demander",
      schedulingNotes: "après 18h",
      aiMemoryEnabled: false,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, MEMORY_PREFERENCE_LIMITS.maxBudget + 1])(
    "rejects unsafe budgets: %s",
    (defaultBudget) => {
      expect(() => parseMemoryPreferencesInput({ defaultBudget })).toThrow();
    }
  );

  it("rejects oversized notes and service lists", () => {
    expect(() =>
      parseMemoryPreferencesInput({
        householdNotes: "x".repeat(MEMORY_PREFERENCE_LIMITS.maxNoteLength + 1),
      })
    ).toThrow();

    expect(() =>
      parseMemoryPreferencesInput({
        preferredServiceSlugs: Array.from(
          { length: MEMORY_PREFERENCE_LIMITS.maxServiceSlugs + 1 },
          (_, index) => `service-${index}`
        ),
      })
    ).toThrow();
  });

  it("rejects malformed types", () => {
    expect(() => parseMemoryPreferencesInput(null)).toThrow();
    expect(() => parseMemoryPreferencesInput({ preferredServiceSlugs: "cleaning" })).toThrow();
    expect(() => parseMemoryPreferencesInput({ aiMemoryEnabled: "false" })).toThrow();
  });
});
