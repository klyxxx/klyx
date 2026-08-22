import { describe, expect, it } from "vitest";

import {
  KLYX_LANGUAGE_OPTIONS,
  getKlyxLocaleMetadata,
  normalizeKlyxLocale,
  resolveKlyxLocale,
  translateKlyxNavigationLabel,
  translateKlyxUi,
} from "../../lib/klyx-i18n";
import { KLYX_EN_NAVIGATION_TRANSLATIONS } from "../../lib/klyx-i18n-batch-1";
import {
  KLYX_BATCH_11_LANGUAGE_OPTIONS,
  KLYX_BATCH_11_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_11_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-11";
import { searchKlyxNavigation } from "../../lib/klyx-navigation";

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

const BATCH_11_LOCALES = ["sq", "mk", "is", "ga"] as const;

describe("KLYX i18n batch 11", () => {
  it("exposes every batch-11 locale through the canonical catalog", () => {
    expect(KLYX_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual(
      expect.arrayContaining([...BATCH_11_LOCALES])
    );
  });

  it("normalizes regional browser variants", () => {
    for (const [input, expected] of [
      ["sq-AL", "sq"],
      ["mk-MK", "mk"],
      ["is-IS", "is"],
      ["ga-IE", "ga"],
    ] as const) {
      expect(normalizeKlyxLocale(input)).toBe(expected);
    }
    expect(resolveKlyxLocale(["xx-YY", "ga-IE", "en-US"])).toBe("ga");
  });

  it("requires every batch-11 locale to own every shell and navigation translation", () => {
    const requiredNavigationLabels = Object.keys(KLYX_EN_NAVIGATION_TRANSLATIONS);

    for (const option of KLYX_BATCH_11_LANGUAGE_OPTIONS) {
      const ui = KLYX_BATCH_11_UI_MESSAGES[option.value];
      const navigation = KLYX_BATCH_11_NAVIGATION_TRANSLATIONS[option.value];
      expect(ui).toBeDefined();
      expect(navigation).toBeDefined();

      for (const key of REQUIRED_UI_KEYS) {
        expect(ui[key]?.trim(), `${option.value} is missing UI key: ${key}`).toBeTruthy();
      }
      for (const sourceLabel of requiredNavigationLabels) {
        expect(
          navigation[sourceLabel]?.trim(),
          `${option.value} is missing navigation label: ${sourceLabel}`
        ).toBeTruthy();
      }
    }
  });

  it("exposes correct metadata and representative translations", () => {
    expect(getKlyxLocaleMetadata("sq").htmlLang).toBe("sq");
    expect(getKlyxLocaleMetadata("ga").dir).toBe("ltr");
    expect(translateKlyxUi("mk", "sidebar.logout")).toBe("Одјави се");
    expect(translateKlyxUi("is", "sidebar.noResults")).toBe("Engar niðurstöður.");
    expect(translateKlyxNavigationLabel("sq", "Paramètres")).toBe("Cilësimet");
    expect(translateKlyxNavigationLabel("mk", "Paramètres")).toBe("Поставки");
    expect(translateKlyxNavigationLabel("is", "Paramètres")).toBe("Stillingar");
    expect(translateKlyxNavigationLabel("ga", "Paramètres")).toBe("Socruithe");
  });

  it("finds Settings through translated navigation labels", () => {
    for (const [query, locale] of [
      ["cilësimet", "sq"],
      ["поставки", "mk"],
      ["stillingar", "is"],
      ["socruithe", "ga"],
    ] as const) {
      expect(
        searchKlyxNavigation(query, "client", false, locale)
          .some((item) => item.href === "/settings")
      ).toBe(true);
    }
  });
});
