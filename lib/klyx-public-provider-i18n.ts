import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PUBLIC_PROVIDER_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxPublicProviderLocale =
  (typeof KLYX_PUBLIC_PROVIDER_TRANSLATED_LOCALES)[number];

export const KLYX_PUBLIC_PROVIDER_MESSAGE_KEYS = [
  "loading",
  "loadError",
  "notFoundTitle",
  "notFoundText",
  "backToSearch",
  "providerEyebrow",
  "identityVerified",
  "headlineFallback",
  "score",
  "galleryTitle",
  "galleryAlt",
  "servicesTitle",
  "noServices",
  "cityMissing",
  "cancellationRate",
  "quote",
  "book",
] as const;

export type KlyxPublicProviderMessageKey =
  (typeof KLYX_PUBLIC_PROVIDER_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxPublicProviderMessageKey, string>;

const DICTIONARIES: Record<KlyxPublicProviderLocale, Dictionary> = {
  fr: {
    loading: "Chargement du profil...",
    loadError: "Impossible de charger ce prestataire.",
    notFoundTitle: "Prestataire introuvable",
    notFoundText: "Cette fiche n’est pas encore publiée.",
    backToSearch: "Retour à la recherche",
    providerEyebrow: "Prestataire KLYX",
    identityVerified: "Identité vérifiée",
    headlineFallback: "Prestataire de services du quotidien",
    score: "KLYX Score",
    galleryTitle: "Réalisations et environnement",
    galleryAlt: "Réalisation du prestataire",
    servicesTitle: "Services proposés",
    noServices: "Aucun service disponible pour le moment.",
    cityMissing: "Ville non renseignée",
    cancellationRate: "Taux d’annulation",
    quote: "Demander un devis",
    book: "Réserver directement",
  },
  en: {
    loading: "Loading profile...",
    loadError: "Unable to load this provider.",
    notFoundTitle: "Provider not found",
    notFoundText: "This profile has not been published yet.",
    backToSearch: "Back to search",
    providerEyebrow: "KLYX provider",
    identityVerified: "Identity verified",
    headlineFallback: "Everyday services provider",
    score: "KLYX Score",
    galleryTitle: "Work and environment",
    galleryAlt: "Provider work",
    servicesTitle: "Services offered",
    noServices: "No service is available right now.",
    cityMissing: "City not provided",
    cancellationRate: "Cancellation rate",
    quote: "Request a quote",
    book: "Book directly",
  },
  nl: {
    loading: "Profiel laden...",
    loadError: "Deze dienstverlener kan niet worden geladen.",
    notFoundTitle: "Dienstverlener niet gevonden",
    notFoundText: "Dit profiel is nog niet gepubliceerd.",
    backToSearch: "Terug naar zoeken",
    providerEyebrow: "KLYX-dienstverlener",
    identityVerified: "Identiteit geverifieerd",
    headlineFallback: "Dienstverlener voor dagelijkse diensten",
    score: "KLYX Score",
    galleryTitle: "Realisaties en werkomgeving",
    galleryAlt: "Realisatie van de dienstverlener",
    servicesTitle: "Aangeboden diensten",
    noServices: "Er is momenteel geen dienst beschikbaar.",
    cityMissing: "Stad niet opgegeven",
    cancellationRate: "Annuleringspercentage",
    quote: "Offerte aanvragen",
    book: "Direct boeken",
  },
  de: {
    loading: "Profil wird geladen...",
    loadError: "Dieser Anbieter konnte nicht geladen werden.",
    notFoundTitle: "Anbieter nicht gefunden",
    notFoundText: "Dieses Profil wurde noch nicht veröffentlicht.",
    backToSearch: "Zurück zur Suche",
    providerEyebrow: "KLYX-Anbieter",
    identityVerified: "Identität verifiziert",
    headlineFallback: "Anbieter für Dienstleistungen des Alltags",
    score: "KLYX Score",
    galleryTitle: "Arbeiten und Umfeld",
    galleryAlt: "Arbeit des Anbieters",
    servicesTitle: "Angebotene Dienstleistungen",
    noServices: "Derzeit ist keine Dienstleistung verfügbar.",
    cityMissing: "Stadt nicht angegeben",
    cancellationRate: "Stornierungsquote",
    quote: "Angebot anfragen",
    book: "Direkt buchen",
  },
};

export function resolveKlyxPublicProviderLocale(
  locale: KlyxLocale | string
): KlyxPublicProviderLocale {
  return KLYX_PUBLIC_PROVIDER_TRANSLATED_LOCALES.includes(
    locale as KlyxPublicProviderLocale
  )
    ? (locale as KlyxPublicProviderLocale)
    : "fr";
}

export function getKlyxPublicProviderDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxPublicProviderLocale(locale)];
}

