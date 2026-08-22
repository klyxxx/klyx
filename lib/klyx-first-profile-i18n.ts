import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FIRST_PROFILE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

type KlyxFirstProfileLocale =
  (typeof KLYX_FIRST_PROFILE_TRANSLATED_LOCALES)[number];

export type KlyxFirstProfileMessageKey =
  | "servicesLoadFailed"
  | "identityRequired"
  | "marketRequired"
  | "serviceRequired"
  | "profileCreateFailed"
  | "firstSetup"
  | "title"
  | "intro"
  | "providerSelected"
  | "clientSelected"
  | "firstName"
  | "lastName"
  | "city"
  | "cityPlaceholder"
  | "market"
  | "marketPlaceholder"
  | "marketHint"
  | "spaceQuestion"
  | "spaceHint"
  | "profileType"
  | "provider"
  | "client"
  | "roleUnlocked"
  | "roleLocked"
  | "lockChoice"
  | "changeProfileType"
  | "clientDescription"
  | "providerDescription"
  | "firstService"
  | "loading"
  | "chooseService"
  | "serviceHint"
  | "afterStep"
  | "providerNextTitle"
  | "clientNextTitle"
  | "providerNextDescription"
  | "clientNextDescription"
  | "configure"
  | "configureDescription"
  | "discover"
  | "discoverDescription"
  | "prepare"
  | "prepareDescription"
  | "describe"
  | "describeDescription"
  | "compare"
  | "compareDescription"
  | "confirm"
  | "confirmDescription"
  | "creating"
  | "createProvider"
  | "createClient"
  | "noAutomaticAction"
  | "notAuthenticated"
  | "marketUnsupported"
  | "profileLimit"
  | "serviceNotFound"
  | "invalidProfileData";

const MESSAGES: Record<
  KlyxFirstProfileLocale,
  Record<KlyxFirstProfileMessageKey, string>
