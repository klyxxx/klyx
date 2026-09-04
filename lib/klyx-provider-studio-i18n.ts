import type { KlyxLocale } from "@/lib/klyx-i18n";

type ProviderStudioLocale = "fr" | "en" | "nl" | "de";

const FR = {
  unexpectedError: "Une erreur inattendue est survenue.",
  loadError: "Impossible de charger la fiche prestataire.",
  savePublishedSuccess:
    "Ta fiche prestataire est publiée et visible dans la recherche.",
  saveDraftSuccess:
    "Brouillon enregistré. Tes services ne sont pas visibles par les clients.",
  saveError: "Impossible d’enregistrer la fiche.",
  galleryUploadSuccess: "Photo ajoutée à la galerie.",
  galleryUploadError: "Impossible d’ajouter la photo.",
  documentUploadSuccess: "Document transmis pour vérification.",
  documentUploadError: "Impossible d’envoyer le document.",
  deleteConfirm: "Supprimer définitivement ce fichier ?",
  deleteSuccess: "Fichier supprimé.",
  deleteError: "Impossible de supprimer le fichier.",
  loading: "Chargement de tes services...",
  notFound: "La fiche prestataire est introuvable.",
  eyebrow: "Services",
  pageTitle: "Configurer mes services",
  pageDescription:
    "Ajoute ce que tu proposes, précise tes tarifs et disponibilités, puis publie quand tout est prêt.",
  publicProfile: "Voir ma fiche publique",
  presentationTitle: "Présentation",
  presentationDescription: "Les informations visibles sur ta fiche publique.",
  businessNameLabel: "Nom commercial (facultatif)",
  experienceLabel: "Années d’expérience",
  headlineLabel: "Titre de ta fiche",
  headlinePlaceholder: "Exemple : Prestataire fiable et ponctuel à Bruxelles",
  bioLabel: "Présentation générale",
  bioPlaceholder:
    "Présente ton expérience, ta méthode de travail et ce qui rassurera tes futurs clients.",
  servicesTitle: "Mes services",
  servicesDescription:
    "Recherche un service, ajoute-le, puis configure ses détails.",
  serviceSearchPlaceholder: "Rechercher un service...",
  serviceSearchAria: "Rechercher un service à proposer",
  noServiceFound: "Aucun autre service trouvé.",
  serviceSearchHint:
    "Tape le nom d’un métier ou d’un service, puis sélectionne-le pour l’ajouter.",
  removeServiceAria: "Retirer {name}",
  galleryTitle: "Galerie",
  galleryDescription: "Ajoute jusqu’à 8 photos de ton travail.",
  galleryUploading: "Envoi en cours...",
  galleryAddPhoto: "Ajouter une photo",
  galleryFileHint: "JPG, PNG ou WEBP · 6 Mo maximum",
  galleryPhotoAlt: "Photo du prestataire",
  galleryDeleteAria: "Supprimer cette photo",
  documentsTitle: "Documents",
  documentsDescription:
    "Privés et utilisés uniquement pour la vérification KLYX.",
  documentTypeAria: "Type de document",
  documentUploading: "Envoi...",
  documentTransmit: "Transmettre",
  documentFileHint: "PDF, JPG, PNG ou WEBP · 10 Mo maximum",
  identityRequired:
    "Une pièce d’identité est nécessaire avant la publication.",
  genericDocument: "Document",
  documentDeleteAria: "Supprimer ce document",
  completionTitle: "Profil complété",
  completionAvatar: "Photo de profil",
  completionPresentation: "Présentation commerciale",
  completionService: "Service, tarif et horaires",
  completionIdentity: "Pièce d’identité transmise",
  completionGallery: "Galerie professionnelle",
  publicationTitle: "Publication",
  publicationDescription: "Enregistre ton travail ou rends ta fiche visible.",
  updateProfile: "Mettre à jour la fiche",
  publishProfile: "Publier ma fiche",
  saveDraft: "Enregistrer le brouillon",
  summaryTitle: "Résumé",
  activeServices: "Services actifs",
  photos: "Photos",
  documents: "Documents",
  verification: "Vérification",
  verificationVerified: "Vérifiée",
  verificationPending: "En cours",
  verificationMissing: "À transmettre",
  personalInfo: "Informations personnelles",
  personalInfoDescription: "Photo, nom et ville",
  configureService: "Configurer ce service",
  serviceTitleLabel: "Titre du service",
  serviceTitlePlaceholder: "Un titre précis et rassurant",
  cityLabel: "Ville principale",
  cityPlaceholder: "Bruxelles",
  serviceDescriptionLabel: "Description du service",
  serviceDescriptionPlaceholder:
    "Explique ce que tu proposes, ce qui est inclus et comment tu travailles.",
  pricingLabel: "Tarif utilisé pour ce service",
  hourly: "Par heure",
  fixed: "Prix fixe",
  pricingHint:
    "Les deux montants restent mémorisés. Le bouton choisit seulement le tarif actif.",
  hourlyRateLabel: "Tarif par heure (€)",
  fixedPriceLabel: "Prix fixe (€)",
  zonesTitle: "Zones d’intervention",
  zonesDescription:
    "Ajoute les communes et quartiers dans lesquels tu acceptes des demandes.",
  zonePlaceholder: "Exemple : Bruxelles, Ixelles...",
  addZoneAria: "Ajouter la zone",
  removeZoneAria: "Retirer {zone}",
  radiusLabel: "Rayon maximum (km)",
  availabilityTitle: "Disponibilités hebdomadaires",
  minimumCounter: "Minimum {minimum} · ",
  publishedStatus: "Fiche publiée",
  draftStatus: "Brouillon privé",
  businessSuffix: "Services",
} as const;

