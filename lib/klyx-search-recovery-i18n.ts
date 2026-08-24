import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SEARCH_RECOVERY_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSearchRecoveryLocale =
  (typeof KLYX_SEARCH_RECOVERY_TRANSLATED_LOCALES)[number];

export const KLYX_SEARCH_RECOVERY_MESSAGE_KEYS = [
  "eyebrow",
  "title",
  "description",
  "raiseBudgetTitle",
  "raiseBudgetDescription",
  "removeBudgetTitle",
  "removeBudgetDescription",
  "removeTimeTitle",
  "removeTimeDescription",
  "removeDateTitle",
  "removeDateDescription",
  "shorterDurationTitle",
  "shorterDurationDescription",
  "removePricingTitle",
  "removePricingDescription",
  "removeCityTitle",
  "removeCityDescription",
  "showAllTitle",
  "showAllDescription",
] as const;

export type KlyxSearchRecoveryMessageKey =
  (typeof KLYX_SEARCH_RECOVERY_MESSAGE_KEYS)[number];

type SearchRecoveryDictionary = Record<KlyxSearchRecoveryMessageKey, string>;

const SEARCH_RECOVERY_MESSAGES: Record<
  KlyxSearchRecoveryLocale,
  SearchRecoveryDictionary
> = {
  fr: {
    eyebrow: "KLYX peut adapter la recherche",
    title: "Essaie une de ces corrections",
    description:
      "Rien n’est modifié automatiquement. Tu choisis toi-même l’adaptation à appliquer.",
    raiseBudgetTitle: "Augmenter le budget à {amount} €",
    raiseBudgetDescription:
      "C’est le budget minimum estimé parmi les alternatives actuellement trouvées.",
    removeBudgetTitle: "Retirer temporairement le budget maximum",
    removeBudgetDescription:
      "KLYX gardera les prix visibles pour que tu puisses comparer avant de réserver.",
    removeTimeTitle: "Chercher toute la journée",
    removeTimeDescription:
      "Conserve la date mais affiche aussi les prestataires disponibles à d’autres heures.",
    removeDateTitle: "Retirer la date précise",
    removeDateDescription:
      "Affiche les prestataires du service sans imposer un jour particulier.",
    shorterDurationTitle: "Tester un créneau d’1 heure",
    shorterDurationDescription:
      "Un créneau plus court peut faire apparaître davantage de prestataires disponibles.",
    removePricingTitle: "Accepter tous les types de tarifs",
    removePricingDescription:
      "Inclut les prestataires au forfait et au tarif horaire.",
    removeCityTitle: "Élargir à toutes les zones",
    removeCityDescription:
      "Utile si aucun prestataire n’est encore publié dans la zone saisie.",
    showAllTitle: "Voir tous les prestataires de ce service",
    showAllDescription:
      "Conserve seulement le service demandé et retire les contraintes commerciales.",
  },
  en: {
    eyebrow: "KLYX can adapt the search",
    title: "Try one of these adjustments",
    description:
      "Nothing is changed automatically. You choose the adjustment you want to apply.",
    raiseBudgetTitle: "Raise the budget to {amount} €",
    raiseBudgetDescription:
      "This is the lowest estimated budget among the alternatives currently found.",
    removeBudgetTitle: "Temporarily remove the maximum budget",
    removeBudgetDescription:
      "KLYX will keep prices visible so you can compare before booking.",
    removeTimeTitle: "Search the whole day",
    removeTimeDescription:
      "Keep the date while also showing providers available at other times.",
    removeDateTitle: "Remove the exact date",
    removeDateDescription:
      "Show providers for this service without requiring a particular day.",
    shorterDurationTitle: "Try a 1-hour slot",
    shorterDurationDescription:
      "A shorter slot can reveal more available providers.",
    removePricingTitle: "Allow all pricing types",
    removePricingDescription:
      "Include providers with fixed-price and hourly pricing.",
    removeCityTitle: "Expand to all areas",
    removeCityDescription:
      "Useful when no provider has been published yet in the entered area.",
    showAllTitle: "See all providers for this service",
    showAllDescription:
      "Keep only the requested service and remove the commercial constraints.",
  },
  nl: {
    eyebrow: "KLYX kan de zoekopdracht aanpassen",
    title: "Probeer een van deze aanpassingen",
    description:
      "Niets wordt automatisch gewijzigd. Jij kiest zelf welke aanpassing je toepast.",
    raiseBudgetTitle: "Verhoog het budget naar {amount} €",
    raiseBudgetDescription:
      "Dit is het laagste geschatte budget van de alternatieven die momenteel zijn gevonden.",
    removeBudgetTitle: "Verwijder tijdelijk het maximumbudget",
    removeBudgetDescription:
      "KLYX houdt de prijzen zichtbaar zodat je kunt vergelijken voordat je boekt.",
    removeTimeTitle: "Zoek de hele dag",
    removeTimeDescription:
      "Behoud de datum en toon ook dienstverleners die op andere uren beschikbaar zijn.",
    removeDateTitle: "Verwijder de exacte datum",
    removeDateDescription:
      "Toon dienstverleners voor deze service zonder een specifieke dag op te leggen.",
    shorterDurationTitle: "Probeer een tijdslot van 1 uur",
    shorterDurationDescription:
      "Een korter tijdslot kan meer beschikbare dienstverleners tonen.",
    removePricingTitle: "Sta alle tarieftypes toe",
    removePricingDescription:
      "Neem dienstverleners met een vaste prijs en een uurtarief mee.",
    removeCityTitle: "Breid uit naar alle zones",
    removeCityDescription:
      "Handig als er nog geen dienstverlener in de ingevoerde zone is gepubliceerd.",
    showAllTitle: "Bekijk alle dienstverleners voor deze service",
    showAllDescription:
      "Behoud alleen de gevraagde service en verwijder de commerciële beperkingen.",
  },
  de: {
    eyebrow: "KLYX kann die Suche anpassen",
    title: "Probiere eine dieser Anpassungen",
    description:
      "Nichts wird automatisch geändert. Du wählst selbst aus, welche Anpassung angewendet wird.",
    raiseBudgetTitle: "Budget auf {amount} € erhöhen",
    raiseBudgetDescription:
      "Dies ist das niedrigste geschätzte Budget unter den aktuell gefundenen Alternativen.",
    removeBudgetTitle: "Maximalbudget vorübergehend entfernen",
    removeBudgetDescription:
      "KLYX lässt die Preise sichtbar, damit du vor der Buchung vergleichen kannst.",
    removeTimeTitle: "Den ganzen Tag durchsuchen",
    removeTimeDescription:
      "Das Datum bleibt erhalten und zusätzlich werden Dienstleister zu anderen Uhrzeiten angezeigt.",
    removeDateTitle: "Genaues Datum entfernen",
    removeDateDescription:
      "Zeigt Dienstleister für diesen Service, ohne einen bestimmten Tag vorzugeben.",
    shorterDurationTitle: "Ein 1-Stunden-Zeitfenster testen",
    shorterDurationDescription:
      "Ein kürzeres Zeitfenster kann mehr verfügbare Dienstleister anzeigen.",
    removePricingTitle: "Alle Tarifarten zulassen",
    removePricingDescription:
      "Bezieht Dienstleister mit Festpreis und Stundentarif ein.",
    removeCityTitle: "Auf alle Gebiete erweitern",
    removeCityDescription:
      "Hilfreich, wenn im eingegebenen Gebiet noch kein Dienstleister veröffentlicht wurde.",
    showAllTitle: "Alle Dienstleister für diesen Service anzeigen",
    showAllDescription:
      "Behält nur den gewünschten Service bei und entfernt die kommerziellen Einschränkungen.",
  },
};

const SEARCH_RECOVERY_LOCALE_SET = new Set<string>(
  KLYX_SEARCH_RECOVERY_TRANSLATED_LOCALES
);

export function resolveKlyxSearchRecoveryLocale(
  locale: KlyxLocale
): KlyxSearchRecoveryLocale {
  return SEARCH_RECOVERY_LOCALE_SET.has(locale)
    ? (locale as KlyxSearchRecoveryLocale)
    : "fr";
}

export function getKlyxSearchRecoveryDictionary(locale: KlyxLocale) {
  return SEARCH_RECOVERY_MESSAGES[resolveKlyxSearchRecoveryLocale(locale)];
}

export function translateKlyxSearchRecovery(
  locale: KlyxLocale,
  key: KlyxSearchRecoveryMessageKey
) {
  return getKlyxSearchRecoveryDictionary(locale)[key];
}

export function formatKlyxSearchRecoveryRaiseBudgetTitle(
  locale: KlyxLocale,
  amount: number
) {
  return translateKlyxSearchRecovery(locale, "raiseBudgetTitle").replace(
    "{amount}",
    String(amount)
  );
}
