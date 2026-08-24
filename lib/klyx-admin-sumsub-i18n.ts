import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxAdminSumsubLocale =
  (typeof KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_SUMSUB_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "backAdmin",
  "readOnly",
  "title",
  "description",
  "searchPlaceholder",
  "refresh",
  "empty",
  "applicantPending",
  "pending",
  "klyxLabel",
  "environment",
  "sandbox",
  "production",
  "rejectType",
  "noRejectType",
  "unknownKlyxStatus",
  "unknownReviewStatus",
  "greenAnswer",
  "redAnswer",
  "unknownAnswer",
  "finalReject",
  "retryReject",
  "unknownRejectType",
  "providerFallback",
] as const;

export type KlyxAdminSumsubMessageKey =
  (typeof KLYX_ADMIN_SUMSUB_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAdminSumsubMessageKey, string>;

const MESSAGES: Record<KlyxAdminSumsubLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Impossible de charger les décisions Sumsub pour le moment.",
    backAdmin: "Centre Admin KLYX",
    readOnly: "Lecture seule",
    title: "Décisions Sumsub",
    description:
      "Tu vois les décisions reçues par KLYX. Aucun bouton d’approbation ou de refus n’est disponible ici.",
    searchPlaceholder: "Rechercher une décision...",
    refresh: "Actualiser",
    empty: "Aucune décision Sumsub reçue.",
    applicantPending: "Applicant ID en attente",
    pending: "En attente",
    klyxLabel: "KLYX",
    environment: "Environnement",
    sandbox: "Sandbox",
    production: "Production",
    rejectType: "Type de refus",
    noRejectType: "—",
    unknownKlyxStatus: "Statut KLYX à vérifier",
    unknownReviewStatus: "Statut Sumsub à vérifier",
    greenAnswer: "Vérification validée",
    redAnswer: "Vérification refusée",
    unknownAnswer: "Décision Sumsub à vérifier",
    finalReject: "Refus définitif",
    retryReject: "Nouvelle tentative autorisée",
    unknownRejectType: "Type de refus à vérifier",
    providerFallback: "Prestataire KLYX",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Sumsub decisions are currently unavailable.",
    backAdmin: "KLYX Admin Center",
    readOnly: "Read only",
    title: "Sumsub decisions",
    description:
      "You can view decisions received by KLYX. No approval or rejection button is available here.",
    searchPlaceholder: "Search a decision...",
    refresh: "Refresh",
    empty: "No Sumsub decision received.",
    applicantPending: "Applicant ID pending",
    pending: "Pending",
    klyxLabel: "KLYX",
    environment: "Environment",
    sandbox: "Sandbox",
    production: "Production",
    rejectType: "Rejection type",
    noRejectType: "—",
    unknownKlyxStatus: "KLYX status needs review",
    unknownReviewStatus: "Sumsub status needs review",
    greenAnswer: "Verification approved",
    redAnswer: "Verification rejected",
    unknownAnswer: "Sumsub decision needs review",
    finalReject: "Final rejection",
    retryReject: "Retry allowed",
    unknownRejectType: "Rejection type needs review",
    providerFallback: "KLYX provider",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "Sumsub-beslissingen zijn momenteel niet beschikbaar.",
    backAdmin: "KLYX-beheercentrum",
    readOnly: "Alleen-lezen",
    title: "Sumsub-beslissingen",
    description:
      "Je kunt de door KLYX ontvangen beslissingen bekijken. Er is hier geen knop om goed te keuren of te weigeren.",
    searchPlaceholder: "Zoek een beslissing...",
    refresh: "Vernieuwen",
    empty: "Geen Sumsub-beslissing ontvangen.",
    applicantPending: "Applicant ID in afwachting",
    pending: "In afwachting",
    klyxLabel: "KLYX",
    environment: "Omgeving",
    sandbox: "Sandbox",
    production: "Productie",
    rejectType: "Weigeringstype",
    noRejectType: "—",
    unknownKlyxStatus: "KLYX-status moet worden gecontroleerd",
    unknownReviewStatus: "Sumsub-status moet worden gecontroleerd",
    greenAnswer: "Verificatie goedgekeurd",
    redAnswer: "Verificatie geweigerd",
    unknownAnswer: "Sumsub-beslissing moet worden gecontroleerd",
    finalReject: "Definitieve weigering",
    retryReject: "Nieuwe poging toegestaan",
    unknownRejectType: "Weigeringstype moet worden gecontroleerd",
    providerFallback: "KLYX-dienstverlener",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Sumsub-Entscheidungen sind derzeit nicht verfügbar.",
    backAdmin: "KLYX Admin-Center",
    readOnly: "Nur lesen",
    title: "Sumsub-Entscheidungen",
    description:
      "Du kannst die von KLYX empfangenen Entscheidungen einsehen. Hier gibt es keine Schaltfläche zum Genehmigen oder Ablehnen.",
    searchPlaceholder: "Entscheidung suchen...",
    refresh: "Aktualisieren",
    empty: "Keine Sumsub-Entscheidung erhalten.",
    applicantPending: "Applicant ID ausstehend",
    pending: "Ausstehend",
    klyxLabel: "KLYX",
    environment: "Umgebung",
    sandbox: "Sandbox",
    production: "Produktion",
    rejectType: "Ablehnungstyp",
    noRejectType: "—",
    unknownKlyxStatus: "KLYX-Status muss geprüft werden",
    unknownReviewStatus: "Sumsub-Status muss geprüft werden",
    greenAnswer: "Verifizierung genehmigt",
    redAnswer: "Verifizierung abgelehnt",
    unknownAnswer: "Sumsub-Entscheidung muss geprüft werden",
    finalReject: "Endgültige Ablehnung",
    retryReject: "Erneuter Versuch erlaubt",
    unknownRejectType: "Ablehnungstyp muss geprüft werden",
    providerFallback: "KLYX-Anbieter",
  },
};

