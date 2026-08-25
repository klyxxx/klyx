import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_SERVICE_PROPOSALS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderServiceProposalsLocale =
  (typeof KLYX_PROVIDER_SERVICE_PROPOSALS_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_SERVICE_PROPOSALS_MESSAGE_KEYS = [
  "backToProvider",
  "eyebrow",
  "title",
  "description",
  "newProfession",
  "sendProposal",
  "loadError",
  "submitError",
  "submitSuccess",
  "professionName",
  "professionNamePlaceholder",
  "category",
  "serviceDescription",
  "serviceDescriptionPlaceholder",
  "experience",
  "experiencePlaceholder",
  "optional",
  "sending",
  "proposeProfession",
  "validationTitle",
  "validationDescription",
  "myProposals",
  "loading",
  "empty",
  "statusPending",
  "statusApproved",
  "statusRejected",
  "statusUnknown",
] as const;

export type KlyxProviderServiceProposalsMessageKey =
  (typeof KLYX_PROVIDER_SERVICE_PROPOSALS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderServiceProposalsMessageKey, string>;

const MESSAGES: Record<KlyxProviderServiceProposalsLocale, Dictionary> = {
  fr: {
    backToProvider: "Retour à l’espace prestataire",
    eyebrow: "Catalogue universel",
    title: "Propose le métier que tu sais exercer",
    description:
      "Si ton métier n’existe pas encore dans KLYX, décris-le ici. Après validation, il pourra rejoindre le catalogue et devenir disponible pour les prestataires et les clients.",
    newProfession: "Nouveau métier",
    sendProposal: "Envoyer une proposition",
    loadError: "Impossible de charger tes propositions pour le moment.",
    submitError: "Impossible d’envoyer cette proposition pour le moment.",
    submitSuccess:
      "Ton métier a été transmis. KLYX le vérifiera avant de l’ajouter au catalogue.",
    professionName: "Nom du métier",
    professionNamePlaceholder: "Ex. Photographe immobilier",
    category: "Catégorie",
    serviceDescription: "Description du service",
    serviceDescriptionPlaceholder:
      "Explique précisément ce que fait ce professionnel, pour quels clients et dans quelles situations.",
    experience: "Expérience, diplôme ou compétence",
    experiencePlaceholder: "Décris ton expérience ou les qualifications utiles.",
    optional: "Facultatif",
    sending: "Envoi...",
    proposeProfession: "Proposer ce métier",
    validationTitle: "Validation obligatoire",
    validationDescription:
      "KLYX refuse les activités illégales, dangereuses, frauduleuses ou incompatibles avec les règles de la plateforme. Certains métiers pourront demander des documents supplémentaires.",
    myProposals: "Mes propositions",
    loading: "Chargement...",
    empty: "Tu n’as encore proposé aucun nouveau métier.",
    statusPending: "En validation",
    statusApproved: "Approuvé",
    statusRejected: "Refusé",
    statusUnknown: "Statut inconnu",
  },
  en: {
    backToProvider: "Back to provider space",
    eyebrow: "Universal catalog",
    title: "Propose the profession you can provide",
    description:
      "If your profession is not yet available in KLYX, describe it here. After validation, it may join the catalog and become available to providers and clients.",
    newProfession: "New profession",
    sendProposal: "Send a proposal",
    loadError: "Unable to load your proposals right now.",
    submitError: "Unable to send this proposal right now.",
    submitSuccess:
      "Your profession was submitted. KLYX will review it before adding it to the catalog.",
    professionName: "Profession name",
    professionNamePlaceholder: "E.g. Real-estate photographer",
    category: "Category",
    serviceDescription: "Service description",
    serviceDescriptionPlaceholder:
      "Explain precisely what this professional does, for which clients and in which situations.",
    experience: "Experience, diploma or skill",
    experiencePlaceholder: "Describe your experience or useful qualifications.",
    optional: "Optional",
    sending: "Sending...",
    proposeProfession: "Propose this profession",
    validationTitle: "Validation required",
    validationDescription:
      "KLYX rejects illegal, dangerous, fraudulent activities or activities incompatible with platform rules. Some professions may require additional documents.",
    myProposals: "My proposals",
    loading: "Loading...",
    empty: "You have not proposed a new profession yet.",
    statusPending: "Under review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusUnknown: "Unknown status",
  },
  nl: {
    backToProvider: "Terug naar de ruimte voor dienstverleners",
    eyebrow: "Universele catalogus",
    title: "Stel het beroep voor dat je kunt uitoefenen",
    description:
      "Als je beroep nog niet in KLYX staat, beschrijf het hier. Na validatie kan het aan de catalogus worden toegevoegd en beschikbaar worden voor dienstverleners en klanten.",
    newProfession: "Nieuw beroep",
    sendProposal: "Een voorstel versturen",
    loadError: "Je voorstellen kunnen momenteel niet worden geladen.",
    submitError: "Dit voorstel kan momenteel niet worden verstuurd.",
    submitSuccess:
      "Je beroep is verzonden. KLYX controleert het voordat het aan de catalogus wordt toegevoegd.",
    professionName: "Naam van het beroep",
    professionNamePlaceholder: "Bijv. vastgoedfotograaf",
    category: "Categorie",
    serviceDescription: "Beschrijving van de dienst",
    serviceDescriptionPlaceholder:
      "Leg precies uit wat deze professional doet, voor welke klanten en in welke situaties.",
    experience: "Ervaring, diploma of vaardigheid",
    experiencePlaceholder: "Beschrijf je ervaring of nuttige kwalificaties.",
    optional: "Optioneel",
    sending: "Verzenden...",
    proposeProfession: "Dit beroep voorstellen",
    validationTitle: "Validatie verplicht",
    validationDescription:
      "KLYX weigert illegale, gevaarlijke, frauduleuze activiteiten of activiteiten die niet met de platformregels verenigbaar zijn. Voor sommige beroepen kunnen extra documenten nodig zijn.",
    myProposals: "Mijn voorstellen",
    loading: "Laden...",
    empty: "Je hebt nog geen nieuw beroep voorgesteld.",
    statusPending: "In beoordeling",
    statusApproved: "Goedgekeurd",
    statusRejected: "Afgewezen",
    statusUnknown: "Onbekende status",
  },
  de: {
    backToProvider: "Zurück zum Anbieterbereich",
    eyebrow: "Universeller Katalog",
    title: "Schlage den Beruf vor, den du ausüben kannst",
    description:
      "Wenn dein Beruf noch nicht in KLYX vorhanden ist, beschreibe ihn hier. Nach der Prüfung kann er in den Katalog aufgenommen und für Anbieter und Kunden verfügbar werden.",
    newProfession: "Neuer Beruf",
    sendProposal: "Vorschlag senden",
    loadError: "Deine Vorschläge können derzeit nicht geladen werden.",
    submitError: "Dieser Vorschlag kann derzeit nicht gesendet werden.",
    submitSuccess:
      "Dein Beruf wurde übermittelt. KLYX prüft ihn, bevor er dem Katalog hinzugefügt wird.",
    professionName: "Berufsbezeichnung",
    professionNamePlaceholder: "Z. B. Immobilienfotograf",
    category: "Kategorie",
    serviceDescription: "Dienstleistungsbeschreibung",
    serviceDescriptionPlaceholder:
      "Beschreibe genau, was diese Fachkraft macht, für welche Kunden und in welchen Situationen.",
    experience: "Erfahrung, Abschluss oder Kompetenz",
    experiencePlaceholder: "Beschreibe deine Erfahrung oder relevante Qualifikationen.",
    optional: "Optional",
    sending: "Wird gesendet...",
    proposeProfession: "Diesen Beruf vorschlagen",
    validationTitle: "Validierung erforderlich",
    validationDescription:
      "KLYX lehnt illegale, gefährliche, betrügerische oder mit den Plattformregeln unvereinbare Tätigkeiten ab. Für bestimmte Berufe können zusätzliche Unterlagen erforderlich sein.",
    myProposals: "Meine Vorschläge",
    loading: "Wird geladen...",
    empty: "Du hast noch keinen neuen Beruf vorgeschlagen.",
    statusPending: "In Prüfung",
    statusApproved: "Genehmigt",
    statusRejected: "Abgelehnt",
    statusUnknown: "Unbekannter Status",
  },
};

export const KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES = [
  "Maison et entretien",
  "Famille et garde",
  "Transport et déménagement",
  "Beauté et bien-être",
  "Cours et accompagnement",
  "Événementiel",
  "Animaux",
  "Numérique et création",
  "Réparation et technique",
  "Autre service",
] as const;

export type KlyxProviderServiceProposalCategory =
  (typeof KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES)[number];

const CATEGORY_LABELS: Record<
  KlyxProviderServiceProposalsLocale,
  Record<KlyxProviderServiceProposalCategory, string>
> = {
  fr: {
    "Maison et entretien": "Maison et entretien",
    "Famille et garde": "Famille et garde",
    "Transport et déménagement": "Transport et déménagement",
    "Beauté et bien-être": "Beauté et bien-être",
    "Cours et accompagnement": "Cours et accompagnement",
    Événementiel: "Événementiel",
    Animaux: "Animaux",
    "Numérique et création": "Numérique et création",
    "Réparation et technique": "Réparation et technique",
    "Autre service": "Autre service",
  },
  en: {
    "Maison et entretien": "Home and maintenance",
    "Famille et garde": "Family and care",
    "Transport et déménagement": "Transport and moving",
    "Beauté et bien-être": "Beauty and wellness",
    "Cours et accompagnement": "Lessons and support",
    Événementiel: "Events",
    Animaux: "Pets",
    "Numérique et création": "Digital and creative",
    "Réparation et technique": "Repair and technical",
    "Autre service": "Other service",
  },
  nl: {
    "Maison et entretien": "Woning en onderhoud",
    "Famille et garde": "Gezin en opvang",
    "Transport et déménagement": "Transport en verhuizing",
    "Beauté et bien-être": "Schoonheid en welzijn",
    "Cours et accompagnement": "Lessen en begeleiding",
    Événementiel: "Evenementen",
    Animaux: "Dieren",
    "Numérique et création": "Digitaal en creatief",
    "Réparation et technique": "Reparatie en techniek",
    "Autre service": "Andere dienst",
  },
  de: {
    "Maison et entretien": "Haushalt und Instandhaltung",
    "Famille et garde": "Familie und Betreuung",
    "Transport et déménagement": "Transport und Umzug",
    "Beauté et bien-être": "Beauty und Wohlbefinden",
    "Cours et accompagnement": "Unterricht und Begleitung",
    Événementiel: "Veranstaltungen",
    Animaux: "Tiere",
    "Numérique et création": "Digitales und Kreatives",
    "Réparation et technique": "Reparatur und Technik",
    "Autre service": "Andere Dienstleistung",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_PROVIDER_SERVICE_PROPOSALS_TRANSLATED_LOCALES
);

export function resolveKlyxProviderServiceProposalsLocale(
  locale: KlyxLocale
): KlyxProviderServiceProposalsLocale {
  return LOCALE_SET.has(locale)
    ? (locale as KlyxProviderServiceProposalsLocale)
    : "fr";
}

export function translateKlyxProviderServiceProposals(
  locale: KlyxLocale,
  key: KlyxProviderServiceProposalsMessageKey
): string {
  return MESSAGES[resolveKlyxProviderServiceProposalsLocale(locale)][key];
}

export function getKlyxProviderServiceProposalCategoryLabel(
  locale: KlyxLocale,
  category: string
): string {
  const canonical = KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES.find(
    (value) => value === category
  );

  if (!canonical) return category;

  return CATEGORY_LABELS[resolveKlyxProviderServiceProposalsLocale(locale)][
    canonical
  ];
}

export function translateKlyxProviderServiceProposalStatus(
  locale: KlyxLocale,
  status: string
): string {
  if (status === "pending") {
    return translateKlyxProviderServiceProposals(locale, "statusPending");
  }

  if (status === "approved") {
    return translateKlyxProviderServiceProposals(locale, "statusApproved");
  }

  if (status === "rejected") {
    return translateKlyxProviderServiceProposals(locale, "statusRejected");
  }

  return translateKlyxProviderServiceProposals(locale, "statusUnknown");
}
