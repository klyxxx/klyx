import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_SKILLS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderSkillsLocale =
  (typeof KLYX_PROVIDER_SKILLS_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_SKILLS_MESSAGE_KEYS = [
  "loadError",
  "uploadError",
  "saveError",
  "fileTooLarge",
  "invalidFileType",
  "proofAdded",
  "saved",
  "submitted",
  "backProvider",
  "eyebrow",
  "title",
  "description",
  "trustTitle",
  "trustDescription",
  "refresh",
  "emptyTitle",
  "emptyDescription",
  "addSkill",
  "verified",
  "yearsExperience",
  "proofType",
  "proofPlaceholder",
  "statementLabel",
  "statementPlaceholder",
  "proofsAdded",
  "noProofs",
  "addProof",
  "save",
  "submit",
  "submitReadyTitle",
  "submitBlockedTitle",
  "requirementsLoading",
  "requirementsUnavailableTitle",
  "requirementsUnavailableText",
  "requirementsTitle",
  "requirementsReadyText",
  "requirementsIncompleteText",
  "readyBadge",
  "incompleteBadge",
  "identity",
  "identityRequired",
  "notRequired",
  "experience",
  "noMinimum",
  "insurance",
  "insuranceRequired",
  "authorization",
  "professionalLicenseFallback",
  "requiredProofs",
  "missing",
  "validated",
  "acceptedProofs",
  "regulatedTitle",
  "regulatedText",
] as const;

export type KlyxProviderSkillsMessageKey =
  (typeof KLYX_PROVIDER_SKILLS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderSkillsMessageKey, string>;

const MESSAGES: Record<KlyxProviderSkillsLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger tes compétences pour le moment.",
    uploadError: "Impossible d’ajouter cette preuve pour le moment.",
    saveError: "Impossible d’enregistrer cette compétence pour le moment.",
    fileTooLarge: "Le fichier dépasse 10 Mo.",
    invalidFileType: "Utilise un PDF, JPG, PNG ou WEBP.",
    proofAdded: "Preuve ajoutée.",
    saved: "Informations enregistrées.",
    submitted: "Compétence envoyée à KLYX pour vérification.",
    backProvider: "Mon activité",
    eyebrow: "Confiance KLYX",
    title: "Mes compétences",
    description:
      "Tu peux proposer autant de métiers que tu maîtrises. Chaque métier possède son propre dossier de preuves et sa propre validation KLYX.",
    trustTitle: "Une compétence est vérifiée séparément",
    trustDescription:
      "Selon le métier, une preuve peut être un diplôme, une formation, une licence, une assurance, une référence professionnelle ou un portfolio. KLYX demandera ensuite les justificatifs obligatoires adaptés aux activités réglementées.",
    refresh: "Actualiser",
    emptyTitle: "Aucun métier ajouté",
    emptyDescription: "Ajoute d’abord un métier dans ton activité.",
    addSkill: "Ajouter un métier",
    verified: "Compétence vérifiée",
    yearsExperience: "Années d’expérience",
    proofType: "Type de preuve",
    proofPlaceholder: "Choisir un type de preuve",
    statementLabel: "Explique ton expérience pour ce métier",
    statementPlaceholder:
      "Formation, années d’expérience, types de missions réalisées...",
    proofsAdded: "Preuves ajoutées",
    noProofs: "Aucune preuve pour ce métier.",
    addProof: "Ajouter une preuve",
    save: "Enregistrer",
    submit: "Envoyer à KLYX",
    submitReadyTitle: "Envoyer cette compétence à KLYX",
    submitBlockedTitle: "Complète d’abord toutes les exigences obligatoires.",
    requirementsLoading: "Vérification des exigences KLYX...",
    requirementsUnavailableTitle: "Exigences indisponibles",
    requirementsUnavailableText:
      "Impossible de déterminer les exigences de ce métier.",
    requirementsTitle: "Exigences KLYX",
    requirementsReadyText: "Ton dossier remplit les exigences actuelles.",
    requirementsIncompleteText:
      "Complète les éléments manquants avant l’envoi.",
    readyBadge: "Prêt à envoyer",
    incompleteBadge: "Dossier incomplet",
    identity: "Identité",
    identityRequired: "Vérification d’identité requise",
    notRequired: "Non requise",
    experience: "Expérience",
    noMinimum: "Aucun minimum configuré",
    insurance: "Assurance",
    insuranceRequired: "Assurance professionnelle obligatoire",
    authorization: "Autorisation",
    professionalLicenseFallback: "Licence ou autorisation professionnelle",
    requiredProofs: "Preuves obligatoires",
    missing: "Manquant",
    validated: "Validé",
    acceptedProofs: "Preuves acceptées",
    regulatedTitle: "Activité à exigences renforcées",
    regulatedText:
      "La publication reste bloquée jusqu’à validation des justificatifs configurés pour ce métier.",
  },
  en: {
    loadError: "Your skills cannot be loaded right now.",
    uploadError: "This evidence cannot be added right now.",
    saveError: "This skill cannot be saved right now.",
    fileTooLarge: "The file is larger than 10 MB.",
    invalidFileType: "Use a PDF, JPG, PNG, or WEBP file.",
    proofAdded: "Evidence added.",
    saved: "Information saved.",
    submitted: "Skill sent to KLYX for verification.",
    backProvider: "My activity",
    eyebrow: "KLYX trust",
    title: "My skills",
    description:
      "You can offer as many professions as you master. Each profession has its own evidence file and its own KLYX verification.",
    trustTitle: "Each skill is verified separately",
    trustDescription:
      "Depending on the profession, evidence can be a diploma, training certificate, licence, insurance, professional reference, or portfolio. KLYX then requires the supporting documents configured for regulated activities.",
    refresh: "Refresh",
    emptyTitle: "No profession added",
    emptyDescription: "Add a profession to your activity first.",
    addSkill: "Add a profession",
    verified: "Skill verified",
    yearsExperience: "Years of experience",
    proofType: "Evidence type",
    proofPlaceholder: "Choose an evidence type",
    statementLabel: "Explain your experience for this profession",
    statementPlaceholder:
      "Training, years of experience, types of jobs completed...",
    proofsAdded: "Evidence added",
    noProofs: "No evidence for this profession.",
    addProof: "Add evidence",
    save: "Save",
    submit: "Send to KLYX",
    submitReadyTitle: "Send this skill to KLYX",
    submitBlockedTitle: "Complete all mandatory requirements first.",
    requirementsLoading: "Checking KLYX requirements...",
    requirementsUnavailableTitle: "Requirements unavailable",
    requirementsUnavailableText:
      "The requirements for this profession cannot be determined.",
    requirementsTitle: "KLYX requirements",
    requirementsReadyText: "Your file meets the current requirements.",
    requirementsIncompleteText: "Complete the missing items before submitting.",
    readyBadge: "Ready to submit",
    incompleteBadge: "Incomplete file",
    identity: "Identity",
    identityRequired: "Identity verification required",
    notRequired: "Not required",
    experience: "Experience",
    noMinimum: "No minimum configured",
    insurance: "Insurance",
    insuranceRequired: "Professional insurance required",
    authorization: "Authorization",
    professionalLicenseFallback: "Professional licence or authorization",
    requiredProofs: "Required evidence",
    missing: "Missing",
    validated: "Validated",
    acceptedProofs: "Accepted evidence",
    regulatedTitle: "Activity with enhanced requirements",
    regulatedText:
      "Publication remains blocked until the supporting documents configured for this profession are validated.",
  },
  nl: {
    loadError: "Je vaardigheden kunnen momenteel niet worden geladen.",
    uploadError: "Dit bewijs kan momenteel niet worden toegevoegd.",
    saveError: "Deze vaardigheid kan momenteel niet worden opgeslagen.",
    fileTooLarge: "Het bestand is groter dan 10 MB.",
    invalidFileType: "Gebruik een PDF-, JPG-, PNG- of WEBP-bestand.",
    proofAdded: "Bewijs toegevoegd.",
    saved: "Informatie opgeslagen.",
    submitted: "Vaardigheid naar KLYX gestuurd voor verificatie.",
    backProvider: "Mijn activiteit",
    eyebrow: "KLYX-vertrouwen",
    title: "Mijn vaardigheden",
    description:
      "Je kunt zoveel beroepen aanbieden als je beheerst. Elk beroep heeft een eigen bewijsdossier en een eigen KLYX-verificatie.",
    trustTitle: "Elke vaardigheid wordt afzonderlijk geverifieerd",
    trustDescription:
      "Afhankelijk van het beroep kan bewijs bestaan uit een diploma, opleiding, vergunning, verzekering, professionele referentie of portfolio. KLYX vraagt daarna de bewijsstukken die voor gereglementeerde activiteiten zijn ingesteld.",
    refresh: "Vernieuwen",
    emptyTitle: "Geen beroep toegevoegd",
    emptyDescription: "Voeg eerst een beroep toe aan je activiteit.",
    addSkill: "Beroep toevoegen",
    verified: "Vaardigheid geverifieerd",
    yearsExperience: "Jaren ervaring",
    proofType: "Bewijstype",
    proofPlaceholder: "Kies een bewijstype",
    statementLabel: "Beschrijf je ervaring voor dit beroep",
    statementPlaceholder:
      "Opleiding, jaren ervaring, soorten uitgevoerde opdrachten...",
    proofsAdded: "Toegevoegde bewijzen",
    noProofs: "Geen bewijs voor dit beroep.",
    addProof: "Bewijs toevoegen",
    save: "Opslaan",
    submit: "Naar KLYX sturen",
    submitReadyTitle: "Stuur deze vaardigheid naar KLYX",
    submitBlockedTitle: "Vul eerst alle verplichte vereisten aan.",
    requirementsLoading: "KLYX-vereisten controleren...",
    requirementsUnavailableTitle: "Vereisten niet beschikbaar",
    requirementsUnavailableText:
      "De vereisten voor dit beroep kunnen niet worden bepaald.",
    requirementsTitle: "KLYX-vereisten",
    requirementsReadyText: "Je dossier voldoet aan de huidige vereisten.",
    requirementsIncompleteText: "Vul de ontbrekende onderdelen aan vóór verzending.",
    readyBadge: "Klaar om te verzenden",
    incompleteBadge: "Onvolledig dossier",
    identity: "Identiteit",
    identityRequired: "Identiteitsverificatie vereist",
    notRequired: "Niet vereist",
    experience: "Ervaring",
    noMinimum: "Geen minimum ingesteld",
    insurance: "Verzekering",
    insuranceRequired: "Beroepsverzekering verplicht",
    authorization: "Vergunning",
    professionalLicenseFallback: "Professionele vergunning of toelating",
    requiredProofs: "Verplichte bewijzen",
    missing: "Ontbreekt",
    validated: "Gevalideerd",
    acceptedProofs: "Geaccepteerde bewijzen",
    regulatedTitle: "Activiteit met strengere vereisten",
    regulatedText:
      "Publicatie blijft geblokkeerd totdat de voor dit beroep ingestelde bewijsstukken zijn gevalideerd.",
  },
  de: {
    loadError: "Deine Kompetenzen können derzeit nicht geladen werden.",
    uploadError: "Dieser Nachweis kann derzeit nicht hinzugefügt werden.",
    saveError: "Diese Kompetenz kann derzeit nicht gespeichert werden.",
    fileTooLarge: "Die Datei ist größer als 10 MB.",
    invalidFileType: "Verwende eine PDF-, JPG-, PNG- oder WEBP-Datei.",
    proofAdded: "Nachweis hinzugefügt.",
    saved: "Informationen gespeichert.",
    submitted: "Kompetenz zur Prüfung an KLYX gesendet.",
    backProvider: "Meine Tätigkeit",
    eyebrow: "KLYX-Vertrauen",
    title: "Meine Kompetenzen",
    description:
      "Du kannst so viele Berufe anbieten, wie du beherrschst. Jeder Beruf hat ein eigenes Nachweisdossier und eine eigene KLYX-Prüfung.",
    trustTitle: "Jede Kompetenz wird separat geprüft",
    trustDescription:
      "Je nach Beruf kann ein Nachweis ein Diplom, eine Ausbildung, eine Lizenz, eine Versicherung, eine berufliche Referenz oder ein Portfolio sein. KLYX verlangt anschließend die für reglementierte Tätigkeiten konfigurierten Nachweise.",
    refresh: "Aktualisieren",
    emptyTitle: "Kein Beruf hinzugefügt",
    emptyDescription: "Füge zuerst einen Beruf zu deiner Tätigkeit hinzu.",
    addSkill: "Beruf hinzufügen",
    verified: "Kompetenz verifiziert",
    yearsExperience: "Jahre Erfahrung",
    proofType: "Nachweistyp",
    proofPlaceholder: "Nachweistyp auswählen",
    statementLabel: "Beschreibe deine Erfahrung für diesen Beruf",
    statementPlaceholder:
      "Ausbildung, Jahre Erfahrung, Arten ausgeführter Aufträge...",
    proofsAdded: "Hinzugefügte Nachweise",
    noProofs: "Kein Nachweis für diesen Beruf.",
    addProof: "Nachweis hinzufügen",
    save: "Speichern",
    submit: "An KLYX senden",
    submitReadyTitle: "Diese Kompetenz an KLYX senden",
    submitBlockedTitle: "Vervollständige zuerst alle Pflichtanforderungen.",
    requirementsLoading: "KLYX-Anforderungen werden geprüft...",
    requirementsUnavailableTitle: "Anforderungen nicht verfügbar",
    requirementsUnavailableText:
      "Die Anforderungen für diesen Beruf können nicht ermittelt werden.",
    requirementsTitle: "KLYX-Anforderungen",
    requirementsReadyText: "Dein Dossier erfüllt die aktuellen Anforderungen.",
    requirementsIncompleteText: "Vervollständige die fehlenden Punkte vor dem Senden.",
    readyBadge: "Sendebereit",
    incompleteBadge: "Unvollständiges Dossier",
    identity: "Identität",
    identityRequired: "Identitätsprüfung erforderlich",
    notRequired: "Nicht erforderlich",
    experience: "Erfahrung",
    noMinimum: "Kein Mindestwert konfiguriert",
    insurance: "Versicherung",
    insuranceRequired: "Berufshaftpflicht erforderlich",
    authorization: "Genehmigung",
    professionalLicenseFallback: "Berufslizenz oder Genehmigung",
    requiredProofs: "Erforderliche Nachweise",
    missing: "Fehlt",
    validated: "Validiert",
    acceptedProofs: "Akzeptierte Nachweise",
    regulatedTitle: "Tätigkeit mit erhöhten Anforderungen",
    regulatedText:
      "Die Veröffentlichung bleibt gesperrt, bis die für diesen Beruf konfigurierten Nachweise validiert sind.",
  },
};

