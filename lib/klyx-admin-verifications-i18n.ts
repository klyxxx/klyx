import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxAdminVerificationsLocale = (typeof KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_VERIFICATIONS_MESSAGE_KEYS = [
  "loadError", "documentError", "decisionError", "decisionSuccess",
  "eyebrow", "title", "description", "refresh", "empty",
  "profile", "caseLabel", "submitted", "notProvided", "technicalPrecheck",
  "privateDocuments", "decisionNote", "notePlaceholder",
  "underReviewAction", "approveAction", "changesAction", "rejectAction", "reopenAction",
  "unknownStatus", "unknownDocumentType", "unknownDocumentStatus", "unknownPrecheck",
  "identityLabel", "identityFound", "identityMissing",
  "addressLabel", "addressFound", "addressMissing",
  "formatsLabel", "formatsOk", "formatsFailed",
  "sizesLabel", "sizesOk", "sizesFailed",
  "duplicatesLabel", "duplicatesOk", "duplicatesFailed",
] as const;
export type KlyxAdminVerificationsMessageKey = (typeof KLYX_ADMIN_VERIFICATIONS_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxAdminVerificationsMessageKey, string>;

const MESSAGES: Record<KlyxAdminVerificationsLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les dossiers de vérification pour le moment.",
    documentError: "Impossible d’ouvrir ce document pour le moment.",
    decisionError: "Impossible d’enregistrer cette décision pour le moment.",
    decisionSuccess: "Décision enregistrée.",
    eyebrow: "Administration KLYX", title: "Vérifications prestataires",
    description: "La pré-analyse vérifie uniquement les éléments techniques. Elle ne garantit jamais l’authenticité d’une identité.",
    refresh: "Actualiser", empty: "Aucun dossier soumis", profile: "Profil", caseLabel: "Dossier",
    submitted: "Soumis", notProvided: "Non renseigné", technicalPrecheck: "Pré-analyse technique",
    privateDocuments: "Documents privés", decisionNote: "Note de décision",
    notePlaceholder: "Explique la décision, surtout pour une correction ou un refus.",
    underReviewAction: "Mettre en analyse", approveAction: "Approuver", changesAction: "Demander des corrections", rejectAction: "Refuser", reopenAction: "Rouvrir",
    unknownStatus: "Statut à vérifier", unknownDocumentType: "Type de document à vérifier", unknownDocumentStatus: "Statut de document à vérifier", unknownPrecheck: "Contrôle technique à vérifier",
    identityLabel: "Pièce d’identité présente", identityFound: "{count} document(s) trouvé(s).", identityMissing: "Aucune pièce d’identité.",
    addressLabel: "Justificatif d’adresse présent", addressFound: "{count} document(s) trouvé(s).", addressMissing: "Aucun justificatif d’adresse.",
    formatsLabel: "Formats autorisés", formatsOk: "Tous les fichiers utilisent un format autorisé.", formatsFailed: "Au moins un fichier utilise un format interdit.",
    sizesLabel: "Tailles autorisées", sizesOk: "Tous les fichiers respectent la limite de 10 Mo.", sizesFailed: "Au moins un fichier dépasse la limite.",
    duplicatesLabel: "Pas de doublon évident", duplicatesOk: "Aucun doublon évident par nom de fichier.", duplicatesFailed: "Des noms de fichiers identiques ont été détectés.",
  },
  en: {
    loadError: "Verification cases are currently unavailable.", documentError: "This document cannot be opened right now.", decisionError: "This decision cannot be saved right now.", decisionSuccess: "Decision saved.",
    eyebrow: "KLYX administration", title: "Provider verifications", description: "The precheck only verifies technical elements. It never guarantees the authenticity of an identity.",
    refresh: "Refresh", empty: "No submitted case", profile: "Profile", caseLabel: "Case", submitted: "Submitted", notProvided: "Not provided", technicalPrecheck: "Technical precheck", privateDocuments: "Private documents", decisionNote: "Decision note", notePlaceholder: "Explain the decision, especially for a correction request or rejection.",
    underReviewAction: "Move to review", approveAction: "Approve", changesAction: "Request changes", rejectAction: "Reject", reopenAction: "Reopen",
    unknownStatus: "Status needs review", unknownDocumentType: "Document type needs review", unknownDocumentStatus: "Document status needs review", unknownPrecheck: "Technical check needs review",
    identityLabel: "Identity document present", identityFound: "{count} document(s) found.", identityMissing: "No identity document.", addressLabel: "Address proof present", addressFound: "{count} document(s) found.", addressMissing: "No address proof.", formatsLabel: "Allowed formats", formatsOk: "All files use an allowed format.", formatsFailed: "At least one file uses a disallowed format.", sizesLabel: "Allowed sizes", sizesOk: "All files respect the 10 MB limit.", sizesFailed: "At least one file exceeds the limit.", duplicatesLabel: "No obvious duplicate", duplicatesOk: "No obvious duplicate by file name.", duplicatesFailed: "Identical file names were detected.",
  },
  nl: {
    loadError: "Verificatiedossiers zijn momenteel niet beschikbaar.", documentError: "Dit document kan momenteel niet worden geopend.", decisionError: "Deze beslissing kan momenteel niet worden opgeslagen.", decisionSuccess: "Beslissing opgeslagen.",
    eyebrow: "KLYX-beheer", title: "Verificaties van dienstverleners", description: "De voorcontrole verifieert alleen technische elementen. Ze garandeert nooit de echtheid van een identiteit.",
    refresh: "Vernieuwen", empty: "Geen ingediend dossier", profile: "Profiel", caseLabel: "Dossier", submitted: "Ingediend", notProvided: "Niet ingevuld", technicalPrecheck: "Technische voorcontrole", privateDocuments: "Privédocumenten", decisionNote: "Beslissingsnotitie", notePlaceholder: "Leg de beslissing uit, vooral bij een correctieverzoek of weigering.",
    underReviewAction: "In beoordeling zetten", approveAction: "Goedkeuren", changesAction: "Correcties vragen", rejectAction: "Weigeren", reopenAction: "Heropenen",
    unknownStatus: "Status moet worden gecontroleerd", unknownDocumentType: "Documenttype moet worden gecontroleerd", unknownDocumentStatus: "Documentstatus moet worden gecontroleerd", unknownPrecheck: "Technische controle moet worden nagekeken",
    identityLabel: "Identiteitsdocument aanwezig", identityFound: "{count} document(en) gevonden.", identityMissing: "Geen identiteitsdocument.", addressLabel: "Adresbewijs aanwezig", addressFound: "{count} document(en) gevonden.", addressMissing: "Geen adresbewijs.", formatsLabel: "Toegestane formaten", formatsOk: "Alle bestanden gebruiken een toegestaan formaat.", formatsFailed: "Minstens één bestand gebruikt een niet-toegestaan formaat.", sizesLabel: "Toegestane groottes", sizesOk: "Alle bestanden respecteren de limiet van 10 MB.", sizesFailed: "Minstens één bestand overschrijdt de limiet.", duplicatesLabel: "Geen duidelijk duplicaat", duplicatesOk: "Geen duidelijk duplicaat op bestandsnaam.", duplicatesFailed: "Identieke bestandsnamen zijn gedetecteerd.",
  },
  de: {
    loadError: "Verifizierungsfälle sind derzeit nicht verfügbar.", documentError: "Dieses Dokument kann derzeit nicht geöffnet werden.", decisionError: "Diese Entscheidung kann derzeit nicht gespeichert werden.", decisionSuccess: "Entscheidung gespeichert.",
    eyebrow: "KLYX-Administration", title: "Anbieter-Verifizierungen", description: "Die Vorprüfung kontrolliert nur technische Elemente. Sie garantiert niemals die Echtheit einer Identität.",
    refresh: "Aktualisieren", empty: "Kein eingereichter Fall", profile: "Profil", caseLabel: "Fall", submitted: "Eingereicht", notProvided: "Nicht angegeben", technicalPrecheck: "Technische Vorprüfung", privateDocuments: "Private Dokumente", decisionNote: "Entscheidungsnotiz", notePlaceholder: "Erläutere die Entscheidung, besonders bei Korrekturanforderung oder Ablehnung.",
    underReviewAction: "In Prüfung setzen", approveAction: "Genehmigen", changesAction: "Korrekturen anfordern", rejectAction: "Ablehnen", reopenAction: "Wieder öffnen",
    unknownStatus: "Status muss geprüft werden", unknownDocumentType: "Dokumenttyp muss geprüft werden", unknownDocumentStatus: "Dokumentstatus muss geprüft werden", unknownPrecheck: "Technische Prüfung muss kontrolliert werden",
    identityLabel: "Identitätsdokument vorhanden", identityFound: "{count} Dokument(e) gefunden.", identityMissing: "Kein Identitätsdokument.", addressLabel: "Adressnachweis vorhanden", addressFound: "{count} Dokument(e) gefunden.", addressMissing: "Kein Adressnachweis.", formatsLabel: "Zulässige Formate", formatsOk: "Alle Dateien verwenden ein zulässiges Format.", formatsFailed: "Mindestens eine Datei verwendet ein unzulässiges Format.", sizesLabel: "Zulässige Größen", sizesOk: "Alle Dateien halten die Grenze von 10 MB ein.", sizesFailed: "Mindestens eine Datei überschreitet die Grenze.", duplicatesLabel: "Kein offensichtliches Duplikat", duplicatesOk: "Kein offensichtliches Duplikat anhand des Dateinamens.", duplicatesFailed: "Identische Dateinamen wurden erkannt.",
  },
};

