export const KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxBookingsPageLocale =
  (typeof KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_BOOKINGS_PAGE_MESSAGE_KEYS = [
  "dashboard",
  "providerSpace",
  "clientSpace",
  "title",
  "refresh",
  "groupedViewActive",
  "providerTracking",
  "providerActivityNow",
  "providerActivityDescription",
  "toHandle",
  "upcoming",
  "completed",
  "nextStep",
  "actionRequiredTitle",
  "nextMission",
  "status",
  "openMission",
  "viewOpportunities",
  "providerAssistant",
  "providerSafety",
  "clientTracking",
  "clientActionNeeded",
  "clientMissionsProgress",
  "clientAllUpToDate",
  "clientDescription",
  "toConfirm",
  "nextStepKlyx",
  "agreementRequired",
  "missionTracked",
  "viewMission",
  "groupedMissionTracked",
  "groupedMissionDescription",
  "organizeAnotherNeed",
  "findProvider",
  "explicitConfirmationBoundary",
  "filterActions",
  "filterUpcoming",
  "filterHistory",
  "filterAll",
  "loading",
  "nothingToHandle",
  "nothingToHandleDescription",
  "emptyTitle",
  "emptyProvider",
  "emptyClient",
  "manageListing",
  "findService",
  "groupedMission",
  "groupedSlots",
  "actionRequiredNotice",
  "date",
  "planning",
  "schedule",
  "totalMission",
  "amount",
  "openGroupedMission",
  "viewBooking",
  "priceToConfirm",
  "currencyUnavailable",
  "loadFailed",
  "statusPending",
  "statusPaymentPending",
  "statusAccepted",
  "statusCompleted",
  "statusCancelled",
  "statusRejected",
  "statusCancellationWaiting",
  "statusCancellationDecision",
  "statusRefundProcessing",
  "statusRefundFailed",
  "statusRefunded",
] as const;

export type KlyxBookingsPageMessageKey =
  (typeof KLYX_BOOKINGS_PAGE_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxBookingsPageMessageKey, string>;

const dictionaries: Record<KlyxBookingsPageLocale, Dictionary> = {
  fr: {
    dashboard: "Tableau de bord",
    providerSpace: "Espace prestataire",
    clientSpace: "Espace client",
    title: "Mes réservations",
    refresh: "Actualiser",
    groupedViewActive: "Vue groupée active",
    providerTracking: "Suivi KLYX prestataire",
    providerActivityNow: "Ton activité maintenant",
    providerActivityDescription:
      "KLYX rassemble les réservations qui demandent ton attention, celles à venir et celles déjà terminées.",
    toHandle: "À traiter",
    upcoming: "À venir",
    completed: "Terminées",
    nextStep: "Prochaine étape",
    actionRequiredTitle: "Une action est requise",
    nextMission: "Prochaine mission",
    status: "Statut",
    openMission: "Ouvrir la mission",
    viewOpportunities: "Voir les opportunités",
    providerAssistant: "Assistant prestataire",
    providerSafety:
      "KLYX indique la prochaine étape mais ne confirme aucune mission et ne déclenche aucun paiement automatiquement.",
    clientTracking: "KLYX s’en occupe",
    clientActionNeeded: "Ton action est nécessaire",
    clientMissionsProgress: "Tes missions avancent",
    clientAllUpToDate: "Tout est à jour",
    clientDescription:
      "KLYX rassemble ici les réservations qui avancent, celles qui attendent ta confirmation et la prochaine étape à effectuer.",
    toConfirm: "À confirmer",
    nextStepKlyx: "Prochaine étape KLYX",
    agreementRequired: "Ton accord est nécessaire",
    missionTracked: "Mission en cours de suivi",
    viewMission: "Voir la mission",
    groupedMissionTracked: "Mission groupée suivie par KLYX",
    groupedMissionDescription:
      "Les différentes parties de ta mission apparaissent dans la vue groupée ci-dessous.",
    organizeAnotherNeed: "Organiser un autre besoin",
    findProvider: "Chercher un prestataire",
    explicitConfirmationBoundary:
      "KLYX peut suivre et recommander la prochaine étape, mais une confirmation explicite reste nécessaire avant un choix de prestataire, une réservation ou un paiement.",
    filterActions: "À traiter",
    filterUpcoming: "À venir",
    filterHistory: "Historique",
    filterAll: "Toutes",
    loading: "Chargement des réservations...",
    nothingToHandle: "Rien à traiter",
    nothingToHandleDescription:
      "Les missions qui demandent ton intervention apparaîtront ici.",
    emptyTitle: "Aucune réservation pour le moment",
    emptyProvider:
      "Les nouvelles missions apparaîtront ici lorsqu’un client choisira tes services.",
    emptyClient:
      "Trouve un prestataire et organise ta première mission avec KLYX.",
    manageListing: "Gérer ma fiche",
    findService: "Trouver un service",
    groupedMission: "Mission groupée",
    groupedSlots: "réunis dans une seule réservation",
    actionRequiredNotice: "Une action de ta part est requise.",
    date: "Date",
    planning: "Planning",
    schedule: "Horaire",
    totalMission: "Total mission",
    amount: "Montant",
    openGroupedMission: "Ouvrir la mission groupée",
    viewBooking: "Voir la réservation",
    priceToConfirm: "Prix à confirmer",
    currencyUnavailable: "devise indisponible",
    loadFailed: "Impossible de charger les réservations.",
    statusPending: "En attente",
    statusPaymentPending: "Paiement à finaliser",
    statusAccepted: "Acceptée",
    statusCompleted: "Terminée",
    statusCancelled: "Annulée",
    statusRejected: "Refusée",
    statusCancellationWaiting: "Annulation en attente",
    statusCancellationDecision: "Décision requise",
    statusRefundProcessing: "Remboursement en cours",
    statusRefundFailed: "Remboursement à vérifier",
    statusRefunded: "Remboursée",
  },
  en: {
    dashboard: "Dashboard",
    providerSpace: "Provider space",
    clientSpace: "Client space",
    title: "My bookings",
    refresh: "Refresh",
    groupedViewActive: "Grouped view active",
    providerTracking: "KLYX provider tracking",
    providerActivityNow: "Your activity now",
    providerActivityDescription:
      "KLYX brings together bookings that need your attention, upcoming bookings and completed work.",
    toHandle: "To handle",
    upcoming: "Upcoming",
    completed: "Completed",
    nextStep: "Next step",
    actionRequiredTitle: "Action required",
    nextMission: "Next mission",
    status: "Status",
    openMission: "Open mission",
    viewOpportunities: "View opportunities",
    providerAssistant: "Provider assistant",
    providerSafety:
      "KLYX shows the next step but does not confirm any mission or trigger any payment automatically.",
    clientTracking: "KLYX is handling it",
    clientActionNeeded: "Your action is required",
    clientMissionsProgress: "Your missions are moving forward",
    clientAllUpToDate: "Everything is up to date",
    clientDescription:
      "KLYX brings together bookings that are progressing, those waiting for your confirmation and the next step to take.",
    toConfirm: "To confirm",
    nextStepKlyx: "Next KLYX step",
    agreementRequired: "Your approval is required",
    missionTracked: "Mission being tracked",
    viewMission: "View mission",
    groupedMissionTracked: "Grouped mission tracked by KLYX",
    groupedMissionDescription:
      "The different parts of your mission appear in the grouped view below.",
    organizeAnotherNeed: "Organize another need",
    findProvider: "Find a provider",
    explicitConfirmationBoundary:
      "KLYX can track and recommend the next step, but explicit confirmation is still required before choosing a provider, making a booking or making a payment.",
    filterActions: "To handle",
    filterUpcoming: "Upcoming",
    filterHistory: "History",
    filterAll: "All",
    loading: "Loading bookings...",
    nothingToHandle: "Nothing to handle",
    nothingToHandleDescription:
      "Missions that require your intervention will appear here.",
    emptyTitle: "No bookings yet",
    emptyProvider:
      "New missions will appear here when a client chooses your services.",
    emptyClient: "Find a provider and organize your first mission with KLYX.",
    manageListing: "Manage my listing",
    findService: "Find a service",
    groupedMission: "Grouped mission",
    groupedSlots: "combined in one booking",
    actionRequiredNotice: "Action is required from you.",
    date: "Date",
    planning: "Schedule",
    schedule: "Time",
    totalMission: "Mission total",
    amount: "Amount",
    openGroupedMission: "Open grouped mission",
    viewBooking: "View booking",
    priceToConfirm: "Price to be confirmed",
    currencyUnavailable: "currency unavailable",
    loadFailed: "Unable to load bookings.",
    statusPending: "Pending",
    statusPaymentPending: "Payment to complete",
    statusAccepted: "Accepted",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    statusRejected: "Rejected",
    statusCancellationWaiting: "Cancellation pending",
    statusCancellationDecision: "Decision required",
    statusRefundProcessing: "Refund processing",
    statusRefundFailed: "Refund needs review",
    statusRefunded: "Refunded",
  },
  nl: {
    dashboard: "Dashboard",
    providerSpace: "Dienstverlenersruimte",
    clientSpace: "Klantruimte",
    title: "Mijn boekingen",
    refresh: "Vernieuwen",
    groupedViewActive: "Gegroepeerde weergave actief",
    providerTracking: "KLYX-opvolging voor dienstverleners",
    providerActivityNow: "Je activiteit nu",
    providerActivityDescription:
      "KLYX bundelt boekingen die je aandacht vragen, aankomende boekingen en afgeronde opdrachten.",
    toHandle: "Te behandelen",
    upcoming: "Aankomend",
    completed: "Voltooid",
    nextStep: "Volgende stap",
    actionRequiredTitle: "Actie vereist",
    nextMission: "Volgende missie",
    status: "Status",
    openMission: "Missie openen",
    viewOpportunities: "Kansen bekijken",
    providerAssistant: "Assistent voor dienstverleners",
    providerSafety:
      "KLYX toont de volgende stap maar bevestigt geen missie en start geen betaling automatisch.",
    clientTracking: "KLYX regelt het",
    clientActionNeeded: "Je actie is vereist",
    clientMissionsProgress: "Je missies gaan vooruit",
    clientAllUpToDate: "Alles is bijgewerkt",
    clientDescription:
      "KLYX bundelt hier boekingen die vooruitgaan, boekingen die op je bevestiging wachten en de volgende stap die je moet nemen.",
    toConfirm: "Te bevestigen",
    nextStepKlyx: "Volgende KLYX-stap",
    agreementRequired: "Je akkoord is vereist",
    missionTracked: "Missie wordt opgevolgd",
    viewMission: "Missie bekijken",
    groupedMissionTracked: "Gegroepeerde missie opgevolgd door KLYX",
    groupedMissionDescription:
      "De verschillende delen van je missie verschijnen in de gegroepeerde weergave hieronder.",
    organizeAnotherNeed: "Nog een behoefte organiseren",
    findProvider: "Dienstverlener zoeken",
    explicitConfirmationBoundary:
      "KLYX kan de volgende stap volgen en aanbevelen, maar expliciete bevestiging blijft vereist vóór de keuze van een dienstverlener, een boeking of een betaling.",
    filterActions: "Te behandelen",
    filterUpcoming: "Aankomend",
    filterHistory: "Geschiedenis",
    filterAll: "Alle",
    loading: "Boekingen laden...",
    nothingToHandle: "Niets te behandelen",
    nothingToHandleDescription:
      "Missies waarvoor je tussenkomst nodig is, verschijnen hier.",
    emptyTitle: "Nog geen boekingen",
    emptyProvider:
      "Nieuwe missies verschijnen hier wanneer een klant jouw diensten kiest.",
    emptyClient: "Zoek een dienstverlener en organiseer je eerste missie met KLYX.",
    manageListing: "Mijn profiel beheren",
    findService: "Een dienst zoeken",
    groupedMission: "Gegroepeerde missie",
    groupedSlots: "samengebracht in één boeking",
    actionRequiredNotice: "Een actie van jou is vereist.",
    date: "Datum",
    planning: "Planning",
    schedule: "Tijd",
    totalMission: "Totaal missie",
    amount: "Bedrag",
    openGroupedMission: "Gegroepeerde missie openen",
    viewBooking: "Boeking bekijken",
    priceToConfirm: "Prijs nog te bevestigen",
    currencyUnavailable: "valuta niet beschikbaar",
    loadFailed: "De boekingen kunnen niet worden geladen.",
    statusPending: "In afwachting",
    statusPaymentPending: "Betaling afronden",
    statusAccepted: "Geaccepteerd",
    statusCompleted: "Voltooid",
    statusCancelled: "Geannuleerd",
    statusRejected: "Geweigerd",
    statusCancellationWaiting: "Annulering in afwachting",
    statusCancellationDecision: "Beslissing vereist",
    statusRefundProcessing: "Terugbetaling wordt verwerkt",
    statusRefundFailed: "Terugbetaling moet worden gecontroleerd",
    statusRefunded: "Terugbetaald",
  },
  de: {
    dashboard: "Dashboard",
    providerSpace: "Anbieterbereich",
    clientSpace: "Kundenbereich",
    title: "Meine Buchungen",
    refresh: "Aktualisieren",
    groupedViewActive: "Gruppierte Ansicht aktiv",
    providerTracking: "KLYX-Anbieterübersicht",
    providerActivityNow: "Deine Aktivität jetzt",
    providerActivityDescription:
      "KLYX bündelt Buchungen, die deine Aufmerksamkeit benötigen, kommende Buchungen und abgeschlossene Aufträge.",
    toHandle: "Zu bearbeiten",
    upcoming: "Bevorstehend",
    completed: "Abgeschlossen",
    nextStep: "Nächster Schritt",
    actionRequiredTitle: "Aktion erforderlich",
    nextMission: "Nächster Auftrag",
    status: "Status",
    openMission: "Auftrag öffnen",
    viewOpportunities: "Möglichkeiten ansehen",
    providerAssistant: "Anbieterassistent",
    providerSafety:
      "KLYX zeigt den nächsten Schritt, bestätigt aber keinen Auftrag und löst keine Zahlung automatisch aus.",
    clientTracking: "KLYX kümmert sich darum",
    clientActionNeeded: "Deine Aktion ist erforderlich",
    clientMissionsProgress: "Deine Aufträge kommen voran",
    clientAllUpToDate: "Alles ist aktuell",
    clientDescription:
      "KLYX bündelt hier Buchungen, die vorankommen, Buchungen, die auf deine Bestätigung warten, und den nächsten auszuführenden Schritt.",
    toConfirm: "Zu bestätigen",
    nextStepKlyx: "Nächster KLYX-Schritt",
    agreementRequired: "Deine Zustimmung ist erforderlich",
    missionTracked: "Auftrag wird verfolgt",
    viewMission: "Auftrag ansehen",
    groupedMissionTracked: "Gruppierter Auftrag wird von KLYX verfolgt",
    groupedMissionDescription:
      "Die verschiedenen Teile deines Auftrags erscheinen unten in der gruppierten Ansicht.",
    organizeAnotherNeed: "Weiteren Bedarf organisieren",
    findProvider: "Anbieter suchen",
    explicitConfirmationBoundary:
      "KLYX kann den nächsten Schritt verfolgen und empfehlen, aber vor der Auswahl eines Anbieters, einer Buchung oder einer Zahlung ist weiterhin eine ausdrückliche Bestätigung erforderlich.",
    filterActions: "Zu bearbeiten",
    filterUpcoming: "Bevorstehend",
    filterHistory: "Verlauf",
    filterAll: "Alle",
    loading: "Buchungen werden geladen...",
    nothingToHandle: "Nichts zu bearbeiten",
    nothingToHandleDescription:
      "Aufträge, die deine Mitwirkung erfordern, erscheinen hier.",
    emptyTitle: "Noch keine Buchungen",
    emptyProvider:
      "Neue Aufträge erscheinen hier, wenn ein Kunde deine Dienste auswählt.",
    emptyClient: "Finde einen Anbieter und organisiere deinen ersten Auftrag mit KLYX.",
    manageListing: "Mein Profil verwalten",
    findService: "Dienst finden",
    groupedMission: "Gruppierter Auftrag",
    groupedSlots: "in einer Buchung zusammengefasst",
    actionRequiredNotice: "Eine Aktion von dir ist erforderlich.",
    date: "Datum",
    planning: "Planung",
    schedule: "Uhrzeit",
    totalMission: "Auftragssumme",
    amount: "Betrag",
    openGroupedMission: "Gruppierten Auftrag öffnen",
    viewBooking: "Buchung ansehen",
    priceToConfirm: "Preis noch zu bestätigen",
    currencyUnavailable: "Währung nicht verfügbar",
    loadFailed: "Die Buchungen konnten nicht geladen werden.",
    statusPending: "Ausstehend",
    statusPaymentPending: "Zahlung abschließen",
    statusAccepted: "Angenommen",
    statusCompleted: "Abgeschlossen",
    statusCancelled: "Storniert",
    statusRejected: "Abgelehnt",
    statusCancellationWaiting: "Stornierung ausstehend",
    statusCancellationDecision: "Entscheidung erforderlich",
    statusRefundProcessing: "Rückerstattung wird bearbeitet",
    statusRefundFailed: "Rückerstattung muss geprüft werden",
    statusRefunded: "Erstattet",
  },
};

const INTL_LOCALES: Record<KlyxBookingsPageLocale, string> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-BE",
};

const STATUS_KEYS: Record<string, KlyxBookingsPageMessageKey> = {
  pending: "statusPending",
  payment_pending: "statusPaymentPending",
  accepted: "statusAccepted",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  rejected: "statusRejected",
  cancellation_waiting: "statusCancellationWaiting",
  cancellation_decision: "statusCancellationDecision",
  refund_processing: "statusRefundProcessing",
  refund_failed: "statusRefundFailed",
  refunded: "statusRefunded",
};

const SERVICE_LABEL_ALIASES: Record<
  string,
  "babysitting" | "cleaning" | "moving" | "handyman"
> = {
  babysitting: "babysitting",
  "baby sitting": "babysitting",
  "baby-sitting": "babysitting",
  menage: "cleaning",
  "menage a domicile": "cleaning",
  cleaning: "cleaning",
  demenagement: "moving",
  moving: "moving",
  bricolage: "handyman",
  handyman: "handyman",
};

const SERVICE_LABELS: Record<
  KlyxBookingsPageLocale,
  Record<"babysitting" | "cleaning" | "moving" | "handyman", string>
> = {
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
    babysitting: "Babysitting",
    cleaning: "Schoonmaak",
    moving: "Verhuizing",
    handyman: "Kluswerk",
  },
  de: {
    babysitting: "Babysitting",
    cleaning: "Reinigung",
    moving: "Umzug",
    handyman: "Handwerksservice",
  },
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveKlyxBookingsPageLocale(
  locale: string
): KlyxBookingsPageLocale {
  return KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES.includes(
    locale as KlyxBookingsPageLocale
  )
    ? (locale as KlyxBookingsPageLocale)
    : "fr";
}

export function translateKlyxBookingsPage(
  locale: string,
  key: KlyxBookingsPageMessageKey
): string {
  return dictionaries[resolveKlyxBookingsPageLocale(locale)][key];
}

export function formatKlyxBookingStatus(
  locale: string,
  status: string
): string {
  const key = STATUS_KEYS[status];
  return key
    ? translateKlyxBookingsPage(locale, key)
    : status.replace(/_/g, " ");
}

export function formatKlyxBookingService(
  locale: string,
  serviceLabel: string
): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  const canonical = SERVICE_LABEL_ALIASES[normalizeText(serviceLabel)];
  return canonical ? SERVICE_LABELS[resolved][canonical] : serviceLabel;
}

