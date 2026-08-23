import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAiStatusPageLocale =
  (typeof KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_AI_STATUS_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "backDashboard",
  "badge",
  "title",
  "description",
  "enabledTitle",
  "fallbackTitle",
  "enabledDescription",
  "fallbackDescription",
  "safetyTitle",
  "safetyDescription",
] as const;

export type KlyxAiStatusPageMessageKey =
  (typeof KLYX_AI_STATUS_PAGE_MESSAGE_KEYS)[number];

type AiStatusPageDictionary = Record<KlyxAiStatusPageMessageKey, string>;

const AI_STATUS_PAGE_MESSAGES: Record<
  KlyxAiStatusPageLocale,
  AiStatusPageDictionary
> = {
  fr: {
    metadataTitle: "Statut IA KLYX",
    metadataDescription:
      "Consulte le mode IA actuellement actif et les garde-fous de l’assistant KLYX.",
    backDashboard: "Tableau de bord",
    badge: "Fondation IA KLYX",
    title: "Assistant intelligent, activation progressive",
    description:
      "KLYX conserve son assistant gratuit actuel. Lorsqu’une clé API sera ajoutée plus tard, le moteur intelligent s’activera automatiquement sans reconstruire toute l’application.",
    enabledTitle: "IA OpenAI activée",
    fallbackTitle: "Mode gratuit activé",
    enabledDescription:
      "Les réponses peuvent utiliser le modèle configuré côté serveur.",
    fallbackDescription:
      "Aucun crédit n’est consommé. KLYX utilise ses règles locales de secours.",
    safetyTitle: "Sécurité conservée",
    safetyDescription:
      "L’IA ne peut pas confirmer seule un paiement, un remboursement, une réservation ou une activité réglementée.",
  },
  en: {
    metadataTitle: "KLYX AI status",
    metadataDescription:
      "View the currently active AI mode and the safeguards of the KLYX assistant.",
    backDashboard: "Dashboard",
    badge: "KLYX AI foundation",
    title: "Intelligent assistant, progressive activation",
    description:
      "KLYX keeps its current free assistant. When an API key is added later, the intelligent engine will activate automatically without rebuilding the entire application.",
    enabledTitle: "OpenAI enabled",
    fallbackTitle: "Free mode enabled",
    enabledDescription:
      "Responses can use the model configured on the server.",
    fallbackDescription:
      "No credits are consumed. KLYX uses its local fallback rules.",
    safetyTitle: "Safety preserved",
    safetyDescription:
      "The AI cannot confirm a payment, refund, booking, or regulated activity on its own.",
  },
  nl: {
    metadataTitle: "KLYX AI-status",
    metadataDescription:
      "Bekijk de momenteel actieve AI-modus en de veiligheidsgrenzen van de KLYX-assistent.",
    backDashboard: "Dashboard",
    badge: "KLYX AI-basis",
    title: "Intelligente assistent, geleidelijke activering",
    description:
      "KLYX behoudt zijn huidige gratis assistent. Wanneer later een API-sleutel wordt toegevoegd, wordt de intelligente motor automatisch geactiveerd zonder de hele applicatie opnieuw op te bouwen.",
    enabledTitle: "OpenAI geactiveerd",
    fallbackTitle: "Gratis modus geactiveerd",
    enabledDescription:
      "Antwoorden kunnen het model gebruiken dat aan serverzijde is geconfigureerd.",
    fallbackDescription:
      "Er worden geen credits verbruikt. KLYX gebruikt zijn lokale terugvalregels.",
    safetyTitle: "Veiligheid behouden",
    safetyDescription:
      "De AI kan niet zelfstandig een betaling, terugbetaling, boeking of gereguleerde activiteit bevestigen.",
  },
  de: {
    metadataTitle: "KLYX KI-Status",
    metadataDescription:
      "Zeigt den aktuell aktiven KI-Modus und die Schutzmechanismen des KLYX-Assistenten.",
    backDashboard: "Dashboard",
    badge: "KLYX KI-Grundlage",
    title: "Intelligenter Assistent, schrittweise Aktivierung",
    description:
      "KLYX behält seinen aktuellen kostenlosen Assistenten bei. Wenn später ein API-Schlüssel hinzugefügt wird, aktiviert sich die intelligente Engine automatisch, ohne dass die gesamte Anwendung neu erstellt werden muss.",
    enabledTitle: "OpenAI aktiviert",
    fallbackTitle: "Kostenloser Modus aktiviert",
    enabledDescription:
      "Antworten können das serverseitig konfigurierte Modell verwenden.",
    fallbackDescription:
      "Es werden keine Credits verbraucht. KLYX verwendet seine lokalen Fallback-Regeln.",
    safetyTitle: "Sicherheit bleibt erhalten",
    safetyDescription:
      "Die KI kann eine Zahlung, eine Rückerstattung, eine Buchung oder eine regulierte Tätigkeit nicht eigenständig bestätigen.",
  },
};

const AI_STATUS_PAGE_LOCALE_SET = new Set<string>(
  KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxAiStatusPageTranslation(locale: KlyxLocale) {
  return AI_STATUS_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxAiStatusPageLocale(
  locale: KlyxLocale
): KlyxAiStatusPageLocale {
  return hasKlyxAiStatusPageTranslation(locale)
    ? (locale as KlyxAiStatusPageLocale)
    : "fr";
}

export function getKlyxAiStatusPageDictionary(locale: KlyxLocale) {
  return AI_STATUS_PAGE_MESSAGES[resolveKlyxAiStatusPageLocale(locale)];
}
