export const KLYX_PHONE_HISTORY_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxPhoneHistoryLocale =
  (typeof KLYX_PHONE_HISTORY_TRANSLATED_LOCALES)[number];

export const KLYX_PHONE_HISTORY_MESSAGE_KEYS = [
  "sessionMissing",
  "loadFailed",
  "title",
  "description",
  "refresh",
  "privacyNote",
  "loading",
  "noAccessTitle",
  "noAccessDescription",
  "genericUser",
  "genericMission",
  "missionId",
  "eventExplicitReveal",
  "eventCallStarted",
  "eventReveal",
  "eventAccess",
  "serviceBabysitting",
  "serviceCleaning",
  "serviceMoving",
  "serviceHandyman",
  "statusPending",
  "statusPaymentPending",
  "statusAccepted",
  "statusCompleted",
  "statusCancelled",
  "statusRejected",
  "statusCancellationWaiting",
  "statusCancellationDecision",
  "statusRefundProcessing",
  "statusRefundFailed",
  "statusRefunded",
] as const;

export type KlyxPhoneHistoryMessageKey =
  (typeof KLYX_PHONE_HISTORY_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxPhoneHistoryMessageKey, string>;

const dictionaries: Record<KlyxPhoneHistoryLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX introuvable.",
    loadFailed: "Historique indisponible.",
    title: "Historique de confidentialité",
    description: "Consulte les derniers accès autorisés à ton numéro de téléphone KLYX.",
    refresh: "Actualiser",
    privacyNote: "Cet historique affiche uniquement les accès de sécurité. Aucun numéro de téléphone ni code SMS OTP n’y apparaît.",
    loading: "Chargement de l’historique...",
    noAccessTitle: "Aucun accès enregistré",
    noAccessDescription: "Personne n’a encore révélé ton numéro via KLYX.",
    genericUser: "Utilisateur KLYX",
    genericMission: "Mission KLYX",
    missionId: "Mission {id}",
    eventExplicitReveal: "Numéro affiché",
    eventCallStarted: "Appel lancé",
    eventReveal: "Numéro consulté",
    eventAccess: "Accès téléphone",
    serviceBabysitting: "Baby-sitting",
    serviceCleaning: "Ménage",
    serviceMoving: "Déménagement",
    serviceHandyman: "Bricolage",
    statusPending: "En attente",
    statusPaymentPending: "Paiement en attente",
    statusAccepted: "Acceptée",
    statusCompleted: "Terminée",
    statusCancelled: "Annulée",
    statusRejected: "Refusée",
    statusCancellationWaiting: "Annulation en attente",
    statusCancellationDecision: "Décision d’annulation",
    statusRefundProcessing: "Remboursement en cours",
    statusRefundFailed: "Échec du remboursement",
    statusRefunded: "Remboursée",
  },
  en: {
    sessionMissing: "KLYX session not found.",
    loadFailed: "History unavailable.",
    title: "Privacy history",
    description: "Review the latest authorised access to your KLYX phone number.",
    refresh: "Refresh",
    privacyNote: "This history shows security access only. No phone number or SMS OTP code appears here.",
    loading: "Loading history...",
    noAccessTitle: "No access recorded",
    noAccessDescription: "No one has revealed your number through KLYX yet.",
    genericUser: "KLYX user",
    genericMission: "KLYX mission",
    missionId: "Mission {id}",
    eventExplicitReveal: "Number displayed",
    eventCallStarted: "Call started",
    eventReveal: "Number viewed",
    eventAccess: "Phone access",
    serviceBabysitting: "Babysitting",
    serviceCleaning: "Cleaning",
    serviceMoving: "Moving",
    serviceHandyman: "Handyman",
    statusPending: "Pending",
    statusPaymentPending: "Payment pending",
    statusAccepted: "Accepted",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    statusRejected: "Rejected",
    statusCancellationWaiting: "Cancellation pending",
    statusCancellationDecision: "Cancellation decision",
    statusRefundProcessing: "Refund processing",
    statusRefundFailed: "Refund failed",
    statusRefunded: "Refunded",
  },
  nl: {
    sessionMissing: "KLYX-sessie niet gevonden.",
    loadFailed: "Geschiedenis niet beschikbaar.",
    title: "Privacygeschiedenis",
    description: "Bekijk de laatste geautoriseerde toegang tot je KLYX-telefoonnummer.",
    refresh: "Vernieuwen",
    privacyNote: "Deze geschiedenis toont alleen beveiligingstoegang. Er verschijnt geen telefoonnummer of sms-OTP-code.",
    loading: "Geschiedenis laden...",
    noAccessTitle: "Geen toegang geregistreerd",
    noAccessDescription: "Niemand heeft je nummer nog via KLYX onthuld.",
    genericUser: "KLYX-gebruiker",
    genericMission: "KLYX-opdracht",
    missionId: "Opdracht {id}",
    eventExplicitReveal: "Nummer getoond",
    eventCallStarted: "Oproep gestart",
    eventReveal: "Nummer bekeken",
    eventAccess: "Telefoontoegang",
    serviceBabysitting: "Babysitten",
    serviceCleaning: "Schoonmaak",
    serviceMoving: "Verhuizing",
    serviceHandyman: "Klusjes",
    statusPending: "In afwachting",
    statusPaymentPending: "Betaling in afwachting",
    statusAccepted: "Geaccepteerd",
    statusCompleted: "Voltooid",
    statusCancelled: "Geannuleerd",
    statusRejected: "Geweigerd",
    statusCancellationWaiting: "Annulering in afwachting",
    statusCancellationDecision: "Beslissing over annulering",
    statusRefundProcessing: "Terugbetaling wordt verwerkt",
    statusRefundFailed: "Terugbetaling mislukt",
    statusRefunded: "Terugbetaald",
  },
  de: {
    sessionMissing: "KLYX-Sitzung nicht gefunden.",
    loadFailed: "Verlauf nicht verfügbar.",
    title: "Datenschutzverlauf",
    description: "Sieh dir die letzten autorisierten Zugriffe auf deine KLYX-Telefonnummer an.",
    refresh: "Aktualisieren",
    privacyNote: "Dieser Verlauf zeigt nur Sicherheitszugriffe. Telefonnummern und SMS-OTP-Codes werden hier nicht angezeigt.",
    loading: "Verlauf wird geladen...",
    noAccessTitle: "Kein Zugriff protokolliert",
    noAccessDescription: "Bisher hat niemand deine Nummer über KLYX offengelegt.",
    genericUser: "KLYX-Nutzer",
    genericMission: "KLYX-Mission",
    missionId: "Mission {id}",
    eventExplicitReveal: "Nummer angezeigt",
    eventCallStarted: "Anruf gestartet",
    eventReveal: "Nummer angesehen",
    eventAccess: "Telefonzugriff",
    serviceBabysitting: "Babysitting",
    serviceCleaning: "Reinigung",
    serviceMoving: "Umzug",
    serviceHandyman: "Handwerk",
    statusPending: "Ausstehend",
    statusPaymentPending: "Zahlung ausstehend",
    statusAccepted: "Angenommen",
    statusCompleted: "Abgeschlossen",
    statusCancelled: "Storniert",
    statusRejected: "Abgelehnt",
    statusCancellationWaiting: "Stornierung ausstehend",
    statusCancellationDecision: "Stornierungsentscheidung",
    statusRefundProcessing: "Rückerstattung in Bearbeitung",
    statusRefundFailed: "Rückerstattung fehlgeschlagen",
    statusRefunded: "Erstattet",
  },
};

