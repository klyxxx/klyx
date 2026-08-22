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
  KLYX_EN_NAVIGATION_TRANSLATIONS,
} from "../../lib/klyx-i18n-batch-1";
import {
  KLYX_BATCH_2_LANGUAGE_OPTIONS,
  KLYX_BATCH_2_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_2_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-2";
import {
  KLYX_BATCH_3_LANGUAGE_OPTIONS,
  KLYX_BATCH_3_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_3_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-3";
import {
  searchKlyxNavigation,
} from "../../lib/klyx-navigation";

const REQUIRED_UI_KEYS = [
  "skipToMain",
  "sidebar.providerTagline",
  "sidebar.clientTagline",
  "sidebar.loadingProfile",
  "sidebar.providerAccount",
  "sidebar.clientAccount",
  "sidebar.searchPlaceholder",
  "sidebar.noResults",
  "sidebar.adminCenter",
  "sidebar.loggingOut",
  "sidebar.logout",
  "sidebar.openMenu",
  "sidebar.closeMenu",
] as const;

function requireCompletePack(
  options: readonly { value: string }[],
  uiMessages: Record<string, Record<string, string>>,
  navigationTranslations: Record<string, Record<string, string>>
) {
  const requiredNavigationLabels = Object.keys(
    KLYX_EN_NAVIGATION_TRANSLATIONS
  );

  for (const option of options) {
    const ui = uiMessages[option.value];
    const navigation = navigationTranslations[option.value];

    expect(ui).toBeDefined();
    expect(navigation).toBeDefined();

    for (const key of REQUIRED_UI_KEYS) {
      expect(ui[key]?.trim()).toBeTruthy();
    }

    for (const sourceLabel of requiredNavigationLabels) {
      expect(
        navigation[sourceLabel]?.trim(),
        `${option.value} is missing navigation label: ${sourceLabel}`
      ).toBeTruthy();
    }
  }
}

describe("KLYX i18n foundation", () => {
  it("normalizes supported locale variants", () => {
    expect(normalizeKlyxLocale("fr-BE")).toBe("fr");
    expect(normalizeKlyxLocale("EN_us")).toBe("en");
    expect(normalizeKlyxLocale("nl-BE")).toBe("nl");
    expect(normalizeKlyxLocale("de-CH")).toBe("de");
    expect(normalizeKlyxLocale("es-MX")).toBe("es");
    expect(normalizeKlyxLocale("pt-BR")).toBe("pt");
    expect(normalizeKlyxLocale("ar-MA")).toBe("ar");
    expect(normalizeKlyxLocale("ru-RU")).toBe("ru");
    expect(normalizeKlyxLocale("uk-UA")).toBe("uk");
    expect(normalizeKlyxLocale("pl-PL")).toBe("pl");
    expect(normalizeKlyxLocale("tr-TR")).toBe("tr");
    expect(normalizeKlyxLocale("hi-IN")).toBe("hi");
    expect(normalizeKlyxLocale("ur-PK")).toBe("ur");
    expect(normalizeKlyxLocale("he-IL")).toBe("he");
    expect(normalizeKlyxLocale("fa-IR")).toBe("fa");
    expect(normalizeKlyxLocale("id-ID")).toBe("id");
    expect(normalizeKlyxLocale("vi-VN")).toBe("vi");
    expect(normalizeKlyxLocale("th-TH")).toBe("th");
    expect(normalizeKlyxLocale("bn-BD")).toBe("bn");
    expect(normalizeKlyxLocale("sv-SE")).toBe("sv");
    expect(normalizeKlyxLocale("da-DK")).toBe("da");
    expect(normalizeKlyxLocale("no-NO")).toBe("no");
    expect(normalizeKlyxLocale("fi-FI")).toBe("fi");
  });

  it("supports legacy browser aliases without exposing duplicate locales", () => {
    expect(normalizeKlyxLocale("iw-IL")).toBe("he");
    expect(normalizeKlyxLocale("in-ID")).toBe("id");
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
    expect(resolveKlyxLocale(["xx-YY", "hi-IN", "en-US"])).toBe("hi");
    expect(resolveKlyxLocale(["xx-YY", "fi-FI", "en-US"])).toBe("fi");
  });

  it("ships 28 genuinely translated selectable shell locales", () => {
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
      "ru",
      "uk",
      "pl",
      "tr",
      "hi",
      "ur",
      "he",
      "fa",
      "id",
      "vi",
      "th",
      "bn",
      "sv",
      "da",
      "no",
      "fi",
    ]);

    for (const option of KLYX_LANGUAGE_OPTIONS) {
      for (const key of REQUIRED_UI_KEYS) {
        expect(translateKlyxUi(option.value, key).trim()).not.toBe("");
      }

      expect(
        translateKlyxNavigationLabel(option.value, "Paramètres").trim()
      ).not.toBe("");
    }
  });

  it("requires every batch-2 locale to own every shell and navigation translation", () => {
    requireCompletePack(
      KLYX_BATCH_2_LANGUAGE_OPTIONS,
      KLYX_BATCH_2_UI_MESSAGES,
      KLYX_BATCH_2_NAVIGATION_TRANSLATIONS
    );
  });

  it("requires every batch-3 locale to own every shell and navigation translation", () => {
    requireCompletePack(
      KLYX_BATCH_3_LANGUAGE_OPTIONS,
      KLYX_BATCH_3_UI_MESSAGES,
      KLYX_BATCH_3_NAVIGATION_TRANSLATIONS
    );
  });

  it("exposes HTML language and RTL metadata", () => {
    for (const locale of ["ar", "ur", "he", "fa"] as const) {
      expect(getKlyxLocaleMetadata(locale).dir).toBe("rtl");
    }

    expect(getKlyxLocaleMetadata("zh-hant").htmlLang).toBe("zh-Hant");
    expect(getKlyxLocaleMetadata("hi").htmlLang).toBe("hi");
    expect(getKlyxLocaleMetadata("sv").htmlLang).toBe("sv");
    expect(getKlyxLocaleMetadata("en").dir).toBe("ltr");
  });

  it("translates representative global UI labels", () => {
    expect(translateKlyxUi("en", "sidebar.logout")).toBe("Sign out");
    expect(translateKlyxUi("nl", "sidebar.noResults")).toBe("Geen resultaten.");
    expect(translateKlyxUi("de", "sidebar.logout")).toBe("Abmelden");
    expect(translateKlyxUi("es", "sidebar.logout")).toBe("Cerrar sesión");
    expect(translateKlyxUi("ar", "sidebar.openMenu")).toBe("فتح القائمة");
    expect(translateKlyxUi("ja", "sidebar.noResults")).toBe("結果がありません。");
    expect(translateKlyxUi("ru", "sidebar.logout")).toBe("Выйти");
    expect(translateKlyxUi("hi", "sidebar.openMenu")).toBe("मेनू खोलें");
    expect(translateKlyxUi("he", "sidebar.logout")).toBe("התנתקות");
    expect(translateKlyxUi("id", "sidebar.noResults")).toBe("Tidak ada hasil.");
    expect(translateKlyxUi("sv", "sidebar.logout")).toBe("Logga ut");
    expect(translateKlyxUi("fi", "sidebar.noResults")).toBe("Ei tuloksia.");
  });

  it("translates representative navigation labels", () => {
    expect(translateKlyxNavigationLabel("en", "Paramètres")).toBe("Settings");
    expect(translateKlyxNavigationLabel("nl", "Mes réservations")).toBe("Mijn boekingen");
    expect(translateKlyxNavigationLabel("de", "Paramètres")).toBe("Einstellungen");
    expect(translateKlyxNavigationLabel("es", "Mes réservations")).toBe("Mis reservas");
    expect(translateKlyxNavigationLabel("zh-hans", "Paramètres")).toBe("设置");
    expect(translateKlyxNavigationLabel("ru", "Paramètres")).toBe("Настройки");
    expect(translateKlyxNavigationLabel("hi", "Paramètres")).toBe("सेटिंग्स");
    expect(translateKlyxNavigationLabel("id", "Paramètres")).toBe("Pengaturan");
    expect(translateKlyxNavigationLabel("sv", "Paramètres")).toBe("Inställningar");
    expect(translateKlyxNavigationLabel("fi", "Paramètres")).toBe("Asetukset");
    expect(translateKlyxNavigationLabel("en", "Libellé inconnu")).toBe("Libellé inconnu");
  });

  it("finds navigation entries using translated labels", () => {
    for (const [query, locale] of [
      ["settings", "en"],
      ["instellingen", "nl"],
      ["einstellungen", "de"],
      ["设置", "zh-hans"],
      ["настройки", "ru"],
      ["सेटिंग्स", "hi"],
      ["pengaturan", "id"],
      ["inställningar", "sv"],
      ["asetukset", "fi"],
    ] as const) {
      expect(
        searchKlyxNavigation(query, "client", false, locale)
          .some((item) => item.href === "/settings")
      ).toBe(true);
    }
  });
});
