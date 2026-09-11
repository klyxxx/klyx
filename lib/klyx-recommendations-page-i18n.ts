import type { KlyxLocale } from "@/lib/klyx-i18n";

export type KlyxRecommendationsMessageKey =
  | "editRequest"
  | "eyebrow"
  | "title"
  | "description"
  | "requestSummary"
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
  | "whyRecommended"
  | "otherOptions"
  | "otherOptionsDescription"
  | "score"
  | "verified"
  | "providerFallback"
  | "headlineFallback"
  | "areaToConfirm"
  | "availabilityFallback"
  | "viewProfile"
  | "choose"
  | "chooseRecommendation"
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
  eyebrow: "Choix KLYX",
  title: "KLYX te recommande ce prestataire",
  description: "KLYX a retenu l’option la plus pertinente pour ta demande. Tu peux confirmer ce choix directement ou consulter les autres options si tu le souhaites.",
  requestSummary: "Résumé de la demande",
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
  loading: "KLYX cherche l’option la plus pertinente...",
  selectionUnavailable: "Sélection indisponible",
  loadError: "Impossible de charger la recommandation.",
  alternativesTitle: "Aucun profil ne correspond exactement à tous les critères.",
  alternativesDescription: "KLYX te propose l’option la plus proche de ta demande actuelle.",
  noProviderTitle: "Aucun prestataire disponible",
  noProviderDescription: "Aucun profil publié ne correspond encore à cette demande. Modifie la zone, la date ou le budget pour relancer KLYX.",
  editFilters: "Modifier les filtres",
  recommendations: "Recommandations",
  selectedProfile: "profil sélectionné",
  selectedProfiles: "profils sélectionnés",
  seeAllResults: "Voir tous les résultats",
  bestChoice: "Recommandation KLYX",
  whyRecommended: "Pourquoi ce choix",
  otherOptions: "Voir les autres options",
  otherOptionsDescription: "KLYX les garde en retrait pour ne pas te faire comparer inutilement. Elles restent disponibles si tu veux choisir toi-même.",
  score: "Score",
  verified: "Identité vérifiée",
  providerFallback: "Prestataire KLYX",
  headlineFallback: "Prestataire disponible pour répondre à ta demande.",
  areaToConfirm: "Zone à confirmer",
  availabilityFallback: "Disponibilité à confirmer avec le prestataire.",
  viewProfile: "Voir le profil",
  choose: "Choisir",
  chooseRecommendation: "Réserver ce prestataire",
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
  eyebrow: "KLYX choice",
  title: "KLYX recommends this provider",
  description: "KLYX selected the option that best fits your request. You can confirm this choice directly or open the other options if you want to compare.",
  requestSummary: "Request summary",
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
  loading: "KLYX is finding the most relevant option...",
  selectionUnavailable: "Selection unavailable",
  loadError: "Unable to load the recommendation.",
  alternativesTitle: "No profile matches every criterion exactly.",
  alternativesDescription: "KLYX is showing the closest option for your current request.",
  noProviderTitle: "No provider available",
  noProviderDescription: "No published profile matches this request yet. Change the area, date or budget and ask KLYX again.",
  editFilters: "Edit filters",
  recommendations: "Recommendations",
  selectedProfile: "profile selected",
  selectedProfiles: "profiles selected",
  seeAllResults: "See all results",
  bestChoice: "KLYX recommendation",
  whyRecommended: "Why this choice",
  otherOptions: "See other options",
  otherOptionsDescription: "KLYX keeps them secondary so you do not have to compare unnecessarily. They remain available if you want to choose yourself.",
  score: "Score",
  verified: "Verified identity",
  providerFallback: "KLYX provider",
  headlineFallback: "Provider available to respond to your request.",
  areaToConfirm: "Area to confirm",
  availabilityFallback: "Availability to be confirmed with the provider.",
  viewProfile: "View profile",
  choose: "Choose",
  chooseRecommendation: "Book this provider",
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
  eyebrow: "KLYX-keuze",
  title: "KLYX raadt deze dienstverlener aan",
  description: "KLYX heeft de optie gekozen die het best bij je aanvraag past. Je kunt deze keuze meteen bevestigen of de andere opties openen als je wilt vergelijken.",
  requestSummary: "Samenvatting van de aanvraag",
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
  loading: "KLYX zoekt de meest relevante optie...",
  selectionUnavailable: "Selectie niet beschikbaar",
  loadError: "De aanbeveling kon niet worden geladen.",
  alternativesTitle: "Geen enkel profiel voldoet exact aan alle criteria.",
  alternativesDescription: "KLYX toont de optie die het dichtst bij je huidige aanvraag ligt.",
  noProviderTitle: "Geen dienstverlener beschikbaar",
  noProviderDescription: "Er is nog geen gepubliceerd profiel dat bij deze aanvraag past. Pas de zone, datum of het budget aan en laat KLYX opnieuw zoeken.",
  editFilters: "Filters wijzigen",
  recommendations: "Aanbevelingen",
  selectedProfile: "profiel geselecteerd",
  selectedProfiles: "profielen geselecteerd",
  seeAllResults: "Alle resultaten bekijken",
  bestChoice: "KLYX-aanbeveling",
  whyRecommended: "Waarom deze keuze",
  otherOptions: "Andere opties bekijken",
  otherOptionsDescription: "KLYX houdt ze op de achtergrond zodat je niet onnodig hoeft te vergelijken. Ze blijven beschikbaar als je zelf wilt kiezen.",
  score: "Score",
  verified: "Identiteit geverifieerd",
  providerFallback: "KLYX-dienstverlener",
  headlineFallback: "Dienstverlener beschikbaar om op je aanvraag te reageren.",
  areaToConfirm: "Zone te bevestigen",
  availabilityFallback: "Beschikbaarheid te bevestigen met de dienstverlener.",
  viewProfile: "Profiel bekijken",
  choose: "Kiezen",
  chooseRecommendation: "Deze dienstverlener boeken",
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
  title: "KLYX empfiehlt diesen Anbieter",
  description: "KLYX hat die Option ausgewählt, die am besten zu deiner Anfrage passt. Du kannst diese Wahl direkt bestätigen oder die anderen Optionen öffnen, wenn du vergleichen möchtest.",
  requestSummary: "Zusammenfassung der Anfrage",
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
  loading: "KLYX sucht die passendste Option...",
  selectionUnavailable: "Auswahl nicht verfügbar",
  loadError: "Die Empfehlung konnte nicht geladen werden.",
  alternativesTitle: "Kein Profil erfüllt alle Kriterien exakt.",
  alternativesDescription: "KLYX zeigt die Option, die deiner aktuellen Anfrage am nächsten kommt.",
  noProviderTitle: "Kein Anbieter verfügbar",
  noProviderDescription: "Noch kein veröffentlichtes Profil passt zu dieser Anfrage. Ändere Gebiet, Datum oder Budget und lass KLYX erneut suchen.",
  editFilters: "Filter ändern",
  recommendations: "Empfehlungen",
  selectedProfile: "Profil ausgewählt",
  selectedProfiles: "Profile ausgewählt",
  seeAllResults: "Alle Ergebnisse anzeigen",
  bestChoice: "KLYX-Empfehlung",
  whyRecommended: "Warum diese Wahl",
  otherOptions: "Andere Optionen ansehen",
  otherOptionsDescription: "KLYX hält sie im Hintergrund, damit du nicht unnötig vergleichen musst. Sie bleiben verfügbar, wenn du selbst wählen möchtest.",
  score: "Score",
  verified: "Identität verifiziert",
  providerFallback: "KLYX-Anbieter",
  headlineFallback: "Anbieter verfügbar, um auf deine Anfrage zu antworten.",
  areaToConfirm: "Gebiet zu bestätigen",
  availabilityFallback: "Verfügbarkeit mit dem Anbieter bestätigen.",
  viewProfile: "Profil anzeigen",
  choose: "Auswählen",
  chooseRecommendation: "Diesen Anbieter buchen",
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
