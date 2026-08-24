import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxAdminSkillsLocale =
  (typeof KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_SKILLS_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "openError",
  "backAdmin",
  "eyebrow",
  "title",
  "description",
  "authorityTitle",
  "authorityText",
  "searchPlaceholder",
  "refresh",
  "empty",
  "cityMissing",
  "unknownStatus",
  "decisionPrefix",
  "documentsTitle",
  "noDocuments",
  "unknownDocumentStatus",
  "view",
] as const;

export type KlyxAdminSkillsMessageKey =
  (typeof KLYX_ADMIN_SKILLS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAdminSkillsMessageKey, string>;

const MESSAGES: Record<KlyxAdminSkillsLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Impossible de charger les dossiers de compétence pour le moment.",
    openError: "Impossible d’ouvrir ce document pour le moment.",
    backAdmin: "Centre Admin KLYX",
    eyebrow: "Supervision",
    title: "Compétences prestataires",
    description:
      "Tu peux consulter les dossiers et leurs décisions. Cette console ne contient volontairement aucun bouton Approuver ou Refuser.",
    authorityTitle: "Autorité de décision : vérificateur externe",
    authorityText:
      "KLYX prépare l’intégration Sumsub pour l’identité et les contrôles documentaires. Les compétences réglementées resteront soumises aux preuves exigées pour le métier et le pays concernés.",
    searchPlaceholder: "Rechercher un prestataire, métier, ville ou statut...",
    refresh: "Actualiser",
    empty: "Aucun dossier de compétence trouvé.",
    cityMissing: "Ville non renseignée",
    unknownStatus: "Statut à vérifier",
    decisionPrefix: "Décision :",
    documentsTitle: "Documents de preuve",
    noDocuments: "Aucun document.",
    unknownDocumentStatus: "Statut du document à vérifier",
    view: "Voir",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Skill verification cases are currently unavailable.",
    openError: "This document cannot be opened right now.",
    backAdmin: "KLYX Admin Center",
    eyebrow: "Supervision",
    title: "Provider skills",
    description:
      "You can review cases and their decisions. This console intentionally contains no Approve or Reject button.",
    authorityTitle: "Decision authority: external verifier",
    authorityText:
      "KLYX is preparing the Sumsub integration for identity and document checks. Regulated skills will remain subject to the evidence required for the relevant profession and country.",
    searchPlaceholder: "Search provider, skill, city, or status...",
    refresh: "Refresh",
    empty: "No skill verification case found.",
    cityMissing: "City not provided",
    unknownStatus: "Status needs review",
    decisionPrefix: "Decision:",
    documentsTitle: "Evidence documents",
    noDocuments: "No document.",
    unknownDocumentStatus: "Document status needs review",
    view: "View",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "Competentiedossiers zijn momenteel niet beschikbaar.",
    openError: "Dit document kan momenteel niet worden geopend.",
    backAdmin: "KLYX-beheercentrum",
    eyebrow: "Supervisie",
    title: "Vaardigheden dienstverleners",
    description:
      "Je kunt dossiers en hun beslissingen bekijken. Deze console bevat bewust geen knop Goedkeuren of Weigeren.",
    authorityTitle: "Beslissingsbevoegdheid: externe verificateur",
    authorityText:
      "KLYX bereidt de Sumsub-integratie voor identiteit en documentcontroles voor. Gereglementeerde vaardigheden blijven onderworpen aan de vereiste bewijzen voor het betrokken beroep en land.",
    searchPlaceholder: "Zoek dienstverlener, vaardigheid, stad of status...",
    refresh: "Vernieuwen",
    empty: "Geen competentiedossier gevonden.",
    cityMissing: "Stad niet opgegeven",
    unknownStatus: "Status moet worden gecontroleerd",
    decisionPrefix: "Beslissing:",
    documentsTitle: "Bewijsdocumenten",
    noDocuments: "Geen document.",
    unknownDocumentStatus: "Documentstatus moet worden gecontroleerd",
    view: "Bekijken",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Kompetenzprüfungen sind derzeit nicht verfügbar.",
    openError: "Dieses Dokument kann derzeit nicht geöffnet werden.",
    backAdmin: "KLYX Admin-Center",
    eyebrow: "Aufsicht",
    title: "Anbieterkompetenzen",
    description:
      "Du kannst Fälle und ihre Entscheidungen einsehen. Diese Konsole enthält bewusst keine Schaltfläche zum Genehmigen oder Ablehnen.",
    authorityTitle: "Entscheidungsinstanz: externer Prüfer",
    authorityText:
      "KLYX bereitet die Sumsub-Integration für Identitäts- und Dokumentprüfungen vor. Reglementierte Kompetenzen bleiben den für Beruf und Land erforderlichen Nachweisen unterworfen.",
    searchPlaceholder: "Anbieter, Kompetenz, Stadt oder Status suchen...",
    refresh: "Aktualisieren",
    empty: "Keine Kompetenzprüfung gefunden.",
    cityMissing: "Stadt nicht angegeben",
    unknownStatus: "Status muss geprüft werden",
    decisionPrefix: "Entscheidung:",
    documentsTitle: "Nachweisdokumente",
    noDocuments: "Kein Dokument.",
    unknownDocumentStatus: "Dokumentstatus muss geprüft werden",
    view: "Ansehen",
  },
};

