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
  "photo",
  "continue",
  "actionsDetected",
  "genericError",
] as const;

export type KlyxAssistantCommandMessageKey =
  (typeof KLYX_ASSISTANT_COMMAND_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAssistantCommandMessageKey, string>;

const DICTIONARIES: Record<KlyxAssistantCommandLocale, Dictionary> = {
  fr: {
    eyebrow: "Demande à KLYX",
    placeholder: "Nouveau besoin ou prochaine action, écris simplement ce que tu veux faire...",
    photo: "Photo",
    continue: "Continuer",
    actionsDetected: "Actions détectées",
    genericError: "KLYX ne peut pas traiter cette commande pour le moment.",
  },
  en: {
    eyebrow: "Ask KLYX",
    placeholder: "New need or next action — simply write what you want to do...",
    photo: "Photo",
    continue: "Continue",
    actionsDetected: "Detected actions",
    genericError: "KLYX cannot process this command right now.",
  },
  nl: {
    eyebrow: "Vraag het aan KLYX",
    placeholder: "Nieuwe behoefte of volgende actie — schrijf gewoon wat je wilt doen...",
    photo: "Foto",
    continue: "Doorgaan",
    actionsDetected: "Gedetecteerde acties",
    genericError: "KLYX kan deze opdracht momenteel niet verwerken.",
  },
  de: {
    eyebrow: "KLYX fragen",
    placeholder: "Neuer Bedarf oder nächste Aktion — schreibe einfach, was du tun möchtest...",
    photo: "Foto",
    continue: "Weiter",
    actionsDetected: "Erkannte Aktionen",
    genericError: "KLYX kann diesen Befehl derzeit nicht verarbeiten.",
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
  key: KlyxAssistantCommandMessageKey
): string {
  return getKlyxAssistantCommandDictionary(locale)[key];
}

export function getKlyxAssistantCommandExamples(
  locale: KlyxLocale | string
): readonly string[] {
  return EXAMPLES[resolveKlyxAssistantCommandLocale(locale)];
}
