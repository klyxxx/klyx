import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_HOME_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderHomeLocale = (typeof KLYX_FOUNDER_HOME_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_HOME_MESSAGE_KEYS = [
  "loadError", "accessDenied", "badge", "title", "description", "active",
  "clientTitle", "clientDescription", "enterClient", "createClient",
  "providerTitle", "providerDescription", "enterProvider", "createProvider",
  "adminTitle", "adminDescription", "openAdmin", "analytics",
  "sumsubTitle", "sumsubDescription",
] as const;
export type KlyxFounderHomeMessageKey = (typeof KLYX_FOUNDER_HOME_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderHomeMessageKey, string>;

const MESSAGES: Record<KlyxFounderHomeLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger la console Founder pour le moment.",
    accessDenied: "Accès Founder refusé",
    badge: "Accès Founder",
    title: "Console Founder KLYX",
    description: "Une seule connexion pour tester KLYX comme client, prestataire et administrateur.",
    active: "ACTIF",
    clientTitle: "Mode Client",
    clientDescription: "Recherche, devis, réservation, paiement, messages et suivi.",
    enterClient: "Entrer comme client",
    createClient: "Créer un profil client",
    providerTitle: "Mode Prestataire",
    providerDescription: "Prestations, devis, planning, zones, vérifications et paiements.",
    enterProvider: "Entrer comme prestataire",
    createProvider: "Créer un profil prestataire",
    adminTitle: "Super Admin",
    adminDescription: "Centre Admin, vérifications, compétences, litiges, finance et contrôle du lancement.",
    openAdmin: "Ouvrir Admin",
    analytics: "Analytics produit",
    sumsubTitle: "Sumsub : mode attente",
    sumsubDescription: "Le compte Founder peut tester KLYX, mais aucune identité non vérifiée n’est présentée publiquement comme vérifiée.",
  },
  en: {
    loadError: "The Founder console is currently unavailable.", accessDenied: "Founder access denied", badge: "Founder access", title: "KLYX Founder Console", description: "One sign-in to test KLYX as a client, provider, and administrator.", active: "ACTIVE",
    clientTitle: "Client mode", clientDescription: "Search, quotes, booking, payment, messages, and tracking.", enterClient: "Enter as client", createClient: "Create client profile",
    providerTitle: "Provider mode", providerDescription: "Services, quotes, schedule, areas, verifications, and payments.", enterProvider: "Enter as provider", createProvider: "Create provider profile",
    adminTitle: "Super Admin", adminDescription: "Admin Center, verifications, skills, disputes, finance, and launch controls.", openAdmin: "Open Admin", analytics: "Product analytics",
    sumsubTitle: "Sumsub: waiting mode", sumsubDescription: "The Founder account can test KLYX, but no unverified identity is publicly presented as verified.",
  },
  nl: {
    loadError: "De Founder-console is momenteel niet beschikbaar.", accessDenied: "Founder-toegang geweigerd", badge: "Founder-toegang", title: "KLYX Founder-console", description: "Eén aanmelding om KLYX te testen als klant, dienstverlener en beheerder.", active: "ACTIEF",
    clientTitle: "Klantmodus", clientDescription: "Zoeken, offertes, boekingen, betalingen, berichten en opvolging.", enterClient: "Doorgaan als klant", createClient: "Klantprofiel maken",
    providerTitle: "Dienstverlenersmodus", providerDescription: "Diensten, offertes, planning, zones, verificaties en betalingen.", enterProvider: "Doorgaan als dienstverlener", createProvider: "Dienstverlenersprofiel maken",
    adminTitle: "Super Admin", adminDescription: "Beheercentrum, verificaties, vaardigheden, geschillen, financiën en lanceringscontrole.", openAdmin: "Admin openen", analytics: "Productanalyse",
    sumsubTitle: "Sumsub: wachtmodus", sumsubDescription: "Het Founder-account kan KLYX testen, maar geen niet-geverifieerde identiteit wordt publiek als geverifieerd weergegeven.",
  },
  de: {
    loadError: "Die Founder-Konsole ist derzeit nicht verfügbar.", accessDenied: "Founder-Zugriff verweigert", badge: "Founder-Zugriff", title: "KLYX Founder-Konsole", description: "Eine Anmeldung, um KLYX als Kunde, Anbieter und Administrator zu testen.", active: "AKTIV",
    clientTitle: "Kundenmodus", clientDescription: "Suche, Angebote, Buchung, Zahlung, Nachrichten und Nachverfolgung.", enterClient: "Als Kunde öffnen", createClient: "Kundenprofil erstellen",
    providerTitle: "Anbietermodus", providerDescription: "Leistungen, Angebote, Planung, Gebiete, Verifizierungen und Zahlungen.", enterProvider: "Als Anbieter öffnen", createProvider: "Anbieterprofil erstellen",
    adminTitle: "Super Admin", adminDescription: "Admin-Center, Verifizierungen, Kompetenzen, Streitfälle, Finanzen und Launch-Kontrolle.", openAdmin: "Admin öffnen", analytics: "Produktanalyse",
    sumsubTitle: "Sumsub: Wartemodus", sumsubDescription: "Das Founder-Konto kann KLYX testen, aber keine unverifizierte Identität wird öffentlich als verifiziert dargestellt.",
  },
};

const LOCALE_SET = new Set<string>(KLYX_FOUNDER_HOME_TRANSLATED_LOCALES);
export function resolveKlyxFounderHomeLocale(locale: KlyxLocale): KlyxFounderHomeLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderHomeLocale) : "fr";
}
export function getKlyxFounderHomeDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderHomeLocale(locale)];
}
export function translateKlyxFounderHome(locale: KlyxLocale, key: KlyxFounderHomeMessageKey) {
  return getKlyxFounderHomeDictionary(locale)[key];
}
