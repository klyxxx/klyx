import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_LANGUAGE_OPTIONS,
  getKlyxLocaleMetadata,
  normalizeKlyxLocale,
  resolveKlyxLocale,
  translateKlyxNavigationLabel,
  translateKlyxUi,
} from "../../lib/klyx-i18n";
import {
  searchKlyxNavigation,
} from "../../lib/klyx-navigation";

describe("KLYX i18n foundation", () => {
  it("normalizes supported locale variants", () => {
    expect(normalizeKlyxLocale("fr-BE")).toBe("fr");
    expect(normalizeKlyxLocale("EN_us")).toBe("en");
    expect(normalizeKlyxLocale("nl-BE")).toBe("nl");
    expect(normalizeKlyxLocale("de-CH")).toBe("de");
    expect(normalizeKlyxLocale("es-MX")).toBe("es");
    expect(normalizeKlyxLocale("pt-BR")).toBe("pt");
    expect(normalizeKlyxLocale("ar-MA")).toBe("ar");
  });

  it("normalizes simplified and traditional Chinese variants", () => {
    expect(normalizeKlyxLocale("zh-CN")).toBe("zh-hans");
    expect(normalizeKlyxLocale("zh-SG")).toBe("zh-hans");
    expect(normalizeKlyxLocale("zh-TW")).toBe("zh-hant");
    expect(normalizeKlyxLocale("zh-HK")).toBe("zh-hant");
  });

  it("falls back safely to French for unsupported locales", () => {
    expect(normalizeKlyxLocale("xx-YY")).toBe("fr");
    expect(normalizeKlyxLocale(null)).toBe("fr");
  });

  it("resolves the first supported browser locale", () => {
    expect(resolveKlyxLocale(["xx-YY", "de-DE", "en-US"])).toBe("de");
    expect(resolveKlyxLocale(["xx-YY", "ja-JP"])).toBe("ja");
    expect(resolveKlyxLocale(["zh-TW", "en-GB"])).toBe("zh-hant");
  });

  it("ships a real translated shell catalog instead of fake selectable fallbacks", () => {
    expect(KLYX_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual([
      "fr",
      "en",
      "nl",
      "de",
      "es",
      "it",
      "pt",
      "ar",
      "zh-hans",
      "zh-hant",
      "ja",
      "ko",
    ]);

    for (const option of KLYX_LANGUAGE_OPTIONS) {
      expect(translateKlyxUi(option.value, "sidebar.logout").trim()).not.toBe("");
      expect(translateKlyxNavigationLabel(option.value, "Paramètres").trim()).not.toBe("");
    }
  });

  it("exposes HTML language and RTL metadata", () => {
    expect(getKlyxLocaleMetadata("ar")).toMatchObject({
      htmlLang: "ar",
      dir: "rtl",
    });
    expect(getKlyxLocaleMetadata("zh-hant").htmlLang).toBe("zh-Hant");
    expect(getKlyxLocaleMetadata("en").dir).toBe("ltr");
  });

  it("translates global UI labels", () => {
    expect(translateKlyxUi("en", "sidebar.logout")).toBe("Sign out");
    expect(translateKlyxUi("nl", "sidebar.noResults")).toBe("Geen resultaten.");
    expect(translateKlyxUi("de", "sidebar.logout")).toBe("Abmelden");
    expect(translateKlyxUi("es", "sidebar.logout")).toBe("Cerrar sesión");
    expect(translateKlyxUi("ar", "sidebar.openMenu")).toBe("فتح القائمة");
    expect(translateKlyxUi("ja", "sidebar.noResults")).toBe("結果がありません。");
    expect(translateKlyxUi("fr", "skipToMain")).toBe("Aller au contenu principal");
  });

  it("translates navigation labels", () => {
    expect(translateKlyxNavigationLabel("en", "Paramètres")).toBe("Settings");
    expect(translateKlyxNavigationLabel("nl", "Mes réservations")).toBe("Mijn boekingen");
    expect(translateKlyxNavigationLabel("de", "Paramètres")).toBe("Einstellungen");
    expect(translateKlyxNavigationLabel("es", "Mes réservations")).toBe("Mis reservas");
    expect(translateKlyxNavigationLabel("zh-hans", "Paramètres")).toBe("设置");
    expect(translateKlyxNavigationLabel("en", "Libellé inconnu")).toBe("Libellé inconnu");
  });

  it("finds navigation entries using translated labels", () => {
    expect(
      searchKlyxNavigation("settings", "client", false, "en")
        .some((item) => item.href === "/settings")
    ).toBe(true);

    expect(
      searchKlyxNavigation("boekingen", "client", false, "nl")
        .some((item) => item.href === "/bookings")
    ).toBe(true);

    expect(
      searchKlyxNavigation("einstellungen", "client", false, "de")
        .some((item) => item.href === "/settings")
    ).toBe(true);

    expect(
      searchKlyxNavigation("设置", "client", false, "zh-hans")
        .some((item) => item.href === "/settings")
    ).toBe(true);
  });
});