const STATUSES: Record<KlyxProviderSkillsLocale, Record<string, string>> = {
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

const DOCUMENT_STATUSES: Record<KlyxProviderSkillsLocale, Record<string, string>> = {
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

const PROOF_TYPES: Record<KlyxProviderSkillsLocale, Record<string, string>> = {
  fr: {
    diploma: "Diplôme",
    training_certificate: "Certificat de formation",
    professional_license: "Licence ou autorisation professionnelle",
    insurance: "Assurance professionnelle",
    experience_reference: "Référence d’expérience",
    portfolio: "Portfolio / preuve de réalisations",
    other: "Autre justificatif",
  },
  en: {
    diploma: "Diploma",
    training_certificate: "Training certificate",
    professional_license: "Professional licence or authorization",
    insurance: "Professional insurance",
    experience_reference: "Experience reference",
    portfolio: "Portfolio / evidence of completed work",
    other: "Other evidence",
  },
  nl: {
    diploma: "Diploma",
    training_certificate: "Opleidingscertificaat",
    professional_license: "Professionele vergunning of toelating",
    insurance: "Beroepsverzekering",
    experience_reference: "Ervaringsreferentie",
    portfolio: "Portfolio / bewijs van uitgevoerd werk",
    other: "Ander bewijs",
  },
  de: {
    diploma: "Diplom",
    training_certificate: "Ausbildungszertifikat",
    professional_license: "Berufslizenz oder Genehmigung",
    insurance: "Berufshaftpflicht",
    experience_reference: "Erfahrungsnachweis",
    portfolio: "Portfolio / Nachweis ausgeführter Arbeiten",
    other: "Anderer Nachweis",
  },
};

const LOCALE_SET = new Set<string>(KLYX_PROVIDER_SKILLS_TRANSLATED_LOCALES);

export function resolveKlyxProviderSkillsLocale(
  locale: KlyxLocale
): KlyxProviderSkillsLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxProviderSkillsLocale) : "fr";
}

