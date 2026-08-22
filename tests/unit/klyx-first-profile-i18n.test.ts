import { describe, expect, it } from "vitest";

import {
  getKlyxFirstProfileDictionary,
  KLYX_FIRST_PROFILE_TRANSLATED_LOCALES,
  translateKlyxFirstProfile,
  translateKlyxFirstProfileApiError,
} from "@/lib/klyx-first-profile-i18n";

import type { KlyxLocale } from "@/lib/klyx-i18n";

describe("KLYX first-profile page i18n", () => {
  it("certifies complete FR/EN/NL/DE dictionaries", () => {
    const referenceKeys = Object.keys(getKlyxFirstProfileDictionary("fr"));

    expect(KLYX_FIRST_PROFILE_TRANSLATED_LOCALES).toEqual(["fr", "en", "nl", "de"]);

    for (const locale of KLYX_FIRST_PROFILE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFirstProfileDictionary(locale);
      expect(Object.keys(dictionary).sort()).toEqual([...referenceKeys].sort());
      expect(Object.values(dictionary).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(translateKlyxFirstProfile("es" as KlyxLocale, "title")).toBe(
      translateKlyxFirstProfile("fr", "title")
    );
  });

  it("translates only the closed set of sanitized public API errors", () => {
    expect(
      translateKlyxFirstProfileApiError(
        "en",
        "Ce pays n’est pas encore pris en charge par KLYX.",
        "profileCreateFailed"
      )
    ).toBe("This country is not supported by KLYX yet.");

    expect(
      translateKlyxFirstProfileApiError(
        "en",
        "postgres internal detail that must not be shown",
        "profileCreateFailed"
      )
    ).toBe("Unable to create the KLYX profile.");
  });
});
