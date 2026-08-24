import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderAnalyticsLocale = (typeof KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_ANALYTICS_MESSAGE_KEYS = [
  "backFounder", "badge", "title", "description", "windowAria", "days",
  "loading", "loadError", "newClients", "providerSearches", "quoteRequests",
  "bookingsCreated", "paidBookings", "searchesWithResults", "quotePerSearch",
  "paidPerBooking", "dailySearches", "dailyHeight", "dailyVolumesAria",
  "privacyTitle", "privacyDescription", "privacyUserIds", "privacySearchText",
  "privacyIp", "ratiosTitle", "ratiosDescription", "bookingPerQuote",
] as const;
export type KlyxFounderAnalyticsMessageKey = (typeof KLYX_FOUNDER_ANALYTICS_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderAnalyticsMessageKey, string>;

const MESSAGES: Record<KlyxFounderAnalyticsLocale, Dictionary> = {
  fr: {
    backFounder: "Console Founder", badge: "Analytics privées", title: "Funnel produit KLYX",
    description: "Volumes produit utiles au lancement, sans tracker navigateur et sans conserver les recherches, villes, IP ou identifiants des utilisateurs.",
    windowAria: "Fenêtre analytics", days: "jours", loading: "Chargement", loadError: "Analytics Founder indisponibles.",
    newClients: "Nouveaux profils clients", providerSearches: "Recherches prestataires", quoteRequests: "Demandes de devis",
    bookingsCreated: "Réservations créées", paidBookings: "Réservations payées", searchesWithResults: "Recherches avec résultat",
    quotePerSearch: "Devis / recherches", paidPerBooking: "Payées / réservations", dailySearches: "Recherches quotidiennes",
    dailyHeight: "Hauteur = volume quotidien", dailyVolumesAria: "Volumes de recherche quotidiens", privacyTitle: "Privacy by design",
    privacyDescription: "Les recherches sont conservées uniquement comme compteurs journaliers agrégés. Les autres volumes proviennent des tables métier canoniques.",
    privacyUserIds: "Aucun identifiant utilisateur dans les compteurs de recherche.", privacySearchText: "Aucun texte recherché ni ville conservés.",
    privacyIp: "Aucune adresse IP ni identifiant navigateur conservés.", ratiosTitle: "Lecture correcte des ratios",
    ratiosDescription: "Les ratios sont des ratios de volumes sur la période, pas des cohortes utilisateur. Ils peuvent refléter des actions commencées avant la fenêtre.",
    bookingPerQuote: "Réservations / devis",
  },
  en: {
    backFounder: "Founder Console", badge: "Private analytics", title: "KLYX product funnel",
    description: "Launch-focused product volumes without browser tracking or storing searches, cities, IP addresses, or user identifiers.",
    windowAria: "Analytics window", days: "days", loading: "Loading", loadError: "Founder analytics are unavailable.",
    newClients: "New client profiles", providerSearches: "Provider searches", quoteRequests: "Quote requests",
    bookingsCreated: "Bookings created", paidBookings: "Paid bookings", searchesWithResults: "Searches with results",
    quotePerSearch: "Quotes / searches", paidPerBooking: "Paid / bookings", dailySearches: "Daily searches",
    dailyHeight: "Height = daily volume", dailyVolumesAria: "Daily search volumes", privacyTitle: "Privacy by design",
    privacyDescription: "Searches are stored only as aggregated daily counters. Other volumes come directly from canonical business tables.",
    privacyUserIds: "No user identifiers in search counters.", privacySearchText: "No search text or city is stored.",
    privacyIp: "No IP address or browser identifier is stored.", ratiosTitle: "How to read the ratios",
    ratiosDescription: "Ratios compare volumes over the selected period, not user cohorts. They can include actions that started before the window.",
    bookingPerQuote: "Bookings / quotes",
  },
  nl: {
    backFounder: "Founder-console", badge: "Privé-analytics", title: "KLYX-productfunnel",
    description: "Productvolumes voor de lancering zonder browsertracking en zonder zoekopdrachten, steden, IP-adressen of gebruikers-ID's op te slaan.",
    windowAria: "Analyticsperiode", days: "dagen", loading: "Laden", loadError: "Founder-analytics zijn niet beschikbaar.",
    newClients: "Nieuwe klantprofielen", providerSearches: "Zoekopdrachten naar dienstverleners", quoteRequests: "Offerteaanvragen",
    bookingsCreated: "Aangemaakte boekingen", paidBookings: "Betaalde boekingen", searchesWithResults: "Zoekopdrachten met resultaat",
    quotePerSearch: "Offertes / zoekopdrachten", paidPerBooking: "Betaald / boekingen", dailySearches: "Dagelijkse zoekopdrachten",
    dailyHeight: "Hoogte = dagelijks volume", dailyVolumesAria: "Dagelijkse zoekvolumes", privacyTitle: "Privacy by design",
    privacyDescription: "Zoekopdrachten worden alleen als geaggregeerde dagelijkse tellers bewaard. Andere volumes komen rechtstreeks uit canonieke bedrijfstabellen.",
    privacyUserIds: "Geen gebruikers-ID's in zoektellers.", privacySearchText: "Geen zoektekst of stad wordt opgeslagen.",
    privacyIp: "Geen IP-adres of browser-ID wordt opgeslagen.", ratiosTitle: "Ratio's correct lezen",
    ratiosDescription: "Ratio's vergelijken volumes binnen de gekozen periode, niet gebruikerscohorten. Ze kunnen acties bevatten die vóór de periode begonnen.",
    bookingPerQuote: "Boekingen / offertes",
  },
  de: {
    backFounder: "Founder-Konsole", badge: "Private Analytics", title: "KLYX Produkt-Funnel",
    description: "Produktvolumen für den Launch ohne Browser-Tracking und ohne Suchanfragen, Städte, IP-Adressen oder Benutzerkennungen zu speichern.",
    windowAria: "Analytics-Zeitraum", days: "Tage", loading: "Laden", loadError: "Founder Analytics sind nicht verfügbar.",
    newClients: "Neue Kundenprofile", providerSearches: "Anbietersuchen", quoteRequests: "Angebotsanfragen",
    bookingsCreated: "Erstellte Buchungen", paidBookings: "Bezahlte Buchungen", searchesWithResults: "Suchen mit Ergebnis",
    quotePerSearch: "Angebote / Suchen", paidPerBooking: "Bezahlt / Buchungen", dailySearches: "Tägliche Suchen",
    dailyHeight: "Höhe = Tagesvolumen", dailyVolumesAria: "Tägliche Suchvolumen", privacyTitle: "Privacy by design",
    privacyDescription: "Suchen werden nur als aggregierte Tageszähler gespeichert. Andere Volumen stammen direkt aus kanonischen Geschäftstabellen.",
    privacyUserIds: "Keine Benutzerkennungen in Suchzählern.", privacySearchText: "Kein Suchtext und keine Stadt werden gespeichert.",
    privacyIp: "Keine IP-Adresse oder Browserkennung wird gespeichert.", ratiosTitle: "Ratios richtig lesen",
    ratiosDescription: "Ratios vergleichen Volumen im gewählten Zeitraum, nicht Benutzerkohorten. Sie können Aktionen enthalten, die vor dem Zeitraum begonnen haben.",
    bookingPerQuote: "Buchungen / Angebote",
  },
};

const INTL: Record<KlyxFounderAnalyticsLocale, string> = {
  fr: "fr-BE", en: "en-BE", nl: "nl-BE", de: "de-BE",
};
const LOCALE_SET = new Set<string>(KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES);

export function resolveKlyxFounderAnalyticsLocale(locale: KlyxLocale): KlyxFounderAnalyticsLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderAnalyticsLocale) : "fr";
}
export function getKlyxFounderAnalyticsDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderAnalyticsLocale(locale)];
}
export function translateKlyxFounderAnalytics(locale: KlyxLocale, key: KlyxFounderAnalyticsMessageKey) {
  return getKlyxFounderAnalyticsDictionary(locale)[key];
}
export function getKlyxFounderAnalyticsIntlLocale(locale: KlyxLocale) {
  return INTL[resolveKlyxFounderAnalyticsLocale(locale)];
}
export function formatKlyxFounderAnalyticsNumber(locale: KlyxLocale, value: number) {
  return value.toLocaleString(getKlyxFounderAnalyticsIntlLocale(locale));
}
export function formatKlyxFounderAnalyticsPercent(locale: KlyxLocale, value: number | null) {
  return value == null ? "—" : `${value.toLocaleString(getKlyxFounderAnalyticsIntlLocale(locale))}%`;
}
export function formatKlyxFounderAnalyticsDate(locale: KlyxLocale, value: string) {
  return new Intl.DateTimeFormat(getKlyxFounderAnalyticsIntlLocale(locale), {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}