export function translateKlyxPublicProvider(
  locale: KlyxLocale | string,
  key: KlyxPublicProviderMessageKey
): string {
  return getKlyxPublicProviderDictionary(locale)[key];
}

const SERVICE_LABELS: Record<KlyxPublicProviderLocale, Record<string, string>> = {
  fr: {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  },
  en: {
    babysitting: "Babysitting",
    cleaning: "Cleaning",
    moving: "Moving",
    handyman: "Handyman",
  },
  nl: {
    babysitting: "Babysitten",
    cleaning: "Schoonmaak",
    moving: "Verhuizen",
    handyman: "Klusjes",
  },
  de: {
    babysitting: "Babysitting",
    cleaning: "Reinigung",
    moving: "Umzug",
    handyman: "Handwerker",
  },
};

export function formatKlyxPublicProviderServiceLabel(
  locale: KlyxLocale | string,
  slug: string,
  fallback: string
): string {
  return SERVICE_LABELS[resolveKlyxPublicProviderLocale(locale)][slug] ?? fallback;
}

export function formatKlyxPublicProviderScoreLabel(
  locale: KlyxLocale | string,
  score: number
): string {
  const resolved = resolveKlyxPublicProviderLocale(locale);
  const labels = {
    fr: ["Nouveau profil", "Correct", "Fiable", "Très fiable", "Excellent"],
    en: ["New profile", "Good", "Reliable", "Very reliable", "Excellent"],
    nl: ["Nieuw profiel", "Goed", "Betrouwbaar", "Zeer betrouwbaar", "Uitstekend"],
    de: ["Neues Profil", "Gut", "Zuverlässig", "Sehr zuverlässig", "Ausgezeichnet"],
  } as const;

  if (score >= 90) return labels[resolved][4];
  if (score >= 80) return labels[resolved][3];
  if (score >= 70) return labels[resolved][2];
  if (score >= 60) return labels[resolved][1];
  return labels[resolved][0];
}

export function formatKlyxPublicProviderExperience(
  locale: KlyxLocale | string,
  years: number
): string {
  const resolved = resolveKlyxPublicProviderLocale(locale);
  if (resolved === "en") return `${years} year${years === 1 ? "" : "s"} of experience`;
  if (resolved === "nl") return `${years} jaar ervaring`;
  if (resolved === "de") return `${years} Jahr${years === 1 ? "" : "e"} Erfahrung`;
  return `${years} an${years > 1 ? "s" : ""} d’expérience`;
}

export function formatKlyxPublicProviderAvailability(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxPublicProviderLocale(locale);
  if (resolved === "en") return `${count} available day${count === 1 ? "" : "s"}`;
  if (resolved === "nl") return `${count} beschikbare dag${count === 1 ? "" : "en"}`;
  if (resolved === "de") return `${count} verfügbare${count === 1 ? "r Tag" : " Tage"}`;
  return `${count} jour${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`;
}

export function formatKlyxPublicProviderCompletedJobs(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxPublicProviderLocale(locale);
  if (resolved === "en") return `${count} completed job${count === 1 ? "" : "s"}`;
  if (resolved === "nl") return `${count} voltooide opdracht${count === 1 ? "" : "en"}`;
  if (resolved === "de") return `${count} abgeschlossene${count === 1 ? "r Auftrag" : " Aufträge"}`;
  return `${count} prestation${count > 1 ? "s" : ""} terminée${count > 1 ? "s" : ""}`;
}

export function formatKlyxPublicProviderPrice(
  locale: KlyxLocale | string,
  price: number | null,
  pricingType: "hourly" | "fixed"
): string {
  const resolved = resolveKlyxPublicProviderLocale(locale);
  if (price === null) {
    return {
      fr: "Prix à confirmer",
      en: "Price to be confirmed",
      nl: "Prijs te bevestigen",
      de: "Preis noch zu bestätigen",
    }[resolved];
  }

  if (pricingType === "fixed") {
    return `${price.toFixed(2)} € ${
      { fr: "forfait", en: "fixed", nl: "vast", de: "pauschal" }[resolved]
    }`;
  }

  return `${price.toFixed(2)} €/h`;
}
