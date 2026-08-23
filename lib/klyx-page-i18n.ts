import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxPublicPageLocale =
  (typeof KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES)[number];

export type KlyxPublicEntryMessageKey =
  | "sessionLoading"
  | "openKlyx"
  | "myProfiles"
  | "login"
  | "start"
  | "client"
  | "clientNeedService"
  | "provider"
  | "providerOfferServices"
  | "alreadyAccount"
  | "signIn";

export const KLYX_PUBLIC_HOME_MESSAGE_KEYS = [
  "install",
  "installKlyx",
  "heroBadge",
  "heroTitle",
  "heroDescription",
  "freeAccount",
  "browserReady",
  "deviceInstallable",
  "assistantLabel",
  "assistantQuestion",
  "assistantExample",
  "searchTitle",
  "searchText",
  "trustTitle",
  "trustText",
  "bookingTitle",
  "bookingText",
  "uniqueTitle",
  "uniqueText",
  "launchServices",
  "serviceBabysitting",
  "serviceCleaning",
  "serviceMoving",
  "serviceHandyman",
  "journeyEyebrow",
  "journeyTitle",
  "journeyIntro",
  "journeyNeedTitle",
  "journeyNeedText",
  "journeyCompareTitle",
  "journeyCompareText",
  "journeyConfirmTitle",
  "journeyConfirmText",
  "journeyTrackTitle",
  "journeyTrackText",
  "safetyTitle",
  "safetyDescription",
  "platformEyebrow",
  "platformTitle",
  "highlightAssistantTitle",
  "highlightAssistantText",
  "highlightProvidersTitle",
  "highlightProvidersText",
  "highlightBookingTitle",
  "highlightBookingText",
  "highlightTrustTitle",
  "highlightTrustText",
  "joinEyebrow",
  "joinTitle",
  "joinDescription",
  "clientLabel",
  "clientTitle",
  "clientDescription",
  "clientBenefitAssistant",
  "clientBenefitCompare",
  "clientBenefitTracking",
  "clientCta",
  "providerLabel",
  "providerTitle",
  "providerDescription",
  "providerBenefitProfile",
  "providerBenefitOpportunities",
  "providerBenefitAssistant",
  "providerCta",
  "roleNote",
  "deviceEyebrow",
  "deviceTitle",
  "deviceDescription",
  "deviceOptions",
  "footerLogin",
  "footerCreateAccount",
  "footerInstall",
  "installInstalled",
  "installIosTitle",
  "installIosInstructions",
  "installAutomatic",
] as const;

export type KlyxPublicHomeMessageKey =
  (typeof KLYX_PUBLIC_HOME_MESSAGE_KEYS)[number];

const PUBLIC_ENTRY_MESSAGES: Record<
  KlyxPublicPageLocale,
  Record<KlyxPublicEntryMessageKey, string>
> = {
  fr: {
    sessionLoading: "Session...",
    openKlyx: "Ouvrir KLYX",
    myProfiles: "Mes profils",
    login: "Connexion",
    start: "Commencer",
    client: "Client",
    clientNeedService: "J’ai besoin d’un service",
    provider: "Prestataire",
    providerOfferServices: "Je veux proposer mes services",
    alreadyAccount: "Tu as déjà un compte ?",
    signIn: "Se connecter",
  },
  en: {
    sessionLoading: "Session...",
    openKlyx: "Open KLYX",
    myProfiles: "My profiles",
    login: "Sign in",
    start: "Get started",
    client: "Client",
    clientNeedService: "I need a service",
    provider: "Provider",
    providerOfferServices: "I want to offer my services",
    alreadyAccount: "Already have an account?",
    signIn: "Sign in",
  },
  nl: {
    sessionLoading: "Sessie...",
    openKlyx: "KLYX openen",
    myProfiles: "Mijn profielen",
    login: "Aanmelden",
    start: "Beginnen",
    client: "Klant",
    clientNeedService: "Ik heb een dienst nodig",
    provider: "Dienstverlener",
    providerOfferServices: "Ik wil mijn diensten aanbieden",
    alreadyAccount: "Heb je al een account?",
    signIn: "Aanmelden",
  },
  de: {
    sessionLoading: "Sitzung...",
    openKlyx: "KLYX öffnen",
    myProfiles: "Meine Profile",
    login: "Anmelden",
    start: "Loslegen",
    client: "Kunde",
    clientNeedService: "Ich brauche eine Dienstleistung",
    provider: "Anbieter",
    providerOfferServices: "Ich möchte meine Dienste anbieten",
    alreadyAccount: "Du hast bereits ein Konto?",
    signIn: "Anmelden",
  },
};

