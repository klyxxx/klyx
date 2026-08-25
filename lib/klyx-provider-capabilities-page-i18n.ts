import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_CAPABILITIES_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderCapabilitiesPageLocale =
  (typeof KLYX_PROVIDER_CAPABILITIES_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_CAPABILITIES_PAGE_MESSAGE_KEYS = [
  "backToProvider",
  "eyebrow",
  "title",
  "description",
  "ordinarySkillNote",
  "addEyebrow",
  "addTitle",
  "label",
  "labelPlaceholder",
  "descriptionLabel",
  "descriptionPlaceholder",
  "optional",
  "addButton",
  "adding",
  "loadError",
  "saveError",
  "duplicateError",
  "addedSuccess",
  "updatedSuccess",
  "confirmedSuccess",
  "archivedSuccess",
  "restoredSuccess",
  "myCapabilities",
  "empty",
  "edit",
  "save",
  "saving",
  "cancel",
  "confirm",
  "archive",
  "restore",
  "statusDraft",
  "statusConfirmed",
  "statusArchived",
  "statusUnknown",
  "linkedOffers",
  "offerHelp",
  "noActiveOffer",
  "manageOffers",
  "link",
  "unlink",
  "linking",
  "entryEyebrow",
  "entryTitle",
  "entryDescription",
  "entryCta",
] as const;

export type KlyxProviderCapabilitiesPageMessageKey =
  (typeof KLYX_PROVIDER_CAPABILITIES_PAGE_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderCapabilitiesPageMessageKey, string>;

const MESSAGES: Record<KlyxProviderCapabilitiesPageLocale, Dictionary> = {
  fr: {
    backToProvider: "Retour à l’espace prestataire",
    eyebrow: "Compétences réelles",
    title: "Qu’est-ce que vous savez faire ?",
    description:
      "Déclarez librement vos savoir-faire, même s’ils ne correspondent pas encore à un métier ou à une catégorie KLYX. Vous pourrez ensuite les relier à vos offres existantes.",
    ordinarySkillNote:
      "Déclarer une compétence n’exige pas de diplôme. Les justificatifs éventuellement nécessaires pour une offre sont gérés séparément par ses règles de qualification.",
    addEyebrow: "Nouvelle compétence",
    addTitle: "Ajouter un savoir-faire",
    label: "Ce que vous savez faire",
    labelPlaceholder: "Ex. Monter un meuble IKEA, tondre une pelouse, retoucher des photos",
    descriptionLabel: "Précisions",
    descriptionPlaceholder:
      "Ajoutez un contexte utile : expérience, type de tâches, outils maîtrisés ou limites de votre intervention.",
    optional: "Facultatif",
    addButton: "Ajouter cette compétence",
    adding: "Ajout...",
    loadError: "Impossible de charger vos compétences pour le moment.",
    saveError: "Impossible d’enregistrer cette modification pour le moment.",
    duplicateError: "Cette compétence est déjà déclarée sur ce profil.",
    addedSuccess: "Compétence ajoutée.",
    updatedSuccess: "Compétence mise à jour.",
    confirmedSuccess: "Compétence confirmée.",
    archivedSuccess: "Compétence archivée.",
    restoredSuccess: "Compétence réactivée.",
    myCapabilities: "Mes compétences",
    empty: "Vous n’avez encore déclaré aucune compétence.",
    edit: "Modifier",
    save: "Enregistrer",
    saving: "Enregistrement...",
    cancel: "Annuler",
    confirm: "Confirmer",
    archive: "Archiver",
    restore: "Réactiver",
    statusDraft: "À confirmer",
    statusConfirmed: "Confirmée",
    statusArchived: "Archivée",
    statusUnknown: "Statut inconnu",
    linkedOffers: "Offres associées",
    offerHelp:
      "Associer une compétence décrit ce que vous savez réellement faire dans cette offre. Cela ne publie pas l’offre et ne remplace aucune vérification réglementaire.",
    noActiveOffer: "Aucune offre prestataire active à relier pour le moment.",
    manageOffers: "Gérer mes offres",
    link: "Associer",
    unlink: "Retirer",
    linking: "Mise à jour...",
    entryEyebrow: "Savoir-faire",
    entryTitle: "Ajoutez ce que vous savez vraiment faire",
    entryDescription:
      "Déclarez des compétences libres puis reliez-les à vos offres. Pas besoin d’inventer un métier pour chaque savoir-faire.",
    entryCta: "Gérer mes compétences",
  },
  en: {
    backToProvider: "Back to provider space",
    eyebrow: "Real capabilities",
    title: "What can you do?",
    description:
      "Freely declare what you know how to do, even when it does not yet match a profession or KLYX category. You can then link those capabilities to your existing offers.",
    ordinarySkillNote:
      "Declaring a capability does not require a diploma. Any evidence required for an offer is handled separately by that offer’s qualification rules.",
    addEyebrow: "New capability",
    addTitle: "Add something you can do",
    label: "What you can do",
    labelPlaceholder: "E.g. Assemble IKEA furniture, mow a lawn, retouch photos",
    descriptionLabel: "Details",
    descriptionPlaceholder:
      "Add useful context: experience, task types, tools you use or the limits of your work.",
    optional: "Optional",
    addButton: "Add this capability",
    adding: "Adding...",
    loadError: "Unable to load your capabilities right now.",
    saveError: "Unable to save this change right now.",
    duplicateError: "This capability is already declared on this profile.",
    addedSuccess: "Capability added.",
    updatedSuccess: "Capability updated.",
    confirmedSuccess: "Capability confirmed.",
    archivedSuccess: "Capability archived.",
    restoredSuccess: "Capability restored.",
    myCapabilities: "My capabilities",
    empty: "You have not declared any capability yet.",
    edit: "Edit",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    confirm: "Confirm",
    archive: "Archive",
    restore: "Restore",
    statusDraft: "To confirm",
    statusConfirmed: "Confirmed",
    statusArchived: "Archived",
    statusUnknown: "Unknown status",
    linkedOffers: "Linked offers",
    offerHelp:
      "Linking a capability describes what you can actually do in that offer. It does not publish the offer and does not replace regulatory verification.",
    noActiveOffer: "There is no active provider offer to link yet.",
    manageOffers: "Manage my offers",
    link: "Link",
    unlink: "Remove",
    linking: "Updating...",
    entryEyebrow: "Capabilities",
    entryTitle: "Add what you can actually do",
    entryDescription:
      "Declare free-form capabilities and link them to your offers. You do not need to invent a profession for every skill.",
    entryCta: "Manage my capabilities",
  },
  nl: {
    backToProvider: "Terug naar de ruimte voor dienstverleners",
    eyebrow: "Echte vaardigheden",
    title: "Wat kunt u doen?",
    description:
      "Geef vrij aan wat u kunt, ook als het nog niet overeenkomt met een beroep of KLYX-categorie. Daarna kunt u deze vaardigheden aan uw bestaande aanbiedingen koppelen.",
    ordinarySkillNote:
      "Voor het aangeven van een vaardigheid is geen diploma nodig. Bewijsstukken die eventueel voor een aanbieding nodig zijn, worden afzonderlijk door de kwalificatieregels van die aanbieding beheerd.",
    addEyebrow: "Nieuwe vaardigheid",
    addTitle: "Voeg toe wat u kunt",
    label: "Wat u kunt doen",
    labelPlaceholder: "Bijv. IKEA-meubels monteren, gras maaien, foto’s retoucheren",
    descriptionLabel: "Details",
    descriptionPlaceholder:
      "Voeg nuttige context toe: ervaring, soorten taken, gebruikte tools of de grenzen van uw werk.",
    optional: "Optioneel",
    addButton: "Deze vaardigheid toevoegen",
    adding: "Toevoegen...",
    loadError: "Uw vaardigheden kunnen momenteel niet worden geladen.",
    saveError: "Deze wijziging kan momenteel niet worden opgeslagen.",
    duplicateError: "Deze vaardigheid is al op dit profiel gedeclareerd.",
    addedSuccess: "Vaardigheid toegevoegd.",
    updatedSuccess: "Vaardigheid bijgewerkt.",
    confirmedSuccess: "Vaardigheid bevestigd.",
    archivedSuccess: "Vaardigheid gearchiveerd.",
    restoredSuccess: "Vaardigheid opnieuw geactiveerd.",
    myCapabilities: "Mijn vaardigheden",
    empty: "U hebt nog geen vaardigheid gedeclareerd.",
    edit: "Bewerken",
    save: "Opslaan",
    saving: "Opslaan...",
    cancel: "Annuleren",
    confirm: "Bevestigen",
    archive: "Archiveren",
    restore: "Heractiveren",
    statusDraft: "Te bevestigen",
    statusConfirmed: "Bevestigd",
    statusArchived: "Gearchiveerd",
    statusUnknown: "Onbekende status",
    linkedOffers: "Gekoppelde aanbiedingen",
    offerHelp:
      "Een vaardigheid koppelen beschrijft wat u werkelijk binnen die aanbieding kunt doen. Het publiceert de aanbieding niet en vervangt geen wettelijke controle.",
    noActiveOffer: "Er is momenteel geen actieve aanbieding om te koppelen.",
    manageOffers: "Mijn aanbiedingen beheren",
    link: "Koppelen",
    unlink: "Verwijderen",
    linking: "Bijwerken...",
    entryEyebrow: "Vaardigheden",
    entryTitle: "Voeg toe wat u echt kunt",
    entryDescription:
      "Declareer vrije vaardigheden en koppel ze aan uw aanbiedingen. U hoeft niet voor elke vaardigheid een beroep te bedenken.",
    entryCta: "Mijn vaardigheden beheren",
  },
  de: {
    backToProvider: "Zurück zum Anbieterbereich",
    eyebrow: "Reale Fähigkeiten",
    title: "Was können Sie?",
    description:
      "Geben Sie frei an, was Sie können, auch wenn es noch keinem Beruf oder keiner KLYX-Kategorie entspricht. Anschließend können Sie diese Fähigkeiten mit Ihren bestehenden Angeboten verknüpfen.",
    ordinarySkillNote:
      "Für die Angabe einer Fähigkeit ist kein Abschluss erforderlich. Nachweise, die eventuell für ein Angebot nötig sind, werden separat durch dessen Qualifikationsregeln verwaltet.",
    addEyebrow: "Neue Fähigkeit",
    addTitle: "Fähigkeit hinzufügen",
    label: "Was Sie können",
    labelPlaceholder: "Z. B. IKEA-Möbel montieren, Rasen mähen, Fotos retuschieren",
    descriptionLabel: "Details",
    descriptionPlaceholder:
      "Fügen Sie hilfreichen Kontext hinzu: Erfahrung, Aufgabentypen, verwendete Werkzeuge oder Grenzen Ihrer Tätigkeit.",
    optional: "Optional",
    addButton: "Diese Fähigkeit hinzufügen",
    adding: "Wird hinzugefügt...",
    loadError: "Ihre Fähigkeiten können derzeit nicht geladen werden.",
    saveError: "Diese Änderung kann derzeit nicht gespeichert werden.",
    duplicateError: "Diese Fähigkeit wurde für dieses Profil bereits angegeben.",
    addedSuccess: "Fähigkeit hinzugefügt.",
    updatedSuccess: "Fähigkeit aktualisiert.",
    confirmedSuccess: "Fähigkeit bestätigt.",
    archivedSuccess: "Fähigkeit archiviert.",
    restoredSuccess: "Fähigkeit reaktiviert.",
    myCapabilities: "Meine Fähigkeiten",
    empty: "Sie haben noch keine Fähigkeit angegeben.",
    edit: "Bearbeiten",
    save: "Speichern",
    saving: "Wird gespeichert...",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    archive: "Archivieren",
    restore: "Reaktivieren",
    statusDraft: "Zu bestätigen",
    statusConfirmed: "Bestätigt",
    statusArchived: "Archiviert",
    statusUnknown: "Unbekannter Status",
    linkedOffers: "Verknüpfte Angebote",
    offerHelp:
      "Eine Fähigkeit zu verknüpfen beschreibt, was Sie in diesem Angebot tatsächlich leisten können. Dadurch wird das Angebot nicht veröffentlicht und keine regulatorische Prüfung ersetzt.",
    noActiveOffer: "Derzeit gibt es kein aktives Anbieterangebot zum Verknüpfen.",
    manageOffers: "Meine Angebote verwalten",
    link: "Verknüpfen",
    unlink: "Entfernen",
    linking: "Wird aktualisiert...",
    entryEyebrow: "Fähigkeiten",
    entryTitle: "Fügen Sie hinzu, was Sie wirklich können",
    entryDescription:
      "Geben Sie freie Fähigkeiten an und verknüpfen Sie sie mit Ihren Angeboten. Sie müssen nicht für jede Fähigkeit einen Beruf erfinden.",
    entryCta: "Meine Fähigkeiten verwalten",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_PROVIDER_CAPABILITIES_PAGE_TRANSLATED_LOCALES
);

export function resolveKlyxProviderCapabilitiesPageLocale(
  locale: KlyxLocale
): KlyxProviderCapabilitiesPageLocale {
  return LOCALE_SET.has(locale)
    ? (locale as KlyxProviderCapabilitiesPageLocale)
    : "fr";
}

export function translateKlyxProviderCapabilitiesPage(
  locale: KlyxLocale,
  key: KlyxProviderCapabilitiesPageMessageKey
): string {
  return MESSAGES[resolveKlyxProviderCapabilitiesPageLocale(locale)][key];
}

export function translateKlyxProviderCapabilityStatus(
  locale: KlyxLocale,
  status: string
): string {
  if (status === "draft") {
    return translateKlyxProviderCapabilitiesPage(locale, "statusDraft");
  }

  if (status === "confirmed") {
    return translateKlyxProviderCapabilitiesPage(locale, "statusConfirmed");
  }

  if (status === "archived") {
    return translateKlyxProviderCapabilitiesPage(locale, "statusArchived");
  }

  return translateKlyxProviderCapabilitiesPage(locale, "statusUnknown");
}
