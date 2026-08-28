export const KLYX_DASHBOARD_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxDashboardLocale =
  (typeof KLYX_DASHBOARD_TRANSLATED_LOCALES)[number];

const FR = {
  resumeEyebrow: "Reprendre mon parcours",
  resumeProviderTitle: "Trouve ta prochaine mission.",
  resumeClientTitle: "Organise ton prochain besoin.",
  resumeProviderPrimary: "Voir mes opportunités",
  resumeProviderSecondary: "Gérer mon activité",
  resumeClientPrimary: "Organiser un besoin",
  resumeClientSecondary: "Chercher moi-même",

  headerProviderPrimary: "Voir mes opportunités",
  headerClientPrimary: "Organiser un besoin",
  headerActiveProvider: "Profil actif · Prestataire",
  headerActiveClient: "Profil actif · Client",
  headerTitle: "Tableau de bord",
  headerWelcome: "Bienvenue{{name}}.",
  headerUserFallback: "Utilisateur KLYX",
  headerProviderSpace: "Espace professionnel",
  headerClientSpace: "Espace services",
  headerManageProfiles: "Gérer mes profils",
  headerSettings: "Paramètres",
  headerFounderConsole: "Console Founder",
  headerAdmin: "Admin",

  clientTagline: "Assistant services KLYX",
  clientHello: "Bonjour {{name}}",
  clientWelcomeFallback: "et bienvenue",
  clientHeroDescription:
    "Commence par dire ce dont tu as besoin. KLYX organise ensuite le parcours, tandis que les fonctions secondaires restent accessibles sans encombrer ton espace.",
  clientOrganizeNeed: "Organiser mon besoin",
  clientViewActivity: "Voir mon activité",
  clientNavEyebrow: "Navigation principale",
  clientNavTitle: "L’essentiel, sans surcharge",
  clientNavDescription:
    "Quatre espaces couvrent l’usage quotidien. Les outils moins fréquents sont rangés dessous.",
  clientActionAssistantTitle: "KLYX Assistant",
  clientActionAssistantDescription:
    "Décris ton besoin et laisse KLYX préparer la recherche et la réservation.",
  clientActionActivityTitle: "Mon activité",
  clientActionActivityDescription:
    "Retrouve tes devis, réservations et prestations en cours au même endroit.",
  clientActionMessagesTitle: "Messages",
  clientActionMessagesDescription:
    "Échange avec les prestataires liés à tes demandes et missions.",
  clientActionProfileTitle: "Mon profil",
  clientActionProfileDescription:
    "Gère ton identité KLYX et les informations visibles sur ton compte.",
  open: "Ouvrir",
  clientSecondaryEyebrow: "Accès secondaires",
  clientCompareProviders: "Comparer les prestataires",
  favorites: "Favoris",
  settings: "Paramètres",

  providerTagline: "Espace prestataire",
  providerHello: "Bonjour {{name}}",
  providerProfessionalFallback: "professionnel",
  providerHeroDescription:
    "Ton espace est centré sur les missions, les services et les finances. Les outils occasionnels restent disponibles sans concurrencer le travail quotidien.",
  providerViewMissions: "Voir mes missions",
  providerManageServices: "Gérer mes services",
  providerFinances: "Finances",
  providerNavEyebrow: "Navigation principale",
  providerNavTitle: "Ton activité, classée par fonction",
  providerNavDescription:
    "Les cinq espaces principaux couvrent l’activité récurrente. Les réglages et outils ponctuels sont rangés séparément.",
  providerActionMissionsTitle: "Missions",
  providerActionMissionsDescription:
    "Découvre les opportunités compatibles et suis les prestations déjà engagées.",
  providerActionServicesTitle: "Services",
  providerActionServicesDescription:
    "Gère tes métiers, tarifs, zones, disponibilités et présentation professionnelle.",
  providerActionFinancesTitle: "Finances",
  providerActionFinancesDescription:
    "Retrouve ton statut de paiement, tes versements et la configuration bancaire.",
  providerActionMessagesTitle: "Messages",
  providerActionMessagesDescription:
    "Échange avec les clients liés à tes demandes, devis et missions.",
  providerActionProfileTitle: "Mon profil",
  providerActionProfileDescription:
    "Gère ton identité, ta réputation et les informations de ton profil public.",
  providerSecondaryEyebrow: "Outils secondaires",
  providerAssistant: "Assistant prestataire",
  providerQuoteRequests: "Demandes de devis",
  bookings: "Réservations",
  providerAddService: "Ajouter un métier",
  providerScoreReviews: "Score et avis",

  actionEyebrow: "À faire maintenant",
  actionProviderTitle: "Priorités de ton activité",
  actionClientTitle: "Tes prochaines actions",
  actionPriorityCount: "{{count}} priorité{{suffix}}",
  actionLoadingTitle: "KLYX vérifie tes priorités",
  actionLoadingDescription:
    "Devis, réservations et missions sont analysés ensemble.",
  actionLoadFailed:
    "Le centre d’actions n’a pas pu être actualisé. Tes autres fonctions KLYX restent disponibles.",
  actionNothingUrgent: "Rien d’urgent pour le moment",
  actionProviderNothingUrgent:
    "Aucun devis ni aucune mission ne demande ton intervention immédiate.",
  actionClientNothingUrgent:
    "Aucun devis ni aucune réservation ne demande ta confirmation immédiate.",
  actionProviderExplore: "Voir les opportunités",
  actionClientExplore: "Organiser un besoin",
  actionBookingProviderTitle: "Missions à traiter",
  actionBookingClientTitle: "Réservations à confirmer",
  actionBookingProviderDescription:
    "Une ou plusieurs missions demandent ton intervention. Ouvre le suivi KLYX pour voir la prochaine étape.",
  actionBookingClientDescription:
    "Une ou plusieurs réservations attendent ton action ou ta confirmation.",
  actionProviderQuotesRequestedTitle: "Demandes de devis à traiter",
  actionProviderQuotesRequestedDescription:
    "Des clients attendent ton prix. Prépare puis envoie chaque devis lorsque tu es prêt.",
  actionProviderQuotesSentTitle: "Devis en attente du client",
  actionProviderQuotesSentDescription:
    "Ces propositions ont été envoyées et attendent encore une décision du client.",
  actionClientQuotesSentTitle: "Devis à examiner",
  actionClientQuotesSentDescription:
    "Un prestataire a proposé un prix. Vérifie son devis avant d’accepter ou refuser.",
  actionClientQuotesAcceptedTitle: "Réservation à finaliser",
  actionClientQuotesAcceptedDescription:
    "Un devis a été accepté. Vérifie maintenant le créneau et continue vers la réservation.",
  actionClientQuotesRequestedTitle: "Devis en attente",
  actionClientQuotesRequestedDescription:
    "Tes demandes de devis sont envoyées. Les prestataires doivent encore répondre.",
  actionUpcomingProviderTitle: "Prochaines missions",
  actionUpcomingClientTitle: "Tes missions avancent",
  actionUpcomingProviderDescription:
    "Tes prochaines prestations sont enregistrées. Consulte les horaires et le suivi.",
  actionUpcomingClientDescription:
    "Tes prochaines réservations sont déjà suivies par KLYX.",

  activityEyebrow: "Activité réelle",
  activityGroupAware: "Group-aware",
  activityTitle: "Missions et créneaux",
  activityDescription:
    "Une mission multi-créneaux compte une seule fois commercialement, tout en conservant son volume réel d’interventions.",
  activityRefresh: "Actualiser",
  activityLoadFailed: "Les statistiques d’activité sont momentanément indisponibles.",
  activityCommercialMissions: "Missions commerciales",
  activityActiveDetail: "{{count}} active(s)",
  activityCompletedMissions: "Missions terminées",
  activityCompletionDetail: "{{percent}} de complétion",
  activityGroupedMissions: "Missions groupées",
  activitySingleDetail: "{{count}} mission(s) simple(s)",
  activityExecutedSlots: "Créneaux exécutés",
  activityTotalSlotsDetail: "{{count}} créneau(x) total",
  activityCancellationRate: "Taux d’annulation commercial : {{percent}}",
  activityCancellationDescription:
    "Une mission groupée annulée compte comme une seule annulation, indépendamment du nombre de créneaux.",
  activityViewScore: "Voir mon KLYX Score",
  activityRefreshFailed: "Dernière actualisation impossible.",

  notificationsLabel: "Notifications",
  notificationsUnread: "{{count}} non lue{{suffix}}",
  notificationsMarkAllRead: "Tout lire",
  notificationsLoadFailed: "Impossible d’actualiser les notifications.",
  notificationsLoading: "Chargement...",
  notificationsEmpty: "Aucune notification.",
} as const;

