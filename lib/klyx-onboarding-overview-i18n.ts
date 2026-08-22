export const KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxOnboardingOverviewLocale =
  (typeof KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES)[number];

export type KlyxOnboardingOverviewMessageKey =
  | "firstSetup"
  | "welcome"
  | "welcomeKlyx"
  | "providerIntro"
  | "clientIntro"
  | "dashboard"
  | "providerPath"
  | "clientPath"
  | "nextAction"
  | "providerNextTitle"
  | "clientNextTitle"
  | "prepareActivity"
  | "opportunities"
  | "organizeNeed"
  | "searchMyself"
  | "start"
  | "providerStart"
  | "clientStart"
  | "providerOpportunitiesTitle"
  | "openOpportunities"
  | "providerAssistantTitle"
  | "openAssistant"
  | "clientProfileTitle"
  | "clientProfileDescription"
  | "clientProfileButton"
  | "clientNeedTitle"
  | "clientNeedDescription"
  | "clientNeedButton"
  | "clientCompareTitle"
  | "clientCompareDescription"
  | "clientCompareButton";

type Dictionary = Record<KlyxOnboardingOverviewMessageKey, string>;

const DICTIONARIES: Record<KlyxOnboardingOverviewLocale, Dictionary> = {
  fr: {
    firstSetup: "Première configuration",
    welcome: "Bienvenue {name}",
    welcomeKlyx: "Bienvenue sur KLYX",
    providerIntro: "Configure les éléments essentiels de ton activité.",
    clientIntro: "Dis à KLYX ce dont tu as besoin.",
    dashboard: "Voir mon tableau de bord",
    providerPath: "Parcours prestataire",
    clientPath: "Parcours client",
    nextAction: "Prochaine action",
    providerNextTitle: "Prépare ton activité avant de répondre aux missions.",
    clientNextTitle: "Organise ton premier besoin avec KLYX.",
    prepareActivity: "Préparer mon activité",
    opportunities: "Voir les opportunités",
    organizeNeed: "Organiser mon besoin",
    searchMyself: "Chercher moi-même",
    start: "Démarrage",
    providerStart: "Prépare ton activité",
    clientStart: "Commence en quelques étapes",
    providerOpportunitiesTitle: "Voir mes opportunités KLYX",
    openOpportunities: "Ouvrir les opportunités",
    providerAssistantTitle: "Utiliser l’Assistant Prestataire",
    openAssistant: "Ouvrir l’assistant",
    clientProfileTitle: "Complète ton profil",
    clientProfileDescription: "Profil et préférences.",
    clientProfileButton: "Compléter mon profil",
    clientNeedTitle: "Explique ton premier besoin",
    clientNeedDescription: "Décris ton besoin à KLYX.",
    clientNeedButton: "Parler à KLYX",
    clientCompareTitle: "Compare les prestataires",
    clientCompareDescription: "Compare les prestataires.",
    clientCompareButton: "Explorer les services",
  },
  en: {
    firstSetup: "First setup",
    welcome: "Welcome {name}",
    welcomeKlyx: "Welcome to KLYX",
    providerIntro: "Set up the essential parts of your business.",
    clientIntro: "Tell KLYX what you need.",
    dashboard: "View my dashboard",
    providerPath: "Provider journey",
    clientPath: "Client journey",
    nextAction: "Next action",
    providerNextTitle: "Prepare your business before responding to jobs.",
    clientNextTitle: "Organize your first need with KLYX.",
    prepareActivity: "Set up my business",
    opportunities: "View opportunities",
    organizeNeed: "Organize my need",
    searchMyself: "Search myself",
    start: "Getting started",
    providerStart: "Prepare your business",
    clientStart: "Get started in a few steps",
    providerOpportunitiesTitle: "View my KLYX opportunities",
    openOpportunities: "Open opportunities",
    providerAssistantTitle: "Use the Provider Assistant",
    openAssistant: "Open the assistant",
    clientProfileTitle: "Complete your profile",
    clientProfileDescription: "Profile and preferences.",
    clientProfileButton: "Complete my profile",
    clientNeedTitle: "Explain your first need",
    clientNeedDescription: "Describe your need to KLYX.",
    clientNeedButton: "Talk to KLYX",
    clientCompareTitle: "Compare providers",
    clientCompareDescription: "Compare providers.",
    clientCompareButton: "Explore services",
  },
  nl: {
    firstSetup: "Eerste configuratie",
    welcome: "Welkom {name}",
    welcomeKlyx: "Welkom bij KLYX",
    providerIntro: "Stel de essentiële onderdelen van je activiteit in.",
    clientIntro: "Vertel KLYX wat je nodig hebt.",
    dashboard: "Mijn dashboard bekijken",
    providerPath: "Traject voor dienstverleners",
    clientPath: "Klanttraject",
    nextAction: "Volgende actie",
    providerNextTitle: "Bereid je activiteit voor voordat je op opdrachten reageert.",
    clientNextTitle: "Organiseer je eerste behoefte met KLYX.",
    prepareActivity: "Mijn activiteit voorbereiden",
    opportunities: "Opportuniteiten bekijken",
    organizeNeed: "Mijn behoefte organiseren",
    searchMyself: "Zelf zoeken",
    start: "Aan de slag",
    providerStart: "Bereid je activiteit voor",
    clientStart: "Start in enkele stappen",
    providerOpportunitiesTitle: "Mijn KLYX-opportuniteiten bekijken",
    openOpportunities: "Opportuniteiten openen",
    providerAssistantTitle: "De Assistent voor dienstverleners gebruiken",
    openAssistant: "Assistent openen",
    clientProfileTitle: "Vul je profiel aan",
    clientProfileDescription: "Profiel en voorkeuren.",
    clientProfileButton: "Mijn profiel aanvullen",
    clientNeedTitle: "Leg je eerste behoefte uit",
    clientNeedDescription: "Beschrijf je behoefte aan KLYX.",
    clientNeedButton: "Met KLYX praten",
    clientCompareTitle: "Vergelijk dienstverleners",
    clientCompareDescription: "Vergelijk dienstverleners.",
    clientCompareButton: "Diensten verkennen",
  },
  de: {
    firstSetup: "Erste Einrichtung",
    welcome: "Willkommen {name}",
    welcomeKlyx: "Willkommen bei KLYX",
    providerIntro: "Richte die wichtigsten Grundlagen deiner Tätigkeit ein.",
    clientIntro: "Sag KLYX, was du brauchst.",
    dashboard: "Mein Dashboard ansehen",
    providerPath: "Anbieter-Pfad",
    clientPath: "Kunden-Pfad",
    nextAction: "Nächste Aktion",
    providerNextTitle: "Bereite deine Tätigkeit vor, bevor du auf Aufträge reagierst.",
    clientNextTitle: "Organisiere deinen ersten Bedarf mit KLYX.",
    prepareActivity: "Meine Tätigkeit vorbereiten",
    opportunities: "Aufträge ansehen",
    organizeNeed: "Meinen Bedarf organisieren",
    searchMyself: "Selbst suchen",
    start: "Erste Schritte",
    providerStart: "Bereite deine Tätigkeit vor",
    clientStart: "Starte in wenigen Schritten",
    providerOpportunitiesTitle: "Meine KLYX-Aufträge ansehen",
    openOpportunities: "Aufträge öffnen",
    providerAssistantTitle: "Anbieter-Assistent verwenden",
    openAssistant: "Assistent öffnen",
    clientProfileTitle: "Vervollständige dein Profil",
    clientProfileDescription: "Profil und Präferenzen.",
    clientProfileButton: "Mein Profil vervollständigen",
    clientNeedTitle: "Beschreibe deinen ersten Bedarf",
    clientNeedDescription: "Beschreibe KLYX, was du brauchst.",
    clientNeedButton: "Mit KLYX sprechen",
    clientCompareTitle: "Anbieter vergleichen",
    clientCompareDescription: "Vergleiche Anbieter.",
    clientCompareButton: "Dienstleistungen entdecken",
  },
};

export function hasKlyxOnboardingOverviewTranslation(locale: string) {
  return KLYX_ONBOARDING_OVERVIEW_TRANSLATED_LOCALES.includes(
    locale as KlyxOnboardingOverviewLocale
  );
}

export function resolveKlyxOnboardingOverviewLocale(
  locale: string
): KlyxOnboardingOverviewLocale {
  return hasKlyxOnboardingOverviewTranslation(locale)
    ? (locale as KlyxOnboardingOverviewLocale)
    : "fr";
}

export function getKlyxOnboardingOverviewDictionary(locale: string) {
  return DICTIONARIES[resolveKlyxOnboardingOverviewLocale(locale)];
}

export function translateKlyxOnboardingOverview(
  locale: string,
  key: KlyxOnboardingOverviewMessageKey
) {
  return getKlyxOnboardingOverviewDictionary(locale)[key];
}

export function formatKlyxOnboardingWelcome(locale: string, name: string) {
  return translateKlyxOnboardingOverview(locale, "welcome").replace(
    "{name}",
    name
  );
}
