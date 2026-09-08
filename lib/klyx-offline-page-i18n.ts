import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_OFFLINE_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de", "es"] as const;

export type KlyxOfflinePageLocale =
  (typeof KLYX_OFFLINE_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_OFFLINE_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "badge",
  "title",
  "description",
  "safetyInfo",
  "retryOnline",
  "retryOffline",
] as const;

export type KlyxOfflinePageMessageKey =
  (typeof KLYX_OFFLINE_PAGE_MESSAGE_KEYS)[number];

type OfflinePageDictionary = Record<KlyxOfflinePageMessageKey, string>;

const OFFLINE_PAGE_MESSAGES: Record<KlyxOfflinePageLocale, OfflinePageDictionary> = {
  fr: {
    metadataTitle: "KLYX hors ligne",
    metadataDescription: "KLYX est temporairement hors ligne sur cet appareil.",
    badge: "Connexion indisponible",
    title: "KLYX est temporairement hors ligne.",
    description:
      "Vérifie ta connexion Internet puis réessaie. Les paiements, réservations, messages et données personnelles ne sont jamais servis depuis un cache hors ligne.",
    safetyInfo:
      "KLYX garde seulement les ressources visuelles nécessaires à l’application. Les opérations sensibles restent connectées aux serveurs KLYX.",
    retryOnline: "Revenir à KLYX",
    retryOffline: "Réessayer",
  },
  en: {
    metadataTitle: "KLYX offline",
    metadataDescription: "KLYX is temporarily offline on this device.",
    badge: "Connection unavailable",
    title: "KLYX is temporarily offline.",
    description:
      "Check your Internet connection, then try again. Payments, bookings, messages and personal data are never served from an offline cache.",
    safetyInfo:
      "KLYX only keeps the visual resources needed by the application. Sensitive operations remain connected to KLYX servers.",
    retryOnline: "Return to KLYX",
    retryOffline: "Try again",
  },
  nl: {
    metadataTitle: "KLYX offline",
    metadataDescription: "KLYX is tijdelijk offline op dit apparaat.",
    badge: "Verbinding niet beschikbaar",
    title: "KLYX is tijdelijk offline.",
    description:
      "Controleer je internetverbinding en probeer opnieuw. Betalingen, boekingen, berichten en persoonlijke gegevens worden nooit vanuit een offline cache geleverd.",
    safetyInfo:
      "KLYX bewaart alleen de visuele middelen die de toepassing nodig heeft. Gevoelige handelingen blijven verbonden met de KLYX-servers.",
    retryOnline: "Terug naar KLYX",
    retryOffline: "Opnieuw proberen",
  },
  de: {
    metadataTitle: "KLYX offline",
    metadataDescription: "KLYX ist auf diesem Gerät vorübergehend offline.",
    badge: "Verbindung nicht verfügbar",
    title: "KLYX ist vorübergehend offline.",
    description:
      "Prüfe deine Internetverbindung und versuche es erneut. Zahlungen, Buchungen, Nachrichten und personenbezogene Daten werden niemals aus einem Offline-Cache bereitgestellt.",
    safetyInfo:
      "KLYX speichert nur die visuellen Ressourcen, die die Anwendung benötigt. Sensible Vorgänge bleiben mit den KLYX-Servern verbunden.",
    retryOnline: "Zurück zu KLYX",
    retryOffline: "Erneut versuchen",
  },
  es: {
    metadataTitle: "KLYX sin conexión",
    metadataDescription: "KLYX está temporalmente sin conexión en este dispositivo.",
    badge: "Conexión no disponible",
    title: "KLYX está temporalmente sin conexión.",
    description:
      "Comprueba tu conexión a Internet y vuelve a intentarlo. Los pagos, las reservas, los mensajes y los datos personales nunca se sirven desde una caché sin conexión.",
    safetyInfo:
      "KLYX solo conserva los recursos visuales necesarios para la aplicación. Las operaciones sensibles permanecen conectadas a los servidores de KLYX.",
    retryOnline: "Volver a KLYX",
    retryOffline: "Volver a intentarlo",
  },
};

const OFFLINE_PAGE_LOCALE_SET = new Set<string>(KLYX_OFFLINE_PAGE_TRANSLATED_LOCALES);

export function hasKlyxOfflinePageTranslation(locale: KlyxLocale) {
  return OFFLINE_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxOfflinePageLocale(locale: KlyxLocale): KlyxOfflinePageLocale {
  return hasKlyxOfflinePageTranslation(locale)
    ? (locale as KlyxOfflinePageLocale)
    : "fr";
}

export function getKlyxOfflinePageDictionary(locale: KlyxLocale) {
  return OFFLINE_PAGE_MESSAGES[resolveKlyxOfflinePageLocale(locale)];
}

export function translateKlyxOfflinePage(
  locale: KlyxLocale,
  key: KlyxOfflinePageMessageKey
) {
  return getKlyxOfflinePageDictionary(locale)[key];
}