export function translateKlyxProviderSkills(
  locale: KlyxLocale,
  key: KlyxProviderSkillsMessageKey
): string {
  return MESSAGES[resolveKlyxProviderSkillsLocale(locale)][key];
}

export function translateKlyxProviderSkillStatus(
  locale: KlyxLocale,
  status: string
): string {
  const resolved = resolveKlyxProviderSkillsLocale(locale);
  return STATUSES[resolved][status] ?? status;
}

export function translateKlyxProviderSkillDocumentStatus(
  locale: KlyxLocale,
  status: string
): string {
  const resolved = resolveKlyxProviderSkillsLocale(locale);
  return DOCUMENT_STATUSES[resolved][status] ?? status;
}

export function translateKlyxProviderSkillProofType(
  locale: KlyxLocale,
  proofType: string
): string {
  const resolved = resolveKlyxProviderSkillsLocale(locale);
  return PROOF_TYPES[resolved][proofType] ?? proofType;
}

export function formatKlyxProviderSkillMinimumYears(
  locale: KlyxLocale,
  years: number
): string {
  const resolved = resolveKlyxProviderSkillsLocale(locale);
  const value = Number.isFinite(years) ? Math.max(0, years) : 0;

  if (resolved === "en") {
    return `${value} ${value === 1 ? "year" : "years"} minimum`;
  }

  if (resolved === "nl") {
    return `${value} jaar minimum`;
  }

  if (resolved === "de") {
    return `Mindestens ${value} ${value === 1 ? "Jahr" : "Jahre"}`;
  }

  return `${value} ${value === 1 ? "année" : "années"} minimum`;
}