const KLYX_STATUSES: Record<KlyxAdminSumsubLocale, Record<string, string>> = {
  fr: {
    not_started: "À compléter",
    pending: "En attente",
    submitted: "Envoyée",
    under_review: "En vérification",
    approved: "Vérifiée",
    changes_required: "Corrections demandées",
    rejected: "Refusée",
    reopened: "Rouverte",
  },
  en: {
    not_started: "To complete",
    pending: "Pending",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Verified",
    changes_required: "Changes required",
    rejected: "Rejected",
    reopened: "Reopened",
  },
  nl: {
    not_started: "Aan te vullen",
    pending: "In afwachting",
    submitted: "Ingediend",
    under_review: "In beoordeling",
    approved: "Geverifieerd",
    changes_required: "Correcties vereist",
    rejected: "Geweigerd",
    reopened: "Heropend",
  },
  de: {
    not_started: "Zu vervollständigen",
    pending: "Ausstehend",
    submitted: "Eingereicht",
    under_review: "In Prüfung",
    approved: "Verifiziert",
    changes_required: "Korrekturen erforderlich",
    rejected: "Abgelehnt",
    reopened: "Wieder geöffnet",
  },
};

const REVIEW_STATUSES: Record<KlyxAdminSumsubLocale, Record<string, string>> = {
  fr: { init: "Initialisation", pending: "En attente", prechecked: "Pré-vérifiée", queued: "En file d’attente", completed: "Terminée", onHold: "En pause", on_hold: "En pause" },
  en: { init: "Initializing", pending: "Pending", prechecked: "Prechecked", queued: "Queued", completed: "Completed", onHold: "On hold", on_hold: "On hold" },
  nl: { init: "Initialiseren", pending: "In afwachting", prechecked: "Vooraf gecontroleerd", queued: "In wachtrij", completed: "Voltooid", onHold: "Gepauzeerd", on_hold: "Gepauzeerd" },
  de: { init: "Initialisierung", pending: "Ausstehend", prechecked: "Vorab geprüft", queued: "In Warteschlange", completed: "Abgeschlossen", onHold: "Pausiert", on_hold: "Pausiert" },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES);

export function resolveKlyxAdminSumsubLocale(locale: KlyxLocale): KlyxAdminSumsubLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminSumsubLocale) : "fr";
}

export function getKlyxAdminSumsubDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminSumsubLocale(locale)];
}

export function translateKlyxAdminSumsub(
  locale: KlyxLocale,
  key: KlyxAdminSumsubMessageKey
) {
  return getKlyxAdminSumsubDictionary(locale)[key];
}

export function translateKlyxAdminSumsubKlyxStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxAdminSumsubLocale(locale);
  return KLYX_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownKlyxStatus;
}

export function translateKlyxAdminSumsubReviewStatus(
  locale: KlyxLocale,
  status: string | null
) {
  const resolved = resolveKlyxAdminSumsubLocale(locale);
  if (!status) return MESSAGES[resolved].pending;
  return REVIEW_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownReviewStatus;
}

export function translateKlyxAdminSumsubAnswer(
  locale: KlyxLocale,
  answer: string | null,
  reviewStatus: string | null
) {
  const resolved = resolveKlyxAdminSumsubLocale(locale);
  if (answer === "GREEN") return MESSAGES[resolved].greenAnswer;
  if (answer === "RED") return MESSAGES[resolved].redAnswer;
  if (!answer) return translateKlyxAdminSumsubReviewStatus(locale, reviewStatus);
  return MESSAGES[resolved].unknownAnswer;
}

export function translateKlyxAdminSumsubRejectType(
  locale: KlyxLocale,
  rejectType: string | null
) {
  const resolved = resolveKlyxAdminSumsubLocale(locale);
  if (!rejectType) return MESSAGES[resolved].noRejectType;
  if (rejectType === "FINAL") return MESSAGES[resolved].finalReject;
  if (rejectType === "RETRY") return MESSAGES[resolved].retryReject;
  return MESSAGES[resolved].unknownRejectType;
}

export function displayKlyxAdminSumsubProviderName(locale: KlyxLocale, name: string) {
  const value = name.trim();
  if (!value || value === "Prestataire KLYX") {
    return MESSAGES[resolveKlyxAdminSumsubLocale(locale)].providerFallback;
  }
  return name;
}