const intlLocales: Record<KlyxPhoneHistoryLocale, string> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-DE",
};

const eventKeys: Readonly<Record<string, KlyxPhoneHistoryMessageKey>> = {
  phone_explicit_reveal: "eventExplicitReveal",
  phone_call_started: "eventCallStarted",
  phone_reveal: "eventReveal",
};

const serviceKeys: Readonly<Record<string, KlyxPhoneHistoryMessageKey>> = {
  babysitting: "serviceBabysitting",
  cleaning: "serviceCleaning",
  moving: "serviceMoving",
  handyman: "serviceHandyman",
};

const statusKeys: Readonly<Record<string, KlyxPhoneHistoryMessageKey>> = {
  pending: "statusPending",
  payment_pending: "statusPaymentPending",
  accepted: "statusAccepted",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  rejected: "statusRejected",
  cancellation_waiting: "statusCancellationWaiting",
  cancellation_decision: "statusCancellationDecision",
  refund_processing: "statusRefundProcessing",
  refund_failed: "statusRefundFailed",
  refunded: "statusRefunded",
};

export function resolveKlyxPhoneHistoryLocale(locale: string): KlyxPhoneHistoryLocale {
  return (KLYX_PHONE_HISTORY_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxPhoneHistoryLocale)
    : "fr";
}

export function translateKlyxPhoneHistory(
  locale: string,
  key: KlyxPhoneHistoryMessageKey,
  variables: Readonly<Record<string, string | number>> = {}
): string {
  const text = dictionaries[resolveKlyxPhoneHistoryLocale(locale)][key];
  return Object.entries(variables).reduce(
    (current, [name, value]) => current.replaceAll(`{${name}}`, String(value)),
    text
  );
}

export function formatKlyxPhoneHistoryDate(locale: string, value: string): string {
  const resolved = resolveKlyxPhoneHistoryLocale(locale);
  return new Intl.DateTimeFormat(intlLocales[resolved], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function translateKlyxPhoneHistoryEvent(locale: string, eventType: string): string {
  return translateKlyxPhoneHistory(locale, eventKeys[eventType] ?? "eventAccess");
}

export function translateKlyxPhoneHistoryService(
  locale: string,
  slug: string | null
): string {
  if (!slug) return translateKlyxPhoneHistory(locale, "genericMission");
  const key = serviceKeys[slug];
  return key ? translateKlyxPhoneHistory(locale, key) : slug;
}

export function translateKlyxPhoneHistoryStatus(
  locale: string,
  status: string
): string {
  const key = statusKeys[status];
  return key ? translateKlyxPhoneHistory(locale, key) : status;
}

export function translateKlyxPhoneHistoryViewer(
  locale: string,
  viewerName: string
): string {
  return viewerName === "Utilisateur KLYX"
    ? translateKlyxPhoneHistory(locale, "genericUser")
    : viewerName;
}
