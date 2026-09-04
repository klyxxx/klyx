import { describe, expect, it } from "vitest";

import {
  KLYX_SIDEBAR_NAVIGATION_MESSAGE_KEYS,
  KLYX_SIDEBAR_NAVIGATION_TRANSLATED_LOCALES,
  getKlyxSidebarNavigationDictionary,
  resolveKlyxSidebarNavigationLocale,
  translateKlyxSidebarNavigation,
} from "@/lib/klyx-sidebar-navigation-i18n";

describe("KLYX sidebar navigation i18n", () => {
  it("keeps every selectable locale complete", () => {
    for (const locale of KLYX_SIDEBAR_NAVIGATION_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSidebarNavigationDictionary(locale);

      for (const key of KLYX_SIDEBAR_NAVIGATION_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("localizes desktop and mobile navigation labels", () => {
    expect(translateKlyxSidebarNavigation("fr", "desktopNavigation")).toBe(
      "Navigation principale KLYX"
    );
    expect(translateKlyxSidebarNavigation("en", "mobileNavigation")).toBe(
      "Mobile KLYX navigation"
    );
    expect(translateKlyxSidebarNavigation("nl", "desktopNavigation")).toBe(
      "Hoofdnavigatie van KLYX"
    );
    expect(translateKlyxSidebarNavigation("de", "mobileNavigation")).toBe(
      "Mobile KLYX-Navigation"
    );
  });

  it("falls back deterministically to French", () => {
    expect(resolveKlyxSidebarNavigationLocale("es")).toBe("fr");
    expect(translateKlyxSidebarNavigation("es", "desktopNavigation")).toBe(
      "Navigation principale KLYX"
    );
  });
});
