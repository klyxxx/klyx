import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_VERIFICATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderVerificationLocale =
  (typeof KLYX_PROVIDER_VERIFICATION_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_VERIFICATION_MESSAGE_KEYS = [
  "loadError",
  "uploadError",
  "previewError",
  "deleteError",
  "submitError",
  "fileTooLarge",
  "invalidFileType",
  "documentAdded",
  "documentDeleted",
  "dossierSubmitted",
  "providerOnly",
  "title",
  "description",
  "statusPrefix",
  "privacyTitle",
  "privacyText",
  "required",
  "optional",
  "add",
  "viewDocument",
  "deleteDocument",
  "confirmDelete",
  "submitTitle",
  "submitDescription",
  "submitButton",
] as const;

export type KlyxProviderVerificationMessageKey =
  (typeof KLYX_PROVIDER_VERIFICATION_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderVerificationMessageKey, string>;

type DocumentCopy = {
  title: string;
  description: string;
};

const MESSAGES: Record<KlyxProviderVerificationLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger la vérification pour le moment.",
    uploadError: "Impossible d’envoyer ce document pour le moment.",
    previewError: "Impossible d’ouvrir ce document pour le moment.",
    deleteError: "Impossible de supprimer ce document pour le moment.",
    submitError: "Impossible d’envoyer ce dossier pour le moment.",
    fileTooLarge: "Le fichier dépasse 10 Mo.",
    invalidFileType: "Utilise un PDF, JPG, PNG ou WEBP.",
    documentAdded: "Document envoyé.",
    documentDeleted: "Document supprimé.",
    dossierSubmitted: "Dossier envoyé pour vérification.",
    providerOnly: "Espace prestataire uniquement",
    title: "Vérification prestataire",
    description:
      "Envoie tes documents dans un espace privé. Les clients ne verront jamais les fichiers : uniquement les badges validés.",
    statusPrefix: "Statut :",
    privacyTitle: "Documents privés et sensibles",
    privacyText:
      "N’utilise que tes vrais documents. Ne téléverse pas de document appartenant à une autre personne.",
    required: "Obligatoire",
    optional: "Facultatif",
    add: "Ajouter",
    viewDocument: "Voir le document",
    deleteDocument: "Supprimer le document",
    confirmDelete: "Supprimer ce document ?",
    submitTitle: "Envoyer le dossier",
    submitDescription:
      "La pièce d’identité et le justificatif d’adresse sont obligatoires. L’analyse automatique pourra aider, mais la validation finale ne sera pas irréversible ni entièrement automatisée.",
    submitButton: "Envoyer pour vérification",
  },
  en: {
    loadError: "Verification cannot be loaded right now.",
    uploadError: "This document cannot be uploaded right now.",
    previewError: "This document cannot be opened right now.",
    deleteError: "This document cannot be deleted right now.",
    submitError: "This verification file cannot be submitted right now.",
    fileTooLarge: "The file exceeds 10 MB.",
    invalidFileType: "Use a PDF, JPG, PNG, or WEBP file.",
    documentAdded: "Document uploaded.",
    documentDeleted: "Document deleted.",
    dossierSubmitted: "Verification file submitted.",
    providerOnly: "Provider area only",
    title: "Provider verification",
    description:
      "Upload your documents to a private area. Clients will never see the files, only verified badges.",
    statusPrefix: "Status:",
    privacyTitle: "Private and sensitive documents",
    privacyText:
      "Only use your own genuine documents. Do not upload a document that belongs to someone else.",
    required: "Required",
    optional: "Optional",
    add: "Add",
    viewDocument: "View document",
    deleteDocument: "Delete document",
    confirmDelete: "Delete this document?",
    submitTitle: "Submit verification file",
    submitDescription:
      "An identity document and proof of address are required. Automated analysis may assist, but final validation will not be irreversible or fully automated.",
    submitButton: "Submit for verification",
  },
  nl: {
    loadError: "De verificatie kan momenteel niet worden geladen.",
    uploadError: "Dit document kan momenteel niet worden geüpload.",
    previewError: "Dit document kan momenteel niet worden geopend.",
    deleteError: "Dit document kan momenteel niet worden verwijderd.",
    submitError: "Dit verificatiedossier kan momenteel niet worden ingediend.",
    fileTooLarge: "Het bestand is groter dan 10 MB.",
    invalidFileType: "Gebruik een PDF-, JPG-, PNG- of WEBP-bestand.",
    documentAdded: "Document geüpload.",
    documentDeleted: "Document verwijderd.",
    dossierSubmitted: "Verificatiedossier ingediend.",
    providerOnly: "Alleen voor dienstverleners",
    title: "Verificatie dienstverlener",
    description:
      "Upload je documenten naar een privéomgeving. Klanten zien de bestanden nooit, alleen gevalideerde badges.",
    statusPrefix: "Status:",
    privacyTitle: "Privé- en gevoelige documenten",
    privacyText:
      "Gebruik alleen je eigen echte documenten. Upload geen document dat van iemand anders is.",
    required: "Verplicht",
    optional: "Optioneel",
    add: "Toevoegen",
    viewDocument: "Document bekijken",
    deleteDocument: "Document verwijderen",
    confirmDelete: "Dit document verwijderen?",
    submitTitle: "Verificatiedossier indienen",
    submitDescription:
      "Een identiteitsdocument en adresbewijs zijn verplicht. Automatische analyse kan helpen, maar de eindvalidatie wordt niet onomkeerbaar of volledig geautomatiseerd.",
    submitButton: "Indienen voor verificatie",
  },
  de: {
    loadError: "Die Verifizierung kann derzeit nicht geladen werden.",
    uploadError: "Dieses Dokument kann derzeit nicht hochgeladen werden.",
    previewError: "Dieses Dokument kann derzeit nicht geöffnet werden.",
    deleteError: "Dieses Dokument kann derzeit nicht gelöscht werden.",
    submitError: "Diese Verifizierungsakte kann derzeit nicht eingereicht werden.",
    fileTooLarge: "Die Datei ist größer als 10 MB.",
    invalidFileType: "Verwende eine PDF-, JPG-, PNG- oder WEBP-Datei.",
    documentAdded: "Dokument hochgeladen.",
    documentDeleted: "Dokument gelöscht.",
    dossierSubmitted: "Verifizierungsakte eingereicht.",
    providerOnly: "Nur für Anbieter",
    title: "Anbieterverifizierung",
    description:
      "Lade deine Dokumente in einen privaten Bereich hoch. Kunden sehen die Dateien niemals, sondern nur bestätigte Abzeichen.",
    statusPrefix: "Status:",
    privacyTitle: "Private und sensible Dokumente",
    privacyText:
      "Verwende nur deine eigenen echten Dokumente. Lade kein Dokument hoch, das einer anderen Person gehört.",
    required: "Erforderlich",
    optional: "Optional",
    add: "Hinzufügen",
    viewDocument: "Dokument ansehen",
    deleteDocument: "Dokument löschen",
    confirmDelete: "Dieses Dokument löschen?",
    submitTitle: "Verifizierungsakte einreichen",
    submitDescription:
      "Ein Identitätsdokument und ein Adressnachweis sind erforderlich. Automatische Analyse kann unterstützen, aber die endgültige Prüfung wird weder unumkehrbar noch vollständig automatisiert sein.",
    submitButton: "Zur Verifizierung einreichen",
  },
};

