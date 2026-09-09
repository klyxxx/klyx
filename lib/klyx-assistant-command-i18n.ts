import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAssistantCommandLocale =
  (typeof KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES)[number];

export const KLYX_ASSISTANT_COMMAND_MESSAGE_KEYS = [
  "eyebrow",
  "placeholder",
  "followUpPlaceholder",
  "photo",
  "continue",
  "actionsDetected",
  "genericError",
  "invalidMessageError",
  "payloadTooLargeError",
  "rateLimitedError",
  "thinking",
  "readyAnnouncement",
  "conversationLabel",
  "starterSuggestionsLabel",
  "quickRepliesLabel",
  "noPendingAction",
  "publishedRequestTitle",
  "publishedRequestFallbackDescription",
] as const;

export type KlyxAssistantCommandMessageKey =
  (typeof KLYX_ASSISTANT_COMMAND_MESSAGE_KEYS)[number];

export type KlyxAssistantCommandParams = Record<string, string | number>;

type Dictionary = Record<KlyxAssistantCommandMessageKey, string>;

const DICTIONARIES: Record<KlyxAssistantCommandLocale, Dictionary> = {
  fr: {
    eyebrow: "Demande à KLYX",
    placeholder: "De quoi avez-vous besoin ?",
    followUpPlaceholder: "Répondez simplement à KLYX…",
    photo: "Photo",
    continue: "Continuer",
    actionsDetected: "Actions détectées",
    genericError: "KLYX ne peut pas traiter ce message pour le moment. La conversation reste ouverte.",
    invalidMessageError: "Ce message ne peut pas être traité. Modifiez-le puis envoyez-le à nouveau si nécessaire.",
    payloadTooLargeError: "Ce message est trop volumineux. Raccourcissez-le avant de le renvoyer.",
    rateLimitedError: "KLYX reçoit trop de demandes pour le moment. Réessayez plus tard sans recréer la mission.",
    thinking: "KLYX réfléchit…",
    readyAnnouncement: "KLYX a compris la demande et elle est prête pour la recherche.",
    conversationLabel: "Conversation KLYX",
    starterSuggestionsLabel: "Suggestions pour commencer",
    quickRepliesLabel: "Réponses rapides",
    noPendingAction:
      "Je ne trouve aucune action en attente liée à votre demande. Vous pouvez décrire un nouveau besoin ou préciser la mission concernée.",
    publishedRequestTitle: "Besoin de {service}",
    publishedRequestFallbackDescription: "Demande KLYX pour {service} à {city}.",
  },
  en: {
    eyebrow: "Ask KLYX",
    placeholder: "What do you need?",
    followUpPlaceholder: "Reply naturally to KLYX…",
    photo: "Photo",
    continue: "Continue",
    actionsDetected: "Detected actions",
    genericError: "KLYX cannot process this message right now. The conversation stays open.",
    invalidMessageError: "This message cannot be processed. Edit it and send it again if needed.",
    payloadTooLargeError: "This message is too large. Shorten it before sending it again.",
    rateLimitedError: "KLYX is receiving too many requests right now. Try again later without recreating the mission.",
    thinking: "KLYX is thinking…",
    readyAnnouncement: "KLYX understood the request and it is ready for search.",
    conversationLabel: "KLYX conversation",
    starterSuggestionsLabel: "Suggestions to get started",
    quickRepliesLabel: "Quick replies",
    noPendingAction:
      "I can’t find a pending action related to your request. You can describe a new need or clarify which mission you mean.",
    publishedRequestTitle: "Need for {service}",
    publishedRequestFallbackDescription: "KLYX request for {service} in {city}.",
  },
  nl: {
    eyebrow: "Vraag het aan KLYX",
    placeholder: "Wat heb je nodig?",
    followUpPlaceholder: "Antwoord gewoon aan KLYX…",
    photo: "Foto",
    continue: "Doorgaan",
    actionsDetected: "Gedetecteerde acties",
    genericError: "KLYX kan dit bericht momenteel niet verwerken. Het gesprek blijft open.",
    invalidMessageError: "Dit bericht kan niet worden verwerkt. Pas het aan en verstuur het opnieuw als dat nodig is.",
    payloadTooLargeError: "Dit bericht is te groot. Maak het korter voordat je het opnieuw verstuurt.",
    rateLimitedError: "KLYX ontvangt momenteel te veel verzoeken. Probeer later opnieuw zonder de missie opnieuw te maken.",
    thinking: "KLYX denkt na…",
    readyAnnouncement: "KLYX heeft de aanvraag begrepen en ze is klaar voor de zoekopdracht.",
    conversationLabel: "KLYX-gesprek",
    starterSuggestionsLabel: "Suggesties om te beginnen",
    quickRepliesLabel: "Snelle antwoorden",
    noPendingAction:
      "Ik vind geen openstaande actie die bij je vraag past. Je kunt een nieuwe behoefte beschrijven of verduidelijken welke missie je bedoelt.",
    publishedRequestTitle: "Nood aan {service}",
    publishedRequestFallbackDescription: "KLYX-aanvraag voor {service} in {city}.",
  },
  de: {
    eyebrow: "KLYX fragen",
    placeholder: "Was brauchst du?",
    followUpPlaceholder: "Antworte KLYX einfach…",
    photo: "Foto",
    continue: "Weiter",
    actionsDetected: "Erkannte Aktionen",
    genericError: "KLYX kann diese Nachricht derzeit nicht verarbeiten. Die Unterhaltung bleibt geöffnet.",
    invalidMessageError: "Diese Nachricht kann nicht verarbeitet werden. Bearbeite sie und sende sie bei Bedarf erneut.",
    payloadTooLargeError: "Diese Nachricht ist zu groß. Kürze sie, bevor du sie erneut sendest.",
    rateLimitedError: "KLYX erhält derzeit zu viele Anfragen. Versuche es später erneut, ohne die Mission neu anzulegen.",
    thinking: "KLYX denkt nach…",
    readyAnnouncement: "KLYX hat die Anfrage verstanden und sie ist bereit für die Suche.",
    conversationLabel: "KLYX-Unterhaltung",
    starterSuggestionsLabel: "Vorschläge zum Start",
    quickRepliesLabel: "Schnelle Antworten",
    noPendingAction:
      "Ich finde keine ausstehende Aktion zu deiner Anfrage. Du kannst einen neuen Bedarf beschreiben oder die gemeinte Mission präzisieren.",
    publishedRequestTitle: "Bedarf an {service}",
    publishedRequestFallbackDescription: "KLYX-Anfrage für {service} in {city}.",
  },
};