const STATUSES: Record<KlyxAdminVerificationsLocale, Record<string, string>> = {
  fr: { submitted: "Envoyé", under_review: "En analyse", approved: "Approuvé", changes_required: "Corrections demandées", rejected: "Refusé", reopened: "Rouvert" },
  en: { submitted: "Submitted", under_review: "Under review", approved: "Approved", changes_required: "Changes required", rejected: "Rejected", reopened: "Reopened" },
  nl: { submitted: "Ingediend", under_review: "In beoordeling", approved: "Goedgekeurd", changes_required: "Correcties vereist", rejected: "Geweigerd", reopened: "Heropend" },
  de: { submitted: "Eingereicht", under_review: "In Prüfung", approved: "Genehmigt", changes_required: "Korrekturen erforderlich", rejected: "Abgelehnt", reopened: "Wieder geöffnet" },
};

const DOCUMENT_TYPES: Record<KlyxAdminVerificationsLocale, Record<string, string>> = {
  fr: { identity: "Identité", address: "Adresse", business: "Entreprise", insurance: "Assurance", professional: "Professionnel" },
  en: { identity: "Identity", address: "Address", business: "Business", insurance: "Insurance", professional: "Professional" },
  nl: { identity: "Identiteit", address: "Adres", business: "Onderneming", insurance: "Verzekering", professional: "Professioneel" },
  de: { identity: "Identität", address: "Adresse", business: "Unternehmen", insurance: "Versicherung", professional: "Beruflich" },
};

