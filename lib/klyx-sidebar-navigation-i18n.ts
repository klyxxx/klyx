import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_SIDEBAR_NAVIGATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSidebarNavigationLocale =
  (typeof KLYX_SIDEBAR_NAVIGATION_TRANSLATED_LOCALES)[number];

export const KLYX_SIDEBAR_NAVIGATION_MESSAGE_KEYS = [
  "desktopNavigation",
  "mobileNavigation",
] as const;

export type KlyxSidebarNavigationMessageKey =
  (typeof KLYX_SIDEBAR_NAVIGATION_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSidebarNavigationMessageKey, string>;

const DICTIONARIES: Record<KlyxSidebarNavigationLocale, Dictionary> = {
  fr: {
    desktopNavigation: "Navigation principale KLYX",
    mobileNavigation: "Navigation mobile KLYX",
  },
  en: {
    desktopNavigation: "Main KLYX navigation",
    mobileNavigation: "Mobile KLYX navigation",
  },
  nl: {
    desktopNavigation: "Hoofdnavigatie van KLYX",
    mobileNavigation: "Mobiele KLYX-navigatie",
  },
  de: {
    desktopNavigation: "KLYX-Hauptnavigation",
    mobileNavigation: "Mobile KLYX-Navigation",
  },
};

export function resolveKlyxSidebarNavigationLocale(
  locale: KlyxLocale | string
): KlyxSidebarNavigationLocale {
  return KLYX_SIDEBAR_NAVIGATION_TRANSLATED_LOCALES.includes(
    locale as KlyxSidebarNavigationLocale
  )
    ? (locale as KlyxSidebarNavigationLocale)
    : "fr";
}

export function getKlyxSidebarNavigationDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxSidebarNavigationLocale(locale)];
}

export function translateKlyxSidebarNavigation(
  locale: KlyxLocale | string,
  key: KlyxSidebarNavigationMessageKey
): string {
  return getKlyxSidebarNavigationDictionary(locale)[key];
}
