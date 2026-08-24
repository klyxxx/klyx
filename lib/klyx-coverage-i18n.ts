import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_COVERAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxCoverageLocale = (typeof KLYX_COVERAGE_TRANSLATED_LOCALES)[number];

export const KLYX_COVERAGE_MESSAGE_KEYS = [
  "eyebrow",
  "title",
  "description",
  "serviceLabel",
  "localityLabel",
  "localityPlaceholder",
  "calculate",
  "calculating",
  "resultsEyebrow",
  "noCoverageTitle",
  "noCoverageDescription",
  "openGeneralSearch",
  "primaryZone",
  "distance",
  "radius",
  "margin",
  "viewInSearch",
  "loadError",
  "searchError",
] as const;

export type KlyxCoverageMessageKey = (typeof KLYX_COVERAGE_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxCoverageMessageKey, string>;

const MESSAGES: Record<KlyxCoverageLocale, Dictionary> = {
  fr: {
    eyebrow: "Distance entre communes",
    title: "Trouve les prestataires réellement dans leur rayon",
    description: "KLYX compare ta commune avec les zones professionnelles déclarées et vérifie automatiquement le rayon maximal.",
    serviceLabel: "Service recherché",
    localityLabel: "Ma commune",
    localityPlaceholder: "Choisir une commune",
    calculate: "Calculer la couverture",
    calculating: "Calcul en cours...",
    resultsEyebrow: "Couverture calculée",
    noCoverageTitle: "Aucun rayon compatible",
    noCoverageDescription: "Les zones déclarées pour ce service ne couvrent pas cette commune actuellement.",
    openGeneralSearch: "Ouvrir la recherche générale",
    primaryZone: "Zone principale",
    distance: "Distance",
    radius: "Rayon",
    margin: "Marge",
    viewInSearch: "Voir dans la recherche",
    loadError: "Impossible de charger les services.",
    searchError: "Recherche impossible.",
  },
  en: {
    eyebrow: "Distance between municipalities",
    title: "Find providers who are truly within range",
    description: "KLYX compares your municipality with declared professional service areas and automatically checks the maximum radius.",
    serviceLabel: "Service needed",
    localityLabel: "My municipality",
    localityPlaceholder: "Choose a municipality",
    calculate: "Calculate coverage",
    calculating: "Calculating...",
    resultsEyebrow: "Coverage calculated",
    noCoverageTitle: "No compatible coverage area",
    noCoverageDescription: "The declared areas for this service do not currently cover this municipality.",
    openGeneralSearch: "Open general search",
    primaryZone: "Primary area",
    distance: "Distance",
    radius: "Radius",
    margin: "Remaining range",
    viewInSearch: "View in search",
    loadError: "Unable to load services.",
    searchError: "Unable to search coverage.",
  },
  nl: {
    eyebrow: "Afstand tussen gemeenten",
    title: "Vind dienstverleners die echt binnen hun bereik vallen",
    description: "KLYX vergelijkt je gemeente met opgegeven werkzones en controleert automatisch de maximale straal.",
    serviceLabel: "Gezochte dienst",
    localityLabel: "Mijn gemeente",
    localityPlaceholder: "Kies een gemeente",
    calculate: "Dekking berekenen",
    calculating: "Bezig met berekenen...",
    resultsEyebrow: "Dekking berekend",
    noCoverageTitle: "Geen compatibele werkzone",
    noCoverageDescription: "De opgegeven zones voor deze dienst dekken deze gemeente momenteel niet.",
    openGeneralSearch: "Algemene zoekopdracht openen",
    primaryZone: "Primaire zone",
    distance: "Afstand",
    radius: "Straal",
    margin: "Resterend bereik",
    viewInSearch: "Bekijken in zoeken",
    loadError: "Kan de diensten niet laden.",
    searchError: "Kan de dekking niet zoeken.",
  },
  de: {
    eyebrow: "Entfernung zwischen Gemeinden",
    title: "Finde Anbieter, die wirklich in ihrem Radius liegen",
    description: "KLYX vergleicht deine Gemeinde mit angegebenen Einsatzgebieten und prüft automatisch den maximalen Radius.",
    serviceLabel: "Gesuchte Dienstleistung",
    localityLabel: "Meine Gemeinde",
    localityPlaceholder: "Gemeinde auswählen",
    calculate: "Abdeckung berechnen",
    calculating: "Wird berechnet...",
    resultsEyebrow: "Abdeckung berechnet",
    noCoverageTitle: "Kein passendes Einsatzgebiet",
    noCoverageDescription: "Die angegebenen Gebiete für diese Dienstleistung decken diese Gemeinde derzeit nicht ab.",
    openGeneralSearch: "Allgemeine Suche öffnen",
    primaryZone: "Hauptgebiet",
    distance: "Entfernung",
    radius: "Radius",
    margin: "Restreichweite",
    viewInSearch: "In der Suche anzeigen",
    loadError: "Dienstleistungen konnten nicht geladen werden.",
    searchError: "Abdeckung konnte nicht gesucht werden.",
  },
};

const LOCALE_SET = new Set<string>(KLYX_COVERAGE_TRANSLATED_LOCALES);

export function resolveKlyxCoverageLocale(locale: KlyxLocale): KlyxCoverageLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxCoverageLocale) : "fr";
}

export function getKlyxCoverageDictionary(locale: KlyxLocale): Dictionary {
  return MESSAGES[resolveKlyxCoverageLocale(locale)];
}

export function translateKlyxCoverage(locale: KlyxLocale, key: KlyxCoverageMessageKey): string {
  return getKlyxCoverageDictionary(locale)[key];
}

export function formatKlyxCoverageProviderCount(locale: KlyxLocale, count: number): string {
  const resolved = resolveKlyxCoverageLocale(locale);
  if (resolved === "en") return `${count} provider${count === 1 ? "" : "s"} within range`;
  if (resolved === "nl") return `${count} dienstverlener${count === 1 ? "" : "s"} binnen bereik`;
  if (resolved === "de") return `${count} Anbieter${count === 1 ? "" : ""} im Radius`;
  return `${count} prestataire${count > 1 ? "s" : ""} dans le rayon`;
}