export type KlyxDashboardMessageKey = keyof typeof FR;
export type KlyxDashboardMessageValues = Readonly<
  Record<string, string | number>
>;

type Dictionary = Record<KlyxDashboardMessageKey, string>;

const EN: Dictionary = {
  resumeEyebrow: "Continue your journey",
  resumeProviderTitle: "Find your next job.",
  resumeClientTitle: "Organize your next need.",
  resumeProviderPrimary: "View opportunities",
  resumeProviderSecondary: "Manage my activity",
  resumeClientPrimary: "Organize a need",
  resumeClientSecondary: "Search myself",
  headerProviderPrimary: "View opportunities",
  headerClientPrimary: "Organize a need",
  headerActiveProvider: "Active profile · Provider",
  headerActiveClient: "Active profile · Client",
  headerTitle: "Dashboard",
  headerWelcome: "Welcome{{name}}.",
  headerUserFallback: "KLYX user",
  headerProviderSpace: "Professional space",
  headerClientSpace: "Services space",
  headerManageProfiles: "Manage profiles",
  headerSettings: "Settings",
  headerFounderConsole: "Founder Console",
  headerAdmin: "Admin",
  clientTagline: "KLYX services assistant",
  clientHello: "Hello {{name}}",
  clientWelcomeFallback: "and welcome",
  clientHeroDescription:
    "Start by telling KLYX what you need. KLYX organizes the journey while secondary features stay available without cluttering your space.",
  clientOrganizeNeed: "Organize my need",
  clientViewActivity: "View my activity",
  clientNavEyebrow: "Main navigation",
  clientNavTitle: "The essentials, without clutter",
  clientNavDescription:
    "Four spaces cover everyday use. Less frequent tools are grouped below.",
  clientActionAssistantTitle: "KLYX Assistant",
  clientActionAssistantDescription:
    "Describe your need and let KLYX prepare the search and booking.",
  clientActionActivityTitle: "My activity",
  clientActionActivityDescription:
    "Find your quotes, bookings and ongoing services in one place.",
  clientActionMessagesTitle: "Messages",
  clientActionMessagesDescription:
    "Talk with providers connected to your requests and jobs.",
  clientActionProfileTitle: "My profile",
  clientActionProfileDescription:
    "Manage your KLYX identity and the information visible on your account.",
  open: "Open",
  clientSecondaryEyebrow: "Secondary access",
  clientCompareProviders: "Compare providers",
  favorites: "Favorites",
  settings: "Settings",
  providerTagline: "Provider space",
  providerHello: "Hello {{name}}",
  providerProfessionalFallback: "professional",
  providerHeroDescription:
    "Your space is centered on jobs, services and finances. Occasional tools remain available without competing with daily work.",
  providerViewMissions: "View my jobs",
  providerManageServices: "Manage my services",
  providerFinances: "Finances",
  providerNavEyebrow: "Main navigation",
  providerNavTitle: "Your activity, organized by function",
  providerNavDescription:
    "The five main spaces cover recurring work. Settings and occasional tools are grouped separately.",
  providerActionMissionsTitle: "Jobs",
  providerActionMissionsDescription:
    "Discover matching opportunities and track services already underway.",
  providerActionServicesTitle: "Services",
  providerActionServicesDescription:
    "Manage your skills, rates, areas, availability and professional presentation.",
  providerActionFinancesTitle: "Finances",
  providerActionFinancesDescription:
    "Review payment status, payouts and bank setup.",
  providerActionMessagesTitle: "Messages",
  providerActionMessagesDescription:
    "Talk with clients connected to your requests, quotes and jobs.",
  providerActionProfileTitle: "My profile",
  providerActionProfileDescription:
    "Manage your identity, reputation and public profile information.",
  providerSecondaryEyebrow: "Secondary tools",
  providerAssistant: "Provider assistant",
  providerQuoteRequests: "Quote requests",
  bookings: "Bookings",
  providerAddService: "Add a skill",
  providerScoreReviews: "Score and reviews",
  actionEyebrow: "Do now",
  actionProviderTitle: "Activity priorities",
  actionClientTitle: "Your next actions",
  actionPriorityCount: "{{count}} priorit{{suffix}}",
  actionLoadingTitle: "KLYX is checking your priorities",
  actionLoadingDescription: "Quotes, bookings and jobs are analyzed together.",
  actionLoadFailed:
    "The action center could not be refreshed. Your other KLYX features remain available.",
  actionNothingUrgent: "Nothing urgent right now",
  actionProviderNothingUrgent:
    "No quote or job needs your immediate attention.",
  actionClientNothingUrgent:
    "No quote or booking needs your immediate confirmation.",
  actionProviderExplore: "View opportunities",
  actionClientExplore: "Organize a need",
  actionBookingProviderTitle: "Jobs to handle",
  actionBookingClientTitle: "Bookings to confirm",
  actionBookingProviderDescription:
    "One or more jobs need your attention. Open KLYX tracking to see the next step.",
  actionBookingClientDescription:
    "One or more bookings are waiting for your action or confirmation.",
  actionProviderQuotesRequestedTitle: "Quote requests to handle",
  actionProviderQuotesRequestedDescription:
    "Clients are waiting for your price. Prepare and send each quote when ready.",
  actionProviderQuotesSentTitle: "Quotes awaiting the client",
  actionProviderQuotesSentDescription:
    "These proposals were sent and are still awaiting a client decision.",
  actionClientQuotesSentTitle: "Quotes to review",
  actionClientQuotesSentDescription:
    "A provider proposed a price. Review the quote before accepting or declining.",
  actionClientQuotesAcceptedTitle: "Booking to finalize",
  actionClientQuotesAcceptedDescription:
    "A quote was accepted. Check the time slot and continue to booking.",
  actionClientQuotesRequestedTitle: "Quotes pending",
  actionClientQuotesRequestedDescription:
    "Your quote requests were sent. Providers still need to respond.",
  actionUpcomingProviderTitle: "Upcoming jobs",
  actionUpcomingClientTitle: "Your jobs are moving forward",
  actionUpcomingProviderDescription:
    "Your next services are recorded. Review times and tracking.",
  actionUpcomingClientDescription:
    "Your upcoming bookings are already tracked by KLYX.",
  activityEyebrow: "Actual activity",
  activityGroupAware: "Group-aware",
  activityTitle: "Jobs and time slots",
  activityDescription:
    "A multi-slot job counts once commercially while preserving its real intervention volume.",
  activityRefresh: "Refresh",
  activityLoadFailed: "Activity statistics are temporarily unavailable.",
  activityCommercialMissions: "Commercial jobs",
  activityActiveDetail: "{{count}} active",
  activityCompletedMissions: "Completed jobs",
  activityCompletionDetail: "{{percent}} completion",
  activityGroupedMissions: "Grouped jobs",
  activitySingleDetail: "{{count}} single job(s)",
  activityExecutedSlots: "Executed slots",
  activityTotalSlotsDetail: "{{count}} total slot(s)",
  activityCancellationRate: "Commercial cancellation rate: {{percent}}",
  activityCancellationDescription:
    "A cancelled grouped job counts as one cancellation regardless of the number of slots.",
  activityViewScore: "View my KLYX Score",
  activityRefreshFailed: "Latest refresh failed.",
  notificationsLabel: "Notifications",
  notificationsUnread: "{{count}} unread",
  notificationsMarkAllRead: "Mark all read",
  notificationsLoadFailed: "Unable to refresh notifications.",
  notificationsLoading: "Loading...",
  notificationsEmpty: "No notifications.",
};

