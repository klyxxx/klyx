import type { KlyxLocale } from "@/lib/klyx-i18n";

export type KlyxRecommendationsMessageKey =
  | "editRequest"
  | "eyebrow"
  | "title"
  | "description"
  | "service"
  | "allServices"
  | "city"
  | "allAreas"
  | "date"
  | "flexible"
  | "time"
  | "budget"
  | "budgetMaximum"
  | "budgetUndefined"
  | "loading"
  | "selectionUnavailable"
  | "loadError"
  | "alternativesTitle"
  | "alternativesDescription"
  | "noProviderTitle"
  | "noProviderDescription"
  | "editFilters"
  | "recommendations"
  | "selectedProfile"
  | "selectedProfiles"
  | "seeAllResults"
  | "bestChoice"
  | "score"
  | "providerFallback"
  | "headlineFallback"
  | "areaToConfirm"
  | "availabilityFallback"
  | "viewProfile"
  | "choose"
  | "priceToConfirm"
  | "fixedPrice"
  | "hourlyPrice"
  | "excellent"
  | "veryReliable"
  | "reliable"
  | "fair"
  | "newProfile"
  | "yearExperience"
  | "yearsExperience"
  | "mission"
  | "missions";

type Dictionary = Record<KlyxRecommendationsMessageKey, string>;

const FR: Dictionary = {
  editRequest: "Modifier ma demande",
  eyebrow: "Sélection KLYX",
  title: "Les meilleurs profils pour ta demande",
  description: "KLYX classe les profils selon la correspondance avec tes critères, leur score de confiance, leur expérience et leur disponibilité.",
  service: "Service",
  allServices: "Tous",
  city: "Ville",
  allAreas: "Toutes les zones",
  date: "Date",
  flexible: "Flexible",
  time: "Heure",
  budget: "Budget",
  budgetMaximum: "maximum",
  budgetUndefined: "Non défini",
  loading: "KLYX compare les profils disponibles...",
  selectionUnavailable: "Sélection indisponible",
  loadError: "Impossible de charger les recommandations.",
  alternativesTitle: "Aucun profil ne correspond exactement à tous les critères.",
  alternativesDescription: "KLYX affiche les alternatives les plus proches pour ne pas te laisser sans solution.",
  noProviderTitle: "Aucun prestataire disponible",
  noProviderDescription: "Aucun profil publié ne correspond encore à cette demande. Essaie une autre zone, une autre date ou un budget plus flexible.",
  editFilters: "Modifier les filtres",
  recommendations: "Recommandations",
  selectedProfile: "profil sélectionné",
  selectedProfiles: "profils sélectionnés",
  seeAllResults: "Voir tous les résultats",
  bestChoice: "Meilleur choix",
  score: "Score",
  providerFallback: "Prestataire KLYX",
  headlineFallback: "Prestataire disponible pour répondre à ta demande.",
  areaToConfirm: "Zone à confirmer",
  availabilityFallback: "Disponibilité à confirmer avec le prestataire.",
  viewProfile: "Voir le profil",
  choose: "Choisir",
  priceToConfirm: "Prix à confirmer",
  fixedPrice: "forfait",
  hourlyPrice: "/h",
  excellent: "Excellent",
  veryReliable: "Très fiable",
  reliable: "Fiable",
  fair: "Correct",
  newProfile: "Nouveau profil",
  yearExperience: "an d’expérience",
  yearsExperience: "ans d’expérience",
  mission: "mission",
  missions: "missions",
};