const EXAMPLES: Record<KlyxAssistantCommandLocale, readonly string[]> = {
  fr: [
    "J’ai besoin d’un plombier demain à Bruxelles",
    "Que dois-je faire maintenant ?",
    "Où en est ma mission ?",
  ],
  en: [
    "I need a plumber tomorrow in Brussels",
    "What should I do now?",
    "Where is the provider?",
  ],
  nl: [
    "Ik heb morgen in Brussel een loodgieter nodig",
    "Wat moet ik doen?",
    "Waar is de dienstverlener?",
  ],
  de: [
    "Ich brauche morgen in Brüssel einen Klempner",
    "Was soll ich tun?",
    "Wo ist der Anbieter?",
  ],
};

export function resolveKlyxAssistantCommandLocale(
  locale: KlyxLocale | string
): KlyxAssistantCommandLocale {
  return KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES.includes(
    locale as KlyxAssistantCommandLocale
  )
    ? (locale as KlyxAssistantCommandLocale)
    : "fr";
}

export function getKlyxAssistantCommandDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxAssistantCommandLocale(locale)];
}

export function translateKlyxAssistantCommand(
  locale: KlyxLocale | string,
  key: KlyxAssistantCommandMessageKey,
  params?: KlyxAssistantCommandParams
): string {
  const template = getKlyxAssistantCommandDictionary(locale)[key];
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

export function getKlyxAssistantCommandExamples(
  locale: KlyxLocale | string
): readonly string[] {
  return EXAMPLES[resolveKlyxAssistantCommandLocale(locale)];
}
