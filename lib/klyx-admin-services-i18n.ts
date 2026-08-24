import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxAdminServicesLocale = (typeof KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_SERVICES_MESSAGE_KEYS = [
  "loadError",
  "actionError",
  "rejectSuccess",
  "approvedPrefix",
  "backDashboard",
  "eyebrow",
  "title",
  "pending",
  "approved",
  "rejected",
  "all",
  "searchPlaceholder",
  "empty",
  "notePlaceholder",
  "approve",
  "reject",
  "status",
  "unknownStatus",
  "confirmApprove",
  "confirmReject",
] as const;
export type KlyxAdminServicesMessageKey = (typeof KLYX_ADMIN_SERVICES_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxAdminServicesMessageKey, string>;

const MESSAGES: Record<KlyxAdminServicesLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les propositions pour le moment.",
    actionError: "Impossible d’enregistrer cette décision pour le moment.",
    rejectSuccess: "Proposition refusée.",
    approvedPrefix: "Métier ajouté au catalogue : {name}.",
    backDashboard: "Tableau de bord",
    eyebrow: "Administration KLYX",
    title: "Validation des nouveaux métiers",
    pending: "En attente",
    approved: "Approuvés",
    rejected: "Refusés",
    all: "Tous",
    searchPlaceholder: "Rechercher",
    empty: "Aucune proposition",
    notePlaceholder: "Note administrateur",
    approve: "Approuver",
    reject: "Refuser",
    status: "Statut",
    unknownStatus: "Statut à vérifier",
    confirmApprove: "Approuver « {name} » ?",
    confirmReject: "Refuser « {name} » ?",
  },
  en: {
    loadError: "Service proposals are currently unavailable.",
    actionError: "This decision cannot be saved right now.",
    rejectSuccess: "Proposal rejected.",
    approvedPrefix: "Service added to the catalog: {name}.",
    backDashboard: "Dashboard",
    eyebrow: "KLYX administration",
    title: "New service approval",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    all: "All",
    searchPlaceholder: "Search",
    empty: "No proposal",
    notePlaceholder: "Admin note",
    approve: "Approve",
    reject: "Reject",
    status: "Status",
    unknownStatus: "Status needs review",
    confirmApprove: "Approve “{name}”?",
    confirmReject: "Reject “{name}”?",
  },
  nl: {
    loadError: "Dienstvoorstellen zijn momenteel niet beschikbaar.",
    actionError: "Deze beslissing kan momenteel niet worden opgeslagen.",
    rejectSuccess: "Voorstel geweigerd.",
    approvedPrefix: "Dienst toegevoegd aan de catalogus: {name}.",
    backDashboard: "Dashboard",
    eyebrow: "KLYX-beheer",
    title: "Nieuwe diensten valideren",
    pending: "In afwachting",
    approved: "Goedgekeurd",
    rejected: "Geweigerd",
    all: "Alle",
    searchPlaceholder: "Zoeken",
    empty: "Geen voorstel",
    notePlaceholder: "Beheerdersnotitie",
    approve: "Goedkeuren",
    reject: "Weigeren",
    status: "Status",
    unknownStatus: "Status moet worden gecontroleerd",
    confirmApprove: "“{name}” goedkeuren?",
    confirmReject: "“{name}” weigeren?",
  },
  de: {
    loadError: "Dienstvorschläge sind derzeit nicht verfügbar.",
    actionError: "Diese Entscheidung kann derzeit nicht gespeichert werden.",
    rejectSuccess: "Vorschlag abgelehnt.",
    approvedPrefix: "Dienst zum Katalog hinzugefügt: {name}.",
    backDashboard: "Dashboard",
    eyebrow: "KLYX-Administration",
    title: "Neue Dienstleistungen prüfen",
    pending: "Ausstehend",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
    all: "Alle",
    searchPlaceholder: "Suchen",
    empty: "Kein Vorschlag",
    notePlaceholder: "Admin-Notiz",
    approve: "Genehmigen",
    reject: "Ablehnen",
    status: "Status",
    unknownStatus: "Status muss geprüft werden",
    confirmApprove: "„{name}“ genehmigen?",
    confirmReject: "„{name}“ ablehnen?",
  },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_SERVICES_TRANSLATED_LOCALES);

export function resolveKlyxAdminServicesLocale(locale: KlyxLocale): KlyxAdminServicesLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminServicesLocale) : "fr";
}

export function getKlyxAdminServicesDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminServicesLocale(locale)];
}

export function translateKlyxAdminServices(locale: KlyxLocale, key: KlyxAdminServicesMessageKey) {
  return getKlyxAdminServicesDictionary(locale)[key];
}

export function translateKlyxAdminServiceProposalStatus(locale: KlyxLocale, status: string) {
  const dictionary = getKlyxAdminServicesDictionary(locale);
  if (status === "pending") return dictionary.pending;
  if (status === "approved") return dictionary.approved;
  if (status === "rejected") return dictionary.rejected;
  return dictionary.unknownStatus;
}

export function formatKlyxAdminServiceConfirm(
  locale: KlyxLocale,
  action: "approve" | "reject",
  name: string
) {
  const dictionary = getKlyxAdminServicesDictionary(locale);
  return (action === "approve" ? dictionary.confirmApprove : dictionary.confirmReject).replace("{name}", name);
}

export function formatKlyxAdminServiceApproved(locale: KlyxLocale, name: string) {
  return getKlyxAdminServicesDictionary(locale).approvedPrefix.replace("{name}", name);
}