const STATUSES: Record<KlyxAdminSkillsLocale, Record<string, string>> = {
  fr: {
    not_started: "À compléter",
    submitted: "Envoyée",
    under_review: "En vérification",
    approved: "Compétence vérifiée",
    changes_required: "Corrections demandées",
    rejected: "Refusée",
  },
  en: {
    not_started: "To complete",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Skill verified",
    changes_required: "Changes required",
    rejected: "Rejected",
  },
  nl: {
    not_started: "Aan te vullen",
    submitted: "Ingediend",
    under_review: "In beoordeling",
    approved: "Vaardigheid geverifieerd",
    changes_required: "Correcties vereist",
    rejected: "Geweigerd",
  },
  de: {
    not_started: "Zu vervollständigen",
    submitted: "Eingereicht",
    under_review: "In Prüfung",
    approved: "Kompetenz verifiziert",
    changes_required: "Korrekturen erforderlich",
    rejected: "Abgelehnt",
  },
};

const DOCUMENT_STATUSES: Record<KlyxAdminSkillsLocale, Record<string, string>> = {
  fr: {
    pending: "En attente",
    uploaded: "Envoyé",
    under_review: "En vérification",
    approved: "Validé",
    rejected: "Refusé",
  },
  en: {
    pending: "Pending",
    uploaded: "Uploaded",
    under_review: "Under review",
    approved: "Approved",
    rejected: "Rejected",
  },
  nl: {
    pending: "In afwachting",
    uploaded: "Geüpload",
    under_review: "In beoordeling",
    approved: "Goedgekeurd",
    rejected: "Geweigerd",
  },
  de: {
    pending: "Ausstehend",
    uploaded: "Hochgeladen",
    under_review: "In Prüfung",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
  },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_SKILLS_TRANSLATED_LOCALES);

export function resolveKlyxAdminSkillsLocale(locale: KlyxLocale): KlyxAdminSkillsLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminSkillsLocale) : "fr";
}

export function getKlyxAdminSkillsDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminSkillsLocale(locale)];
}

export function translateKlyxAdminSkills(
  locale: KlyxLocale,
  key: KlyxAdminSkillsMessageKey
) {
  return getKlyxAdminSkillsDictionary(locale)[key];
}

export function translateKlyxAdminSkillStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxAdminSkillsLocale(locale);
  return STATUSES[resolved][status] ?? MESSAGES[resolved].unknownStatus;
}

export function translateKlyxAdminSkillDocumentStatus(
  locale: KlyxLocale,
  status: string
) {
  const resolved = resolveKlyxAdminSkillsLocale(locale);
  return DOCUMENT_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownDocumentStatus;
}

export function formatKlyxAdminSkillExperience(
  locale: KlyxLocale,
  years: number | null
) {
  const resolved = resolveKlyxAdminSkillsLocale(locale);
  const value =
    typeof years === "number" && Number.isFinite(years)
      ? Math.max(0, years)
      : 0;

  if (resolved === "en") {
    return `${value} ${value === 1 ? "year" : "years"} of experience`;
  }
  if (resolved === "nl") return `${value} jaar ervaring`;
  if (resolved === "de") {
    return `${value} ${value === 1 ? "Jahr" : "Jahre"} Erfahrung`;
  }
  return `${value} ${value === 1 ? "an" : "ans"} d’expérience`;
}
