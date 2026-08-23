import { describe, expect, it } from "vitest";

import {
  KLYX_BABYSITTERS_PAGE_MESSAGE_KEYS,
  KLYX_BABYSITTERS_PAGE_TRANSLATED_LOCALES,
  formatKlyxBabysittersBudgetMax,
  formatKlyxBabysittersCompletedJobs,
  formatKlyxBabysittersDisplayedProfiles,
  getKlyxBabysittersPageDictionary,
  hasKlyxBabysittersPageTranslation,
  resolveKlyxBabysittersPageLocale,
  translateKlyxBabysittersPage,
} from "../../lib/klyx-babysitters-page-i18n";

describe("KLYX babysitters page i18n", () => {
  it("keeps every certified dictionary complete", () => {
    for (const locale of KLYX_BABYSITTERS_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxBabysittersPageDictionary(locale);

      for (const key of KLYX_BABYSITTERS_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real English, Dutch and German directory copy", () => {
    expect(translateKlyxBabysittersPage("en", "title")).toBe(
      "Recommended babysitters"
    );
    expect(translateKlyxBabysittersPage("nl", "viewProfile")).toBe(
      "Profiel bekijken"
    );
    expect(translateKlyxBabysittersPage("de", "recommendedByKlyx")).toBe(
      "Von KLYX empfohlen"
    );
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(hasKlyxBabysittersPageTranslation("de")).toBe(true);
    expect(hasKlyxBabysittersPageTranslation("es")).toBe(false);
    expect(resolveKlyxBabysittersPageLocale("es")).toBe("fr");
    expect(translateKlyxBabysittersPage("es", "newSearch")).toBe(
      "Nouvelle recherche"
    );
  });

  it("localizes dynamic profile counts and completed jobs", () => {
    expect(formatKlyxBabysittersDisplayedProfiles("fr", 1)).toBe(
      "1 profil affiché"
    );
    expect(formatKlyxBabysittersDisplayedProfiles("fr", 2)).toBe(
      "2 profils affichés"
    );
    expect(formatKlyxBabysittersDisplayedProfiles("en", 2)).toBe(
      "2 profiles shown"
    );
    expect(formatKlyxBabysittersCompletedJobs("nl", 1)).toBe(
      "1 opdracht voltooid"
    );
    expect(formatKlyxBabysittersCompletedJobs("de", 3)).toBe(
      "3 Aufträge abgeschlossen"
    );
  });

  it("keeps the existing euro-per-hour budget meaning while localizing the frame", () => {
    expect(formatKlyxBabysittersBudgetMax("fr", 18)).toBe("18.00 €/h max");
    expect(formatKlyxBabysittersBudgetMax("en", 18)).toBe("max €18.00/h");
    expect(formatKlyxBabysittersBudgetMax("nl", 18)).toBe("max. €18.00/u");
    expect(formatKlyxBabysittersBudgetMax("de", 18)).toBe("max. 18.00 €/Std.");
  });
});
