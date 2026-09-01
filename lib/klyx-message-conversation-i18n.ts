import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxMessageConversationLocale =
  (typeof KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES)[number];

export const KLYX_MESSAGE_CONVERSATION_MESSAGE_KEYS = [
  "unknownUser",
  "conversationNotFound",
  "bookingNotFound",
  "accessDenied",
  "loadError",
  "rateLimited",
  "sendError",
  "loading",
  "unavailableTitle",
  "backMessagesFull",
  "back",
  "empty",
  "read",
  "sent",
  "placeholder",
  "sending",
  "send",
] as const;

export type KlyxMessageConversationMessageKey =
  (typeof KLYX_MESSAGE_CONVERSATION_MESSAGE_KEYS)[number];

type MessageConversationDictionary = Record<
  KlyxMessageConversationMessageKey,
  string
>;

const MESSAGE_CONVERSATION_MESSAGES: Record<
  KlyxMessageConversationLocale,
  MessageConversationDictionary
> = {
  fr: {
    unknownUser: "Utilisateur KLYX",
    conversationNotFound: "Conversation introuvable.",
    bookingNotFound: "Réservation introuvable.",
    accessDenied: "Tu n'as pas accès à cette conversation.",
    loadError: "Impossible de charger la conversation.",
    rateLimited: "Trop de messages envoyés. Réessaie dans une minute.",
    sendError: "Impossible d'envoyer le message.",
    loading: "Chargement...",
    unavailableTitle: "Conversation indisponible",
    backMessagesFull: "Retour aux messages",
    back: "Retour",
    empty: "Aucun message. Commence la conversation.",
    read: "Lu",
    sent: "Envoyé",
    placeholder: "Écris un message...",
    sending: "Envoi...",
    send: "Envoyer",
  },
  en: {
    unknownUser: "KLYX user",
    conversationNotFound: "Conversation not found.",
    bookingNotFound: "Booking not found.",
    accessDenied: "You do not have access to this conversation.",
    loadError: "Unable to load the conversation.",
    rateLimited: "Too many messages sent. Try again in one minute.",
    sendError: "Unable to send the message.",
    loading: "Loading...",
    unavailableTitle: "Conversation unavailable",
    backMessagesFull: "Back to messages",
    back: "Back",
    empty: "No messages yet. Start the conversation.",
    read: "Read",
    sent: "Sent",
    placeholder: "Write a message...",
    sending: "Sending...",
    send: "Send",
  },
  nl: {
    unknownUser: "KLYX-gebruiker",
    conversationNotFound: "Gesprek niet gevonden.",
    bookingNotFound: "Reservering niet gevonden.",
    accessDenied: "Je hebt geen toegang tot dit gesprek.",
    loadError: "Het gesprek kan niet worden geladen.",
    rateLimited: "Te veel berichten verzonden. Probeer het over één minuut opnieuw.",
    sendError: "Het bericht kan niet worden verzonden.",
    loading: "Laden...",
    unavailableTitle: "Gesprek niet beschikbaar",
    backMessagesFull: "Terug naar berichten",
    back: "Terug",
    empty: "Nog geen berichten. Start het gesprek.",
    read: "Gelezen",
    sent: "Verzonden",
    placeholder: "Schrijf een bericht...",
    sending: "Verzenden...",
    send: "Verzenden",
  },
  de: {
    unknownUser: "KLYX-Nutzer",
    conversationNotFound: "Unterhaltung nicht gefunden.",
    bookingNotFound: "Buchung nicht gefunden.",
    accessDenied: "Du hast keinen Zugriff auf diese Unterhaltung.",
    loadError: "Die Unterhaltung kann nicht geladen werden.",
    rateLimited: "Zu viele Nachrichten gesendet. Versuche es in einer Minute erneut.",
    sendError: "Die Nachricht kann nicht gesendet werden.",
    loading: "Wird geladen...",
    unavailableTitle: "Unterhaltung nicht verfügbar",
    backMessagesFull: "Zurück zu Nachrichten",
    back: "Zurück",
    empty: "Noch keine Nachrichten. Starte die Unterhaltung.",
    read: "Gelesen",
    sent: "Gesendet",
    placeholder: "Nachricht schreiben...",
    sending: "Wird gesendet...",
    send: "Senden",
  },
};

const MESSAGE_CONVERSATION_LOCALE_SET = new Set<string>(
  KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES
);

const MESSAGE_CONVERSATION_LOCALE_TAGS: Record<
  KlyxMessageConversationLocale,
  string
> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
};

export function hasKlyxMessageConversationTranslation(locale: KlyxLocale) {
  return MESSAGE_CONVERSATION_LOCALE_SET.has(locale);
}

export function resolveKlyxMessageConversationLocale(
  locale: KlyxLocale
): KlyxMessageConversationLocale {
  return hasKlyxMessageConversationTranslation(locale)
    ? (locale as KlyxMessageConversationLocale)
    : "fr";
}

export function getKlyxMessageConversationDictionary(locale: KlyxLocale) {
  return MESSAGE_CONVERSATION_MESSAGES[
    resolveKlyxMessageConversationLocale(locale)
  ];
}

export function translateKlyxMessageConversation(
  locale: KlyxLocale,
  key: KlyxMessageConversationMessageKey
) {
  return getKlyxMessageConversationDictionary(locale)[key];
}

export function getKlyxMessageConversationLocaleTag(locale: KlyxLocale) {
  return MESSAGE_CONVERSATION_LOCALE_TAGS[
    resolveKlyxMessageConversationLocale(locale)
  ];
}