const DOCUMENT_STATUSES: Record<KlyxAdminVerificationsLocale, Record<string, string>> = {
  fr: { pending: "En attente", uploaded: "Téléversé", approved: "Approuvé", rejected: "Refusé", under_review: "En analyse" },
  en: { pending: "Pending", uploaded: "Uploaded", approved: "Approved", rejected: "Rejected", under_review: "Under review" },
  nl: { pending: "In afwachting", uploaded: "Geüpload", approved: "Goedgekeurd", rejected: "Geweigerd", under_review: "In beoordeling" },
  de: { pending: "Ausstehend", uploaded: "Hochgeladen", approved: "Genehmigt", rejected: "Abgelehnt", under_review: "In Prüfung" },
};

const INTL: Record<KlyxAdminVerificationsLocale, string> = { fr: "fr-BE", en: "en-BE", nl: "nl-BE", de: "de-BE" };
const LOCALE_SET = new Set<string>(KLYX_ADMIN_VERIFICATIONS_TRANSLATED_LOCALES);

export function resolveKlyxAdminVerificationsLocale(locale: KlyxLocale): KlyxAdminVerificationsLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminVerificationsLocale) : "fr";
}
export function getKlyxAdminVerificationsDictionary(locale: KlyxLocale) { return MESSAGES[resolveKlyxAdminVerificationsLocale(locale)]; }
export function translateKlyxAdminVerifications(locale: KlyxLocale, key: KlyxAdminVerificationsMessageKey) { return getKlyxAdminVerificationsDictionary(locale)[key]; }
export function translateKlyxAdminVerificationStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxAdminVerificationsLocale(locale);
  return STATUSES[resolved][status] ?? MESSAGES[resolved].unknownStatus;
}
export function translateKlyxAdminVerificationDocumentType(locale: KlyxLocale, type: string) {
  const resolved = resolveKlyxAdminVerificationsLocale(locale);
  return DOCUMENT_TYPES[resolved][type] ?? MESSAGES[resolved].unknownDocumentType;
}
export function translateKlyxAdminVerificationDocumentStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxAdminVerificationsLocale(locale);
  return DOCUMENT_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownDocumentStatus;
}
export function getKlyxAdminVerificationsIntlLocale(locale: KlyxLocale) { return INTL[resolveKlyxAdminVerificationsLocale(locale)]; }
export function translateKlyxAdminVerificationAction(locale: KlyxLocale, action: string) {
  const d = getKlyxAdminVerificationsDictionary(locale);
  if (action === "under_review") return d.underReviewAction;
  if (action === "approved") return d.approveAction;
  if (action === "changes_required") return d.changesAction;
  if (action === "rejected") return d.rejectAction;
  if (action === "reopened") return d.reopenAction;
  return d.unknownStatus;
}

function countFromDetail(detail: string) {
  const match = detail.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function getKlyxAdminVerificationPrecheckText(
  locale: KlyxLocale,
  check: { code: string; passed: boolean; detail: string }
) {
  const d = getKlyxAdminVerificationsDictionary(locale);
  const count = countFromDetail(check.detail);
  if (check.code === "identity_present") return { label: d.identityLabel, detail: check.passed ? d.identityFound.replace("{count}", String(count)) : d.identityMissing };
  if (check.code === "address_present") return { label: d.addressLabel, detail: check.passed ? d.addressFound.replace("{count}", String(count)) : d.addressMissing };
  if (check.code === "formats_allowed") return { label: d.formatsLabel, detail: check.passed ? d.formatsOk : d.formatsFailed };
  if (check.code === "sizes_allowed") return { label: d.sizesLabel, detail: check.passed ? d.sizesOk : d.sizesFailed };
  if (check.code === "no_name_duplicates") return { label: d.duplicatesLabel, detail: check.passed ? d.duplicatesOk : d.duplicatesFailed };
  return { label: d.unknownPrecheck, detail: d.unknownPrecheck };
}
