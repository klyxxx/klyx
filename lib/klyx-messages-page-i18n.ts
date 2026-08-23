import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxMessagesPageLocale =
  (typeof KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_MESSAGES_PAGE_MESSAGE_KEYS = [
  "backDashboard",
  "title",
  "description",
  "loading",
  "errorTitle",
  "loadError",
  "retry",
  "emptyTitle",
  "emptyDescription",
  "unknownUser",
  "unreadSingle",
  "unreadPlural",
  "youPrefix",
  "openConversation",
] as const;

export type KlyxMessagesPageMessageKey =
  (typeof KLYX_MESSAGES_PAGE_MESSAGE_KEYS)[number];

type MessagesPageDictionary = Record<KlyxMessagesPageMessageKey, string>;

const MESSAGES_PAGE_MESSAGES: Record<
  KlyxMessagesPageLocale,
  MessagesPageDictionary
> = {
  fr: {
    backDashboard: "Tableau de bord",
    title: "Messages",
    description:
      "Retrouve les conversations liées à tes réservations KLYX. Ouvrir une conversation permet de lire et d’envoyer des messages.",
    loading: "Chargement des conversations...",
    errorTitle: "Conversations indisponibles",
    loadError:
      "Impossible de charger les conversations pour le moment. Réessaie dans quelques instants.",
    retry: "Réessayer",
    emptyTitle: "Aucune conversation",
    emptyDescription:
      "Tes conversations apparaîtront ici dès qu’un échange sera associé à une réservation.",
    unknownUser: "Utilisateur KLYX",
    unreadSingle: "non lu",
    unreadPlural: "non lus",
    youPrefix: "Vous :",
    openConversation: "Ouvrir",
  },
  en: {
    backDashboard: "Dashboard",
    title: "Messages",
    description:
      "Find the conversations linked to your KLYX bookings. Opening a conversation lets you read and send messages.",
    loading: "Loading conversations...",
    errorTitle: "Conversations unavailable",
    loadError:
      "Unable to load conversations right now. Please try again in a moment.",
    retry: "Try again",
    emptyTitle: "No conversations",
    emptyDescription:
      "Your conversations will appear here as soon as an exchange is linked to a booking.",
    unknownUser: "KLYX user",
    unreadSingle: "unread",
    unreadPlural: "unread",
    youPrefix: "You:",
    openConversation: "Open",
  },
  nl: {
    backDashboard: "Dashboard",
    title: "Berichten",
    description:
      "Bekijk de gesprekken die aan je KLYX-reserveringen zijn gekoppeld. Door een gesprek te openen kun je berichten lezen en versturen.",
    loading: "Gesprekken laden...",
    errorTitle: "Gesprekken niet beschikbaar",
    loadError:
      "De gesprekken kunnen momenteel niet worden geladen. Probeer het over enkele ogenblikken opnieuw.",
    retry: "Opnieuw proberen",
    emptyTitle: "Geen gesprekken",
    emptyDescription:
      "Je gesprekken verschijnen hier zodra een uitwisseling aan een reservering is gekoppeld.",
    unknownUser: "KLYX-gebruiker",
    unreadSingle: "ongelezen",
    unreadPlural: "ongelezen",
    youPrefix: "Jij:",
    openConversation: "Openen",
  },
  de: {
    backDashboard: "Dashboard",
    title: "Nachrichten",
    description:
      "Hier findest du die Unterhaltungen zu deinen KLYX-Buchungen. Wenn du eine Unterhaltung öffnest, kannst du Nachrichten lesen und senden.",
    loading: "Unterhaltungen werden geladen...",
    errorTitle: "Unterhaltungen nicht verfügbar",
    loadError:
      "Die Unterhaltungen können derzeit nicht geladen werden. Versuche es gleich noch einmal.",
    retry: "Erneut versuchen",
    emptyTitle: "Keine Unterhaltungen",
    emptyDescription:
      "Deine Unterhaltungen erscheinen hier, sobald ein Austausch mit einer Buchung verknüpft ist.",
    unknownUser: "KLYX-Nutzer",
    unreadSingle: "ungelesen",
    unreadPlural: "ungelesen",
    youPrefix: "Du:",
    openConversation: "Öffnen",
  },
};

const MESSAGES_PAGE_LOCALE_SET = new Set<string>(
  KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxMessagesPageTranslation(locale: KlyxLocale) {
  return MESSAGES_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxMessagesPageLocale(
  locale: KlyxLocale
): KlyxMessagesPageLocale {
  return hasKlyxMessagesPageTranslation(locale)
    ? (locale as KlyxMessagesPageLocale)
    : "fr";
}

export function getKlyxMessagesPageDictionary(locale: KlyxLocale) {
  return MESSAGES_PAGE_MESSAGES[resolveKlyxMessagesPageLocale(locale)];
}

export function translateKlyxMessagesPage(
  locale: KlyxLocale,
  key: KlyxMessagesPageMessageKey
) {
  return getKlyxMessagesPageDictionary(locale)[key];
}
