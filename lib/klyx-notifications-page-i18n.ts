import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_NOTIFICATIONS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxNotificationsLocale =
  (typeof KLYX_NOTIFICATIONS_TRANSLATED_LOCALES)[number];

export const KLYX_NOTIFICATIONS_MESSAGE_KEYS = [
  "backDashboard",
  "title",
  "refresh",
  "markAllRead",
  "loadError",
  "actionError",
  "loading",
  "emptyTitle",
  "emptyBody",
] as const;

export type KlyxNotificationsMessageKey =
  (typeof KLYX_NOTIFICATIONS_MESSAGE_KEYS)[number];

type NotificationsDictionary = Record<
  KlyxNotificationsMessageKey,
  string
> & {
  unreadOne: string;
  unreadMany: string;
};

const NOTIFICATIONS_MESSAGES: Record<
  KlyxNotificationsLocale,
  NotificationsDictionary
> = {
  fr: {
    backDashboard: "Retour au tableau de bord",
    title: "Notifications",
    refresh: "Actualiser",
    markAllRead: "Tout marquer comme lu",
    loadError: "Impossible de charger les notifications.",
    actionError: "Impossible de mettre à jour les notifications.",
    loading: "Chargement des notifications...",
    emptyTitle: "Aucune notification",
    emptyBody: "Les changements importants apparaîtront ici.",
    unreadOne: "{count} notification non lue.",
    unreadMany: "{count} notifications non lues.",
  },
  en: {
    backDashboard: "Back to dashboard",
    title: "Notifications",
    refresh: "Refresh",
    markAllRead: "Mark all as read",
    loadError: "Unable to load notifications.",
    actionError: "Unable to update notifications.",
    loading: "Loading notifications...",
    emptyTitle: "No notifications",
    emptyBody: "Important changes will appear here.",
    unreadOne: "{count} unread notification.",
    unreadMany: "{count} unread notifications.",
  },
  nl: {
    backDashboard: "Terug naar dashboard",
    title: "Meldingen",
    refresh: "Vernieuwen",
    markAllRead: "Alles als gelezen markeren",
    loadError: "De meldingen kunnen niet worden geladen.",
    actionError: "De meldingen kunnen niet worden bijgewerkt.",
    loading: "Meldingen laden...",
    emptyTitle: "Geen meldingen",
    emptyBody: "Belangrijke wijzigingen verschijnen hier.",
    unreadOne: "{count} ongelezen melding.",
    unreadMany: "{count} ongelezen meldingen.",
  },
  de: {
    backDashboard: "Zurück zum Dashboard",
    title: "Benachrichtigungen",
    refresh: "Aktualisieren",
    markAllRead: "Alle als gelesen markieren",
    loadError: "Benachrichtigungen können nicht geladen werden.",
    actionError: "Benachrichtigungen können nicht aktualisiert werden.",
    loading: "Benachrichtigungen werden geladen...",
    emptyTitle: "Keine Benachrichtigungen",
    emptyBody: "Wichtige Änderungen werden hier angezeigt.",
    unreadOne: "{count} ungelesene Benachrichtigung.",
    unreadMany: "{count} ungelesene Benachrichtigungen.",
  },
};

const NOTIFICATIONS_LOCALE_SET = new Set<string>(
  KLYX_NOTIFICATIONS_TRANSLATED_LOCALES
);

const NOTIFICATIONS_LOCALE_TAGS: Record<
  KlyxNotificationsLocale,
  string
> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
};

export function hasKlyxNotificationsTranslation(locale: KlyxLocale) {
  return NOTIFICATIONS_LOCALE_SET.has(locale);
}

export function resolveKlyxNotificationsLocale(
  locale: KlyxLocale
): KlyxNotificationsLocale {
  return hasKlyxNotificationsTranslation(locale)
    ? (locale as KlyxNotificationsLocale)
    : "fr";
}

export function getKlyxNotificationsDictionary(locale: KlyxLocale) {
  return NOTIFICATIONS_MESSAGES[resolveKlyxNotificationsLocale(locale)];
}

export function translateKlyxNotifications(
  locale: KlyxLocale,
  key: KlyxNotificationsMessageKey
) {
  return getKlyxNotificationsDictionary(locale)[key];
}

export function formatKlyxNotificationsUnreadSummary(
  locale: KlyxLocale,
  count: number
) {
  const dictionary = getKlyxNotificationsDictionary(locale);
  const template = count === 1 ? dictionary.unreadOne : dictionary.unreadMany;

  return template.replace("{count}", String(count));
}

export function getKlyxNotificationsLocaleTag(locale: KlyxLocale) {
  return NOTIFICATIONS_LOCALE_TAGS[resolveKlyxNotificationsLocale(locale)];
}