const EN: Dictionary = {
  editRequest: "Edit my request",
  eyebrow: "KLYX selection",
  title: "The best profiles for your request",
  description: "KLYX ranks profiles by fit with your criteria, trust score, experience and availability.",
  service: "Service",
  allServices: "All",
  city: "City",
  allAreas: "All areas",
  date: "Date",
  flexible: "Flexible",
  time: "Time",
  budget: "Budget",
  budgetMaximum: "maximum",
  budgetUndefined: "Not set",
  loading: "KLYX is comparing available profiles...",
  selectionUnavailable: "Selection unavailable",
  loadError: "Unable to load recommendations.",
  alternativesTitle: "No profile matches every criterion exactly.",
  alternativesDescription: "KLYX shows the closest alternatives so you still have useful options.",
  noProviderTitle: "No provider available",
  noProviderDescription: "No published profile matches this request yet. Try another area, date or a more flexible budget.",
  editFilters: "Edit filters",
  recommendations: "Recommendations",
  selectedProfile: "profile selected",
  selectedProfiles: "profiles selected",
  seeAllResults: "See all results",
  bestChoice: "Best choice",
  score: "Score",
  providerFallback: "KLYX provider",
  headlineFallback: "Provider available to respond to your request.",
  areaToConfirm: "Area to confirm",
  availabilityFallback: "Availability to be confirmed with the provider.",
  viewProfile: "View profile",
  choose: "Choose",
  priceToConfirm: "Price to confirm",
  fixedPrice: "fixed",
  hourlyPrice: "/h",
  excellent: "Excellent",
  veryReliable: "Very reliable",
  reliable: "Reliable",
  fair: "Fair",
  newProfile: "New profile",
  yearExperience: "year of experience",
  yearsExperience: "years of experience",
  mission: "mission",
  missions: "missions",
};

const NL: Dictionary = {
  editRequest: "Mijn aanvraag wijzigen",
  eyebrow: "KLYX-selectie",
  title: "De beste profielen voor je aanvraag",
  description: "KLYX rangschikt profielen op basis van je criteria, vertrouwensscore, ervaring en beschikbaarheid.",
  service: "Dienst",
  allServices: "Alle",
  city: "Stad",
  allAreas: "Alle zones",
  date: "Datum",
  flexible: "Flexibel",
  time: "Tijd",
  budget: "Budget",
  budgetMaximum: "maximum",
  budgetUndefined: "Niet ingesteld",
  loading: "KLYX vergelijkt beschikbare profielen...",
  selectionUnavailable: "Selectie niet beschikbaar",
  loadError: "Aanbevelingen konden niet worden geladen.",
  alternativesTitle: "Geen enkel profiel voldoet exact aan alle criteria.",
  alternativesDescription: "KLYX toont de dichtstbijzijnde alternatieven zodat je opties behoudt.",
  noProviderTitle: "Geen dienstverlener beschikbaar",
  noProviderDescription: "Er is nog geen gepubliceerd profiel dat bij deze aanvraag past. Probeer een andere zone, datum of een flexibeler budget.",
  editFilters: "Filters wijzigen",
  recommendations: "Aanbevelingen",
  selectedProfile: "profiel geselecteerd",
  selectedProfiles: "profielen geselecteerd",
  seeAllResults: "Alle resultaten bekijken",
  bestChoice: "Beste keuze",
  score: "Score",
  providerFallback: "KLYX-dienstverlener",
  headlineFallback: "Dienstverlener beschikbaar om op je aanvraag te reageren.",
  areaToConfirm: "Zone te bevestigen",
  availabilityFallback: "Beschikbaarheid te bevestigen met de dienstverlener.",
  viewProfile: "Profiel bekijken",
  choose: "Kiezen",
  priceToConfirm: "Prijs te bevestigen",
  fixedPrice: "vast",
  hourlyPrice: "/u",
  excellent: "Uitstekend",
  veryReliable: "Zeer betrouwbaar",
  reliable: "Betrouwbaar",
  fair: "Redelijk",
  newProfile: "Nieuw profiel",
  yearExperience: "jaar ervaring",
  yearsExperience: "jaar ervaring",
  mission: "opdracht",
  missions: "opdrachten",
};