const NL: Dictionary = {
  resumeEyebrow: "Ga verder met je traject",
  resumeProviderTitle: "Vind je volgende opdracht.",
  resumeClientTitle: "Organiseer je volgende behoefte.",
  resumeProviderPrimary: "Bekijk kansen",
  resumeProviderSecondary: "Mijn activiteit beheren",
  resumeClientPrimary: "Een behoefte organiseren",
  resumeClientSecondary: "Zelf zoeken",
  headerProviderPrimary: "Bekijk kansen",
  headerClientPrimary: "Een behoefte organiseren",
  headerActiveProvider: "Actief profiel · Dienstverlener",
  headerActiveClient: "Actief profiel · Klant",
  headerTitle: "Dashboard",
  headerWelcome: "Welkom{{name}}.",
  headerUserFallback: "KLYX-gebruiker",
  headerProviderSpace: "Professionele ruimte",
  headerClientSpace: "Dienstenruimte",
  headerManageProfiles: "Profielen beheren",
  headerSettings: "Instellingen",
  headerFounderConsole: "Founder-console",
  headerAdmin: "Admin",
  clientTagline: "KLYX dienstenassistent",
  clientHello: "Hallo {{name}}",
  clientWelcomeFallback: "en welkom",
  clientHeroDescription:
    "Vertel eerst wat je nodig hebt. KLYX organiseert daarna het traject, terwijl minder gebruikte functies beschikbaar blijven zonder je ruimte te overladen.",
  clientOrganizeNeed: "Mijn behoefte organiseren",
  clientViewActivity: "Mijn activiteit bekijken",
  clientNavEyebrow: "Hoofdnavigatie",
  clientNavTitle: "Het essentiële, zonder overbelasting",
  clientNavDescription:
    "Vier ruimtes dekken het dagelijks gebruik. Minder gebruikte tools staan hieronder.",
  clientActionAssistantTitle: "KLYX Assistant",
  clientActionAssistantDescription:
    "Beschrijf je behoefte en laat KLYX de zoekopdracht en boeking voorbereiden.",
  clientActionActivityTitle: "Mijn activiteit",
  clientActionActivityDescription:
    "Vind je offertes, boekingen en lopende diensten op één plek.",
  clientActionMessagesTitle: "Berichten",
  clientActionMessagesDescription:
    "Praat met dienstverleners die bij je aanvragen en opdrachten horen.",
  clientActionProfileTitle: "Mijn profiel",
  clientActionProfileDescription:
    "Beheer je KLYX-identiteit en de informatie die zichtbaar is op je account.",
  open: "Openen",
  clientSecondaryEyebrow: "Secundaire toegang",
  clientCompareProviders: "Dienstverleners vergelijken",
  favorites: "Favorieten",
  settings: "Instellingen",
  providerTagline: "Ruimte voor dienstverleners",
  providerHello: "Hallo {{name}}",
  providerProfessionalFallback: "professional",
  providerHeroDescription:
    "Je ruimte draait om opdrachten, diensten en financiën. Minder gebruikte tools blijven beschikbaar zonder het dagelijkse werk te hinderen.",
  providerViewMissions: "Mijn opdrachten bekijken",
  providerManageServices: "Mijn diensten beheren",
  providerFinances: "Financiën",
  providerNavEyebrow: "Hoofdnavigatie",
  providerNavTitle: "Je activiteit, per functie geordend",
  providerNavDescription:
    "De vijf hoofdruimtes dekken terugkerend werk. Instellingen en incidentele tools staan apart.",
  providerActionMissionsTitle: "Opdrachten",
  providerActionMissionsDescription:
    "Ontdek passende kansen en volg diensten die al lopen.",
  providerActionServicesTitle: "Diensten",
  providerActionServicesDescription:
    "Beheer je vaardigheden, tarieven, werkgebieden, beschikbaarheid en professionele presentatie.",
  providerActionFinancesTitle: "Financiën",
  providerActionFinancesDescription:
    "Bekijk je betaalstatus, uitbetalingen en bankconfiguratie.",
  providerActionMessagesTitle: "Berichten",
  providerActionMessagesDescription:
    "Praat met klanten die bij je aanvragen, offertes en opdrachten horen.",
  providerActionProfileTitle: "Mijn profiel",
  providerActionProfileDescription:
    "Beheer je identiteit, reputatie en openbare profielinformatie.",
  providerSecondaryEyebrow: "Secundaire tools",
  providerAssistant: "Assistent voor dienstverleners",
  providerQuoteRequests: "Offerteaanvragen",
  bookings: "Boekingen",
  providerAddService: "Vaardigheid toevoegen",
  providerScoreReviews: "Score en reviews",
  actionEyebrow: "Nu te doen",
  actionProviderTitle: "Prioriteiten van je activiteit",
  actionClientTitle: "Je volgende acties",
  actionPriorityCount: "{{count}} prioriteit{{suffix}}",
  actionLoadingTitle: "KLYX controleert je prioriteiten",
  actionLoadingDescription: "Offertes, boekingen en opdrachten worden samen geanalyseerd.",
  actionLoadFailed:
    "Het actiecentrum kon niet worden vernieuwd. Je andere KLYX-functies blijven beschikbaar.",
  actionNothingUrgent: "Momenteel niets dringends",
  actionProviderNothingUrgent:
    "Geen offerte of opdracht vereist nu je onmiddellijke aandacht.",
  actionClientNothingUrgent:
    "Geen offerte of boeking vereist nu je onmiddellijke bevestiging.",
  actionProviderExplore: "Bekijk kansen",
  actionClientExplore: "Een behoefte organiseren",
  actionBookingProviderTitle: "Opdrachten om te behandelen",
  actionBookingClientTitle: "Boekingen om te bevestigen",
  actionBookingProviderDescription:
    "Eén of meer opdrachten vragen je aandacht. Open de KLYX-opvolging voor de volgende stap.",
  actionBookingClientDescription:
    "Eén of meer boekingen wachten op je actie of bevestiging.",
  actionProviderQuotesRequestedTitle: "Offerteaanvragen om te behandelen",
  actionProviderQuotesRequestedDescription:
    "Klanten wachten op je prijs. Bereid elke offerte voor en verstuur ze wanneer je klaar bent.",
  actionProviderQuotesSentTitle: "Offertes wachten op de klant",
  actionProviderQuotesSentDescription:
    "Deze voorstellen zijn verstuurd en wachten nog op een beslissing van de klant.",
  actionClientQuotesSentTitle: "Offertes om te bekijken",
  actionClientQuotesSentDescription:
    "Een dienstverlener heeft een prijs voorgesteld. Bekijk de offerte voor je accepteert of weigert.",
  actionClientQuotesAcceptedTitle: "Boeking afronden",
  actionClientQuotesAcceptedDescription:
    "Een offerte is geaccepteerd. Controleer het tijdslot en ga verder naar de boeking.",
  actionClientQuotesRequestedTitle: "Offertes in afwachting",
  actionClientQuotesRequestedDescription:
    "Je offerteaanvragen zijn verstuurd. Dienstverleners moeten nog antwoorden.",
  actionUpcomingProviderTitle: "Komende opdrachten",
  actionUpcomingClientTitle: "Je opdrachten gaan vooruit",
  actionUpcomingProviderDescription:
    "Je volgende diensten zijn geregistreerd. Bekijk tijden en opvolging.",
  actionUpcomingClientDescription:
    "Je komende boekingen worden al door KLYX gevolgd.",
  activityEyebrow: "Werkelijke activiteit",
  activityGroupAware: "Groepsbewust",
  activityTitle: "Opdrachten en tijdsloten",
  activityDescription:
    "Een opdracht met meerdere tijdsloten telt commercieel één keer, terwijl het echte interventievolume behouden blijft.",
  activityRefresh: "Vernieuwen",
  activityLoadFailed: "Activiteitsstatistieken zijn tijdelijk niet beschikbaar.",
  activityCommercialMissions: "Commerciële opdrachten",
  activityActiveDetail: "{{count}} actief",
  activityCompletedMissions: "Voltooide opdrachten",
  activityCompletionDetail: "{{percent}} voltooid",
  activityGroupedMissions: "Gegroepeerde opdrachten",
  activitySingleDetail: "{{count}} losse opdracht(en)",
  activityExecutedSlots: "Uitgevoerde tijdsloten",
  activityTotalSlotsDetail: "{{count}} tijdslot(en) totaal",
  activityCancellationRate: "Commercieel annuleringspercentage: {{percent}}",
  activityCancellationDescription:
    "Een geannuleerde gegroepeerde opdracht telt als één annulering, ongeacht het aantal tijdsloten.",
  activityViewScore: "Mijn KLYX Score bekijken",
  activityRefreshFailed: "Laatste vernieuwing mislukt.",
  notificationsLabel: "Meldingen",
  notificationsUnread: "{{count}} ongelezen",
  notificationsMarkAllRead: "Alles als gelezen",
  notificationsLoadFailed: "Meldingen kunnen niet worden vernieuwd.",
  notificationsLoading: "Laden...",
  notificationsEmpty: "Geen meldingen.",
};