const DOCUMENT_TYPES: Record<
  KlyxProviderVerificationLocale,
  Record<string, DocumentCopy>
> = {
  fr: {
    identity: {
      title: "Pièce d’identité",
      description: "Carte d’identité, passeport ou titre de séjour valide.",
    },
    address: {
      title: "Justificatif d’adresse",
      description: "Document récent indiquant ton nom et ton adresse.",
    },
    business: {
      title: "Document d’entreprise",
      description: "Numéro d’entreprise ou preuve d’activité, si applicable.",
    },
    insurance: {
      title: "Assurance professionnelle",
      description: "Attestation d’assurance liée à ton activité.",
    },
    professional_certificate: {
      title: "Diplôme ou certificat",
      description: "Document professionnel utile pour les métiers réglementés.",
    },
  },
  en: {
    identity: {
      title: "Identity document",
      description: "Valid identity card, passport, or residence permit.",
    },
    address: {
      title: "Proof of address",
      description: "Recent document showing your name and address.",
    },
    business: {
      title: "Business document",
      description: "Business number or proof of activity, when applicable.",
    },
    insurance: {
      title: "Professional insurance",
      description: "Insurance certificate related to your activity.",
    },
    professional_certificate: {
      title: "Diploma or certificate",
      description: "Professional document useful for regulated professions.",
    },
  },
  nl: {
    identity: {
      title: "Identiteitsdocument",
      description: "Geldige identiteitskaart, paspoort of verblijfsvergunning.",
    },
    address: {
      title: "Adresbewijs",
      description: "Recent document met je naam en adres.",
    },
    business: {
      title: "Bedrijfsdocument",
      description: "Ondernemingsnummer of bewijs van activiteit, indien van toepassing.",
    },
    insurance: {
      title: "Beroepsverzekering",
      description: "Verzekeringsattest dat verband houdt met je activiteit.",
    },
    professional_certificate: {
      title: "Diploma of certificaat",
      description: "Professioneel document dat nuttig is voor gereglementeerde beroepen.",
    },
  },
  de: {
    identity: {
      title: "Identitätsdokument",
      description: "Gültiger Personalausweis, Reisepass oder Aufenthaltstitel.",
    },
    address: {
      title: "Adressnachweis",
      description: "Aktuelles Dokument mit deinem Namen und deiner Adresse.",
    },
    business: {
      title: "Unternehmensdokument",
      description: "Unternehmensnummer oder Tätigkeitsnachweis, falls zutreffend.",
    },
    insurance: {
      title: "Berufshaftpflichtversicherung",
      description: "Versicherungsnachweis für deine Tätigkeit.",
    },
    professional_certificate: {
      title: "Diplom oder Zertifikat",
      description: "Berufliches Dokument, das für reglementierte Berufe relevant ist.",
    },
  },
};

