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
  KLYX_BATCH_10_LANGUAGE_OPTIONS,
  KLYX_BATCH_10_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_10_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-10";
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

const BATCH_10_LOCALES = ["my", "km", "lo", "mn"] as const;

describe("KLYX i18n batch 10", () => {
  it("exposes every batch-10 locale through the canonical catalog", () => {
    expect(KLYX_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual(
      expect.arrayContaining([...BATCH_10_LOCALES])
    );
  });

  it("normalizes regional browser variants", () => {
    for (const [input, expected] of [
      ["my-MM", "my"],
      ["km-KH", "km"],
      ["lo-LA", "lo"],
      ["mn-MN", "mn"],
    ] as const) {
      expect(normalizeKlyxLocale(input)).toBe(expected);
    }
    expect(resolveKlyxLocale(["xx-YY", "km-KH", "en-US"])).toBe("km");
  });

  it("requires every batch-10 locale to own every shell and navigation translation", () => {
    const requiredNavigationLabels = Object.keys(KLYX_EN_NAVIGATION_TRANSLATIONS);

    for (const option of KLYX_BATCH_10_LANGUAGE_OPTIONS) {
      const ui = KLYX_BATCH_10_UI_MESSAGES[option.value];
      const navigation = KLYX_BATCH_10_NAVIGATION_TRANSLATIONS[option.value];
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
    expect(getKlyxLocaleMetadata("my").htmlLang).toBe("my");
    expect(getKlyxLocaleMetadata("mn").dir).toBe("ltr");
    expect(translateKlyxUi("km", "sidebar.logout")).toBe("ចាកចេញ");
    expect(translateKlyxUi("lo", "sidebar.noResults")).toBe("ບໍ່ມີຜົນລັບ.");
    expect(translateKlyxNavigationLabel("my", "Paramètres")).toBe("ဆက်တင်များ");
    expect(translateKlyxNavigationLabel("km", "Paramètres")).toBe("ការកំណត់");
    expect(translateKlyxNavigationLabel("lo", "Paramètres")).toBe("ການຕັ້ງຄ່າ");
    expect(translateKlyxNavigationLabel("mn", "Paramètres")).toBe("Тохиргоо");
  });

  it("finds Settings through translated navigation labels", () => {
    for (const [query, locale] of [
      ["ဆက်တင်များ", "my"],
      ["ការកំណត់", "km"],
      ["ການຕັ້ງຄ່າ", "lo"],
      ["тохиргоо", "mn"],
    ] as const) {
      expect(
        searchKlyxNavigation(query, "client", false, locale)
          .some((item) => item.href === "/settings")
      ).toBe(true);
    }
  });
});