const DE: Dictionary = {
  resumeEyebrow: "Vorgang fortsetzen",
  resumeProviderTitle: "Finde deinen nächsten Auftrag.",
  resumeClientTitle: "Organisiere deinen nächsten Bedarf.",
  resumeProviderPrimary: "Chancen ansehen",
  resumeProviderSecondary: "Meine Aktivität verwalten",
  resumeClientPrimary: "Bedarf organisieren",
  resumeClientSecondary: "Selbst suchen",
  headerProviderPrimary: "Chancen ansehen",
  headerClientPrimary: "Bedarf organisieren",
  headerActiveProvider: "Aktives Profil · Anbieter",
  headerActiveClient: "Aktives Profil · Kunde",
  headerTitle: "Dashboard",
  headerWelcome: "Willkommen{{name}}.",
  headerUserFallback: "KLYX-Nutzer",
  headerProviderSpace: "Professioneller Bereich",
  headerClientSpace: "Servicebereich",
  headerManageProfiles: "Profile verwalten",
  headerSettings: "Einstellungen",
  headerFounderConsole: "Founder-Konsole",
  headerAdmin: "Admin",
  clientTagline: "KLYX Service-Assistent",
  clientHello: "Hallo {{name}}",
  clientWelcomeFallback: "und willkommen",
  clientHeroDescription:
    "Sag zuerst, was du brauchst. KLYX organisiert anschließend den Ablauf, während weniger häufige Funktionen verfügbar bleiben, ohne deinen Bereich zu überladen.",
  clientOrganizeNeed: "Meinen Bedarf organisieren",
  clientViewActivity: "Meine Aktivität ansehen",
  clientNavEyebrow: "Hauptnavigation",
  clientNavTitle: "Das Wesentliche, ohne Überlastung",
  clientNavDescription:
    "Vier Bereiche decken den täglichen Gebrauch ab. Weniger häufige Werkzeuge sind unten gruppiert.",
  clientActionAssistantTitle: "KLYX Assistant",
  clientActionAssistantDescription:
    "Beschreibe deinen Bedarf und lass KLYX Suche und Buchung vorbereiten.",
  clientActionActivityTitle: "Meine Aktivität",
  clientActionActivityDescription:
    "Finde Angebote, Buchungen und laufende Leistungen an einem Ort.",
  clientActionMessagesTitle: "Nachrichten",
  clientActionMessagesDescription:
    "Tausche dich mit Anbietern zu deinen Anfragen und Aufträgen aus.",
  clientActionProfileTitle: "Mein Profil",
  clientActionProfileDescription:
    "Verwalte deine KLYX-Identität und die sichtbaren Kontoinformationen.",
  open: "Öffnen",
  clientSecondaryEyebrow: "Weitere Zugänge",
  clientCompareProviders: "Anbieter vergleichen",
  favorites: "Favoriten",
  settings: "Einstellungen",
  providerTagline: "Anbieterbereich",
  providerHello: "Hallo {{name}}",
  providerProfessionalFallback: "Profi",
  providerHeroDescription:
    "Dein Bereich konzentriert sich auf Aufträge, Services und Finanzen. Gelegentliche Werkzeuge bleiben verfügbar, ohne die tägliche Arbeit zu stören.",
  providerViewMissions: "Meine Aufträge ansehen",
  providerManageServices: "Meine Services verwalten",
  providerFinances: "Finanzen",
  providerNavEyebrow: "Hauptnavigation",
  providerNavTitle: "Deine Aktivität, nach Funktion geordnet",
  providerNavDescription:
    "Die fünf Hauptbereiche decken wiederkehrende Arbeit ab. Einstellungen und gelegentliche Werkzeuge sind separat gruppiert.",
  providerActionMissionsTitle: "Aufträge",
  providerActionMissionsDescription:
    "Entdecke passende Chancen und verfolge bereits laufende Leistungen.",
  providerActionServicesTitle: "Services",
  providerActionServicesDescription:
    "Verwalte Fähigkeiten, Preise, Gebiete, Verfügbarkeit und professionelle Darstellung.",
  providerActionFinancesTitle: "Finanzen",
  providerActionFinancesDescription:
    "Prüfe Zahlungsstatus, Auszahlungen und Bankeinrichtung.",
  providerActionMessagesTitle: "Nachrichten",
  providerActionMessagesDescription:
    "Tausche dich mit Kunden zu Anfragen, Angeboten und Aufträgen aus.",
  providerActionProfileTitle: "Mein Profil",
  providerActionProfileDescription:
    "Verwalte Identität, Ruf und öffentliche Profilinformationen.",
  providerSecondaryEyebrow: "Weitere Werkzeuge",
  providerAssistant: "Anbieter-Assistent",
  providerQuoteRequests: "Angebotsanfragen",
  bookings: "Buchungen",
  providerAddService: "Fähigkeit hinzufügen",
  providerScoreReviews: "Score und Bewertungen",
  actionEyebrow: "Jetzt erledigen",
  actionProviderTitle: "Prioritäten deiner Aktivität",
  actionClientTitle: "Deine nächsten Aktionen",
  actionPriorityCount: "{{count}} Priorität{{suffix}}",
  actionLoadingTitle: "KLYX prüft deine Prioritäten",
  actionLoadingDescription: "Angebote, Buchungen und Aufträge werden gemeinsam analysiert.",
  actionLoadFailed:
    "Das Aktionszentrum konnte nicht aktualisiert werden. Deine anderen KLYX-Funktionen bleiben verfügbar.",
  actionNothingUrgent: "Im Moment nichts Dringendes",
  actionProviderNothingUrgent:
    "Kein Angebot und kein Auftrag braucht gerade deine sofortige Aufmerksamkeit.",
  actionClientNothingUrgent:
    "Kein Angebot und keine Buchung braucht gerade deine sofortige Bestätigung.",
  actionProviderExplore: "Chancen ansehen",
  actionClientExplore: "Bedarf organisieren",
  actionBookingProviderTitle: "Aufträge zu bearbeiten",
  actionBookingClientTitle: "Buchungen zu bestätigen",
  actionBookingProviderDescription:
    "Ein oder mehrere Aufträge brauchen deine Aufmerksamkeit. Öffne die KLYX-Verfolgung für den nächsten Schritt.",
  actionBookingClientDescription:
    "Eine oder mehrere Buchungen warten auf deine Aktion oder Bestätigung.",
  actionProviderQuotesRequestedTitle: "Angebotsanfragen zu bearbeiten",
  actionProviderQuotesRequestedDescription:
    "Kunden warten auf deinen Preis. Bereite jedes Angebot vor und sende es, wenn du bereit bist.",
  actionProviderQuotesSentTitle: "Angebote warten auf den Kunden",
  actionProviderQuotesSentDescription:
    "Diese Vorschläge wurden gesendet und warten noch auf eine Kundenentscheidung.",
  actionClientQuotesSentTitle: "Angebote prüfen",
  actionClientQuotesSentDescription:
    "Ein Anbieter hat einen Preis vorgeschlagen. Prüfe das Angebot vor Annahme oder Ablehnung.",
  actionClientQuotesAcceptedTitle: "Buchung abschließen",
  actionClientQuotesAcceptedDescription:
    "Ein Angebot wurde angenommen. Prüfe das Zeitfenster und fahre mit der Buchung fort.",
  actionClientQuotesRequestedTitle: "Angebote ausstehend",
  actionClientQuotesRequestedDescription:
    "Deine Angebotsanfragen wurden gesendet. Anbieter müssen noch antworten.",
  actionUpcomingProviderTitle: "Kommende Aufträge",
  actionUpcomingClientTitle: "Deine Aufträge kommen voran",
  actionUpcomingProviderDescription:
    "Deine nächsten Leistungen sind erfasst. Prüfe Zeiten und Verfolgung.",
  actionUpcomingClientDescription:
    "Deine kommenden Buchungen werden bereits von KLYX verfolgt.",
  activityEyebrow: "Tatsächliche Aktivität",
  activityGroupAware: "Gruppenbewusst",
  activityTitle: "Aufträge und Zeitfenster",
  activityDescription:
    "Ein Auftrag mit mehreren Zeitfenstern zählt kommerziell einmal, während das reale Einsatzvolumen erhalten bleibt.",
  activityRefresh: "Aktualisieren",
  activityLoadFailed: "Aktivitätsstatistiken sind vorübergehend nicht verfügbar.",
  activityCommercialMissions: "Kommerzielle Aufträge",
  activityActiveDetail: "{{count}} aktiv",
  activityCompletedMissions: "Abgeschlossene Aufträge",
  activityCompletionDetail: "{{percent}} Abschluss",
  activityGroupedMissions: "Gruppierte Aufträge",
  activitySingleDetail: "{{count}} Einzelauftrag/-aufträge",
  activityExecutedSlots: "Ausgeführte Zeitfenster",
  activityTotalSlotsDetail: "{{count}} Zeitfenster insgesamt",
  activityCancellationRate: "Kommerzielle Stornoquote: {{percent}}",
  activityCancellationDescription:
    "Ein stornierter gruppierter Auftrag zählt als eine Stornierung, unabhängig von der Zahl der Zeitfenster.",
  activityViewScore: "Meinen KLYX Score ansehen",
  activityRefreshFailed: "Letzte Aktualisierung fehlgeschlagen.",
  notificationsLabel: "Benachrichtigungen",
  notificationsUnread: "{{count}} ungelesen",
  notificationsMarkAllRead: "Alle als gelesen",
  notificationsLoadFailed: "Benachrichtigungen können nicht aktualisiert werden.",
  notificationsLoading: "Wird geladen...",
  notificationsEmpty: "Keine Benachrichtigungen.",
};

const DICTIONARIES: Record<KlyxDashboardLocale, Dictionary> = {
  fr: FR,
  en: EN,
  nl: NL,
  de: DE,
};

export function resolveKlyxDashboardLocale(locale: string): KlyxDashboardLocale {
  return KLYX_DASHBOARD_TRANSLATED_LOCALES.includes(
    locale as KlyxDashboardLocale
  )
    ? (locale as KlyxDashboardLocale)
    : "fr";
}

export function translateKlyxDashboard(
  locale: string,
  key: KlyxDashboardMessageKey,
  values: KlyxDashboardMessageValues = {}
): string {
  const template = DICTIONARIES[resolveKlyxDashboardLocale(locale)][key];

  return Object.entries(values).reduce(
    (message, [name, value]) =>
      message.replaceAll(`{{${name}}}`, String(value)),
    template
  );
}

export function klyxDashboardDateLocale(locale: string): string {
  const resolved = resolveKlyxDashboardLocale(locale);

  if (resolved === "en") return "en-GB";
  if (resolved === "nl") return "nl-BE";
  if (resolved === "de") return "de-BE";
  return "fr-BE";
}