> = {
  fr: {
    servicesLoadFailed: "Impossible de charger les services.",
    identityRequired: "Prénom, nom et ville sont obligatoires.",
    marketRequired: "Choisis ton pays ou territoire KLYX.",
    serviceRequired: "Choisis ton premier métier.",
    profileCreateFailed: "Impossible de créer le profil KLYX.",
    firstSetup: "Première configuration",
    title: "Créons ton premier profil KLYX",
    intro: "Ton compte est connecté. Configure maintenant ton premier espace avant d’accéder au parcours KLYX adapté.",
    providerSelected: "Espace prestataire sélectionné",
    clientSelected: "Espace client sélectionné",
    firstName: "Prénom",
    lastName: "Nom",
    city: "Ville",
    cityPlaceholder: "Ex. Bruxelles",
    market: "Pays ou territoire",
    marketPlaceholder: "Choisir un marché KLYX",
    marketHint: "KLYX utilise ce choix pour associer le bon marché et la bonne devise.",
    spaceQuestion: "Quel espace veux-tu créer ?",
    spaceHint: "Le choix détermine le premier parcours affiché après création.",
    profileType: "Type de premier profil",
    provider: "Prestataire",
    client: "Client",
    roleUnlocked: "Le choix est déverrouillé. Sélectionne volontairement le profil que tu veux créer.",
    roleLocked: "Ce choix vient de ton inscription. Il reste verrouillé pour éviter un changement accidentel.",
    lockChoice: "Verrouiller le choix",
    changeProfileType: "Changer le type de profil",
    clientDescription: "Je cherche et réserve des services.",
    providerDescription: "Je propose mes compétences aux clients.",
    firstService: "Premier métier",
    loading: "Chargement...",
    chooseService: "Choisir un métier",
    serviceHint: "Tu pourras ajouter d’autres métiers ensuite depuis ton espace prestataire.",
    afterStep: "Après cette étape",
    providerNextTitle: "KLYX prépare ton démarrage professionnel",
    clientNextTitle: "KLYX t’aide à organiser ton premier besoin",
    providerNextDescription: "Tu retrouveras la progression de ton profil, les opportunités compatibles et l’Assistant Prestataire.",
    clientNextDescription: "Tu pourras décrire ton besoin, comparer les prestataires puis confirmer toi-même les étapes importantes.",
    configure: "Configure",
    configureDescription: "Complète ton activité.",
    discover: "Découvre",
    discoverDescription: "Vois les opportunités.",
    prepare: "Prépare",
    prepareDescription: "Utilise l’assistant.",
    describe: "Décris",
    describeDescription: "Explique ton besoin.",
    compare: "Compare",
    compareDescription: "Examine les solutions.",
    confirm: "Confirme",
    confirmDescription: "Tu gardes le contrôle.",
    creating: "Création du profil...",
    createProvider: "Créer mon espace prestataire",
    createClient: "Créer mon espace client",
    noAutomaticAction: "La création de ce profil ne déclenche aucune réservation, offre ou paiement automatiquement.",
    notAuthenticated: "Non connecté.",
    marketUnsupported: "Ce pays n’est pas encore pris en charge par KLYX.",
    profileLimit: "Tu peux enregistrer au maximum cinq profils KLYX.",
    serviceNotFound: "Le service sélectionné n’existe plus.",
    invalidProfileData: "Les informations du profil sont invalides.",
  },
  en: {
    servicesLoadFailed: "Unable to load services.",
    identityRequired: "First name, last name and city are required.",
    marketRequired: "Choose your KLYX country or territory.",
    serviceRequired: "Choose your first service.",
    profileCreateFailed: "Unable to create the KLYX profile.",
    firstSetup: "First setup",
    title: "Let’s create your first KLYX profile",
    intro: "Your account is connected. Set up your first space now before entering the KLYX journey that matches it.",
    providerSelected: "Provider space selected",
    clientSelected: "Client space selected",
    firstName: "First name",
    lastName: "Last name",
    city: "City",
    cityPlaceholder: "E.g. Brussels",
    market: "Country or territory",
    marketPlaceholder: "Choose a KLYX market",
    marketHint: "KLYX uses this choice to associate the correct market and currency.",
    spaceQuestion: "Which space do you want to create?",
    spaceHint: "This choice determines the first journey shown after creation.",
    profileType: "First profile type",
    provider: "Provider",
    client: "Client",
    roleUnlocked: "The choice is unlocked. Deliberately select the profile you want to create.",
    roleLocked: "This choice comes from sign-up and stays locked to prevent an accidental change.",
    lockChoice: "Lock choice",
    changeProfileType: "Change profile type",
    clientDescription: "I look for and book services.",
    providerDescription: "I offer my skills to clients.",
    firstService: "First service",
    loading: "Loading...",
    chooseService: "Choose a service",
    serviceHint: "You can add more services later from your provider space.",
    afterStep: "After this step",
    providerNextTitle: "KLYX prepares your professional start",
    clientNextTitle: "KLYX helps organize your first need",
    providerNextDescription: "You’ll find your profile progress, matching opportunities and the Provider Assistant.",
    clientNextDescription: "You can describe your need, compare providers and then confirm important steps yourself.",
    configure: "Set up",
    configureDescription: "Complete your activity.",
    discover: "Discover",
    discoverDescription: "See opportunities.",
    prepare: "Prepare",
    prepareDescription: "Use the assistant.",
    describe: "Describe",
    describeDescription: "Explain your need.",
    compare: "Compare",
    compareDescription: "Review the options.",
    confirm: "Confirm",
    confirmDescription: "You stay in control.",
    creating: "Creating profile...",
    createProvider: "Create my provider space",
    createClient: "Create my client space",
    noAutomaticAction: "Creating this profile does not automatically trigger any booking, offer or payment.",
    notAuthenticated: "Not signed in.",
    marketUnsupported: "This country is not supported by KLYX yet.",
    profileLimit: "You can save up to five KLYX profiles.",
    serviceNotFound: "The selected service is no longer available.",
    invalidProfileData: "The profile information is invalid.",
  },
  nl: {
    servicesLoadFailed: "Kan de diensten niet laden.",
    identityRequired: "Voornaam, achternaam en plaats zijn verplicht.",
    marketRequired: "Kies je KLYX-land of -gebied.",
    serviceRequired: "Kies je eerste dienst.",
    profileCreateFailed: "Kan het KLYX-profiel niet aanmaken.",
    firstSetup: "Eerste configuratie",
    title: "Maak je eerste KLYX-profiel aan",
    intro: "Je account is verbonden. Stel nu je eerste ruimte in voordat je verdergaat met het passende KLYX-traject.",
    providerSelected: "Dienstverlenersruimte geselecteerd",
    clientSelected: "Klantruimte geselecteerd",
    firstName: "Voornaam",
    lastName: "Achternaam",
    city: "Plaats",
    cityPlaceholder: "Bijv. Brussel",
    market: "Land of gebied",
    marketPlaceholder: "Kies een KLYX-markt",
    marketHint: "KLYX gebruikt deze keuze om de juiste markt en valuta te koppelen.",
    spaceQuestion: "Welke ruimte wil je aanmaken?",
    spaceHint: "Deze keuze bepaalt welk traject na het aanmaken eerst wordt getoond.",
    profileType: "Type eerste profiel",
    provider: "Dienstverlener",
    client: "Klant",
    roleUnlocked: "De keuze is ontgrendeld. Kies bewust het profiel dat je wilt aanmaken.",
    roleLocked: "Deze keuze komt uit je registratie en blijft vergrendeld om een onbedoelde wijziging te voorkomen.",
    lockChoice: "Keuze vergrendelen",
    changeProfileType: "Profieltype wijzigen",
    clientDescription: "Ik zoek en boek diensten.",
    providerDescription: "Ik bied mijn vaardigheden aan klanten aan.",
    firstService: "Eerste dienst",
    loading: "Laden...",
    chooseService: "Kies een dienst",
    serviceHint: "Je kunt later meer diensten toevoegen vanuit je dienstverlenersruimte.",
    afterStep: "Na deze stap",
    providerNextTitle: "KLYX bereidt je professionele start voor",
    clientNextTitle: "KLYX helpt je eerste behoefte te organiseren",
    providerNextDescription: "Je vindt er de voortgang van je profiel, passende kansen en de Dienstverlenersassistent.",
    clientNextDescription: "Je kunt je behoefte beschrijven, dienstverleners vergelijken en belangrijke stappen daarna zelf bevestigen.",
    configure: "Configureer",
    configureDescription: "Vul je activiteit aan.",
    discover: "Ontdek",
    discoverDescription: "Bekijk kansen.",
    prepare: "Bereid voor",
    prepareDescription: "Gebruik de assistent.",
    describe: "Beschrijf",
    describeDescription: "Leg je behoefte uit.",
    compare: "Vergelijk",
    compareDescription: "Bekijk de oplossingen.",
    confirm: "Bevestig",
    confirmDescription: "Jij houdt de controle.",
    creating: "Profiel aanmaken...",
    createProvider: "Mijn dienstverlenersruimte aanmaken",
    createClient: "Mijn klantruimte aanmaken",
    noAutomaticAction: "Het aanmaken van dit profiel start niet automatisch een boeking, aanbod of betaling.",
    notAuthenticated: "Niet aangemeld.",
    marketUnsupported: "Dit land wordt nog niet door KLYX ondersteund.",
    profileLimit: "Je kunt maximaal vijf KLYX-profielen opslaan.",
    serviceNotFound: "De geselecteerde dienst is niet meer beschikbaar.",
    invalidProfileData: "De profielgegevens zijn ongeldig.",
  },
  de: {
    servicesLoadFailed: "Dienste konnten nicht geladen werden.",
    identityRequired: "Vorname, Nachname und Ort sind erforderlich.",
    marketRequired: "Wähle dein KLYX-Land oder -Gebiet.",
    serviceRequired: "Wähle deinen ersten Dienst.",
    profileCreateFailed: "Das KLYX-Profil konnte nicht erstellt werden.",
    firstSetup: "Erste Einrichtung",
    title: "Erstellen wir dein erstes KLYX-Profil",
    intro: "Dein Konto ist verbunden. Richte jetzt deinen ersten Bereich ein, bevor du den passenden KLYX-Ablauf öffnest.",
    providerSelected: "Anbieterbereich ausgewählt",
    clientSelected: "Kundenbereich ausgewählt",
    firstName: "Vorname",
    lastName: "Nachname",
    city: "Ort",
    cityPlaceholder: "Z. B. Brüssel",
    market: "Land oder Gebiet",
    marketPlaceholder: "KLYX-Markt auswählen",
    marketHint: "KLYX verwendet diese Auswahl, um den richtigen Markt und die richtige Währung zuzuordnen.",
    spaceQuestion: "Welchen Bereich möchtest du erstellen?",
    spaceHint: "Diese Auswahl bestimmt den ersten Ablauf nach der Erstellung.",
    profileType: "Typ des ersten Profils",
    provider: "Anbieter",
    client: "Kunde",
    roleUnlocked: "Die Auswahl ist entsperrt. Wähle bewusst das Profil aus, das du erstellen möchtest.",
    roleLocked: "Diese Auswahl stammt aus deiner Registrierung und bleibt gesperrt, um versehentliche Änderungen zu vermeiden.",
    lockChoice: "Auswahl sperren",
    changeProfileType: "Profiltyp ändern",
    clientDescription: "Ich suche und buche Dienstleistungen.",
    providerDescription: "Ich biete Kunden meine Fähigkeiten an.",
    firstService: "Erster Dienst",
    loading: "Wird geladen...",
    chooseService: "Dienst auswählen",
    serviceHint: "Du kannst später weitere Dienste in deinem Anbieterbereich hinzufügen.",
    afterStep: "Nach diesem Schritt",
    providerNextTitle: "KLYX bereitet deinen professionellen Start vor",
    clientNextTitle: "KLYX hilft dir, deinen ersten Bedarf zu organisieren",
    providerNextDescription: "Du findest dort deinen Profilfortschritt, passende Chancen und den Anbieter-Assistenten.",
    clientNextDescription: "Du kannst deinen Bedarf beschreiben, Anbieter vergleichen und wichtige Schritte anschließend selbst bestätigen.",
    configure: "Einrichten",
    configureDescription: "Vervollständige deine Tätigkeit.",
    discover: "Entdecken",
    discoverDescription: "Chancen ansehen.",
    prepare: "Vorbereiten",
    prepareDescription: "Assistenten verwenden.",
    describe: "Beschreiben",
    describeDescription: "Erkläre deinen Bedarf.",
    compare: "Vergleichen",
    compareDescription: "Lösungen prüfen.",
    confirm: "Bestätigen",
    confirmDescription: "Du behältst die Kontrolle.",
    creating: "Profil wird erstellt...",
    createProvider: "Meinen Anbieterbereich erstellen",
    createClient: "Meinen Kundenbereich erstellen",
    noAutomaticAction: "Das Erstellen dieses Profils löst nicht automatisch eine Buchung, ein Angebot oder eine Zahlung aus.",
    notAuthenticated: "Nicht angemeldet.",
    marketUnsupported: "Dieses Land wird von KLYX noch nicht unterstützt.",
    profileLimit: "Du kannst höchstens fünf KLYX-Profile speichern.",
    serviceNotFound: "Der ausgewählte Dienst ist nicht mehr verfügbar.",
    invalidProfileData: "Die Profildaten sind ungültig.",
  },
};

