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
  KLYX_BATCH_9_LANGUAGE_OPTIONS,
  KLYX_BATCH_9_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_9_UI_MESSAGES,
} from "../../lib/klyx-i18n-batch-9";
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

const BATCH_9_LOCALES = ["si", "pa", "gu", "kn"] as const;

describe("KLYX i18n batch 9", () => {
  it("exposes every batch-9 locale through the canonical catalog", () => {
    expect(KLYX_LANGUAGE_OPTIONS.map((item) => item.value)).toEqual(
      expect.arrayContaining([...BATCH_9_LOCALES])
    );
  });

  it("normalizes regional browser variants", () => {
    for (const [input, expected] of [
      ["si-LK", "si"],
      ["pa-IN", "pa"],
      ["gu-IN", "gu"],
      ["kn-IN", "kn"],
    ] as const) {
      expect(normalizeKlyxLocale(input)).toBe(expected);
    }
    expect(resolveKlyxLocale(["xx-YY", "si-LK", "en-US"])).toBe("si");
  });

  it("requires every batch-9 locale to own every shell and navigation translation", () => {
    const requiredNavigationLabels = Object.keys(KLYX_EN_NAVIGATION_TRANSLATIONS);

    for (const option of KLYX_BATCH_9_LANGUAGE_OPTIONS) {
      const ui = KLYX_BATCH_9_UI_MESSAGES[option.value];
      const navigation = KLYX_BATCH_9_NAVIGATION_TRANSLATIONS[option.value];
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
    expect(getKlyxLocaleMetadata("si").htmlLang).toBe("si");
    expect(getKlyxLocaleMetadata("pa").dir).toBe("ltr");
    expect(translateKlyxUi("gu", "sidebar.logout")).toBe("લોગ આઉટ");
    expect(translateKlyxUi("kn", "sidebar.noResults")).toBe("ಯಾವುದೇ ಫಲಿತಾಂಶಗಳಿಲ್ಲ.");
    expect(translateKlyxNavigationLabel("si", "Paramètres")).toBe("සැකසුම්");
    expect(translateKlyxNavigationLabel("pa", "Paramètres")).toBe("ਸੈਟਿੰਗਾਂ");
    expect(translateKlyxNavigationLabel("gu", "Paramètres")).toBe("સેટિંગ્સ");
    expect(translateKlyxNavigationLabel("kn", "Paramètres")).toBe("ಸೆಟ್ಟಿಂಗ್‌ಗಳು");
  });

  it("finds Settings through translated navigation labels", () => {
    for (const [query, locale] of [
      ["සැකසුම්", "si"],
      ["ਸੈਟਿੰਗਾਂ", "pa"],
      ["સેટિંગ્સ", "gu"],
      ["ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "kn"],
    ] as const) {
      expect(
        searchKlyxNavigation(query, "client", false, locale)
          .some((item) => item.href === "/settings")
      ).toBe(true);
    }
  });
});
