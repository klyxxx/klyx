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
  KLYX_BATCH_4_LANGUAGE_OPTIONS,
  KLYX_BATCH_4_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_4_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-4";
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
    for (const [input, expected] of [
      ["fr-BE", "fr"], ["EN_us", "en"], ["nl-BE", "nl"], ["de-CH", "de"],
      ["es-MX", "es"], ["pt-BR", "pt"], ["ar-MA", "ar"], ["ru-RU", "ru"],
      ["uk-UA", "uk"], ["pl-PL", "pl"], ["tr-TR", "tr"], ["hi-IN", "hi"],
      ["ur-PK", "ur"], ["he-IL", "he"], ["fa-IR", "fa"], ["id-ID", "id"],
      ["vi-VN", "vi"], ["th-TH", "th"], ["bn-BD", "bn"], ["sv-SE", "sv"],
      ["da-DK", "da"], ["no-NO", "no"], ["fi-FI", "fi"], ["cs-CZ", "cs"],
      ["sk-SK", "sk"], ["hu-HU", "hu"], ["ro-RO", "ro"], ["el-GR", "el"],
      ["bg-BG", "bg"], ["hr-HR", "hr"], ["sr-RS", "sr"],
    ] as const) {
      expect(normalizeKlyxLocale(input)).toBe(expected);
    }
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
    expect(resolveKlyxLocale(["xx-YY", "ro-RO", "en-US"])).toBe("ro");
  });

  it("ships 36 genuinely translated selectable shell locales", () => {
    expect(KLYX_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual([
      "fr", "en", "nl", "de", "es", "it", "pt", "ar", "zh-hans", "zh-hant", "ja", "ko",
      "ru", "uk", "pl", "tr", "hi", "ur", "he", "fa", "id", "vi", "th", "bn",
      "sv", "da", "no", "fi",
      "cs", "sk", "hu", "ro", "el", "bg", "hr", "sr",
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
    requireCompletePack(KLYX_BATCH_2_LANGUAGE_OPTIONS, KLYX_BATCH_2_UI_MESSAGES, KLYX_BATCH_2_NAVIGATION_TRANSLATIONS);
  });

  it("requires every batch-3 locale to own every shell and navigation translation", () => {
    requireCompletePack(KLYX_BATCH_3_LANGUAGE_OPTIONS, KLYX_BATCH_3_UI_MESSAGES, KLYX_BATCH_3_NAVIGATION_TRANSLATIONS);
  });

  it("requires every batch-4 locale to own every shell and navigation translation", () => {
    requireCompletePack(KLYX_BATCH_4_LANGUAGE_OPTIONS, KLYX_BATCH_4_UI_MESSAGES, KLYX_BATCH_4_NAVIGATION_TRANSLATIONS);
  });

  it("exposes HTML language and RTL metadata", () => {
    for (const locale of ["ar", "ur", "he", "fa"] as const) {
      expect(getKlyxLocaleMetadata(locale).dir).toBe("rtl");
    }

    expect(getKlyxLocaleMetadata("zh-hant").htmlLang).toBe("zh-Hant");
    expect(getKlyxLocaleMetadata("hi").htmlLang).toBe("hi");
    expect(getKlyxLocaleMetadata("sv").htmlLang).toBe("sv");
    expect(getKlyxLocaleMetadata("el").htmlLang).toBe("el");
    expect(getKlyxLocaleMetadata("en").dir).toBe("ltr");
  });

  it("translates representative global UI labels", () => {
    expect(translateKlyxUi("en", "sidebar.logout")).toBe("Sign out");
    expect(translateKlyxUi("ar", "sidebar.openMenu")).toBe("فتح القائمة");
    expect(translateKlyxUi("ru", "sidebar.logout")).toBe("Выйти");
    expect(translateKlyxUi("hi", "sidebar.openMenu")).toBe("मेनू खोलें");
    expect(translateKlyxUi("he", "sidebar.logout")).toBe("התנתקות");
    expect(translateKlyxUi("sv", "sidebar.logout")).toBe("Logga ut");
    expect(translateKlyxUi("fi", "sidebar.noResults")).toBe("Ei tuloksia.");
    expect(translateKlyxUi("cs", "sidebar.logout")).toBe("Odhlásit se");
    expect(translateKlyxUi("ro", "sidebar.noResults")).toBe("Niciun rezultat.");
    expect(translateKlyxUi("sr", "sidebar.openMenu")).toBe("Отвори мени");
  });

  it("translates representative navigation labels", () => {
    expect(translateKlyxNavigationLabel("en", "Paramètres")).toBe("Settings");
    expect(translateKlyxNavigationLabel("zh-hans", "Paramètres")).toBe("设置");
    expect(translateKlyxNavigationLabel("ru", "Paramètres")).toBe("Настройки");
    expect(translateKlyxNavigationLabel("id", "Paramètres")).toBe("Pengaturan");
    expect(translateKlyxNavigationLabel("sv", "Paramètres")).toBe("Inställningar");
    expect(translateKlyxNavigationLabel("fi", "Paramètres")).toBe("Asetukset");
    expect(translateKlyxNavigationLabel("cs", "Paramètres")).toBe("Nastavení");
    expect(translateKlyxNavigationLabel("hu", "Paramètres")).toBe("Beállítások");
    expect(translateKlyxNavigationLabel("el", "Paramètres")).toBe("Ρυθμίσεις");
    expect(translateKlyxNavigationLabel("sr", "Paramètres")).toBe("Подешавања");
    expect(translateKlyxNavigationLabel("en", "Libellé inconnu")).toBe("Libellé inconnu");
  });

  it("finds navigation entries using translated labels", () => {
    for (const [query, locale] of [
      ["settings", "en"], ["设置", "zh-hans"], ["настройки", "ru"], ["pengaturan", "id"],
      ["inställningar", "sv"], ["asetukset", "fi"], ["nastavení", "cs"], ["beállítások", "hu"],
      ["ρυθμίσεις", "el"], ["подешавања", "sr"],
    ] as const) {
      expect(
        searchKlyxNavigation(query, "client", false, locale)
          .some((item) => item.href === "/settings")
      ).toBe(true);
    }
  });
});