const PUBLIC_HOME_MESSAGES: Record<
  KlyxPublicPageLocale,
  Record<KlyxPublicHomeMessageKey, string>
> = {
  fr: {
    install: "Installer",
    installKlyx: "Installer KLYX",
    heroBadge: "Un service pour chaque besoin",
    heroTitle: "KLYX organise les services du quotidien à ta place.",
    heroDescription:
      "Trouve un prestataire, demande un devis, réserve, échange, paie et suis ta mission depuis une seule plateforme.",
    freeAccount: "Compte gratuit",
    browserReady: "Utilisable dans le navigateur",
    deviceInstallable: "Installable sur appareil compatible",
    assistantLabel: "KLYX Assistant",
    assistantQuestion: "De quoi as-tu besoin ?",
    assistantExample:
      "« J’ai besoin de quelqu’un pour nettoyer mon appartement samedi matin à Bruxelles. »",
    searchTitle: "Recherche",
    searchText: "Prestataires compatibles avec ton besoin",
    trustTitle: "Confiance",
    trustText: "Compétences et profils contrôlés",
    bookingTitle: "Réservation",
    bookingText: "Créneau, devis et mission centralisés",
    uniqueTitle: "Une expérience unique",
    uniqueText: "Client et prestataire dans le même écosystème KLYX.",
    launchServices: "Services de lancement",
    serviceBabysitting: "Baby-sitting",
    serviceCleaning: "Ménage",
    serviceMoving: "Déménagement",
    serviceHandyman: "Bricolage",
    journeyEyebrow: "Comment fonctionne KLYX",
    journeyTitle: "Du besoin à la mission terminée.",
    journeyIntro:
      "KLYX organise les étapes pour éviter de multiplier recherches, messages, devis et applications.",
    journeyNeedTitle: "Décris ton besoin",
    journeyNeedText: "Explique simplement ce qu’il te faut, où et quand.",
    journeyCompareTitle: "KLYX compare",
    journeyCompareText:
      "Les prestataires sont comparés selon compatibilité, prix, disponibilité et confiance.",
    journeyConfirmTitle: "Tu confirmes",
    journeyConfirmText:
      "KLYX peut comparer et retenir une recommandation. Tu confirmes explicitement avant toute réservation.",
    journeyTrackTitle: "KLYX suit la mission",
    journeyTrackText:
      "Réservation, paiement, prestation et avis restent réunis jusqu’à la fin.",
    safetyTitle: "Tu gardes toujours la décision finale",
    safetyDescription:
      "KLYX peut rechercher, comparer et préparer une recommandation. Publication de demande, réservation, paiement, annulation et remboursement restent soumis à une action explicite de ta part.",
    platformEyebrow: "Une seule plateforme",
    platformTitle: "Moins d’applications. Moins de recherches. Plus d’action.",
    highlightAssistantTitle: "Un assistant qui agit",
    highlightAssistantText:
      "KLYX t’aide à trouver, organiser et suivre les services dont tu as besoin.",
    highlightProvidersTitle: "Des prestataires adaptés",
    highlightProvidersText:
      "Recherche par besoin, zone, disponibilité et critères de confiance.",
    highlightBookingTitle: "Réservation centralisée",
    highlightBookingText:
      "Devis, réservation, messages, suivi et paiement dans une même expérience.",
    highlightTrustTitle: "Confiance intégrée",
    highlightTrustText:
      "Vérifications, preuves de compétences, avis et règles de sécurité KLYX.",
    joinEyebrow: "Rejoindre KLYX",
    joinTitle: "Tu cherches un service ou tu proposes ton savoir-faire ?",
    joinDescription:
      "KLYX possède un parcours séparé pour les clients et les prestataires, avec une seule plateforme pour organiser toute la mission.",
    clientLabel: "Je suis client",
    clientTitle: "J’ai besoin d’un service",
    clientDescription:
      "Décris ton besoin, laisse KLYX comparer les prestataires, confirme la réservation puis suis ta mission jusqu’à la prestation terminée.",
    clientBenefitAssistant: "Assistant KLYX pour organiser ton besoin",
    clientBenefitCompare: "Comparaison prix, disponibilité et confiance",
    clientBenefitTracking: "Réservation et suivi au même endroit",
    clientCta: "Créer mon compte client",
    providerLabel: "Je suis prestataire",
    providerTitle: "Je veux proposer mes services",
    providerDescription:
      "Présente ton activité, découvre les opportunités compatibles, prépare tes offres avec KLYX et suis tes missions.",
    providerBenefitProfile: "Profil professionnel et services configurables",
    providerBenefitOpportunities: "Opportunités selon ton activité",
    providerBenefitAssistant: "Assistant prestataire et suivi des missions",
    providerCta: "Créer mon espace prestataire",
    roleNote:
      "L’inscription est gratuite. Le rôle choisi prépare simplement ton espace KLYX : client et prestataire gardent des parcours séparés.",
    deviceEyebrow: "KLYX sur ton appareil",
    deviceTitle:
      "Utilise KLYX dans le navigateur ou installe-le comme une application.",
    deviceDescription:
      "Aucun téléchargement obligatoire. Sur les appareils compatibles, KLYX peut être ajouté à ton écran d’accueil et s’ouvrir en mode application.",
    deviceOptions: "Voir les options d’installation",
    footerLogin: "Connexion",
    footerCreateAccount: "Créer un compte",
    footerInstall: "Installer KLYX",
    installInstalled: "KLYX est installé sur cet appareil",
    installIosTitle: "Installation sur iPhone ou iPad",
    installIosInstructions:
      "Dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ».",
    installAutomatic:
      "L’installation sera proposée automatiquement par ton navigateur dès que toutes les conditions sont réunies.",
  },
  en: {
    install: "Install",
    installKlyx: "Install KLYX",
    heroBadge: "One service for every need",
    heroTitle: "KLYX organizes everyday services for you.",
    heroDescription:
      "Find a provider, request a quote, book, chat, pay and track your mission from one platform.",
    freeAccount: "Free account",
    browserReady: "Works in your browser",
    deviceInstallable: "Installable on a compatible device",
    assistantLabel: "KLYX Assistant",
    assistantQuestion: "What do you need?",
    assistantExample:
      "“I need someone to clean my apartment on Saturday morning in Brussels.”",
    searchTitle: "Search",
    searchText: "Providers matching your need",
    trustTitle: "Trust",
    trustText: "Skills and profiles checked",
    bookingTitle: "Booking",
    bookingText: "Time slot, quote and mission in one place",
    uniqueTitle: "One seamless experience",
    uniqueText: "Clients and providers in the same KLYX ecosystem.",
    launchServices: "Launch services",
    serviceBabysitting: "Babysitting",
    serviceCleaning: "Cleaning",
    serviceMoving: "Moving",
    serviceHandyman: "Handyman",
    journeyEyebrow: "How KLYX works",
    journeyTitle: "From need to completed mission.",
    journeyIntro:
      "KLYX organizes the steps so you do not have to multiply searches, messages, quotes and apps.",
    journeyNeedTitle: "Describe your need",
    journeyNeedText: "Simply explain what you need, where and when.",
    journeyCompareTitle: "KLYX compares",
    journeyCompareText:
      "Providers are compared by fit, price, availability and trust.",
    journeyConfirmTitle: "You confirm",
    journeyConfirmText:
      "KLYX can compare and retain a recommendation. You explicitly confirm before any booking.",
    journeyTrackTitle: "KLYX tracks the mission",
    journeyTrackText:
      "Booking, payment, service delivery and review stay together through completion.",
    safetyTitle: "You always keep the final decision",
    safetyDescription:
      "KLYX can search, compare and prepare a recommendation. Publishing a request, booking, payment, cancellation and refund remain subject to an explicit action from you.",
    platformEyebrow: "One platform",
    platformTitle: "Fewer apps. Fewer searches. More action.",
    highlightAssistantTitle: "An assistant that acts",
    highlightAssistantText:
      "KLYX helps you find, organize and track the services you need.",
    highlightProvidersTitle: "Providers that fit",
    highlightProvidersText:
      "Search by need, area, availability and trust criteria.",
    highlightBookingTitle: "Centralized booking",
    highlightBookingText:
      "Quotes, booking, messages, tracking and payment in one experience.",
    highlightTrustTitle: "Built-in trust",
    highlightTrustText:
      "Checks, proof of skills, reviews and KLYX safety rules.",
    joinEyebrow: "Join KLYX",
    joinTitle: "Looking for a service or offering your expertise?",
    joinDescription:
      "KLYX has separate paths for clients and providers, with one platform to organize the whole mission.",
    clientLabel: "I am a client",
    clientTitle: "I need a service",
    clientDescription:
      "Describe your need, let KLYX compare providers, confirm the booking, then track your mission until the service is completed.",
    clientBenefitAssistant: "KLYX Assistant to organize your need",
    clientBenefitCompare: "Compare price, availability and trust",
    clientBenefitTracking: "Booking and tracking in one place",
    clientCta: "Create my client account",
    providerLabel: "I am a provider",
    providerTitle: "I want to offer my services",
    providerDescription:
      "Present your activity, discover matching opportunities, prepare your offers with KLYX and track your missions.",
    providerBenefitProfile: "Professional profile and configurable services",
    providerBenefitOpportunities: "Opportunities matching your activity",
    providerBenefitAssistant: "Provider assistant and mission tracking",
    providerCta: "Create my provider space",
    roleNote:
      "Registration is free. The role you choose simply prepares your KLYX space: client and provider paths remain separate.",
    deviceEyebrow: "KLYX on your device",
    deviceTitle: "Use KLYX in your browser or install it like an app.",
    deviceDescription:
      "No download is required. On compatible devices, KLYX can be added to your home screen and opened in app mode.",
    deviceOptions: "View installation options",
    footerLogin: "Sign in",
    footerCreateAccount: "Create an account",
    footerInstall: "Install KLYX",
    installInstalled: "KLYX is installed on this device",
    installIosTitle: "Install on iPhone or iPad",
    installIosInstructions:
      "In Safari, tap Share, then “Add to Home Screen”.",
    installAutomatic:
      "Your browser will offer installation automatically once all requirements are met.",
  },
  nl: {
    install: "Installeren",
    installKlyx: "KLYX installeren",
    heroBadge: "Een dienst voor elke behoefte",
    heroTitle: "KLYX organiseert dagelijkse diensten voor jou.",
    heroDescription:
      "Vind een dienstverlener, vraag een offerte, boek, chat, betaal en volg je missie vanaf één platform.",
    freeAccount: "Gratis account",
    browserReady: "Te gebruiken in je browser",
    deviceInstallable: "Installeerbaar op een compatibel apparaat",
    assistantLabel: "KLYX Assistant",
    assistantQuestion: "Wat heb je nodig?",
    assistantExample:
      "‘Ik heb zaterdagmorgen iemand nodig om mijn appartement in Brussel schoon te maken.’",
    searchTitle: "Zoeken",
    searchText: "Dienstverleners die bij je behoefte passen",
    trustTitle: "Vertrouwen",
    trustText: "Vaardigheden en profielen gecontroleerd",
    bookingTitle: "Boeking",
    bookingText: "Tijdslot, offerte en missie op één plek",
    uniqueTitle: "Eén naadloze ervaring",
    uniqueText: "Klanten en dienstverleners in hetzelfde KLYX-ecosysteem.",
    launchServices: "Diensten bij de lancering",
    serviceBabysitting: "Babysitting",
    serviceCleaning: "Schoonmaak",
    serviceMoving: "Verhuizing",
    serviceHandyman: "Kluswerk",
    journeyEyebrow: "Zo werkt KLYX",
    journeyTitle: "Van behoefte tot voltooide missie.",
    journeyIntro:
      "KLYX organiseert de stappen zodat je niet steeds meer zoekopdrachten, berichten, offertes en apps nodig hebt.",
    journeyNeedTitle: "Beschrijf je behoefte",
    journeyNeedText: "Leg eenvoudig uit wat je nodig hebt, waar en wanneer.",
    journeyCompareTitle: "KLYX vergelijkt",
    journeyCompareText:
      "Dienstverleners worden vergeleken op geschiktheid, prijs, beschikbaarheid en vertrouwen.",
    journeyConfirmTitle: "Jij bevestigt",
    journeyConfirmText:
      "KLYX kan vergelijken en een aanbeveling selecteren. Je bevestigt expliciet vóór elke boeking.",
    journeyTrackTitle: "KLYX volgt de missie",
    journeyTrackText:
      "Boeking, betaling, uitvoering en beoordeling blijven tot het einde bij elkaar.",
    safetyTitle: "Jij houdt altijd de eindbeslissing",
    safetyDescription:
      "KLYX kan zoeken, vergelijken en een aanbeveling voorbereiden. Het publiceren van een aanvraag, boeken, betalen, annuleren en terugbetalen blijven onderworpen aan een expliciete actie van jou.",
    platformEyebrow: "Eén platform",
    platformTitle: "Minder apps. Minder zoeken. Meer actie.",
    highlightAssistantTitle: "Een assistent die handelt",
    highlightAssistantText:
      "KLYX helpt je de diensten die je nodig hebt te vinden, organiseren en volgen.",
    highlightProvidersTitle: "Passende dienstverleners",
    highlightProvidersText:
      "Zoek op behoefte, regio, beschikbaarheid en vertrouwenscriteria.",
    highlightBookingTitle: "Centrale boeking",
    highlightBookingText:
      "Offertes, boeking, berichten, opvolging en betaling in één ervaring.",
    highlightTrustTitle: "Ingebouwd vertrouwen",
    highlightTrustText:
      "Controles, bewijs van vaardigheden, beoordelingen en KLYX-veiligheidsregels.",
    joinEyebrow: "Word lid van KLYX",
    joinTitle: "Zoek je een dienst of bied je je expertise aan?",
    joinDescription:
      "KLYX heeft aparte trajecten voor klanten en dienstverleners, met één platform om de volledige missie te organiseren.",
    clientLabel: "Ik ben klant",
    clientTitle: "Ik heb een dienst nodig",
    clientDescription:
      "Beschrijf je behoefte, laat KLYX dienstverleners vergelijken, bevestig de boeking en volg daarna je missie tot de dienst is voltooid.",
    clientBenefitAssistant: "KLYX Assistant om je behoefte te organiseren",
    clientBenefitCompare: "Prijs, beschikbaarheid en vertrouwen vergelijken",
    clientBenefitTracking: "Boeking en opvolging op één plek",
    clientCta: "Mijn klantaccount aanmaken",
    providerLabel: "Ik ben dienstverlener",
    providerTitle: "Ik wil mijn diensten aanbieden",
    providerDescription:
      "Stel je activiteit voor, ontdek passende kansen, bereid je offertes met KLYX voor en volg je missies.",
    providerBenefitProfile: "Professioneel profiel en configureerbare diensten",
    providerBenefitOpportunities: "Kansen die bij je activiteit passen",
    providerBenefitAssistant: "Assistent voor dienstverleners en missie-opvolging",
    providerCta: "Mijn dienstverlenersruimte aanmaken",
    roleNote:
      "Registratie is gratis. De gekozen rol bereidt alleen je KLYX-ruimte voor: klant- en dienstverlenerstrajecten blijven gescheiden.",
    deviceEyebrow: "KLYX op je apparaat",
    deviceTitle: "Gebruik KLYX in je browser of installeer het als een app.",
    deviceDescription:
      "Downloaden is niet verplicht. Op compatibele apparaten kan KLYX aan je beginscherm worden toegevoegd en in appmodus worden geopend.",
    deviceOptions: "Installatieopties bekijken",
    footerLogin: "Aanmelden",
    footerCreateAccount: "Account aanmaken",
    footerInstall: "KLYX installeren",
    installInstalled: "KLYX is op dit apparaat geïnstalleerd",
    installIosTitle: "Installeren op iPhone of iPad",
    installIosInstructions:
      "Tik in Safari op Delen en vervolgens op ‘Zet op beginscherm’.",
    installAutomatic:
      "Je browser zal de installatie automatisch voorstellen zodra aan alle voorwaarden is voldaan.",
  },
  de: {
    install: "Installieren",
    installKlyx: "KLYX installieren",
    heroBadge: "Ein Service für jeden Bedarf",
    heroTitle: "KLYX organisiert Alltagsdienstleistungen für dich.",
    heroDescription:
      "Finde einen Anbieter, fordere ein Angebot an, buche, chatte, bezahle und verfolge deinen Auftrag auf einer Plattform.",
    freeAccount: "Kostenloses Konto",
    browserReady: "Im Browser nutzbar",
    deviceInstallable: "Auf kompatiblen Geräten installierbar",
    assistantLabel: "KLYX Assistant",
    assistantQuestion: "Was brauchst du?",
    assistantExample:
      "„Ich brauche am Samstagmorgen jemanden, der meine Wohnung in Brüssel reinigt.“",
    searchTitle: "Suche",
    searchText: "Anbieter, die zu deinem Bedarf passen",
    trustTitle: "Vertrauen",
    trustText: "Fähigkeiten und Profile geprüft",
    bookingTitle: "Buchung",
    bookingText: "Zeitfenster, Angebot und Auftrag an einem Ort",
    uniqueTitle: "Ein nahtloses Erlebnis",
    uniqueText: "Kunden und Anbieter im selben KLYX-Ökosystem.",
    launchServices: "Services zum Start",
    serviceBabysitting: "Babysitting",
    serviceCleaning: "Reinigung",
    serviceMoving: "Umzug",
    serviceHandyman: "Handwerksservice",
    journeyEyebrow: "So funktioniert KLYX",
    journeyTitle: "Vom Bedarf bis zum abgeschlossenen Auftrag.",
    journeyIntro:
      "KLYX organisiert die Schritte, damit du nicht immer mehr Suchen, Nachrichten, Angebote und Apps brauchst.",
    journeyNeedTitle: "Beschreibe deinen Bedarf",
    journeyNeedText: "Erkläre einfach, was du brauchst, wo und wann.",
    journeyCompareTitle: "KLYX vergleicht",
    journeyCompareText:
      "Anbieter werden nach Eignung, Preis, Verfügbarkeit und Vertrauen verglichen.",
    journeyConfirmTitle: "Du bestätigst",
    journeyConfirmText:
      "KLYX kann vergleichen und eine Empfehlung auswählen. Vor jeder Buchung bestätigst du ausdrücklich.",
    journeyTrackTitle: "KLYX verfolgt den Auftrag",
    journeyTrackText:
      "Buchung, Zahlung, Leistung und Bewertung bleiben bis zum Abschluss gebündelt.",
    safetyTitle: "Du behältst immer die letzte Entscheidung",
    safetyDescription:
      "KLYX kann suchen, vergleichen und eine Empfehlung vorbereiten. Das Veröffentlichen einer Anfrage, Buchung, Zahlung, Stornierung und Rückerstattung erfordern weiterhin eine ausdrückliche Aktion von dir.",
    platformEyebrow: "Eine Plattform",
    platformTitle: "Weniger Apps. Weniger Suchen. Mehr Aktion.",
    highlightAssistantTitle: "Ein Assistent, der handelt",
    highlightAssistantText:
      "KLYX hilft dir, benötigte Services zu finden, zu organisieren und zu verfolgen.",
    highlightProvidersTitle: "Passende Anbieter",
    highlightProvidersText:
      "Suche nach Bedarf, Gebiet, Verfügbarkeit und Vertrauenskriterien.",
    highlightBookingTitle: "Zentrale Buchung",
    highlightBookingText:
      "Angebote, Buchung, Nachrichten, Verfolgung und Zahlung in einem Erlebnis.",
    highlightTrustTitle: "Integriertes Vertrauen",
    highlightTrustText:
      "Prüfungen, Kompetenznachweise, Bewertungen und KLYX-Sicherheitsregeln.",
    joinEyebrow: "KLYX beitreten",
    joinTitle: "Suchst du einen Service oder bietest du dein Können an?",
    joinDescription:
      "KLYX bietet getrennte Wege für Kunden und Anbieter und eine Plattform, um den gesamten Auftrag zu organisieren.",
    clientLabel: "Ich bin Kunde",
    clientTitle: "Ich brauche einen Service",
    clientDescription:
      "Beschreibe deinen Bedarf, lass KLYX Anbieter vergleichen, bestätige die Buchung und verfolge anschließend deinen Auftrag bis zur abgeschlossenen Leistung.",
    clientBenefitAssistant: "KLYX Assistant zur Organisation deines Bedarfs",
    clientBenefitCompare: "Preis, Verfügbarkeit und Vertrauen vergleichen",
    clientBenefitTracking: "Buchung und Verfolgung an einem Ort",
    clientCta: "Mein Kundenkonto erstellen",
    providerLabel: "Ich bin Anbieter",
    providerTitle: "Ich möchte meine Dienste anbieten",
    providerDescription:
      "Stelle deine Tätigkeit vor, entdecke passende Chancen, bereite deine Angebote mit KLYX vor und verfolge deine Aufträge.",
    providerBenefitProfile: "Professionelles Profil und konfigurierbare Services",
    providerBenefitOpportunities: "Chancen passend zu deiner Tätigkeit",
    providerBenefitAssistant: "Anbieter-Assistent und Auftragsverfolgung",
    providerCta: "Meinen Anbieterbereich erstellen",
    roleNote:
      "Die Registrierung ist kostenlos. Die gewählte Rolle bereitet nur deinen KLYX-Bereich vor: Kunden- und Anbieterwege bleiben getrennt.",
    deviceEyebrow: "KLYX auf deinem Gerät",
    deviceTitle: "Nutze KLYX im Browser oder installiere es wie eine App.",
    deviceDescription:
      "Ein Download ist nicht erforderlich. Auf kompatiblen Geräten kann KLYX zum Startbildschirm hinzugefügt und im App-Modus geöffnet werden.",
    deviceOptions: "Installationsoptionen ansehen",
    footerLogin: "Anmelden",
    footerCreateAccount: "Konto erstellen",
    footerInstall: "KLYX installieren",
    installInstalled: "KLYX ist auf diesem Gerät installiert",
    installIosTitle: "Auf iPhone oder iPad installieren",
    installIosInstructions:
      "Tippe in Safari auf Teilen und dann auf „Zum Home-Bildschirm“.",
    installAutomatic:
      "Dein Browser bietet die Installation automatisch an, sobald alle Voraussetzungen erfüllt sind.",
  },
};

export function resolveKlyxPublicPageLocale(
  locale: KlyxLocale
): KlyxPublicPageLocale {
  return (KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxPublicPageLocale)
    : "fr";
}

export function hasKlyxPublicPageTranslation(locale: KlyxLocale) {
  return (KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(locale);
}

export function translateKlyxPublicEntry(
  locale: KlyxLocale,
  key: KlyxPublicEntryMessageKey
) {
  return PUBLIC_ENTRY_MESSAGES[resolveKlyxPublicPageLocale(locale)][key];
}

export function getKlyxPublicEntryDictionary(locale: KlyxLocale) {
  return PUBLIC_ENTRY_MESSAGES[resolveKlyxPublicPageLocale(locale)];
}

export function translateKlyxPublicHome(
  locale: KlyxLocale,
  key: KlyxPublicHomeMessageKey
) {
  return PUBLIC_HOME_MESSAGES[resolveKlyxPublicPageLocale(locale)][key];
}

export function getKlyxPublicHomeDictionary(locale: KlyxLocale) {
  return PUBLIC_HOME_MESSAGES[resolveKlyxPublicPageLocale(locale)];
}
