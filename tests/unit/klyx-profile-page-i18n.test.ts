import { describe, expect, it } from "vitest";

import {
  KLYX_PROFILE_PAGE_MESSAGE_KEYS,
  KLYX_PROFILE_PAGE_TRANSLATED_LOCALES,
  resolveKlyxProfilePageApiErrorKey,
  resolveKlyxProfilePageLocale,
  translateKlyxProfilePage,
} from "@/lib/klyx-profile-page-i18n";

describe("KLYX profile page i18n", () => {
  it("certifies only the four current page locales", () => {
    expect(KLYX_PROFILE_PAGE_TRANSLATED_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
    ]);
  });

  it("keeps every certified dictionary key complete and non-empty", () => {
    for (const locale of KLYX_PROFILE_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_PROFILE_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxProfilePage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(resolveKlyxProfilePageLocale("es")).toBe("fr");
    expect(translateKlyxProfilePage("es", "title")).toBe(
      translateKlyxProfilePage("fr", "title")
    );
  });

  it("maps only known public API errors and fails closed otherwise", () => {
    expect(
      resolveKlyxProfilePageApiErrorKey(
        "L’âge doit être compris entre 18 et 100 ans.",
        "saveFailed"
      )
    ).toBe("ageInvalid");
    expect(
      resolveKlyxProfilePageApiErrorKey(
        "Choisis une image JPG, PNG ou WEBP.",
        "uploadFailed"
      )
    ).toBe("avatarTypeInvalid");
    expect(
      resolveKlyxProfilePageApiErrorKey(
        "postgres internal relation detail",
        "loadFailed"
      )
    ).toBe("loadFailed");
    expect(resolveKlyxProfilePageApiErrorKey(null, "saveFailed")).toBe(
      "saveFailed"
    );
  });
});
