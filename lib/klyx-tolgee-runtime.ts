import deCatalog from "@/messages/tolgee/de.json";
import enCatalog from "@/messages/tolgee/en.json";
import frCatalog from "@/messages/tolgee/fr.json";
import nlCatalog from "@/messages/tolgee/nl.json";

import {
  translateKlyxNavigationLabel,
  translateKlyxUi,
  type KlyxLocale,
  type KlyxSelectableLocale,
  type KlyxUiMessageKey,
} from "./klyx-i18n";
import { isKlyxTolgeePublishedLocale } from "./klyx-tolgee";

type KlyxTolgeeStaticCatalog = Readonly<Record<string, string>>;

export const KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS = [
  "sidebar.desktopNavigation",
  "sidebar.mobileNavigation",
] as const;

export type KlyxTolgeeOnlyUiMessageKey =
  (typeof KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS)[number];

export type KlyxTolgeeUiMessageKey =
  | KlyxUiMessageKey
  | KlyxTolgeeOnlyUiMessageKey;

function isKlyxTolgeeOnlyUiMessageKey(
  key: KlyxTolgeeUiMessageKey
): key is KlyxTolgeeOnlyUiMessageKey {
  return KLYX_TOLGEE_ONLY_UI_MESSAGE_KEYS.includes(
    key as KlyxTolgeeOnlyUiMessageKey
  );
}

// Keep runtime consumption stricter than management: a staged locale can have a
// Tolgee snapshot without becoming reachable from the published KLYX shell.
export const KLYX_TOLGEE_RUNTIME_CATALOGS: Record<
  KlyxSelectableLocale,
  KlyxTolgeeStaticCatalog
> = {
  fr: frCatalog,
  en: enCatalog,
  nl: nlCatalog,
  de: deCatalog,
};

export function getKlyxTolgeeRuntimeNavigationTranslation(
  locale: KlyxLocale,
  frenchLabel: string
) {
  if (!isKlyxTolgeePublishedLocale(locale)) {
    return null;
  }

  const catalog =
    KLYX_TOLGEE_RUNTIME_CATALOGS[locale as KlyxSelectableLocale];
  const value = catalog[`navigation.${frenchLabel}`];

  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

export function translateKlyxTolgeeRuntimeNavigation(
  locale: KlyxLocale,
  frenchLabel: string
) {
  return (
    getKlyxTolgeeRuntimeNavigationTranslation(locale, frenchLabel) ??
    translateKlyxNavigationLabel(locale, frenchLabel)
  );
}

export function getKlyxTolgeeRuntimeUiTranslation(
  locale: KlyxLocale,
  key: KlyxTolgeeUiMessageKey
) {
  if (!isKlyxTolgeePublishedLocale(locale)) {
    return null;
  }

  const catalog =
    KLYX_TOLGEE_RUNTIME_CATALOGS[locale as KlyxSelectableLocale];
  const value = catalog[`ui.${key}`];

  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

export function translateKlyxTolgeeRuntimeUi(
  locale: KlyxLocale,
  key: KlyxTolgeeUiMessageKey
) {
  const translated = getKlyxTolgeeRuntimeUiTranslation(locale, key);
  if (translated) return translated;

  if (isKlyxTolgeeOnlyUiMessageKey(key)) {
    const fallback = frCatalog[`ui.${key}`];
    if (typeof fallback === "string" && fallback.trim().length > 0) {
      return fallback;
    }

    throw new Error(`Missing required Tolgee UI fallback: ui.${key}`);
  }

  return translateKlyxUi(locale, key);
}
