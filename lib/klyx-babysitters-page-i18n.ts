import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_BABYSITTERS_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxBabysittersPageLocale =
  (typeof KLYX_BABYSITTERS_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_BABYSITTERS_PAGE_MESSAGE_KEYS = [
  "modifyRequest",
  "title",
  "intro",
  "newSearch",
  "city",
  "date",
  "time",
  "budget",
  "allFeminine",
  "allMasculine",
  "rankingLoading",
  "loadError",
  "noExactTitle",
  "noExactDescription",
  "noProfilesTitle",
  "noProfilesDescription",
  "modifyRequestButton",
  "rankedByScore",
  "recommendedByKlyx",
  "babysitter",
  "fallbackName",
  "cityMissing",
  "cancellationRate",
  "pricePending",
  "viewProfile",
  "suspenseLoading",
  "scoreExcellent",
  "scoreVeryReliable",
  "scoreReliable",
  "scoreFair",
  "scoreNew",
] as const;

export type KlyxBabysittersPageMessageKey =
  (typeof KLYX_BABYSITTERS_PAGE_MESSAGE_KEYS)[number];

type BabysittersPageDictionary = Record<
  KlyxBabysittersPageMessageKey,
  string
>;

const BABYSITTERS_PAGE_MESSAGES: Record<
  KlyxBabysittersPageLocale,
  BabysittersPageDictionary
> = {
  fr: {
    modifyRequest: "Modifier ma demande",
    title: "Baby-sitters recommandées",
    intro:
      "KLYX compare la disponibilité, le prix, la ville et le score de confiance.",
    newSearch: "Nouvelle recherche",
    city: "Ville",
    date: "Date",
    time: "Heure",
    budget: "Budget",
    allFeminine: "Toutes",
    allMasculine: "Tous",
    rankingLoading: "KLYX classe les meilleurs profils...",
    loadError: "Impossible de charger les baby-sitters.",
    noExactTitle: "Aucun profil ne correspond à tous les critères.",
    noExactDescription:
      "KLYX affiche les profils les plus proches de ta demande, classés par pertinence et score de confiance.",
    noProfilesTitle: "Aucun profil disponible",
    noProfilesDescription:
      "Aucun prestataire actif n’est actuellement disponible.",
    modifyRequestButton: "Modifier la demande",
    rankedByScore: "Classés par score KLYX",
    recommendedByKlyx: "Recommandé par KLYX",
    babysitter: "Baby-sitter",
    fallbackName: "Baby-sitter KLYX",
    cityMissing: "Ville non renseignée",
    cancellationRate: "Taux d’annulation",
    pricePending: "Prix à confirmer",
    viewProfile: "Voir le profil",
    suspenseLoading: "Chargement...",
    scoreExcellent: "Excellent",
    scoreVeryReliable: "Très fiable",
    scoreReliable: "Fiable",
    scoreFair: "Correct",
    scoreNew: "Nouveau profil",
  },
  en: {
    modifyRequest: "Edit my request",
    title: "Recommended babysitters",
    intro:
      "KLYX compares availability, price, city and trust score.",
    newSearch: "New search",
    city: "City",
    date: "Date",
    time: "Time",
    budget: "Budget",
    allFeminine: "All",
    allMasculine: "All",
    rankingLoading: "KLYX is ranking the best profiles...",
    loadError: "Unable to load babysitters.",
    noExactTitle: "No profile matches every criterion.",
    noExactDescription:
      "KLYX shows the profiles closest to your request, ranked by relevance and trust score.",
    noProfilesTitle: "No profiles available",
    noProfilesDescription:
      "No active provider is currently available.",
    modifyRequestButton: "Edit request",
    rankedByScore: "Ranked by KLYX score",
    recommendedByKlyx: "Recommended by KLYX",
    babysitter: "Babysitter",
    fallbackName: "KLYX babysitter",
    cityMissing: "City not provided",
    cancellationRate: "Cancellation rate",
    pricePending: "Price to be confirmed",
    viewProfile: "View profile",
    suspenseLoading: "Loading...",
    scoreExcellent: "Excellent",
    scoreVeryReliable: "Very reliable",
    scoreReliable: "Reliable",
    scoreFair: "Fair",
    scoreNew: "New profile",
  },
  nl: {
    modifyRequest: "Mijn aanvraag wijzigen",
    title: "Aanbevolen babysitters",
    intro:
      "KLYX vergelijkt beschikbaarheid, prijs, stad en vertrouwensscore.",
    newSearch: "Nieuwe zoekopdracht",
    city: "Stad",
    date: "Datum",
    time: "Tijd",
    budget: "Budget",
    allFeminine: "Alle",
    allMasculine: "Alle",
    rankingLoading: "KLYX rangschikt de beste profielen...",
    loadError: "De babysitters kunnen niet worden geladen.",
    noExactTitle: "Geen enkel profiel voldoet aan alle criteria.",
    noExactDescription:
      "KLYX toont de profielen die het dichtst bij je aanvraag liggen, gerangschikt op relevantie en vertrouwensscore.",
    noProfilesTitle: "Geen profielen beschikbaar",
    noProfilesDescription:
      "Er is momenteel geen actieve dienstverlener beschikbaar.",
    modifyRequestButton: "Aanvraag wijzigen",
    rankedByScore: "Gerangschikt op KLYX-score",
    recommendedByKlyx: "Aanbevolen door KLYX",
    babysitter: "Babysitter",
    fallbackName: "KLYX-babysitter",
    cityMissing: "Stad niet ingevuld",
    cancellationRate: "Annuleringspercentage",
    pricePending: "Prijs nog te bevestigen",
    viewProfile: "Profiel bekijken",
    suspenseLoading: "Laden...",
    scoreExcellent: "Uitstekend",
    scoreVeryReliable: "Zeer betrouwbaar",
    scoreReliable: "Betrouwbaar",
    scoreFair: "Goed",
    scoreNew: "Nieuw profiel",
  },
  de: {
    modifyRequest: "Meine Anfrage ändern",
    title: "Empfohlene Babysitter",
    intro:
      "KLYX vergleicht Verfügbarkeit, Preis, Stadt und Vertrauenswert.",
    newSearch: "Neue Suche",
    city: "Stadt",
    date: "Datum",
    time: "Uhrzeit",
    budget: "Budget",
    allFeminine: "Alle",
    allMasculine: "Alle",
    rankingLoading: "KLYX ordnet die besten Profile...",
    loadError: "Babysitter konnten nicht geladen werden.",
    noExactTitle: "Kein Profil erfüllt alle Kriterien.",
    noExactDescription:
      "KLYX zeigt die Profile, die deiner Anfrage am nächsten kommen, sortiert nach Relevanz und Vertrauenswert.",
    noProfilesTitle: "Keine Profile verfügbar",
    noProfilesDescription:
      "Derzeit ist kein aktiver Dienstleister verfügbar.",
    modifyRequestButton: "Anfrage ändern",
    rankedByScore: "Nach KLYX-Score sortiert",
    recommendedByKlyx: "Von KLYX empfohlen",
    babysitter: "Babysitter",
    fallbackName: "KLYX-Babysitter",
    cityMissing: "Stadt nicht angegeben",
    cancellationRate: "Stornierungsrate",
    pricePending: "Preis noch zu bestätigen",
    viewProfile: "Profil ansehen",
    suspenseLoading: "Wird geladen...",
    scoreExcellent: "Ausgezeichnet",
    scoreVeryReliable: "Sehr zuverlässig",
    scoreReliable: "Zuverlässig",
    scoreFair: "Solide",
    scoreNew: "Neues Profil",
  },
};

const BABYSITTERS_PAGE_LOCALE_SET = new Set<string>(
  KLYX_BABYSITTERS_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxBabysittersPageTranslation(locale: KlyxLocale) {
  return BABYSITTERS_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxBabysittersPageLocale(
  locale: KlyxLocale
): KlyxBabysittersPageLocale {
  return hasKlyxBabysittersPageTranslation(locale)
    ? (locale as KlyxBabysittersPageLocale)
    : "fr";
}

export function getKlyxBabysittersPageDictionary(locale: KlyxLocale) {
  return BABYSITTERS_PAGE_MESSAGES[resolveKlyxBabysittersPageLocale(locale)];
}

export function translateKlyxBabysittersPage(
  locale: KlyxLocale,
  key: KlyxBabysittersPageMessageKey
) {
  return getKlyxBabysittersPageDictionary(locale)[key];
}

export function formatKlyxBabysittersBudgetMax(
  locale: KlyxLocale,
  budget: number
) {
  const amount = budget.toFixed(2);

  switch (resolveKlyxBabysittersPageLocale(locale)) {
    case "en":
      return `max €${amount}/h`;
    case "nl":
      return `max. €${amount}/u`;
    case "de":
      return `max. ${amount} €/Std.`;
    default:
      return `${amount} €/h max`;
  }
}

export function formatKlyxBabysittersDisplayedProfiles(
  locale: KlyxLocale,
  count: number
) {
  switch (resolveKlyxBabysittersPageLocale(locale)) {
    case "en":
      return `${count} ${count === 1 ? "profile" : "profiles"} shown`;
    case "nl":
      return `${count} ${count === 1 ? "profiel" : "profielen"} weergegeven`;
    case "de":
      return `${count} ${count === 1 ? "Profil" : "Profile"} angezeigt`;
    default:
      return `${count} ${count === 1 ? "profil affiché" : "profils affichés"}`;
  }
}

export function formatKlyxBabysittersCompletedJobs(
  locale: KlyxLocale,
  count: number
) {
  switch (resolveKlyxBabysittersPageLocale(locale)) {
    case "en":
      return `${count} completed ${count === 1 ? "job" : "jobs"}`;
    case "nl":
      return `${count} ${count === 1 ? "opdracht" : "opdrachten"} voltooid`;
    case "de":
      return `${count} ${count === 1 ? "Auftrag" : "Aufträge"} abgeschlossen`;
    default:
      return `${count} ${count === 1 ? "prestation terminée" : "prestations terminées"}`;
  }
}
