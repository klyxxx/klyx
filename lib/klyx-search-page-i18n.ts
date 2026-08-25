import type { KlyxLocale } from "@/lib/klyx-i18n";
import type { ProviderPricingType, ProviderSearchSort } from "@/lib/provider-search";

export const KLYX_SEARCH_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxSearchPageLocale =
  (typeof KLYX_SEARCH_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_SEARCH_PAGE_MESSAGE_KEYS = [
  "marketplaceEyebrow", "title", "assistantBridge", "criteriaTitle", "reset",
  "service", "city", "cityPlaceholder", "date", "startTime", "endTime",
  "advancedFilters", "hide", "show", "maxPrice", "pricingType", "sortBy",
  "searchButton", "zone", "when", "budget", "allZones", "allDates", "allPrices",
  "loading", "searchUnavailable", "loadError", "invalidTimeRange", "retry",
  "alternativesTitle", "alternativesText", "noProvidersTitle", "noProvidersText",
  "seeAllProviders", "publishedOnly", "comparisonEyebrow", "comparisonTitle",
  "comparisonText", "bestScore", "bestRated", "insufficientReviews",
  "insufficientReviewsText", "lowestPrice", "currentResults", "priceConfirm",
  "noComparablePrice", "decisionNotice", "providerFallback", "recommended",
  "alternative", "verified", "professionalFallback", "zoneConfirm", "trustEyebrow",
  "whyProfile", "identity", "verifiedStatus", "confirmStatus", "experience", "jobs",
  "verifiedReviews", "noReviews", "availability", "recommendedPrefix",
  "recommendedText", "viewProfile", "book", "searchLoading",
] as const;

export type KlyxSearchPageMessageKey =
  (typeof KLYX_SEARCH_PAGE_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSearchPageMessageKey, string>;

const DICTIONARIES: Record<KlyxSearchPageLocale, Dictionary> = {
  fr: {
    marketplaceEyebrow: "Marketplace KLYX",
    title: "Trouver un prestataire",
    assistantBridge: "Décrire mon besoin à KLYX",
    criteriaTitle: "Critères de recherche",
    reset: "Réinitialiser",
    service: "Service",
    city: "Ville ou zone",
    cityPlaceholder: "Bruxelles, Anderlecht...",
    date: "Date",
    startTime: "Heure de début",
    endTime: "Heure de fin",
    advancedFilters: "Filtres avancés",
    hide: "Masquer",
    show: "Afficher",
    maxPrice: "Prix maximum",
    pricingType: "Type de tarif",
    sortBy: "Trier par",
    searchButton: "Rechercher les prestataires",
    zone: "Zone",
    when: "Quand",
    budget: "Budget",
    allZones: "Toutes les zones",
    allDates: "Toutes les dates",
    allPrices: "Tous les prix",
    loading: "KLYX vérifie les profils publiés et leurs disponibilités...",
    searchUnavailable: "Recherche indisponible",
    loadError: "Impossible de charger les prestataires.",
    invalidTimeRange: "L'heure de fin doit être après l'heure de début.",
    retry: "Réessayer",
    alternativesTitle: "Aucun profil ne correspond exactement à tous les critères.",
    alternativesText: "KLYX affiche les alternatives les plus proches et peut adapter la recherche avec ton accord.",
    noProvidersTitle: "Aucun prestataire publié",
    noProvidersText: "Aucun service actif ne correspond encore à cette recherche. Essaie une autre zone ou retire certains critères.",
    seeAllProviders: "Voir tous les prestataires",
    publishedOnly: "Profils publiés uniquement",
    comparisonEyebrow: "Comparaison KLYX",
    comparisonTitle: "Les profils qui ressortent",
    comparisonText: "KLYX résume les différences principales. Ces indications servent à comparer : aucun prestataire n’est choisi automatiquement.",
    bestScore: "Meilleur score KLYX",
    bestRated: "Mieux noté",
    insufficientReviews: "Pas encore assez d’avis",
    insufficientReviewsText: "KLYX attend des missions terminées avant d’utiliser les avis dans cette comparaison.",
    lowestPrice: "Prix le plus bas",
    currentResults: "Pour les résultats actuellement affichés",
    priceConfirm: "Prix à confirmer",
    noComparablePrice: "Aucun tarif comparable n’est disponible.",
    decisionNotice: "Le meilleur score, la meilleure note et le prix le plus bas peuvent appartenir à des prestataires différents. La décision finale reste toujours au client.",
    providerFallback: "Prestataire KLYX",
    recommended: "Recommandé par KLYX",
    alternative: "Alternative",
    verified: "Vérifié",
    professionalFallback: "Service professionnel KLYX",
    zoneConfirm: "Zone à confirmer",
    trustEyebrow: "Confiance KLYX",
    whyProfile: "Pourquoi ce profil ressort",
    identity: "Identité",
    verifiedStatus: "Vérifiée",
    confirmStatus: "À confirmer",
    experience: "Expérience",
    jobs: "Prestations",
    verifiedReviews: "Avis vérifiés",
    noReviews: "Aucun avis",
    availability: "Disponibilité",
    recommendedPrefix: "Recommandé par KLYX :",
    recommendedText: "ce profil est actuellement le mieux classé parmi les résultats correspondant à tes critères. Tu gardes toujours la décision finale.",
    viewProfile: "Voir le profil",
    book: "Réserver",
    searchLoading: "Chargement de la recherche...",
  },
  en: {
    marketplaceEyebrow: "KLYX Marketplace",
    title: "Find a provider",
    assistantBridge: "Describe my need to KLYX",
    criteriaTitle: "Search criteria",
    reset: "Reset",
    service: "Service",
    city: "City or area",
    cityPlaceholder: "Brussels, Anderlecht...",
    date: "Date",
    startTime: "Start time",
    endTime: "End time",
    advancedFilters: "Advanced filters",
    hide: "Hide",
    show: "Show",
    maxPrice: "Maximum price",
    pricingType: "Pricing type",
    sortBy: "Sort by",
    searchButton: "Search providers",
    zone: "Area",
    when: "When",
    budget: "Budget",
    allZones: "All areas",
    allDates: "All dates",
    allPrices: "All prices",
    loading: "KLYX is checking published profiles and availability...",
    searchUnavailable: "Search unavailable",
    loadError: "Unable to load providers.",
    invalidTimeRange: "The end time must be after the start time.",
    retry: "Try again",
    alternativesTitle: "No profile matches every criterion exactly.",
    alternativesText: "KLYX shows the closest alternatives and can adapt the search with your agreement.",
    noProvidersTitle: "No published provider",
    noProvidersText: "No active service matches this search yet. Try another area or remove some criteria.",
    seeAllProviders: "See all providers",
    publishedOnly: "Published profiles only",
    comparisonEyebrow: "KLYX comparison",
    comparisonTitle: "Profiles that stand out",
    comparisonText: "KLYX summarizes the main differences for comparison. No provider is selected automatically.",
    bestScore: "Best KLYX score",
    bestRated: "Best rated",
    insufficientReviews: "Not enough reviews yet",
    insufficientReviewsText: "KLYX waits for completed jobs before using reviews in this comparison.",
    lowestPrice: "Lowest price",
    currentResults: "For the currently displayed results",
    priceConfirm: "Price to be confirmed",
    noComparablePrice: "No comparable price is available.",
    decisionNotice: "The best score, best rating and lowest price may belong to different providers. The final decision always remains with the client.",
    providerFallback: "KLYX provider",
    recommended: "Recommended by KLYX",
    alternative: "Alternative",
    verified: "Verified",
    professionalFallback: "Professional KLYX service",
    zoneConfirm: "Area to be confirmed",
    trustEyebrow: "KLYX Trust",
    whyProfile: "Why this profile stands out",
    identity: "Identity",
    verifiedStatus: "Verified",
    confirmStatus: "To be confirmed",
    experience: "Experience",
    jobs: "Jobs",
    verifiedReviews: "Verified reviews",
    noReviews: "No reviews",
    availability: "Availability",
    recommendedPrefix: "Recommended by KLYX:",
    recommendedText: "this profile is currently ranked highest among the results matching your criteria. You always keep the final decision.",
    viewProfile: "View profile",
    book: "Book",
    searchLoading: "Loading search...",
  },
  nl: {
    marketplaceEyebrow: "KLYX Marketplace",
    title: "Een dienstverlener vinden",
    assistantBridge: "Mijn behoefte aan KLYX beschrijven",
    criteriaTitle: "Zoekcriteria",
    reset: "Resetten",
    service: "Dienst",
    city: "Stad of zone",
    cityPlaceholder: "Brussel, Anderlecht...",
    date: "Datum",
    startTime: "Starttijd",
    endTime: "Eindtijd",
    advancedFilters: "Geavanceerde filters",
    hide: "Verbergen",
    show: "Tonen",
    maxPrice: "Maximumprijs",
    pricingType: "Tariefsoort",
    sortBy: "Sorteren op",
    searchButton: "Dienstverleners zoeken",
    zone: "Zone",
    when: "Wanneer",
    budget: "Budget",
    allZones: "Alle zones",
    allDates: "Alle datums",
    allPrices: "Alle prijzen",
    loading: "KLYX controleert gepubliceerde profielen en beschikbaarheid...",
    searchUnavailable: "Zoeken niet beschikbaar",
    loadError: "Dienstverleners kunnen niet worden geladen.",
    invalidTimeRange: "De eindtijd moet na de starttijd liggen.",
    retry: "Opnieuw proberen",
    alternativesTitle: "Geen profiel voldoet exact aan alle criteria.",
    alternativesText: "KLYX toont de dichtstbijzijnde alternatieven en kan de zoekopdracht met jouw akkoord aanpassen.",
    noProvidersTitle: "Geen gepubliceerde dienstverlener",
    noProvidersText: "Nog geen actieve dienst voldoet aan deze zoekopdracht. Probeer een andere zone of verwijder enkele criteria.",
    seeAllProviders: "Alle dienstverleners bekijken",
    publishedOnly: "Alleen gepubliceerde profielen",
    comparisonEyebrow: "KLYX-vergelijking",
    comparisonTitle: "Profielen die opvallen",
    comparisonText: "KLYX vat de belangrijkste verschillen samen om te vergelijken. Geen dienstverlener wordt automatisch gekozen.",
    bestScore: "Beste KLYX-score",
    bestRated: "Best beoordeeld",
    insufficientReviews: "Nog niet genoeg beoordelingen",
    insufficientReviewsText: "KLYX wacht op voltooide opdrachten voordat beoordelingen in deze vergelijking worden gebruikt.",
    lowestPrice: "Laagste prijs",
    currentResults: "Voor de momenteel getoonde resultaten",
    priceConfirm: "Prijs te bevestigen",
    noComparablePrice: "Er is geen vergelijkbare prijs beschikbaar.",
    decisionNotice: "De beste score, beste beoordeling en laagste prijs kunnen bij verschillende dienstverleners horen. De uiteindelijke beslissing blijft altijd bij de klant.",
    providerFallback: "KLYX-dienstverlener",
    recommended: "Aanbevolen door KLYX",
    alternative: "Alternatief",
    verified: "Geverifieerd",
    professionalFallback: "Professionele KLYX-dienst",
    zoneConfirm: "Zone te bevestigen",
    trustEyebrow: "KLYX Vertrouwen",
    whyProfile: "Waarom dit profiel opvalt",
    identity: "Identiteit",
    verifiedStatus: "Geverifieerd",
    confirmStatus: "Te bevestigen",
    experience: "Ervaring",
    jobs: "Opdrachten",
    verifiedReviews: "Geverifieerde beoordelingen",
    noReviews: "Geen beoordelingen",
    availability: "Beschikbaarheid",
    recommendedPrefix: "Aanbevolen door KLYX:",
    recommendedText: "dit profiel staat momenteel het hoogst gerangschikt bij de resultaten die aan jouw criteria voldoen. Jij houdt altijd de eindbeslissing.",
    viewProfile: "Profiel bekijken",
    book: "Boeken",
    searchLoading: "Zoekopdracht laden...",
  },
  de: {
    marketplaceEyebrow: "KLYX Marketplace",
    title: "Anbieter finden",
    assistantBridge: "Meinen Bedarf KLYX beschreiben",
    criteriaTitle: "Suchkriterien",
    reset: "Zurücksetzen",
    service: "Dienstleistung",
    city: "Stadt oder Gebiet",
    cityPlaceholder: "Brüssel, Anderlecht...",
    date: "Datum",
    startTime: "Startzeit",
    endTime: "Endzeit",
    advancedFilters: "Erweiterte Filter",
    hide: "Ausblenden",
    show: "Anzeigen",
    maxPrice: "Höchstpreis",
    pricingType: "Tarifart",
    sortBy: "Sortieren nach",
    searchButton: "Anbieter suchen",
    zone: "Gebiet",
    when: "Wann",
    budget: "Budget",
    allZones: "Alle Gebiete",
    allDates: "Alle Daten",
    allPrices: "Alle Preise",
    loading: "KLYX prüft veröffentlichte Profile und Verfügbarkeiten...",
    searchUnavailable: "Suche nicht verfügbar",
    loadError: "Anbieter konnten nicht geladen werden.",
    invalidTimeRange: "Die Endzeit muss nach der Startzeit liegen.",
    retry: "Erneut versuchen",
    alternativesTitle: "Kein Profil erfüllt alle Kriterien exakt.",
    alternativesText: "KLYX zeigt die nächstliegenden Alternativen und kann die Suche mit deiner Zustimmung anpassen.",
    noProvidersTitle: "Kein veröffentlichter Anbieter",
    noProvidersText: "Noch keine aktive Dienstleistung passt zu dieser Suche. Probiere ein anderes Gebiet oder entferne einige Kriterien.",
    seeAllProviders: "Alle Anbieter anzeigen",
    publishedOnly: "Nur veröffentlichte Profile",
    comparisonEyebrow: "KLYX-Vergleich",
    comparisonTitle: "Profile, die herausstechen",
    comparisonText: "KLYX fasst die wichtigsten Unterschiede zum Vergleichen zusammen. Kein Anbieter wird automatisch ausgewählt.",
    bestScore: "Bester KLYX Score",
    bestRated: "Am besten bewertet",
    insufficientReviews: "Noch nicht genug Bewertungen",
    insufficientReviewsText: "KLYX wartet auf abgeschlossene Aufträge, bevor Bewertungen in diesem Vergleich verwendet werden.",
    lowestPrice: "Niedrigster Preis",
    currentResults: "Für die derzeit angezeigten Ergebnisse",
    priceConfirm: "Preis noch zu bestätigen",
    noComparablePrice: "Kein vergleichbarer Preis verfügbar.",
    decisionNotice: "Der beste Score, die beste Bewertung und der niedrigste Preis können zu unterschiedlichen Anbietern gehören. Die endgültige Entscheidung bleibt immer beim Kunden.",
    providerFallback: "KLYX-Anbieter",
    recommended: "Von KLYX empfohlen",
    alternative: "Alternative",
    verified: "Verifiziert",
    professionalFallback: "Professioneller KLYX-Service",
    zoneConfirm: "Gebiet zu bestätigen",
    trustEyebrow: "KLYX Vertrauen",
    whyProfile: "Warum dieses Profil heraussticht",
    identity: "Identität",
    verifiedStatus: "Verifiziert",
    confirmStatus: "Zu bestätigen",
    experience: "Erfahrung",
    jobs: "Aufträge",
    verifiedReviews: "Verifizierte Bewertungen",
    noReviews: "Keine Bewertungen",
    availability: "Verfügbarkeit",
    recommendedPrefix: "Von KLYX empfohlen:",
    recommendedText: "dieses Profil ist aktuell unter den Ergebnissen, die deinen Kriterien entsprechen, am höchsten eingestuft. Die endgültige Entscheidung bleibt immer bei dir.",
    viewProfile: "Profil anzeigen",
    book: "Buchen",
    searchLoading: "Suche wird geladen...",
  },
};

export function resolveKlyxSearchPageLocale(
  locale: KlyxLocale | string
): KlyxSearchPageLocale {
  return KLYX_SEARCH_PAGE_TRANSLATED_LOCALES.includes(locale as KlyxSearchPageLocale)
    ? (locale as KlyxSearchPageLocale)
    : "fr";
}

export function getKlyxSearchPageDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxSearchPageLocale(locale)];
}

