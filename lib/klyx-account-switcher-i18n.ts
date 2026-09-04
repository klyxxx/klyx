import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_ACCOUNT_SWITCHER_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAccountSwitcherLocale =
  (typeof KLYX_ACCOUNT_SWITCHER_TRANSLATED_LOCALES)[number];

export const KLYX_ACCOUNT_SWITCHER_MESSAGE_KEYS = [
  "profileFallback",
  "providerRole",
  "clientRole",
  "loadError",
  "missingProfileError",
  "switchError",
  "menuAria",
  "menuTitle",
  "manageProfiles",
] as const;

export type KlyxAccountSwitcherMessageKey =
  (typeof KLYX_ACCOUNT_SWITCHER_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAccountSwitcherMessageKey, string>;

const DICTIONARIES: Record<KlyxAccountSwitcherLocale, Dictionary> = {
  fr: {
    profileFallback: "Mon profil",
    providerRole: "Prestataire",
    clientRole: "Client",
    loadError: "Impossible de charger les profils.",
    missingProfileError: "Profil KLYX introuvable.",
    switchError: "Impossible de changer de profil.",
    menuAria: "Changer de profil KLYX",
    menuTitle: "Profils KLYX",
    manageProfiles: "Gérer les profils",
  },
  en: {
    profileFallback: "My profile",
    providerRole: "Provider",
    clientRole: "Client",
    loadError: "Unable to load profiles.",
    missingProfileError: "KLYX profile not found.",
    switchError: "Unable to switch profile.",
    menuAria: "Switch KLYX profile",
    menuTitle: "KLYX profiles",
    manageProfiles: "Manage profiles",
  },
  nl: {
    profileFallback: "Mijn profiel",
    providerRole: "Dienstverlener",
    clientRole: "Klant",
    loadError: "Profielen konden niet worden geladen.",
    missingProfileError: "KLYX-profiel niet gevonden.",
    switchError: "Wisselen van profiel is niet gelukt.",
    menuAria: "Van KLYX-profiel wisselen",
    menuTitle: "KLYX-profielen",
    manageProfiles: "Profielen beheren",
  },
  de: {
    profileFallback: "Mein Profil",
    providerRole: "Dienstleister",
    clientRole: "Kunde",
    loadError: "Profile konnten nicht geladen werden.",
    missingProfileError: "KLYX-Profil nicht gefunden.",
    switchError: "Profil konnte nicht gewechselt werden.",
    menuAria: "KLYX-Profil wechseln",
    menuTitle: "KLYX-Profile",
    manageProfiles: "Profile verwalten",
  },
};

export function resolveKlyxAccountSwitcherLocale(
  locale: KlyxLocale | string
): KlyxAccountSwitcherLocale {
  return KLYX_ACCOUNT_SWITCHER_TRANSLATED_LOCALES.includes(
    locale as KlyxAccountSwitcherLocale
  )
    ? (locale as KlyxAccountSwitcherLocale)
    : "fr";
}

export function getKlyxAccountSwitcherDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxAccountSwitcherLocale(locale)];
}

export function translateKlyxAccountSwitcher(
  locale: KlyxLocale | string,
  key: KlyxAccountSwitcherMessageKey
): string {
  return getKlyxAccountSwitcherDictionary(locale)[key];
}
