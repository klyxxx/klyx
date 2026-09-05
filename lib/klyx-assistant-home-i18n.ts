import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_ASSISTANT_HOME_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAssistantHomeLocale =
  (typeof KLYX_ASSISTANT_HOME_TRANSLATED_LOCALES)[number];

export const KLYX_ASSISTANT_HOME_MESSAGE_KEYS = [
  "badge",
  "title",
  "organizeTitle",
  "notifications",
  "description",
  "loadError",
  "priority",
  "upToDate",
  "noPriority",
  "noPriorityDescription",
  "describeNeedTitle",
  "describeNeedText",
  "actionsTitle",
  "requestsTitle",
  "requestsText",
  "searchTitle",
  "searchText",
  "brainTitle",
  "brainText",
  "providerJobsTitle",
  "providerJobsText",
  "providerAssistantTitle",
  "providerAssistantText",
  "open",
] as const;

export type KlyxAssistantHomeMessageKey =
  (typeof KLYX_ASSISTANT_HOME_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAssistantHomeMessageKey, string>;

const DICTIONARIES: Record<KlyxAssistantHomeLocale, Dictionary> = {
  fr: {
    badge: "KLYX Assistant",
    title: "Dis-moi ce qu’il faut faire.",
    organizeTitle: "Que dois-je organiser pour vous ?",
    notifications: "Notifications",
    description: "KLYX rassemble tes prochaines actions, tes demandes et les outils utiles de ton profil actif au même endroit.",
    loadError: "KLYX ne peut pas charger tes prochaines actions pour le moment.",
    priority: "Priorité KLYX",
    upToDate: "Tout est à jour",
    noPriority: "Aucune action prioritaire",
    noPriorityDescription: "Tu peux lancer une nouvelle action quand tu veux.",
    describeNeedTitle: "Décrire un besoin",
    describeNeedText: "Parle normalement à KLYX. Il prépare la demande, puis tu confirmes.",
    actionsTitle: "Mes actions",
    requestsTitle: "Mes demandes",
    requestsText: "Suis les offres reçues, compare et choisis ton prestataire.",
    searchTitle: "Trouver directement",
    searchText: "Recherche un prestataire et réserve sans publier de demande ouverte.",
    brainTitle: "Assistant général",
    brainText: "Retrouve le Brain KLYX et ses recommandations générales.",
    providerJobsTitle: "Missions disponibles",
    providerJobsText: "Découvre les demandes compatibles classées par KLYX.",
    providerAssistantTitle: "Assistant professionnel",
    providerAssistantText: "Pilote ton activité, ton planning et tes prochaines décisions.",
    open: "Ouvrir",
  },
  en: {
    badge: "KLYX Assistant",
    title: "Tell me what needs to be done.",
    organizeTitle: "What should I organize for you?",
    notifications: "Notifications",
    description: "KLYX brings your next actions, requests and useful tools for the active profile together in one place.",
    loadError: "KLYX cannot load your next actions right now.",
    priority: "KLYX priority",
    upToDate: "Everything is up to date",
    noPriority: "No priority action",
    noPriorityDescription: "You can start a new action whenever you want.",
    describeNeedTitle: "Describe a need",
    describeNeedText: "Talk naturally to KLYX. It prepares the request, then you confirm it.",
    actionsTitle: "My actions",
    requestsTitle: "My requests",
    requestsText: "Track received offers, compare them and choose your provider.",
    searchTitle: "Find directly",
    searchText: "Search for a provider and book without publishing an open request.",
    brainTitle: "General assistant",
    brainText: "Open KLYX Brain and its general recommendations.",
    providerJobsTitle: "Available missions",
    providerJobsText: "Discover compatible requests ranked by KLYX.",
    providerAssistantTitle: "Professional assistant",
    providerAssistantText: "Manage your activity, schedule and next decisions.",
    open: "Open",
  },
  nl: {
    badge: "KLYX Assistent",
    title: "Vertel me wat er moet gebeuren.",
    organizeTitle: "Wat zal ik voor je organiseren?",
    notifications: "Meldingen",
    description: "KLYX brengt je volgende acties, aanvragen en nuttige tools voor het actieve profiel op één plek samen.",
    loadError: "KLYX kan je volgende acties momenteel niet laden.",
    priority: "KLYX-prioriteit",
    upToDate: "Alles is up-to-date",
    noPriority: "Geen prioritaire actie",
    noPriorityDescription: "Je kunt op elk moment een nieuwe actie starten.",
    describeNeedTitle: "Een behoefte beschrijven",
    describeNeedText: "Praat gewoon met KLYX. KLYX bereidt de aanvraag voor en daarna bevestig jij.",
    actionsTitle: "Mijn acties",
    requestsTitle: "Mijn aanvragen",
    requestsText: "Volg ontvangen offertes, vergelijk ze en kies je dienstverlener.",
    searchTitle: "Direct zoeken",
    searchText: "Zoek een dienstverlener en boek zonder een open aanvraag te publiceren.",
    brainTitle: "Algemene assistent",
    brainText: "Open KLYX Brain en de algemene aanbevelingen.",
    providerJobsTitle: "Beschikbare missies",
    providerJobsText: "Ontdek compatibele aanvragen gerangschikt door KLYX.",
    providerAssistantTitle: "Professionele assistent",
    providerAssistantText: "Beheer je activiteit, planning en volgende beslissingen.",
    open: "Openen",
  },
  de: {
    badge: "KLYX Assistent",
    title: "Sag mir, was erledigt werden muss.",
    organizeTitle: "Was soll ich für dich organisieren?",
    notifications: "Benachrichtigungen",
    description: "KLYX bündelt deine nächsten Aktionen, Anfragen und nützlichen Werkzeuge für das aktive Profil an einem Ort.",
    loadError: "KLYX kann deine nächsten Aktionen derzeit nicht laden.",
    priority: "KLYX-Priorität",
    upToDate: "Alles ist aktuell",
    noPriority: "Keine prioritäre Aktion",
    noPriorityDescription: "Du kannst jederzeit eine neue Aktion starten.",
    describeNeedTitle: "Bedarf beschreiben",
    describeNeedText: "Sprich ganz normal mit KLYX. KLYX bereitet die Anfrage vor, danach bestätigst du sie.",
    actionsTitle: "Meine Aktionen",
    requestsTitle: "Meine Anfragen",
    requestsText: "Verfolge eingegangene Angebote, vergleiche sie und wähle deinen Anbieter.",
    searchTitle: "Direkt suchen",
    searchText: "Suche einen Anbieter und buche, ohne eine offene Anfrage zu veröffentlichen.",
    brainTitle: "Allgemeiner Assistent",
    brainText: "Öffne KLYX Brain und seine allgemeinen Empfehlungen.",
    providerJobsTitle: "Verfügbare Missionen",
    providerJobsText: "Entdecke passende, von KLYX geordnete Anfragen.",
    providerAssistantTitle: "Professioneller Assistent",
    providerAssistantText: "Steuere deine Tätigkeit, deinen Zeitplan und deine nächsten Entscheidungen.",
    open: "Öffnen",
  },
};

export function resolveKlyxAssistantHomeLocale(
  locale: KlyxLocale | string
): KlyxAssistantHomeLocale {
  return KLYX_ASSISTANT_HOME_TRANSLATED_LOCALES.includes(
    locale as KlyxAssistantHomeLocale
  )
    ? (locale as KlyxAssistantHomeLocale)
    : "fr";
}

export function getKlyxAssistantHomeDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxAssistantHomeLocale(locale)];
}