export function translateKlyxSearchPage(
  locale: KlyxLocale | string,
  key: KlyxSearchPageMessageKey
): string {
  return getKlyxSearchPageDictionary(locale)[key];
}

export function getKlyxSearchIntlLocale(locale: KlyxLocale | string): string {
  return {
    fr: "fr-BE",
    en: "en-BE",
    nl: "nl-BE",
    de: "de-BE",
  }[resolveKlyxSearchPageLocale(locale)];
}

const SERVICE_LABELS: Record<KlyxSearchPageLocale, Record<string, string>> = {
  fr: { all: "Tous les services", babysitting: "Baby-sitting", cleaning: "Ménage", moving: "Déménagement", handyman: "Bricolage" },
  en: { all: "All services", babysitting: "Babysitting", cleaning: "Cleaning", moving: "Moving", handyman: "Handyman" },
  nl: { all: "Alle diensten", babysitting: "Babysitten", cleaning: "Schoonmaak", moving: "Verhuizen", handyman: "Klusjes" },
  de: { all: "Alle Dienstleistungen", babysitting: "Babysitting", cleaning: "Reinigung", moving: "Umzug", handyman: "Handwerker" },
};

export function formatKlyxSearchServiceLabel(
  locale: KlyxLocale | string,
  value: string,
  fallback: string
): string {
  return SERVICE_LABELS[resolveKlyxSearchPageLocale(locale)][value] ?? fallback;
}

