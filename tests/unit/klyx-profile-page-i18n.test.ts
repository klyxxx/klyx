import { describe, expect, it } from "vitest";

import {
  KLYX_PROFILE_PAGE_MESSAGE_KEYS,
  KLYX_PROFILE_PAGE_TRANSLATED_LOCALES,
  resolveKlyxProfilePageApiErrorKey,
  resolveKlyxProfilePageLocale,
  translateKlyxProfilePage,
} from "@/lib/klyx-profile-page-i18n";

describe("KLYX profile page i18n", () => {
  it("certifies the current page locales", () => {
    expect(KLYX_PROFILE_PAGE_TRANSLATED_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
      "es",
    ]);
  });

  it("keeps every certified dictionary key complete and non-empty", () => {
    for (const locale of KLYX_PROFILE_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_PROFILE_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxProfilePage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("certifies the Spanish profile labels and validation boundaries", () => {
    expect(resolveKlyxProfilePageLocale("es")).toBe("es");
    expect(translateKlyxProfilePage("es", "providerProfile")).toBe(
      "Perfil de prestador"
    );
    expect(translateKlyxProfilePage("es", "clientProfile")).toBe(
      "Perfil de cliente"
    );
    expect(translateKlyxProfilePage("es", "accessDenied")).toBe(
      "Se ha denegado el acceso a este perfil."
    );
    expect(translateKlyxProfilePage("es", "ageInvalid")).toContain(
      "entre 18 y 100 años"
    );
    expect(translateKlyxProfilePage("es", "avatarTypeInvalid")).toContain(
      "JPG, PNG o WEBP"
    );
    expect(translateKlyxProfilePage("es", "avatarTooLarge")).toContain(
      "5 MB"
    );
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(resolveKlyxProfilePageLocale("it")).toBe("fr");
    expect(translateKlyxProfilePage("it", "title")).toBe(
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