const DE: Dictionary = {
  editRequest: "Anfrage bearbeiten",
  eyebrow: "KLYX-Auswahl",
  title: "Die besten Profile für deine Anfrage",
  description: "KLYX ordnet Profile nach Übereinstimmung mit deinen Kriterien, Vertrauenswert, Erfahrung und Verfügbarkeit.",
  service: "Service",
  allServices: "Alle",
  city: "Stadt",
  allAreas: "Alle Gebiete",
  date: "Datum",
  flexible: "Flexibel",
  time: "Uhrzeit",
  budget: "Budget",
  budgetMaximum: "maximal",
  budgetUndefined: "Nicht festgelegt",
  loading: "KLYX vergleicht verfügbare Profile...",
  selectionUnavailable: "Auswahl nicht verfügbar",
  loadError: "Empfehlungen konnten nicht geladen werden.",
  alternativesTitle: "Kein Profil erfüllt alle Kriterien exakt.",
  alternativesDescription: "KLYX zeigt die nächstgelegenen Alternativen, damit du weiterhin passende Optionen hast.",
  noProviderTitle: "Kein Anbieter verfügbar",
  noProviderDescription: "Noch kein veröffentlichtes Profil passt zu dieser Anfrage. Versuche ein anderes Gebiet, Datum oder ein flexibleres Budget.",
  editFilters: "Filter ändern",
  recommendations: "Empfehlungen",
  selectedProfile: "Profil ausgewählt",
  selectedProfiles: "Profile ausgewählt",
  seeAllResults: "Alle Ergebnisse anzeigen",
  bestChoice: "Beste Wahl",
  score: "Score",
  providerFallback: "KLYX-Anbieter",
  headlineFallback: "Anbieter verfügbar, um auf deine Anfrage zu antworten.",
  areaToConfirm: "Gebiet zu bestätigen",
  availabilityFallback: "Verfügbarkeit mit dem Anbieter bestätigen.",
  viewProfile: "Profil anzeigen",
  choose: "Auswählen",
  priceToConfirm: "Preis zu bestätigen",
  fixedPrice: "pauschal",
  hourlyPrice: "/Std.",
  excellent: "Ausgezeichnet",
  veryReliable: "Sehr zuverlässig",
  reliable: "Zuverlässig",
  fair: "Solide",
  newProfile: "Neues Profil",
  yearExperience: "Jahr Erfahrung",
  yearsExperience: "Jahre Erfahrung",
  mission: "Auftrag",
  missions: "Aufträge",
};

const DICTIONARIES: Partial<Record<KlyxLocale, Dictionary>> = {
  fr: FR,
  en: EN,
  nl: NL,
  de: DE,
};

export function translateKlyxRecommendations(
  locale: KlyxLocale,
  key: KlyxRecommendationsMessageKey
): string {
  return DICTIONARIES[locale]?.[key] ?? FR[key];
}

export function formatKlyxRecommendationPrice(
  locale: KlyxLocale,
  price: number | null,
  pricingType: "hourly" | "fixed"
): string {
  if (price === null) {
    return translateKlyxRecommendations(locale, "priceToConfirm");
  }

  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

  return pricingType === "fixed"
    ? `${amount} ${translateKlyxRecommendations(locale, "fixedPrice")}`
    : `${amount}${translateKlyxRecommendations(locale, "hourlyPrice")}`;
}

export function formatKlyxRecommendationScore(
  locale: KlyxLocale,
  score: number
): string {
  if (score >= 90) return translateKlyxRecommendations(locale, "excellent");
  if (score >= 80) return translateKlyxRecommendations(locale, "veryReliable");
  if (score >= 70) return translateKlyxRecommendations(locale, "reliable");
  if (score >= 60) return translateKlyxRecommendations(locale, "fair");
  return translateKlyxRecommendations(locale, "newProfile");
}

export function formatKlyxRecommendationExperience(
  locale: KlyxLocale,
  years: number
): string {
  const unit = translateKlyxRecommendations(
    locale,
    years === 1 ? "yearExperience" : "yearsExperience"
  );
  return `${years} ${unit}`;
}

export function formatKlyxRecommendationMissions(
  locale: KlyxLocale,
  count: number
): string {
  const unit = translateKlyxRecommendations(
    locale,
    count === 1 ? "mission" : "missions"
  );
  return `${count} ${unit}`;
}

export function formatKlyxRecommendationService(
  locale: KlyxLocale,
  slug: string,
  fallback: string
): string {
  const labels: Record<string, Partial<Record<KlyxLocale, string>>> = {
    babysitting: { fr: "Baby-sitting", en: "Babysitting", nl: "Babysitten", de: "Babysitting" },
    cleaning: { fr: "Ménage", en: "Cleaning", nl: "Schoonmaak", de: "Reinigung" },
    moving: { fr: "Déménagement", en: "Moving", nl: "Verhuizen", de: "Umzug" },
    handyman: { fr: "Bricolage", en: "Handyman", nl: "Klusjes", de: "Handwerker" },
  };

  return labels[slug.trim().toLowerCase()]?.[locale]
    ?? labels[slug.trim().toLowerCase()]?.fr
    ?? fallback;
}
