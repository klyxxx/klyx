import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

type KlyxProviderProgressLocale =
  (typeof KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES)[number];

export type KlyxProviderProgressMessageKey =
  | "sessionMissing"
  | "studioFailed"
  | "zonesFailed"
  | "verificationFailed"
  | "refreshFailed"
  | "journey"
  | "ready"
  | "requiredCompleted"
  | "realData"
  | "refresh"
  | "requiredPercent"
  | "items"
  | "step"
  | "optionalByTrade"
  | "checking"
  | "done"
  | "todo"
  | "verified"
  | "inProgress"
  | "operational"
  | "published"
  | "profileTitle"
  | "profileDescription"
  | "profileEdit"
  | "profileComplete"
  | "serviceTitle"
  | "serviceDescription"
  | "serviceManage"
  | "serviceAdd"
  | "priceTitle"
  | "priceDescription"
  | "priceEdit"
  | "priceSet"
  | "zoneTitle"
  | "zoneDescription"
  | "zoneManage"
  | "zoneAdd"
  | "availabilityTitle"
  | "availabilityDescription"
  | "availabilityEdit"
  | "availabilityAdd"
  | "verificationTitle"
  | "verificationDoneDescription"
  | "verificationStartedDescription"
  | "verificationTodoDescription"
  | "verificationDoneButton"
  | "verificationStartedButton"
  | "verificationTodoButton"
  | "paymentsTitle"
  | "paymentsDoneDescription"
  | "paymentsStartedDescription"
  | "paymentsTodoDescription"
  | "paymentsDoneButton"
  | "paymentsStartedButton"
  | "paymentsTodoButton"
  | "publishTitle"
  | "publishDoneDescription"
  | "publishTodoDescription"
  | "publishDoneButton"
  | "publishTodoButton";

const MESSAGES: Record<
  KlyxProviderProgressLocale,
  Record<KlyxProviderProgressMessageKey, string>