export function formatKlyxSearchPricingOption(
  locale: KlyxLocale | string,
  value: string,
  fallback: string
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  const labels: Record<KlyxSearchPageLocale, Record<string, string>> = {
    fr: { all: "Tous les tarifs", hourly: "Tarif horaire", fixed: "Prix fixe" },
    en: { all: "All pricing", hourly: "Hourly rate", fixed: "Fixed price" },
    nl: { all: "Alle tarieven", hourly: "Uurtarief", fixed: "Vaste prijs" },
    de: { all: "Alle Tarife", hourly: "Stundentarif", fixed: "Festpreis" },
  };
  return labels[resolved][value] ?? fallback;
}

export function formatKlyxSearchSortOption(
  locale: KlyxLocale | string,
  value: ProviderSearchSort,
  fallback: string
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  const labels: Record<KlyxSearchPageLocale, Record<ProviderSearchSort, string>> = {
    fr: { recommended: "Recommandés", price_asc: "Prix croissant", score_desc: "Meilleur score", rating_desc: "Mieux notés", experience_desc: "Plus expérimentés" },
    en: { recommended: "Recommended", price_asc: "Lowest price", score_desc: "Best score", rating_desc: "Best rated", experience_desc: "Most experienced" },
    nl: { recommended: "Aanbevolen", price_asc: "Laagste prijs", score_desc: "Beste score", rating_desc: "Best beoordeeld", experience_desc: "Meeste ervaring" },
    de: { recommended: "Empfohlen", price_asc: "Niedrigster Preis", score_desc: "Bester Score", rating_desc: "Am besten bewertet", experience_desc: "Meiste Erfahrung" },
  };
  return labels[resolved][value] ?? fallback;
}

