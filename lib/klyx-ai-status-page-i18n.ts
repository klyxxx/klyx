import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
  "es",
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
  "probeTitle",
  "probeDescription",
  "probeRun",
  "probeRunning",
  "probeReady",
  "probeNotReady",
  "probeAssistant",
  "probeVision",
  "probeFallback",
  "probeDisabled",
  "probeUnavailable",
  "probeAdminOnly",
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
    probeTitle: "Preuve OpenAI de bout en bout",
    probeDescription:
      "Lance deux appels synthétiques depuis le serveur KLYX : un par le vrai assistant conversationnel et un par la vraie analyse Vision. Aucune donnée utilisateur, réservation ou paiement n’est utilisé.",
    probeRun: "Tester Assistant + Vision",
    probeRunning: "Test en cours…",
    probeReady: "Assistant et Vision OpenAI sont validés.",
    probeNotReady: "Au moins un chemin OpenAI utilise encore le mode de secours.",
    probeAssistant: "Assistant",
    probeVision: "Vision",
    probeFallback: "Mode de secours",
    probeDisabled: "Vision désactivée",
    probeUnavailable: "Diagnostic indisponible",
    probeAdminOnly: "Ce diagnostic réel est réservé à l’administrateur KLYX connecté.",
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
    probeTitle: "End-to-end OpenAI proof",
    probeDescription:
      "Runs two synthetic calls from the KLYX server: one through the real conversational assistant and one through real Vision analysis. No user data, booking, or payment is used.",
    probeRun: "Test Assistant + Vision",
    probeRunning: "Testing…",
    probeReady: "OpenAI Assistant and Vision are validated.",
    probeNotReady: "At least one OpenAI path is still using fallback mode.",
    probeAssistant: "Assistant",
    probeVision: "Vision",
    probeFallback: "Fallback mode",
    probeDisabled: "Vision disabled",
    probeUnavailable: "Diagnostic unavailable",
    probeAdminOnly: "This real diagnostic is restricted to the signed-in KLYX administrator.",
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
    probeTitle: "End-to-end OpenAI-bewijs",
    probeDescription:
      "Voert twee synthetische oproepen uit vanaf de KLYX-server: één via de echte conversationele assistent en één via echte Vision-analyse. Er worden geen gebruikersgegevens, boekingen of betalingen gebruikt.",
    probeRun: "Assistant + Vision testen",
    probeRunning: "Test wordt uitgevoerd…",
    probeReady: "OpenAI Assistant en Vision zijn gevalideerd.",
    probeNotReady: "Minstens één OpenAI-pad gebruikt nog de terugvalmodus.",
    probeAssistant: "Assistant",
    probeVision: "Vision",
    probeFallback: "Terugvalmodus",
    probeDisabled: "Vision uitgeschakeld",
    probeUnavailable: "Diagnose niet beschikbaar",
    probeAdminOnly: "Deze echte diagnose is alleen beschikbaar voor de aangemelde KLYX-beheerder.",
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
    probeTitle: "End-to-End-OpenAI-Nachweis",
    probeDescription:
      "Führt zwei synthetische Aufrufe vom KLYX-Server aus: einen über den echten Konversationsassistenten und einen über die echte Vision-Analyse. Es werden keine Nutzerdaten, Buchungen oder Zahlungen verwendet.",
    probeRun: "Assistant + Vision testen",
    probeRunning: "Test läuft…",
    probeReady: "OpenAI Assistant und Vision sind validiert.",
    probeNotReady: "Mindestens ein OpenAI-Pfad verwendet noch den Fallback-Modus.",
    probeAssistant: "Assistant",
    probeVision: "Vision",
    probeFallback: "Fallback-Modus",
    probeDisabled: "Vision deaktiviert",
    probeUnavailable: "Diagnose nicht verfügbar",
    probeAdminOnly: "Diese echte Diagnose ist dem angemeldeten KLYX-Administrator vorbehalten.",
  },
  es: {
    metadataTitle: "Estado de la IA de KLYX",
    metadataDescription:
      "Consulta el modo de IA actualmente activo y las salvaguardas del asistente KLYX.",
    backDashboard: "Panel de control",
    badge: "Base de IA de KLYX",
    title: "Asistente inteligente, activación progresiva",
    description:
      "KLYX mantiene su asistente gratuito actual. Cuando se añada una clave API más adelante, el motor inteligente se activará automáticamente sin reconstruir toda la aplicación.",
    enabledTitle: "OpenAI activado",
    fallbackTitle: "Modo gratuito activado",
    enabledDescription:
      "Las respuestas pueden usar el modelo configurado en el servidor.",
    fallbackDescription:
      "No se consumen créditos. KLYX utiliza sus reglas locales de respaldo.",
    safetyTitle: "Seguridad preservada",
    safetyDescription:
      "La IA no puede confirmar por sí sola un pago, un reembolso, una reserva ni una actividad regulada.",
    probeTitle: "Prueba integral de OpenAI",
    probeDescription:
      "Ejecuta dos llamadas sintéticas desde el servidor de KLYX: una mediante el asistente conversacional real y otra mediante el análisis Vision real. No se utilizan datos de usuario, reservas ni pagos.",
    probeRun: "Probar Asistente + Vision",
    probeRunning: "Prueba en curso…",
    probeReady: "El Asistente y Vision de OpenAI están validados.",
    probeNotReady: "Al menos una ruta de OpenAI sigue usando el modo de respaldo.",
    probeAssistant: "Asistente",
    probeVision: "Vision",
    probeFallback: "Modo de respaldo",
    probeDisabled: "Vision desactivado",
    probeUnavailable: "Diagnóstico no disponible",
    probeAdminOnly:
      "Este diagnóstico real está reservado al administrador de KLYX que ha iniciado sesión.",
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
