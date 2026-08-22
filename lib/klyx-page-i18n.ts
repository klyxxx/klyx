import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxPublicPageLocale =
  (typeof KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES)[number];

export type KlyxPublicEntryMessageKey =
  | "sessionLoading"
  | "openKlyx"
  | "myProfiles"
  | "login"
  | "start"
  | "client"
  | "clientNeedService"
  | "provider"
  | "providerOfferServices"
  | "alreadyAccount"
  | "signIn";

const PUBLIC_ENTRY_MESSAGES: Record<
  KlyxPublicPageLocale,
  Record<KlyxPublicEntryMessageKey, string>
> = {
  fr: {
    sessionLoading: "Session...",
    openKlyx: "Ouvrir KLYX",
    myProfiles: "Mes profils",
    login: "Connexion",
    start: "Commencer",
    client: "Client",
    clientNeedService: "J’ai besoin d’un service",
    provider: "Prestataire",
    providerOfferServices: "Je veux proposer mes services",
    alreadyAccount: "Tu as déjà un compte ?",
    signIn: "Se connecter",
  },
  en: {
    sessionLoading: "Session...",
    openKlyx: "Open KLYX",
    myProfiles: "My profiles",
    login: "Sign in",
    start: "Get started",
    client: "Client",
    clientNeedService: "I need a service",
    provider: "Provider",
    providerOfferServices: "I want to offer my services",
    alreadyAccount: "Already have an account?",
    signIn: "Sign in",
  },
  nl: {
    sessionLoading: "Sessie...",
    openKlyx: "KLYX openen",
    myProfiles: "Mijn profielen",
    login: "Aanmelden",
    start: "Beginnen",
    client: "Klant",
    clientNeedService: "Ik heb een dienst nodig",
    provider: "Dienstverlener",
    providerOfferServices: "Ik wil mijn diensten aanbieden",
    alreadyAccount: "Heb je al een account?",
    signIn: "Aanmelden",
  },
  de: {
    sessionLoading: "Sitzung...",
    openKlyx: "KLYX öffnen",
    myProfiles: "Meine Profile",
    login: "Anmelden",
    start: "Loslegen",
    client: "Kunde",
    clientNeedService: "Ich brauche eine Dienstleistung",
    provider: "Anbieter",
    providerOfferServices: "Ich möchte meine Dienste anbieten",
    alreadyAccount: "Du hast bereits ein Konto?",
    signIn: "Anmelden",
  },
};

export function resolveKlyxPublicPageLocale(
  locale: KlyxLocale
): KlyxPublicPageLocale {
  return (KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxPublicPageLocale)
    : "fr";
}

export function hasKlyxPublicPageTranslation(locale: KlyxLocale) {
  return (KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale);
}

export function translateKlyxPublicEntry(
  locale: KlyxLocale,
  key: KlyxPublicEntryMessageKey
) {
  return PUBLIC_ENTRY_MESSAGES[resolveKlyxPublicPageLocale(locale)][key];
}

export function getKlyxPublicEntryDictionary(locale: KlyxLocale) {
  return PUBLIC_ENTRY_MESSAGES[resolveKlyxPublicPageLocale(locale)];
}