> = {
  fr: {
    sessionMissing: "Session manquante.",
    studioFailed: "Impossible de charger le studio.",
    zonesFailed: "Impossible de charger les zones.",
    verificationFailed: "Impossible de charger la vérification.",
    refreshFailed: "Impossible d’actualiser ta progression.",
    journey: "Parcours prestataire KLYX",
    ready: "Ton activité est prête",
    requiredCompleted: "{completed}/{total} étapes obligatoires terminées",
    realData: "KLYX lit les données réellement enregistrées dans ton activité.",
    refresh: "Actualiser",
    requiredPercent: "{percent}% des étapes obligatoires",
    items: "{completed}/{total} éléments",
    step: "Étape {number}",
    optionalByTrade: "Selon le métier",
    checking: "Vérification",
    done: "Terminé",
    todo: "À faire",
    verified: "Vérifié",
    inProgress: "En cours",
    operational: "Opérationnel",
    published: "Publié",
    profileTitle: "Profil professionnel",
    profileDescription: "Présente ton activité, ton expérience et ce qui te différencie.",
    profileEdit: "Modifier mon profil",
    profileComplete: "Compléter mon profil",
    serviceTitle: "Métier proposé",
    serviceDescription: "Active au moins un métier. S’il n’existe pas, propose-le à KLYX.",
    serviceManage: "Gérer mes métiers",
    serviceAdd: "Ajouter ou proposer un métier",
    priceTitle: "Tarif",
    priceDescription: "Définis un prix horaire ou forfaitaire clair.",
    priceEdit: "Modifier mes tarifs",
    priceSet: "Définir mon tarif",
    zoneTitle: "Zone d’intervention",
    zoneDescription: "Indique précisément où tu travailles.",
    zoneManage: "Gérer mes zones",
    zoneAdd: "Ajouter une zone",
    availabilityTitle: "Disponibilités",
    availabilityDescription: "Déclare les jours et horaires où tu peux réellement intervenir.",
    availabilityEdit: "Modifier mes horaires",
    availabilityAdd: "Ajouter mes disponibilités",
    verificationTitle: "Vérification et confiance",
    verificationDoneDescription: "Ton dossier est validé.",
    verificationStartedDescription: "Ton dossier est en cours.",
    verificationTodoDescription: "Commence la vérification pour renforcer la confiance.",
    verificationDoneButton: "Voir ma vérification",
    verificationStartedButton: "Suivre mon dossier",
    verificationTodoButton: "Commencer la vérification",
    paymentsTitle: "Paiements",
    paymentsDoneDescription: "Stripe Connect est opérationnel.",
    paymentsStartedDescription: "Stripe doit encore être terminé.",
    paymentsTodoDescription: "Configure ton compte de paiement pour recevoir tes gains.",
    paymentsDoneButton: "Voir mes paiements",
    paymentsStartedButton: "Terminer Stripe",
    paymentsTodoButton: "Configurer les paiements",
    publishTitle: "Publication",
    publishDoneDescription: "Ton profil professionnel est publié.",
    publishTodoDescription: "Finalise puis publie ton profil.",
    publishDoneButton: "Voir mon studio",
    publishTodoButton: "Finaliser et publier",
  },
  en: {
    sessionMissing: "Session missing.",
    studioFailed: "Unable to load the studio.",
    zonesFailed: "Unable to load service areas.",
    verificationFailed: "Unable to load verification.",
    refreshFailed: "Unable to refresh your progress.",
    journey: "KLYX provider journey",
    ready: "Your activity is ready",
    requiredCompleted: "{completed}/{total} required steps completed",
    realData: "KLYX reads the data actually saved for your activity.",
    refresh: "Refresh",
    requiredPercent: "{percent}% of required steps",
    items: "{completed}/{total} items",
    step: "Step {number}",
    optionalByTrade: "Depending on the service",
    checking: "Checking",
    done: "Done",
    todo: "To do",
    verified: "Verified",
    inProgress: "In progress",
    operational: "Operational",
    published: "Published",
    profileTitle: "Professional profile",
    profileDescription: "Present your activity, experience and what sets you apart.",
    profileEdit: "Edit my profile",
    profileComplete: "Complete my profile",
    serviceTitle: "Service offered",
    serviceDescription: "Enable at least one service. If it does not exist, suggest it to KLYX.",
    serviceManage: "Manage my services",
    serviceAdd: "Add or suggest a service",
    priceTitle: "Price",
    priceDescription: "Set a clear hourly or fixed price.",
    priceEdit: "Edit my prices",
    priceSet: "Set my price",
    zoneTitle: "Service area",
    zoneDescription: "Specify exactly where you work.",
    zoneManage: "Manage my areas",
    zoneAdd: "Add an area",
    availabilityTitle: "Availability",
    availabilityDescription: "Declare the days and times when you can actually work.",
    availabilityEdit: "Edit my schedule",
    availabilityAdd: "Add my availability",
    verificationTitle: "Verification and trust",
    verificationDoneDescription: "Your verification file is approved.",
    verificationStartedDescription: "Your verification file is in progress.",
    verificationTodoDescription: "Start verification to strengthen trust.",
    verificationDoneButton: "View my verification",
    verificationStartedButton: "Track my verification",
    verificationTodoButton: "Start verification",
    paymentsTitle: "Payments",
    paymentsDoneDescription: "Stripe Connect is operational.",
    paymentsStartedDescription: "Stripe setup still needs to be completed.",
    paymentsTodoDescription: "Set up your payment account to receive your earnings.",
    paymentsDoneButton: "View my payments",
    paymentsStartedButton: "Finish Stripe setup",
    paymentsTodoButton: "Set up payments",
    publishTitle: "Publication",
    publishDoneDescription: "Your professional profile is published.",
    publishTodoDescription: "Finish and publish your profile.",
    publishDoneButton: "View my studio",
    publishTodoButton: "Finish and publish",
  },
  nl: {
    sessionMissing: "Sessie ontbreekt.",
    studioFailed: "Kan de studio niet laden.",
    zonesFailed: "Kan de werkgebieden niet laden.",
    verificationFailed: "Kan de verificatie niet laden.",
    refreshFailed: "Kan je voortgang niet vernieuwen.",
    journey: "KLYX-traject voor dienstverleners",
    ready: "Je activiteit is klaar",
    requiredCompleted: "{completed}/{total} verplichte stappen voltooid",
    realData: "KLYX leest de gegevens die daadwerkelijk voor je activiteit zijn opgeslagen.",
    refresh: "Vernieuwen",
    requiredPercent: "{percent}% van de verplichte stappen",
    items: "{completed}/{total} onderdelen",
    step: "Stap {number}",
    optionalByTrade: "Afhankelijk van de dienst",
    checking: "Controleren",
    done: "Voltooid",
    todo: "Te doen",
    verified: "Geverifieerd",
    inProgress: "Bezig",
    operational: "Operationeel",
    published: "Gepubliceerd",
    profileTitle: "Professioneel profiel",
    profileDescription: "Beschrijf je activiteit, ervaring en wat jou onderscheidt.",
    profileEdit: "Mijn profiel wijzigen",
    profileComplete: "Mijn profiel voltooien",
    serviceTitle: "Aangeboden dienst",
    serviceDescription: "Activeer minstens één dienst. Bestaat die niet, stel ze dan voor aan KLYX.",
    serviceManage: "Mijn diensten beheren",
    serviceAdd: "Dienst toevoegen of voorstellen",
    priceTitle: "Tarief",
    priceDescription: "Stel een duidelijk uur- of vast tarief in.",
    priceEdit: "Mijn tarieven wijzigen",
    priceSet: "Mijn tarief instellen",
    zoneTitle: "Werkgebied",
    zoneDescription: "Geef precies aan waar je werkt.",
    zoneManage: "Mijn gebieden beheren",
    zoneAdd: "Gebied toevoegen",
    availabilityTitle: "Beschikbaarheid",
    availabilityDescription: "Geef de dagen en uren aan waarop je echt beschikbaar bent.",
    availabilityEdit: "Mijn uren wijzigen",
    availabilityAdd: "Beschikbaarheid toevoegen",
    verificationTitle: "Verificatie en vertrouwen",
    verificationDoneDescription: "Je dossier is goedgekeurd.",
    verificationStartedDescription: "Je dossier wordt verwerkt.",
    verificationTodoDescription: "Start de verificatie om het vertrouwen te versterken.",
    verificationDoneButton: "Mijn verificatie bekijken",
    verificationStartedButton: "Mijn dossier volgen",
    verificationTodoButton: "Verificatie starten",
    paymentsTitle: "Betalingen",
    paymentsDoneDescription: "Stripe Connect is operationeel.",
    paymentsStartedDescription: "De Stripe-configuratie moet nog worden afgerond.",
    paymentsTodoDescription: "Stel je betaalaccount in om je inkomsten te ontvangen.",
    paymentsDoneButton: "Mijn betalingen bekijken",
    paymentsStartedButton: "Stripe afronden",
    paymentsTodoButton: "Betalingen instellen",
    publishTitle: "Publicatie",
    publishDoneDescription: "Je professionele profiel is gepubliceerd.",
    publishTodoDescription: "Rond je profiel af en publiceer het.",
    publishDoneButton: "Mijn studio bekijken",
    publishTodoButton: "Afronden en publiceren",
  },
  de: {
    sessionMissing: "Sitzung fehlt.",
    studioFailed: "Studio konnte nicht geladen werden.",
    zonesFailed: "Einsatzgebiete konnten nicht geladen werden.",
    verificationFailed: "Verifizierung konnte nicht geladen werden.",
    refreshFailed: "Dein Fortschritt konnte nicht aktualisiert werden.",
    journey: "KLYX-Anbieterablauf",
    ready: "Deine Tätigkeit ist bereit",
    requiredCompleted: "{completed}/{total} Pflichtschritte abgeschlossen",
    realData: "KLYX liest die tatsächlich für deine Tätigkeit gespeicherten Daten.",
    refresh: "Aktualisieren",
    requiredPercent: "{percent}% der Pflichtschritte",
    items: "{completed}/{total} Elemente",
    step: "Schritt {number}",
    optionalByTrade: "Je nach Dienst",
    checking: "Prüfung",
    done: "Erledigt",
    todo: "Zu erledigen",
    verified: "Verifiziert",
    inProgress: "In Bearbeitung",
    operational: "Betriebsbereit",
    published: "Veröffentlicht",
    profileTitle: "Professionelles Profil",
    profileDescription: "Beschreibe deine Tätigkeit, Erfahrung und was dich auszeichnet.",
    profileEdit: "Mein Profil bearbeiten",
    profileComplete: "Mein Profil vervollständigen",
    serviceTitle: "Angebotener Dienst",
    serviceDescription: "Aktiviere mindestens einen Dienst. Falls er nicht existiert, schlage ihn KLYX vor.",
    serviceManage: "Meine Dienste verwalten",
    serviceAdd: "Dienst hinzufügen oder vorschlagen",
    priceTitle: "Preis",
    priceDescription: "Lege einen klaren Stunden- oder Festpreis fest.",
    priceEdit: "Meine Preise bearbeiten",
    priceSet: "Meinen Preis festlegen",
    zoneTitle: "Einsatzgebiet",
    zoneDescription: "Gib genau an, wo du arbeitest.",
    zoneManage: "Meine Gebiete verwalten",
    zoneAdd: "Gebiet hinzufügen",
    availabilityTitle: "Verfügbarkeit",
    availabilityDescription: "Gib die Tage und Zeiten an, an denen du tatsächlich arbeiten kannst.",
    availabilityEdit: "Meine Zeiten bearbeiten",
    availabilityAdd: "Verfügbarkeit hinzufügen",
    verificationTitle: "Verifizierung und Vertrauen",
    verificationDoneDescription: "Dein Dossier ist bestätigt.",
    verificationStartedDescription: "Dein Dossier wird bearbeitet.",
    verificationTodoDescription: "Starte die Verifizierung, um Vertrauen zu stärken.",
    verificationDoneButton: "Meine Verifizierung ansehen",
    verificationStartedButton: "Mein Dossier verfolgen",
    verificationTodoButton: "Verifizierung starten",
    paymentsTitle: "Zahlungen",
    paymentsDoneDescription: "Stripe Connect ist betriebsbereit.",
    paymentsStartedDescription: "Die Stripe-Einrichtung muss noch abgeschlossen werden.",
    paymentsTodoDescription: "Richte dein Zahlungskonto ein, um Einnahmen zu erhalten.",
    paymentsDoneButton: "Meine Zahlungen ansehen",
    paymentsStartedButton: "Stripe abschließen",
    paymentsTodoButton: "Zahlungen einrichten",
    publishTitle: "Veröffentlichung",
    publishDoneDescription: "Dein professionelles Profil ist veröffentlicht.",
    publishTodoDescription: "Vervollständige und veröffentliche dein Profil.",
    publishDoneButton: "Mein Studio ansehen",
    publishTodoButton: "Vervollständigen und veröffentlichen",
  },
};

export function resolveKlyxProviderProgressLocale(
  locale: KlyxLocale
): KlyxProviderProgressLocale {
  return (KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxProviderProgressLocale)
    : "fr";
}

export function translateKlyxProviderProgress(
  locale: KlyxLocale,
  key: KlyxProviderProgressMessageKey
) {
  return MESSAGES[resolveKlyxProviderProgressLocale(locale)][key];
}

export function formatKlyxProviderProgress(
  locale: KlyxLocale,
  key: "requiredCompleted" | "requiredPercent" | "items" | "step",
  values: Record<string, string | number>
) {
  let message = translateKlyxProviderProgress(locale, key);
  for (const [name, value] of Object.entries(values)) {
    message = message.replace(`{${name}}`, String(value));
  }
  return message;
}

export function getKlyxProviderProgressDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxProviderProgressLocale(locale)];
}
