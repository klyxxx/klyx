import { describe, expect, it } from "vitest";

import {
  KLYX_INSTALL_PAGE_MESSAGE_KEYS,
  KLYX_INSTALL_PAGE_TRANSLATED_LOCALES,
  getKlyxInstallPageDictionary,
  hasKlyxInstallPageTranslation,
  resolveKlyxInstallPageLocale,
  translateKlyxInstallPage,
} from "../../lib/klyx-install-page-i18n";

describe("KLYX install page i18n", () => {
  it("keeps every certified install-page dictionary complete", () => {
    for (const locale of KLYX_INSTALL_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxInstallPageDictionary(locale);

      for (const key of KLYX_INSTALL_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real English, Dutch, German and Spanish install copy", () => {
    expect(translateKlyxInstallPage("en", "backHome")).toBe("Back to home");
    expect(translateKlyxInstallPage("nl", "browserSignup")).toBe(
      "Een account maken"
    );
    expect(translateKlyxInstallPage("de", "desktopTitle")).toBe("Computer");
    expect(translateKlyxInstallPage("es", "desktopTitle")).toBe("Ordenador");
  });

  it("keeps the PWA versus store-app distinction explicit in every certified locale", () => {
    for (const locale of KLYX_INSTALL_PAGE_TRANSLATED_LOCALES) {
      const currentVersion = translateKlyxInstallPage(
        locale,
        "currentVersionDescription"
      );
      const noStore = translateKlyxInstallPage(locale, "benefitNoStore");

      expect(currentVersion).toContain("PWA");
      expect(currentVersion).toContain("App Store");
      expect(currentVersion).toContain("Google Play");
      expect(noStore).toContain("App Store");
      expect(noStore).toContain("Google Play");
    }
  });

  it("certifies the Spanish install page copy", () => {
    expect(hasKlyxInstallPageTranslation("es")).toBe(true);
    expect(resolveKlyxInstallPageLocale("es")).toBe("es");
    expect(getKlyxInstallPageDictionary("es")).toMatchObject({
      metadataTitle: "Instalar KLYX",
      login: "Iniciar sesión",
      androidTitle: "Android",
      iosTitle: "iPhone / iPad",
      desktopTitle: "Ordenador",
      browserSignup: "Crear una cuenta",
      currentVersionTitle: "Versión actual",
    });
  });

  it("keeps the Spanish current-version honesty boundary explicit", () => {
    const currentVersion = getKlyxInstallPageDictionary(
      "es"
    ).currentVersionDescription;

    expect(currentVersion).toContain("PWA");
    expect(currentVersion).toContain("Todavía no es una aplicación publicada");
    expect(currentVersion).toContain("App Store");
    expect(currentVersion).toContain("Google Play");
  });

  it("keeps five-language install coverage explicit and falls back to French", () => {
    expect(hasKlyxInstallPageTranslation("en")).toBe(true);
    expect(hasKlyxInstallPageTranslation("es")).toBe(true);
    expect(hasKlyxInstallPageTranslation("ar")).toBe(false);
    expect(resolveKlyxInstallPageLocale("ar")).toBe("fr");
    expect(translateKlyxInstallPage("ar", "metadataTitle")).toBe(
      "Installer KLYX"
    );
    expect(translateKlyxInstallPage("ar", "currentVersionTitle")).toBe(
      "Version actuelle"
    );
  });
});
