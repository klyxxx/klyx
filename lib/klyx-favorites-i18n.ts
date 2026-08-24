import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FAVORITES_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxFavoritesLocale = (typeof KLYX_FAVORITES_TRANSLATED_LOCALES)[number];

export const KLYX_FAVORITES_MESSAGE_KEYS = [
  "loadError",
  "loading",
  "backToSearch",
  "title",
  "description",
  "findService",
  "emptyTitle",
  "emptyText",
  "providerFallback",
  "serviceFallback",
  "cityFallback",
  "priceToConfirm",
  "fixedRateSuffix",
  "hourSuffix",
  "viewProfile",
  "removeFavorite",
  "addFavorite",
  "updating",
] as const;

export type KlyxFavoritesMessageKey = (typeof KLYX_FAVORITES_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxFavoritesMessageKey, string>;

const MESSAGES: Record<KlyxFavoritesLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les favoris pour le moment.",
    loading: "Chargement des favoris...",
    backToSearch: "Retour à la recherche",
    title: "Mes favoris",
    description: "Retrouve ici tous les prestataires et services que tu as enregistrés.",
    findService: "Trouver un service",
    emptyTitle: "Aucun favori pour le moment",
    emptyText: "Explore les services KLYX et ajoute les prestataires qui t’intéressent.",
    providerFallback: "Prestataire KLYX",
    serviceFallback: "Service KLYX",
    cityFallback: "Zone à confirmer",
    priceToConfirm: "Prix à confirmer",
    fixedRateSuffix: "forfait",
    hourSuffix: "h",
    viewProfile: "Voir le profil",
    removeFavorite: "Retirer des favoris",
    addFavorite: "Ajouter aux favoris",
    updating: "Mise à jour...",
  },
  en: {
    loadError: "Favorites are currently unavailable.",
    loading: "Loading favorites...",
    backToSearch: "Back to search",
    title: "My favorites",
    description: "Find all the providers and services you have saved here.",
    findService: "Find a service",
    emptyTitle: "No favorites yet",
    emptyText: "Explore KLYX services and save the providers you are interested in.",
    providerFallback: "KLYX provider",
    serviceFallback: "KLYX service",
    cityFallback: "Area to confirm",
    priceToConfirm: "Price to confirm",
    fixedRateSuffix: "flat rate",
    hourSuffix: "h",
    viewProfile: "View profile",
    removeFavorite: "Remove from favorites",
    addFavorite: "Add to favorites",
    updating: "Updating...",
  },
  nl: {
    loadError: "Favorieten zijn momenteel niet beschikbaar.",
    loading: "Favorieten laden...",
    backToSearch: "Terug naar zoeken",
    title: "Mijn favorieten",
    description: "Hier vind je alle dienstverleners en diensten die je hebt opgeslagen.",
    findService: "Een dienst vinden",
    emptyTitle: "Nog geen favorieten",
    emptyText: "Ontdek KLYX-diensten en bewaar de dienstverleners die je interesseren.",
    providerFallback: "KLYX-dienstverlener",
    serviceFallback: "KLYX-dienst",
    cityFallback: "Regio te bevestigen",
    priceToConfirm: "Prijs te bevestigen",
    fixedRateSuffix: "vast tarief",
    hourSuffix: "u",
    viewProfile: "Profiel bekijken",
    removeFavorite: "Uit favorieten verwijderen",
    addFavorite: "Aan favorieten toevoegen",
    updating: "Bijwerken...",
  },
  de: {
    loadError: "Favoriten sind derzeit nicht verfügbar.",
    loading: "Favoriten werden geladen...",
    backToSearch: "Zurück zur Suche",
    title: "Meine Favoriten",
    description: "Hier findest du alle gespeicherten Dienstleister und Dienstleistungen.",
    findService: "Dienst finden",
    emptyTitle: "Noch keine Favoriten",
    emptyText: "Entdecke KLYX-Dienste und speichere interessante Dienstleister.",
    providerFallback: "KLYX-Dienstleister",
    serviceFallback: "KLYX-Dienst",
    cityFallback: "Gebiet zu bestätigen",
    priceToConfirm: "Preis zu bestätigen",
    fixedRateSuffix: "Pauschale",
    hourSuffix: "Std.",
    viewProfile: "Profil ansehen",
    removeFavorite: "Aus Favoriten entfernen",
    addFavorite: "Zu Favoriten hinzufügen",
    updating: "Wird aktualisiert...",
  },
};

const INTL_LOCALES: Record<KlyxFavoritesLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

const LOCALE_SET = new Set<string>(KLYX_FAVORITES_TRANSLATED_LOCALES);

export function hasKlyxFavoritesTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxFavoritesLocale(locale: KlyxLocale): KlyxFavoritesLocale {
  return hasKlyxFavoritesTranslation(locale) ? (locale as KlyxFavoritesLocale) : "fr";
}

export function getKlyxFavoritesDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFavoritesLocale(locale)];
}

export function translateKlyxFavorites(locale: KlyxLocale, key: KlyxFavoritesMessageKey) {
  return getKlyxFavoritesDictionary(locale)[key];
}

export function formatKlyxFavoritePrice(
  locale: KlyxLocale,
  price: number | null,
  pricingType: "hourly" | "fixed"
) {
  const resolved = resolveKlyxFavoritesLocale(locale);
  const dictionary = MESSAGES[resolved];

  if (price === null || !Number.isFinite(price)) {
    return dictionary.priceToConfirm;
  }

  const amount = new Intl.NumberFormat(INTL_LOCALES[resolved], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

  return pricingType === "fixed"
    ? `${amount} · ${dictionary.fixedRateSuffix}`
    : `${amount}/${dictionary.hourSuffix}`;
}