const SAFE_API_ERROR_KEYS: Record<string, KlyxFirstProfileMessageKey> = {
  "Non connecté.": "notAuthenticated",
  "Ce pays n’est pas encore pris en charge par KLYX.": "marketUnsupported",
  "Tu peux enregistrer au maximum cinq profils KLYX.": "profileLimit",
  "Choisis le premier service proposé par ce prestataire.": "serviceRequired",
  "Choisis le premier service du prestataire.": "serviceRequired",
  "Le service sélectionné n’existe plus.": "serviceNotFound",
  "Les informations du profil sont invalides.": "invalidProfileData",
  "Choisis Client ou Prestataire.": "invalidProfileData",
};

export function resolveKlyxFirstProfileLocale(
  locale: KlyxLocale
): KlyxFirstProfileLocale {
  return (KLYX_FIRST_PROFILE_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxFirstProfileLocale)
    : "fr";
}

export function translateKlyxFirstProfile(
  locale: KlyxLocale,
  key: KlyxFirstProfileMessageKey
) {
  return MESSAGES[resolveKlyxFirstProfileLocale(locale)][key];
}

export function translateKlyxFirstProfileApiError(
  locale: KlyxLocale,
  publicMessage: string | undefined,
  fallbackKey: KlyxFirstProfileMessageKey
) {
  const key = publicMessage ? SAFE_API_ERROR_KEYS[publicMessage] : undefined;
  return translateKlyxFirstProfile(locale, key ?? fallbackKey);
}

export function getKlyxFirstProfileDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFirstProfileLocale(locale)];
}
