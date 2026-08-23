import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionAcceptanceLocale =
  (typeof KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_ACCEPTANCE_MESSAGE_KEYS = [
  "sessionMissing",
  "verificationFallback",
  "loadingResponses",
  "verificationImpossible",
  "retry",
  "aggregateWaiting",
  "aggregatePartiallyAccepted",
  "aggregateAllAccepted",
  "aggregateRebuildRequired",
  "aggregateRecoveryRequired",
  "providerPending",
  "providerAccepted",
  "providerRejected",
  "providerRecoveryRequired",
  "title",
  "refresh",
  "providers",
  "acceptedProviders",
  "pendingProviders",
  "slots",
  "allAcceptedTitle",
  "allAcceptedDescription",
  "partiallyAcceptedTitle",
  "partiallyAcceptedDescription",
  "rebuildTitle",
  "rebuildDescription",
  "reviewPlan",
  "rebuildConfirmationDescription",
  "recoveryTitle",
  "recoveryDescription",
  "automationSummary",
] as const;

export type KlyxSplitMissionAcceptanceMessageKey =
  (typeof KLYX_SPLIT_MISSION_ACCEPTANCE_MESSAGE_KEYS)[number];

type SplitMissionAcceptanceDictionary = Record<
  KlyxSplitMissionAcceptanceMessageKey,
  string
>;

const SPLIT_MISSION_ACCEPTANCE_MESSAGES: Record<
  KlyxSplitMissionAcceptanceLocale,
  SplitMissionAcceptanceDictionary
> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    verificationFallback: "Acceptation impossible à vérifier.",
    loadingResponses: "Vérification des réponses des prestataires...",
    verificationImpossible: "Vérification impossible",
    retry: "Réessayer",
    aggregateWaiting: "En attente des prestataires",
    aggregatePartiallyAccepted: "Acceptation partielle",
    aggregateAllAccepted: "Tous les prestataires ont accepté",
    aggregateRebuildRequired: "Mission à reconstruire",
    aggregateRecoveryRequired: "Vérification technique requise",
    providerPending: "En attente",
    providerAccepted: "Accepté",
    providerRejected: "Refusé / indisponible",
    providerRecoveryRequired: "À vérifier",
    title: "Acceptation de la mission",
    refresh: "Actualiser",
    providers: "Prestataires",
    acceptedProviders: "Ont accepté",
    pendingProviders: "En attente",
    slots: "créneau(x)",
    allAcceptedTitle: "Mission entièrement acceptée",
    allAcceptedDescription:
      "Tous les prestataires nécessaires ont accepté leurs créneaux. KLYX peut préparer l'étape suivante, mais aucun paiement n'est automatique.",
    partiallyAcceptedTitle: "Acceptation partielle",
    partiallyAcceptedDescription:
      "Au moins un prestataire a accepté, mais la mission entière n'est pas encore sécurisée.",
    rebuildTitle: "Le plan doit être revu",
    rebuildDescription:
      "Un prestataire a refusé ou n'est plus disponible. KLYX ne le remplace jamais silencieusement.",
    reviewPlan: "Revoir le plan KLYX",
    rebuildConfirmationDescription:
      "Un nouveau plan devra de nouveau être confirmé explicitement avant toute nouvelle réservation.",
    recoveryTitle: "Vérification technique requise",
    recoveryDescription:
      "Le nombre de réservations ou l'intégrité du batch ne correspond pas au plan attendu. Aucun remplacement ou retry automatique n'est effectué.",
    automationSummary:
      "Remplacement automatique : non · Reconstruction automatique : non · Réservation automatique : non · Paiement automatique : non",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    verificationFallback: "Unable to verify acceptance.",
    loadingResponses: "Checking provider responses...",
    verificationImpossible: "Unable to verify",
    retry: "Try again",
    aggregateWaiting: "Waiting for providers",
    aggregatePartiallyAccepted: "Partially accepted",
    aggregateAllAccepted: "All providers have accepted",
    aggregateRebuildRequired: "Mission needs to be rebuilt",
    aggregateRecoveryRequired: "Technical verification required",
    providerPending: "Pending",
    providerAccepted: "Accepted",
    providerRejected: "Declined / unavailable",
    providerRecoveryRequired: "Needs verification",
    title: "Mission acceptance",
    refresh: "Refresh",
    providers: "Providers",
    acceptedProviders: "Accepted",
    pendingProviders: "Pending",
    slots: "slot(s)",
    allAcceptedTitle: "Mission fully accepted",
    allAcceptedDescription:
      "All required providers have accepted their slots. KLYX can prepare the next step, but no payment is automatic.",
    partiallyAcceptedTitle: "Partially accepted",
    partiallyAcceptedDescription:
      "At least one provider has accepted, but the full mission is not secured yet.",
    rebuildTitle: "The plan needs to be reviewed",
    rebuildDescription:
      "A provider declined or is no longer available. KLYX never replaces them silently.",
    reviewPlan: "Review the KLYX plan",
    rebuildConfirmationDescription:
      "A new plan will again have to be explicitly confirmed before any new booking.",
    recoveryTitle: "Technical verification required",
    recoveryDescription:
      "The booking count or batch integrity does not match the expected plan. No automatic replacement or retry is performed.",
    automationSummary:
      "Automatic replacement: no · Automatic rebuild: no · Automatic booking: no · Automatic payment: no",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    verificationFallback: "Acceptatie kan niet worden gecontroleerd.",
    loadingResponses: "Reacties van dienstverleners controleren...",
    verificationImpossible: "Controle niet mogelijk",
    retry: "Opnieuw proberen",
    aggregateWaiting: "Wachten op dienstverleners",
    aggregatePartiallyAccepted: "Gedeeltelijk geaccepteerd",
    aggregateAllAccepted: "Alle dienstverleners hebben geaccepteerd",
    aggregateRebuildRequired: "Missie moet opnieuw worden opgebouwd",
    aggregateRecoveryRequired: "Technische controle vereist",
    providerPending: "In afwachting",
    providerAccepted: "Geaccepteerd",
    providerRejected: "Geweigerd / niet beschikbaar",
    providerRecoveryRequired: "Te controleren",
    title: "Acceptatie van de missie",
    refresh: "Vernieuwen",
    providers: "Dienstverleners",
    acceptedProviders: "Geaccepteerd",
    pendingProviders: "In afwachting",
    slots: "tijdslot(en)",
    allAcceptedTitle: "Missie volledig geaccepteerd",
    allAcceptedDescription:
      "Alle benodigde dienstverleners hebben hun tijdsloten geaccepteerd. KLYX kan de volgende stap voorbereiden, maar geen enkele betaling gebeurt automatisch.",
    partiallyAcceptedTitle: "Gedeeltelijk geaccepteerd",
    partiallyAcceptedDescription:
      "Minstens één dienstverlener heeft geaccepteerd, maar de volledige missie is nog niet veiliggesteld.",
    rebuildTitle: "Het plan moet worden herzien",
    rebuildDescription:
      "Een dienstverlener heeft geweigerd of is niet meer beschikbaar. KLYX vervangt die nooit stilzwijgend.",
    reviewPlan: "KLYX-plan herzien",
    rebuildConfirmationDescription:
      "Een nieuw plan moet opnieuw uitdrukkelijk worden bevestigd voordat een nieuwe boeking kan plaatsvinden.",
    recoveryTitle: "Technische controle vereist",
    recoveryDescription:
      "Het aantal boekingen of de integriteit van de batch komt niet overeen met het verwachte plan. Er wordt geen automatische vervanging of retry uitgevoerd.",
    automationSummary:
      "Automatische vervanging: nee · Automatische heropbouw: nee · Automatische boeking: nee · Automatische betaling: nee",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    verificationFallback: "Die Annahme kann nicht überprüft werden.",
    loadingResponses: "Antworten der Dienstleister werden geprüft...",
    verificationImpossible: "Überprüfung nicht möglich",
    retry: "Erneut versuchen",
    aggregateWaiting: "Warten auf Dienstleister",
    aggregatePartiallyAccepted: "Teilweise angenommen",
    aggregateAllAccepted: "Alle Dienstleister haben angenommen",
    aggregateRebuildRequired: "Mission muss neu aufgebaut werden",
    aggregateRecoveryRequired: "Technische Überprüfung erforderlich",
    providerPending: "Ausstehend",
    providerAccepted: "Angenommen",
    providerRejected: "Abgelehnt / nicht verfügbar",
    providerRecoveryRequired: "Zu überprüfen",
    title: "Annahme der Mission",
    refresh: "Aktualisieren",
    providers: "Dienstleister",
    acceptedProviders: "Angenommen",
    pendingProviders: "Ausstehend",
    slots: "Zeitfenster",
    allAcceptedTitle: "Mission vollständig angenommen",
    allAcceptedDescription:
      "Alle erforderlichen Dienstleister haben ihre Zeitfenster angenommen. KLYX kann den nächsten Schritt vorbereiten, aber keine Zahlung erfolgt automatisch.",
    partiallyAcceptedTitle: "Teilweise angenommen",
    partiallyAcceptedDescription:
      "Mindestens ein Dienstleister hat angenommen, aber die gesamte Mission ist noch nicht abgesichert.",
    rebuildTitle: "Der Plan muss überarbeitet werden",
    rebuildDescription:
      "Ein Dienstleister hat abgelehnt oder ist nicht mehr verfügbar. KLYX ersetzt ihn niemals stillschweigend.",
    reviewPlan: "KLYX-Plan überprüfen",
    rebuildConfirmationDescription:
      "Ein neuer Plan muss erneut ausdrücklich bestätigt werden, bevor eine neue Buchung erfolgen kann.",
    recoveryTitle: "Technische Überprüfung erforderlich",
    recoveryDescription:
      "Die Anzahl der Buchungen oder die Integrität des Batches entspricht nicht dem erwarteten Plan. Es erfolgt kein automatischer Ersatz und kein automatischer Wiederholungsversuch.",
    automationSummary:
      "Automatischer Ersatz: nein · Automatischer Neuaufbau: nein · Automatische Buchung: nein · Automatische Zahlung: nein",
  },
};

const SPLIT_MISSION_ACCEPTANCE_LOCALE_SET = new Set<string>(
  KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES
);

export function hasKlyxSplitMissionAcceptanceTranslation(locale: KlyxLocale) {
  return SPLIT_MISSION_ACCEPTANCE_LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionAcceptanceLocale(
  locale: KlyxLocale
): KlyxSplitMissionAcceptanceLocale {
  return hasKlyxSplitMissionAcceptanceTranslation(locale)
    ? (locale as KlyxSplitMissionAcceptanceLocale)
    : "fr";
}

export function getKlyxSplitMissionAcceptanceDictionary(locale: KlyxLocale) {
  return SPLIT_MISSION_ACCEPTANCE_MESSAGES[
    resolveKlyxSplitMissionAcceptanceLocale(locale)
  ];
}

export function translateKlyxSplitMissionAcceptance(
  locale: KlyxLocale,
  key: KlyxSplitMissionAcceptanceMessageKey
) {
  return getKlyxSplitMissionAcceptanceDictionary(locale)[key];
}