export type KlyxProviderStudioMessageKey = keyof typeof FR;
type ProviderStudioCopy = Record<KlyxProviderStudioMessageKey, string>;

const COPY: Record<ProviderStudioLocale, ProviderStudioCopy> = {
  fr: FR,
  en: {
    unexpectedError: "An unexpected error occurred.",
    loadError: "Unable to load the provider profile.",
    savePublishedSuccess:
      "Your provider profile is published and visible in search.",
    saveDraftSuccess:
      "Draft saved. Your services are not visible to clients.",
    saveError: "Unable to save the profile.",
    galleryUploadSuccess: "Photo added to the gallery.",
    galleryUploadError: "Unable to add the photo.",
    documentUploadSuccess: "Document submitted for review.",
    documentUploadError: "Unable to send the document.",
    deleteConfirm: "Delete this file permanently?",
    deleteSuccess: "File deleted.",
    deleteError: "Unable to delete the file.",
    loading: "Loading your services...",
    notFound: "The provider profile could not be found.",
    eyebrow: "Services",
    pageTitle: "Set up my services",
    pageDescription:
      "Add what you offer, set your prices and availability, then publish when everything is ready.",
    publicProfile: "View my public profile",
    presentationTitle: "Presentation",
    presentationDescription: "Information shown on your public profile.",
    businessNameLabel: "Business name (optional)",
    experienceLabel: "Years of experience",
    headlineLabel: "Profile headline",
    headlinePlaceholder: "Example: Reliable and punctual provider in Brussels",
    bioLabel: "General presentation",
    bioPlaceholder:
      "Describe your experience, how you work, and what will reassure future clients.",
    servicesTitle: "My services",
    servicesDescription: "Search for a service, add it, then configure its details.",
    serviceSearchPlaceholder: "Search for a service...",
    serviceSearchAria: "Search for a service to offer",
    noServiceFound: "No other service found.",
    serviceSearchHint:
      "Type a trade or service name, then select it to add it.",
    removeServiceAria: "Remove {name}",
    galleryTitle: "Gallery",
    galleryDescription: "Add up to 8 photos of your work.",
    galleryUploading: "Uploading...",
    galleryAddPhoto: "Add a photo",
    galleryFileHint: "JPG, PNG or WEBP · 6 MB maximum",
    galleryPhotoAlt: "Provider photo",
    galleryDeleteAria: "Delete this photo",
    documentsTitle: "Documents",
    documentsDescription: "Private and used only for KLYX verification.",
    documentTypeAria: "Document type",
    documentUploading: "Uploading...",
    documentTransmit: "Submit",
    documentFileHint: "PDF, JPG, PNG or WEBP · 10 MB maximum",
    identityRequired: "An identity document is required before publishing.",
    genericDocument: "Document",
    documentDeleteAria: "Delete this document",
    completionTitle: "Profile completed",
    completionAvatar: "Profile photo",
    completionPresentation: "Business presentation",
    completionService: "Service, price and schedule",
    completionIdentity: "Identity document submitted",
    completionGallery: "Professional gallery",
    publicationTitle: "Publication",
    publicationDescription: "Save your work or make your profile visible.",
    updateProfile: "Update profile",
    publishProfile: "Publish my profile",
    saveDraft: "Save draft",
    summaryTitle: "Summary",
    activeServices: "Active services",
    photos: "Photos",
    documents: "Documents",
    verification: "Verification",
    verificationVerified: "Verified",
    verificationPending: "In progress",
    verificationMissing: "To submit",
    personalInfo: "Personal information",
    personalInfoDescription: "Photo, name and city",
    configureService: "Configure this service",
    serviceTitleLabel: "Service title",
    serviceTitlePlaceholder: "A clear and reassuring title",
    cityLabel: "Main city",
    cityPlaceholder: "Brussels",
    serviceDescriptionLabel: "Service description",
    serviceDescriptionPlaceholder:
      "Explain what you offer, what is included, and how you work.",
    pricingLabel: "Price used for this service",
    hourly: "Per hour",
    fixed: "Fixed price",
    pricingHint:
      "Both amounts stay saved. The buttons only choose which price is active.",
    hourlyRateLabel: "Hourly rate (€)",
    fixedPriceLabel: "Fixed price (€)",
    zonesTitle: "Service areas",
    zonesDescription: "Add the towns and areas where you accept requests.",
    zonePlaceholder: "Example: Brussels, Ixelles...",
    addZoneAria: "Add area",
    removeZoneAria: "Remove {zone}",
    radiusLabel: "Maximum radius (km)",
    availabilityTitle: "Weekly availability",
    minimumCounter: "Minimum {minimum} · ",
    publishedStatus: "Profile published",
    draftStatus: "Private draft",
    businessSuffix: "Services",
  },
  nl: {
    unexpectedError: "Er is een onverwachte fout opgetreden.",
    loadError: "Het dienstverlenersprofiel kan niet worden geladen.",
    savePublishedSuccess:
      "Je dienstverlenersprofiel is gepubliceerd en zichtbaar in de zoekresultaten.",
    saveDraftSuccess:
      "Concept opgeslagen. Je diensten zijn niet zichtbaar voor klanten.",
    saveError: "Het profiel kan niet worden opgeslagen.",
    galleryUploadSuccess: "Foto toegevoegd aan de galerij.",
    galleryUploadError: "De foto kan niet worden toegevoegd.",
    documentUploadSuccess: "Document ter controle verzonden.",
    documentUploadError: "Het document kan niet worden verzonden.",
    deleteConfirm: "Dit bestand definitief verwijderen?",
    deleteSuccess: "Bestand verwijderd.",
    deleteError: "Het bestand kan niet worden verwijderd.",
    loading: "Je diensten worden geladen...",
    notFound: "Het dienstverlenersprofiel is niet gevonden.",
    eyebrow: "Diensten",
    pageTitle: "Mijn diensten instellen",
    pageDescription:
      "Voeg toe wat je aanbiedt, stel je tarieven en beschikbaarheid in en publiceer wanneer alles klaar is.",
    publicProfile: "Mijn openbare profiel bekijken",
    presentationTitle: "Presentatie",
    presentationDescription: "Informatie die op je openbare profiel zichtbaar is.",
    businessNameLabel: "Handelsnaam (optioneel)",
    experienceLabel: "Jaren ervaring",
    headlineLabel: "Titel van je profiel",
    headlinePlaceholder: "Voorbeeld: Betrouwbare en stipte dienstverlener in Brussel",
    bioLabel: "Algemene presentatie",
    bioPlaceholder:
      "Beschrijf je ervaring, je werkwijze en wat toekomstige klanten vertrouwen geeft.",
    servicesTitle: "Mijn diensten",
    servicesDescription: "Zoek een dienst, voeg ze toe en stel daarna de details in.",
    serviceSearchPlaceholder: "Een dienst zoeken...",
    serviceSearchAria: "Zoek een dienst om aan te bieden",
    noServiceFound: "Geen andere dienst gevonden.",
    serviceSearchHint:
      "Typ de naam van een vak of dienst en selecteer die om ze toe te voegen.",
    removeServiceAria: "{name} verwijderen",
    galleryTitle: "Galerij",
    galleryDescription: "Voeg maximaal 8 foto's van je werk toe.",
    galleryUploading: "Bezig met uploaden...",
    galleryAddPhoto: "Foto toevoegen",
    galleryFileHint: "JPG, PNG of WEBP · maximaal 6 MB",
    galleryPhotoAlt: "Foto van de dienstverlener",
    galleryDeleteAria: "Deze foto verwijderen",
    documentsTitle: "Documenten",
    documentsDescription: "Privé en alleen gebruikt voor KLYX-verificatie.",
    documentTypeAria: "Documenttype",
    documentUploading: "Uploaden...",
    documentTransmit: "Verzenden",
    documentFileHint: "PDF, JPG, PNG of WEBP · maximaal 10 MB",
    identityRequired: "Een identiteitsbewijs is vereist vóór publicatie.",
    genericDocument: "Document",
    documentDeleteAria: "Dit document verwijderen",
    completionTitle: "Profiel voltooid",
    completionAvatar: "Profielfoto",
    completionPresentation: "Zakelijke presentatie",
    completionService: "Dienst, tarief en uren",
    completionIdentity: "Identiteitsbewijs verzonden",
    completionGallery: "Professionele galerij",
    publicationTitle: "Publicatie",
    publicationDescription: "Sla je werk op of maak je profiel zichtbaar.",
    updateProfile: "Profiel bijwerken",
    publishProfile: "Mijn profiel publiceren",
    saveDraft: "Concept opslaan",
    summaryTitle: "Samenvatting",
    activeServices: "Actieve diensten",
    photos: "Foto's",
    documents: "Documenten",
    verification: "Verificatie",
    verificationVerified: "Geverifieerd",
    verificationPending: "Bezig",
    verificationMissing: "Te verzenden",
    personalInfo: "Persoonlijke gegevens",
    personalInfoDescription: "Foto, naam en stad",
    configureService: "Deze dienst instellen",
    serviceTitleLabel: "Titel van de dienst",
    serviceTitlePlaceholder: "Een duidelijke en geruststellende titel",
    cityLabel: "Hoofdstad of gemeente",
    cityPlaceholder: "Brussel",
    serviceDescriptionLabel: "Beschrijving van de dienst",
    serviceDescriptionPlaceholder:
      "Leg uit wat je aanbiedt, wat inbegrepen is en hoe je werkt.",
    pricingLabel: "Tarief dat voor deze dienst wordt gebruikt",
    hourly: "Per uur",
    fixed: "Vaste prijs",
    pricingHint:
      "Beide bedragen blijven bewaard. De knoppen kiezen alleen welk tarief actief is.",
    hourlyRateLabel: "Uurtarief (€)",
    fixedPriceLabel: "Vaste prijs (€)",
    zonesTitle: "Werkgebieden",
    zonesDescription: "Voeg gemeenten en buurten toe waar je aanvragen aanneemt.",
    zonePlaceholder: "Voorbeeld: Brussel, Elsene...",
    addZoneAria: "Werkgebied toevoegen",
    removeZoneAria: "{zone} verwijderen",
    radiusLabel: "Maximale straal (km)",
    availabilityTitle: "Wekelijkse beschikbaarheid",
    minimumCounter: "Minimum {minimum} · ",
    publishedStatus: "Profiel gepubliceerd",
    draftStatus: "Privéconcept",
    businessSuffix: "Diensten",
  },
  de: {
    unexpectedError: "Ein unerwarteter Fehler ist aufgetreten.",
    loadError: "Das Anbieterprofil konnte nicht geladen werden.",
    savePublishedSuccess:
      "Dein Anbieterprofil ist veröffentlicht und in der Suche sichtbar.",
    saveDraftSuccess:
      "Entwurf gespeichert. Deine Dienstleistungen sind für Kunden nicht sichtbar.",
    saveError: "Das Profil konnte nicht gespeichert werden.",
    galleryUploadSuccess: "Foto zur Galerie hinzugefügt.",
    galleryUploadError: "Das Foto konnte nicht hinzugefügt werden.",
    documentUploadSuccess: "Dokument zur Prüfung übermittelt.",
    documentUploadError: "Das Dokument konnte nicht gesendet werden.",
    deleteConfirm: "Diese Datei endgültig löschen?",
    deleteSuccess: "Datei gelöscht.",
    deleteError: "Die Datei konnte nicht gelöscht werden.",
    loading: "Deine Dienstleistungen werden geladen...",
    notFound: "Das Anbieterprofil wurde nicht gefunden.",
    eyebrow: "Dienstleistungen",
    pageTitle: "Meine Dienstleistungen einrichten",
    pageDescription:
      "Füge dein Angebot hinzu, lege Preise und Verfügbarkeit fest und veröffentliche alles, sobald es bereit ist.",
    publicProfile: "Mein öffentliches Profil ansehen",
    presentationTitle: "Präsentation",
    presentationDescription: "Informationen, die in deinem öffentlichen Profil erscheinen.",
    businessNameLabel: "Geschäftsname (optional)",
    experienceLabel: "Jahre Erfahrung",
    headlineLabel: "Profiltitel",
    headlinePlaceholder: "Beispiel: Zuverlässiger und pünktlicher Anbieter in Brüssel",
    bioLabel: "Allgemeine Vorstellung",
    bioPlaceholder:
      "Beschreibe deine Erfahrung, deine Arbeitsweise und was künftigen Kunden Sicherheit gibt.",
    servicesTitle: "Meine Dienstleistungen",
    servicesDescription:
      "Suche eine Dienstleistung, füge sie hinzu und richte anschließend die Details ein.",
    serviceSearchPlaceholder: "Dienstleistung suchen...",
    serviceSearchAria: "Nach einer Dienstleistung zum Anbieten suchen",
    noServiceFound: "Keine weitere Dienstleistung gefunden.",
    serviceSearchHint:
      "Gib einen Beruf oder eine Dienstleistung ein und wähle sie zum Hinzufügen aus.",
    removeServiceAria: "{name} entfernen",
    galleryTitle: "Galerie",
    galleryDescription: "Füge bis zu 8 Fotos deiner Arbeit hinzu.",
    galleryUploading: "Wird hochgeladen...",
    galleryAddPhoto: "Foto hinzufügen",
    galleryFileHint: "JPG, PNG oder WEBP · maximal 6 MB",
    galleryPhotoAlt: "Foto des Anbieters",
    galleryDeleteAria: "Dieses Foto löschen",
    documentsTitle: "Dokumente",
    documentsDescription: "Privat und nur für die KLYX-Verifizierung verwendet.",
    documentTypeAria: "Dokumenttyp",
    documentUploading: "Upload...",
    documentTransmit: "Übermitteln",
    documentFileHint: "PDF, JPG, PNG oder WEBP · maximal 10 MB",
    identityRequired: "Vor der Veröffentlichung ist ein Ausweisdokument erforderlich.",
    genericDocument: "Dokument",
    documentDeleteAria: "Dieses Dokument löschen",
    completionTitle: "Profil vollständig",
    completionAvatar: "Profilfoto",
    completionPresentation: "Geschäftliche Vorstellung",
    completionService: "Dienstleistung, Preis und Zeiten",
    completionIdentity: "Ausweisdokument übermittelt",
    completionGallery: "Professionelle Galerie",
    publicationTitle: "Veröffentlichung",
    publicationDescription: "Speichere deine Arbeit oder mache dein Profil sichtbar.",
    updateProfile: "Profil aktualisieren",
    publishProfile: "Mein Profil veröffentlichen",
    saveDraft: "Entwurf speichern",
    summaryTitle: "Zusammenfassung",
    activeServices: "Aktive Dienstleistungen",
    photos: "Fotos",
    documents: "Dokumente",
    verification: "Verifizierung",
    verificationVerified: "Verifiziert",
    verificationPending: "In Bearbeitung",
    verificationMissing: "Zu übermitteln",
    personalInfo: "Persönliche Angaben",
    personalInfoDescription: "Foto, Name und Stadt",
    configureService: "Diese Dienstleistung einrichten",
    serviceTitleLabel: "Titel der Dienstleistung",
    serviceTitlePlaceholder: "Ein klarer und vertrauenswürdiger Titel",
    cityLabel: "Hauptort",
    cityPlaceholder: "Brüssel",
    serviceDescriptionLabel: "Beschreibung der Dienstleistung",
    serviceDescriptionPlaceholder:
      "Erkläre, was du anbietest, was enthalten ist und wie du arbeitest.",
    pricingLabel: "Für diese Dienstleistung verwendeter Preis",
    hourly: "Pro Stunde",
    fixed: "Festpreis",
    pricingHint:
      "Beide Beträge bleiben gespeichert. Die Schaltflächen wählen nur den aktiven Preis aus.",
    hourlyRateLabel: "Stundensatz (€)",
    fixedPriceLabel: "Festpreis (€)",
    zonesTitle: "Einsatzgebiete",
    zonesDescription: "Füge Orte und Stadtteile hinzu, in denen du Anfragen annimmst.",
    zonePlaceholder: "Beispiel: Brüssel, Ixelles...",
    addZoneAria: "Einsatzgebiet hinzufügen",
    removeZoneAria: "{zone} entfernen",
    radiusLabel: "Maximaler Radius (km)",
    availabilityTitle: "Wöchentliche Verfügbarkeit",
    minimumCounter: "Mindestens {minimum} · ",
    publishedStatus: "Profil veröffentlicht",
    draftStatus: "Privater Entwurf",
    businessSuffix: "Dienstleistungen",
  },
};