export function translateKlyxAssistantHome(
  locale: KlyxLocale | string,
  key: KlyxAssistantHomeMessageKey
): string {
  return getKlyxAssistantHomeDictionary(locale)[key];
}

export function formatKlyxAssistantHomeActionCount(
  locale: KlyxLocale | string,
  count: number,
  accountType: "client" | "provider"
): string {
  const resolved = resolveKlyxAssistantHomeLocale(locale);

  if (resolved === "en") {
    return accountType === "provider"
      ? `${count} priority ${count === 1 ? "action" : "actions"} for your activity.`
      : `${count} ${count === 1 ? "action" : "actions"} detected by KLYX.`;
  }

  if (resolved === "nl") {
    return accountType === "provider"
      ? `${count} prioritaire ${count === 1 ? "actie" : "acties"} voor je activiteit.`
      : `${count} ${count === 1 ? "actie" : "acties"} gedetecteerd door KLYX.`;
  }

  if (resolved === "de") {
    return accountType === "provider"
      ? `${count} prioritäre ${count === 1 ? "Aktion" : "Aktionen"} für deine Tätigkeit.`
      : `${count} von KLYX erkannte ${count === 1 ? "Aktion" : "Aktionen"}.`;
  }

  return accountType === "provider"
    ? `${count} action${count > 1 ? "s" : ""} prioritaire${count > 1 ? "s" : ""} pour ton activité.`
    : `${count} action${count > 1 ? "s" : ""} détectée${count > 1 ? "s" : ""} par KLYX.`;
}
