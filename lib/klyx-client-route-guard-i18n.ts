import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_CLIENT_ROUTE_GUARD_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxClientRouteGuardLocale =
  (typeof KLYX_CLIENT_ROUTE_GUARD_TRANSLATED_LOCALES)[number];

export const KLYX_CLIENT_ROUTE_GUARD_MESSAGE_KEYS = [
  "profileCheckError",
  "verificationErrorTitle",
  "retry",
  "redirecting",
  "checking",
] as const;

export type KlyxClientRouteGuardMessageKey =
  (typeof KLYX_CLIENT_ROUTE_GUARD_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxClientRouteGuardMessageKey, string>;

const DICTIONARIES: Record<KlyxClientRouteGuardLocale, Dictionary> = {
  fr: {
    profileCheckError: "Impossible de vérifier le profil KLYX.",
    verificationErrorTitle: "Vérification impossible",
    retry: "Réessayer",
    redirecting: "Redirection vers votre espace KLYX...",
    checking: "Vérification du profil actif...",
  },
  en: {
    profileCheckError: "Unable to verify the KLYX profile.",
    verificationErrorTitle: "Unable to verify",
    retry: "Try again",
    redirecting: "Redirecting to your KLYX space...",
    checking: "Checking the active profile...",
  },
  nl: {
    profileCheckError: "Kan het KLYX-profiel niet verifiëren.",
    verificationErrorTitle: "Verificatie niet mogelijk",
    retry: "Opnieuw proberen",
    redirecting: "Doorsturen naar je KLYX-omgeving...",
    checking: "Actief profiel controleren...",
  },
  de: {
    profileCheckError: "KLYX-Profil konnte nicht überprüft werden.",
    verificationErrorTitle: "Überprüfung nicht möglich",
    retry: "Erneut versuchen",
    redirecting: "Weiterleitung zu deinem KLYX-Bereich...",
    checking: "Aktives Profil wird überprüft...",
  },
};

export function resolveKlyxClientRouteGuardLocale(
  locale: KlyxLocale | string
): KlyxClientRouteGuardLocale {
  return KLYX_CLIENT_ROUTE_GUARD_TRANSLATED_LOCALES.includes(
    locale as KlyxClientRouteGuardLocale
  )
    ? (locale as KlyxClientRouteGuardLocale)
    : "fr";
}

export function getKlyxClientRouteGuardDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxClientRouteGuardLocale(locale)];
}

export function translateKlyxClientRouteGuard(
  locale: KlyxLocale | string,
  key: KlyxClientRouteGuardMessageKey
): string {
  return getKlyxClientRouteGuardDictionary(locale)[key];
}
