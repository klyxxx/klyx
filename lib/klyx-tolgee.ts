import {
  KLYX_FULLY_TRANSLATED_LOCALES,
  KLYX_LOCALES,
  type KlyxLocale,
} from "./klyx-i18n";

export const KLYX_TOLGEE_CLI_VERSION = "2.20.0" as const;
export const KLYX_TOLGEE_TRANSLATIONS_DIRECTORY = "messages/tolgee" as const;

export const KLYX_TOLGEE_MANAGED_LOCALES = [
  ...KLYX_LOCALES,
] as readonly KlyxLocale[];

export const KLYX_TOLGEE_PUBLISHED_LOCALES = [
  ...KLYX_FULLY_TRANSLATED_LOCALES,
] as readonly KlyxLocale[];

const PUBLISHED_LOCALE_SET = new Set<string>(
  KLYX_TOLGEE_PUBLISHED_LOCALES
);

export const KLYX_TOLGEE_STAGED_LOCALES =
  KLYX_TOLGEE_MANAGED_LOCALES.filter(
    (locale) => !PUBLISHED_LOCALE_SET.has(locale)
  );

export function isKlyxTolgeePublishedLocale(locale: KlyxLocale) {
  return PUBLISHED_LOCALE_SET.has(locale);
}

export function isKlyxTolgeeStagedLocale(locale: KlyxLocale) {
  return !PUBLISHED_LOCALE_SET.has(locale);
}
