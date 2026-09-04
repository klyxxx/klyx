import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderDashboardLocale =
  (typeof KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_DASHBOARD_MESSAGE_KEYS = [
  "spaceLabel",
  "title",
  "subtitle",
  "secondaryAria",
  "manageMore",
  "servicesPricing",
  "proposeNewTrade",
  "planning",
  "quotes",
  "serviceAreas",
  "capabilities",
  "trust",
  "verification",
  "providerAssistant",
  "settings",
] as const;

export type KlyxProviderDashboardMessageKey =
  (typeof KLYX_PROVIDER_DASHBOARD_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderDashboardMessageKey, string>;

const DICTIONARIES: Record<KlyxProviderDashboardLocale, Dictionary> = {
  fr: {
    spaceLabel: "Espace prestataire",
    title: "Votre activité",
    subtitle: "KLYX vous montre ce qui demande votre attention maintenant.",
    secondaryAria: "Gestion secondaire",
    manageMore: "Gérer autre chose",
    servicesPricing: "Services & tarifs",
    proposeNewTrade: "Proposer un nouveau métier",
    planning: "Planning",
    quotes: "Devis",
    serviceAreas: "Zones d’intervention",
    capabilities: "Capacités",
    trust: "Confiance",
    verification: "Vérification",
    providerAssistant: "Assistant prestataire",
    settings: "Paramètres",
  },
  en: {
    spaceLabel: "Provider space",
    title: "Your activity",
    subtitle: "KLYX shows you what needs your attention right now.",
    secondaryAria: "Secondary management",
    manageMore: "Manage something else",
    servicesPricing: "Services & pricing",
    proposeNewTrade: "Suggest a new profession",
    planning: "Schedule",
    quotes: "Quotes",
    serviceAreas: "Service areas",
    capabilities: "Capabilities",
    trust: "Trust",
    verification: "Verification",
    providerAssistant: "Provider assistant",
    settings: "Settings",
  },
  nl: {
    spaceLabel: "Dienstverlenersruimte",
    title: "Je activiteit",
    subtitle: "KLYX toont wat nu je aandacht nodig heeft.",
    secondaryAria: "Secundair beheer",
    manageMore: "Iets anders beheren",
    servicesPricing: "Diensten & tarieven",
    proposeNewTrade: "Een nieuw beroep voorstellen",
    planning: "Planning",
    quotes: "Offertes",
    serviceAreas: "Werkgebieden",
    capabilities: "Vaardigheden",
    trust: "Vertrouwen",
    verification: "Verificatie",
    providerAssistant: "Dienstverlenersassistent",
    settings: "Instellingen",
  },
  de: {
    spaceLabel: "Anbieterbereich",
    title: "Deine Aktivität",
    subtitle: "KLYX zeigt dir, was jetzt deine Aufmerksamkeit braucht.",
    secondaryAria: "Sekundäre Verwaltung",
    manageMore: "Etwas anderes verwalten",
    servicesPricing: "Services & Preise",
    proposeNewTrade: "Neuen Beruf vorschlagen",
    planning: "Planung",
    quotes: "Angebote",
    serviceAreas: "Einsatzgebiete",
    capabilities: "Fähigkeiten",
    trust: "Vertrauen",
    verification: "Verifizierung",
    providerAssistant: "Anbieter-Assistent",
    settings: "Einstellungen",
  },
};

export function resolveKlyxProviderDashboardLocale(
  locale: KlyxLocale | string
): KlyxProviderDashboardLocale {
  return KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES.includes(
    locale as KlyxProviderDashboardLocale
  )
    ? (locale as KlyxProviderDashboardLocale)
    : "fr";
}

export function getKlyxProviderDashboardDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxProviderDashboardLocale(locale)];
}

export function translateKlyxProviderDashboard(
  locale: KlyxLocale | string,
  key: KlyxProviderDashboardMessageKey
): string {
  return getKlyxProviderDashboardDictionary(locale)[key];
}
