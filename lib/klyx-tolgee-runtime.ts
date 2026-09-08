import deCatalog from "@/messages/tolgee/de.json";
import enCatalog from "@/messages/tolgee/en.json";
import frCatalog from "@/messages/tolgee/fr.json";
import nlCatalog from "@/messages/tolgee/nl.json";

import {
  translateKlyxUi,
  type KlyxLocale,
  type KlyxSelectableLocale,
  type KlyxUiMessageKey,
} from "./klyx-i18n";
import { isKlyxTolgeePublishedLocale } from "./klyx-tolgee";

type KlyxTolgeeStaticCatalog = Readonly<Record<string, string>>;

// Keep runtime consumption stricter than management: a staged locale can have a
// Tolgee snapshot without becoming reachable from the published KLYX shell.
export const KLYX_TOLGEE_RUNTIME_CATALOGS = {
  fr: frCatalog,
  en: enCatalog,
  nl: nlCatalog,
  de: deCatalog,
} satisfies Record<KlyxSelectableLocale, KlyxTolgeeStaticCatalog>;

export function getKlyxTolgeeRuntimeUiTranslation(
  locale: KlyxLocale,
  key: KlyxUiMessageKey
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
  key: KlyxUiMessageKey
) {
  return (
    getKlyxTolgeeRuntimeUiTranslation(locale, key) ??
    translateKlyxUi(locale, key)
  );
}