export function formatKlyxBookingDate(
  locale: string,
  value: string
): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export function formatKlyxBookingDateRange(
  locale: string,
  dateFrom: string,
  dateTo: string
): string {
  if (dateFrom === dateTo) {
    return formatKlyxBookingDate(locale, dateFrom);
  }
  return `${formatKlyxBookingDate(locale, dateFrom)} → ${formatKlyxBookingDate(locale, dateTo)}`;
}

export function formatKlyxBookingSlotCount(
  locale: string,
  count: number
): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  if (resolved === "en") return `${count} ${count === 1 ? "time slot" : "time slots"}`;
  if (resolved === "nl") return `${count} ${count === 1 ? "tijdslot" : "tijdsloten"}`;
  if (resolved === "de") return `${count} Zeitfenster`;
  return `${count} ${count === 1 ? "créneau" : "créneaux"}`;
}

export function formatKlyxBookingAmount(
  locale: string,
  amountCents: number | null,
  currency: string
): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  const dictionary = dictionaries[resolved];

  if (amountCents == null) {
    return dictionary.priceToConfirm;
  }

  const normalizedCurrency = currency?.trim().toUpperCase();
  if (!normalizedCurrency || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
    const amount = new Intl.NumberFormat(INTL_LOCALES[resolved], {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
    return `${amount} · ${dictionary.currencyUnavailable}`;
  }

  try {
    return new Intl.NumberFormat(INTL_LOCALES[resolved], {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amountCents / 100);
  } catch {
    const amount = new Intl.NumberFormat(INTL_LOCALES[resolved], {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
    return `${amount} · ${dictionary.currencyUnavailable}`;
  }
}