export function formatKlyxSearchDate(
  locale: KlyxLocale | string,
  value: string
): string {
  if (!value) return translateKlyxSearchPage(locale, "allDates");
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getKlyxSearchIntlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatKlyxSearchWhen(
  locale: KlyxLocale | string,
  date: string,
  startTime: string,
  endTime: string
): string {
  const dateText = formatKlyxSearchDate(locale, date);
  if (!startTime) return dateText;
  const resolved = resolveKlyxSearchPageLocale(locale);
  const startConnector = { fr: "de", en: "from", nl: "van", de: "ab" }[resolved];
  const endConnector = { fr: "à", en: "to", nl: "tot", de: "bis" }[resolved];
  return `${dateText} ${startConnector} ${startTime}${endTime ? ` ${endConnector} ${endTime}` : ""}`;
}

export function formatKlyxSearchBudget(
  locale: KlyxLocale | string,
  budget: string
): string {
  if (!budget) return translateKlyxSearchPage(locale, "allPrices");
  const resolved = resolveKlyxSearchPageLocale(locale);
  const suffix = { fr: "maximum", en: "maximum", nl: "maximum", de: "maximal" }[resolved];
  return `${Number(budget).toFixed(2)} € ${suffix}`;
}

export function formatKlyxSearchProviderPrice(
  locale: KlyxLocale | string,
  price: number | null,
  pricingType: ProviderPricingType
): string {
  if (price === null) return translateKlyxSearchPage(locale, "priceConfirm");
  if (pricingType === "fixed") {
    const resolved = resolveKlyxSearchPageLocale(locale);
    const suffix = { fr: "forfait", en: "fixed", nl: "vast", de: "pauschal" }[resolved];
    return `${price.toFixed(2)} € ${suffix}`;
  }
  return `${price.toFixed(2)} €/h`;
}

export function formatKlyxSearchScoreLabel(
  locale: KlyxLocale | string,
  score: number
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
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

export function formatKlyxSearchReviewCount(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  if (resolved === "en") return `${count} verified review${count === 1 ? "" : "s"}`;
  if (resolved === "nl") return `${count} geverifieerde beoordeling${count === 1 ? "" : "en"}`;
  if (resolved === "de") return `${count} verifizierte Bewertung${count === 1 ? "" : "en"}`;
  return `${count} avis vérifié${count > 1 ? "s" : ""}`;
}

export function formatKlyxSearchExperience(
  locale: KlyxLocale | string,
  years: number
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  if (resolved === "en") return `${years} year${years === 1 ? "" : "s"}`;
  if (resolved === "nl") return `${years} jaar`;
  if (resolved === "de") return `${years} ${years === 1 ? "Jahr" : "Jahre"}`;
  return `${years} an${years > 1 ? "s" : ""}`;
}

export function formatKlyxSearchJobs(
  locale: KlyxLocale | string,
  count: number,
  completedOnly = false
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  if (resolved === "en") return completedOnly ? `${count} completed` : `${count} job${count === 1 ? "" : "s"}`;
  if (resolved === "nl") return completedOnly ? `${count} voltooid` : `${count} opdracht${count === 1 ? "" : "en"}`;
  if (resolved === "de") return completedOnly ? `${count} abgeschlossen` : `${count} ${count === 1 ? "Auftrag" : "Aufträge"}`;
  return completedOnly
    ? `${count} terminée${count > 1 ? "s" : ""}`
    : `${count} prestation${count > 1 ? "s" : ""}`;
}

export function formatKlyxSearchComparedProfiles(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  if (resolved === "en") return `${count} profile${count === 1 ? "" : "s"} compared`;
  if (resolved === "nl") return `${count} profiel${count === 1 ? "" : "en"} vergeleken`;
  if (resolved === "de") return `${count} ${count === 1 ? "Profil" : "Profile"} verglichen`;
  return `${count} profil${count > 1 ? "s" : ""} comparé${count > 1 ? "s" : ""}`;
}

export function formatKlyxSearchResultSummary(
  locale: KlyxLocale | string,
  count: number,
  totalCandidates: number
): string {
  const resolved = resolveKlyxSearchPageLocale(locale);
  const extra = totalCandidates > count;
  if (resolved === "en") {
    return `${count} result${count === 1 ? "" : "s"}${extra ? ` out of ${totalCandidates} published services` : ""}`;
  }
  if (resolved === "nl") {
    return `${count} ${count === 1 ? "resultaat" : "resultaten"}${extra ? ` van ${totalCandidates} gepubliceerde diensten` : ""}`;
  }
  if (resolved === "de") {
    return `${count} ${count === 1 ? "Ergebnis" : "Ergebnisse"}${extra ? ` von ${totalCandidates} veröffentlichten Dienstleistungen` : ""}`;
  }
  return `${count} résultat${count > 1 ? "s" : ""}${extra ? ` sur ${totalCandidates} services publiés` : ""}`;
}