const STATUSES: Record<KlyxProviderVerificationLocale, Record<string, string>> = {
  fr: {
    not_started: "Non commencé",
    incomplete: "À compléter",
    submitted: "Envoyé",
    under_review: "En vérification",
    approved: "Vérifié",
    changes_required: "Modifications demandées",
    rejected: "Refusé",
    missing: "Manquant",
    optional: "Facultatif",
    uploaded: "Envoyé",
  },
  en: {
    not_started: "Not started",
    incomplete: "To complete",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Verified",
    changes_required: "Changes required",
    rejected: "Rejected",
    missing: "Missing",
    optional: "Optional",
    uploaded: "Uploaded",
  },
  nl: {
    not_started: "Niet gestart",
    incomplete: "Aan te vullen",
    submitted: "Ingediend",
    under_review: "In beoordeling",
    approved: "Geverifieerd",
    changes_required: "Wijzigingen vereist",
    rejected: "Geweigerd",
    missing: "Ontbreekt",
    optional: "Optioneel",
    uploaded: "Geüpload",
  },
  de: {
    not_started: "Nicht begonnen",
    incomplete: "Zu vervollständigen",
    submitted: "Eingereicht",
    under_review: "In Prüfung",
    approved: "Verifiziert",
    changes_required: "Änderungen erforderlich",
    rejected: "Abgelehnt",
    missing: "Fehlt",
    optional: "Optional",
    uploaded: "Hochgeladen",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_PROVIDER_VERIFICATION_TRANSLATED_LOCALES
);

export function resolveKlyxProviderVerificationLocale(
  locale: KlyxLocale
): KlyxProviderVerificationLocale {
  return LOCALE_SET.has(locale)
    ? (locale as KlyxProviderVerificationLocale)
    : "fr";
}

export function translateKlyxProviderVerification(
  locale: KlyxLocale,
  key: KlyxProviderVerificationMessageKey
): string {
  return MESSAGES[resolveKlyxProviderVerificationLocale(locale)][key];
}

export function getKlyxProviderVerificationDocumentType(
  locale: KlyxLocale,
  type: string
): DocumentCopy | null {
  const resolved = resolveKlyxProviderVerificationLocale(locale);
  return DOCUMENT_TYPES[resolved][type] ?? null;
}

export function translateKlyxProviderVerificationStatus(
  locale: KlyxLocale,
  status: string
): string {
  const resolved = resolveKlyxProviderVerificationLocale(locale);
  return STATUSES[resolved][status] ?? status;
}

export function formatKlyxProviderVerificationFileSize(
  locale: KlyxLocale,
  bytes: number
): string {
  const resolved = resolveKlyxProviderVerificationLocale(locale);
  const kilobytes = Math.max(0, Math.ceil(Number(bytes) / 1024));
  const language =
    resolved === "fr"
      ? "fr-BE"
      : resolved === "nl"
        ? "nl-BE"
        : resolved === "de"
          ? "de-DE"
          : "en-GB";

  return `${new Intl.NumberFormat(language).format(kilobytes)} KB`;
}