const SERVICE_LABELS: Record<ProviderStudioLocale, Record<string, string>> = {
  fr: {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  },
  en: {
    babysitting: "Babysitting",
    cleaning: "Cleaning",
    moving: "Moving",
    handyman: "Handyman",
  },
  nl: {
    babysitting: "Babysitten",
    cleaning: "Schoonmaak",
    moving: "Verhuizing",
    handyman: "Klusjes",
  },
  de: {
    babysitting: "Babysitting",
    cleaning: "Reinigung",
    moving: "Umzug",
    handyman: "Handwerkliche Hilfe",
  },
};

const DAY_LABELS: Record<ProviderStudioLocale, Record<number, string>> = {
  fr: { 0: "Dimanche", 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" },
  en: { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" },
  nl: { 0: "Zondag", 1: "Maandag", 2: "Dinsdag", 3: "Woensdag", 4: "Donderdag", 5: "Vrijdag", 6: "Zaterdag" },
  de: { 0: "Sonntag", 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag" },
};

const DOCUMENT_TYPES: Record<ProviderStudioLocale, Record<string, string>> = {
  fr: {
    identity: "Pièce d’identité",
    address: "Justificatif de domicile",
    insurance: "Assurance professionnelle",
    company: "Document d’entreprise",
  },
  en: {
    identity: "Identity document",
    address: "Proof of address",
    insurance: "Professional insurance",
    company: "Company document",
  },
  nl: {
    identity: "Identiteitsbewijs",
    address: "Adresbewijs",
    insurance: "Beroepsverzekering",
    company: "Bedrijfsdocument",
  },
  de: {
    identity: "Ausweisdokument",
    address: "Adressnachweis",
    insurance: "Berufsversicherung",
    company: "Unternehmensdokument",
  },
};

const DOCUMENT_STATUS: Record<ProviderStudioLocale, Record<string, string>> = {
  fr: { pending: "En vérification", verified: "Vérifié", rejected: "À remplacer" },
  en: { pending: "Under review", verified: "Verified", rejected: "Replace required" },
  nl: { pending: "In beoordeling", verified: "Geverifieerd", rejected: "Vervangen" },
  de: { pending: "In Prüfung", verified: "Verifiziert", rejected: "Zu ersetzen" },
};

function resolveLocale(locale: KlyxLocale): ProviderStudioLocale {
  return locale === "en" || locale === "nl" || locale === "de" ? locale : "fr";
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;

  return Object.entries(params).reduce(
    (result, [key, replacement]) =>
      result.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function translateKlyxProviderStudio(
  locale: KlyxLocale,
  key: KlyxProviderStudioMessageKey,
  params?: Record<string, string | number>
): string {
  return interpolate(COPY[resolveLocale(locale)][key], params);
}

export function getKlyxProviderStudioServiceLabel(
  locale: KlyxLocale,
  slug: string,
  fallback = "Service KLYX"
): string {
  return SERVICE_LABELS[resolveLocale(locale)][slug] ?? fallback;
}

export function getKlyxProviderStudioDayLabel(
  locale: KlyxLocale,
  dayOfWeek: number
): string {
  return DAY_LABELS[resolveLocale(locale)][dayOfWeek] ?? String(dayOfWeek);
}

export function getKlyxProviderStudioDocumentTypeLabel(
  locale: KlyxLocale,
  documentType: string,
  fallback?: string
): string {
  return (
    DOCUMENT_TYPES[resolveLocale(locale)][documentType] ??
    fallback ??
    translateKlyxProviderStudio(locale, "genericDocument")
  );
}

export function getKlyxProviderStudioDocumentStatusLabel(
  locale: KlyxLocale,
  status: string
): string {
  return (
    DOCUMENT_STATUS[resolveLocale(locale)][status] ??
    DOCUMENT_STATUS[resolveLocale(locale)].pending
  );
}
