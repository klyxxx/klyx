export type KlyxClientActivityMessageKey =
  | "title"
  | "description"
  | "requests"
  | "requestOpen"
  | "requestMatched"
  | "requestCancelled"
  | "offersReceived"
  | "waitingOffers"
  | "chooseProvider"
  | "finalizeBooking"
  | "followRequest"
  | "recommended"
  | "cheapest"
  | "verified"
  | "reviews"
  | "experience"
  | "budgetMax"
  | "cancelRequest"
  | "acceptOffer"
  | "rejectOffer"
  | "marketLoadFailed"
  | "actionFailed"
  | "selectionReady"
  | "searchInProgress";

type Dictionary = Record<KlyxClientActivityMessageKey, string>;

const dictionaries: Record<"fr" | "en" | "nl" | "de", Dictionary> = {
  fr: {
    title: "Activité",
    description:
      "Demandes, offres, réservations, paiements et suivi : KLYX rassemble tout ici et met la prochaine action en premier.",
    requests: "Demandes en cours",
    requestOpen: "Recherche en cours",
    requestMatched: "Prestataire choisi",
    requestCancelled: "Demande annulée",
    offersReceived: "Offres reçues",
    waitingOffers: "KLYX attend les réponses des prestataires compatibles.",
    chooseProvider: "Choisir un prestataire",
    finalizeBooking: "Finaliser la réservation",
    followRequest: "Voir le suivi",
    recommended: "Recommandé par KLYX",
    cheapest: "Prix le plus bas",
    verified: "Vérifié",
    reviews: "avis",
    experience: "ans d’expérience",
    budgetMax: "Budget max",
    cancelRequest: "Annuler la demande",
    acceptOffer: "Choisir",
    rejectOffer: "Refuser",
    marketLoadFailed: "Les demandes n’ont pas pu être chargées.",
    actionFailed: "Impossible d’effectuer cette action pour le moment.",
    selectionReady: "Un prestataire est sélectionné. La réservation reste à confirmer.",
    searchInProgress: "KLYX cherche les prestataires adaptés.",
  },
  en: {
    title: "Activity",
    description:
      "Requests, offers, bookings, payments and tracking: KLYX keeps everything here and puts the next action first.",
    requests: "Active requests",
    requestOpen: "Search in progress",
    requestMatched: "Provider selected",
    requestCancelled: "Request cancelled",
    offersReceived: "Offers received",
    waitingOffers: "KLYX is waiting for compatible providers to reply.",
    chooseProvider: "Choose a provider",
    finalizeBooking: "Finalize booking",
    followRequest: "View tracking",
    recommended: "Recommended by KLYX",
    cheapest: "Lowest price",
    verified: "Verified",
    reviews: "reviews",
    experience: "years of experience",
    budgetMax: "Max budget",
    cancelRequest: "Cancel request",
    acceptOffer: "Choose",
    rejectOffer: "Reject",
    marketLoadFailed: "Requests could not be loaded.",
    actionFailed: "This action is unavailable right now.",
    selectionReady: "A provider is selected. The booking still needs confirmation.",
    searchInProgress: "KLYX is looking for suitable providers.",
  },
  nl: {
    title: "Activiteit",
    description:
      "Aanvragen, offertes, boekingen, betalingen en opvolging: KLYX bundelt alles hier en zet de volgende actie bovenaan.",
    requests: "Lopende aanvragen",
    requestOpen: "Zoekopdracht loopt",
    requestMatched: "Dienstverlener gekozen",
    requestCancelled: "Aanvraag geannuleerd",
    offersReceived: "Ontvangen offertes",
    waitingOffers: "KLYX wacht op antwoorden van passende dienstverleners.",
    chooseProvider: "Dienstverlener kiezen",
    finalizeBooking: "Boeking afronden",
    followRequest: "Opvolging bekijken",
    recommended: "Aanbevolen door KLYX",
    cheapest: "Laagste prijs",
    verified: "Geverifieerd",
    reviews: "beoordelingen",
    experience: "jaar ervaring",
    budgetMax: "Max. budget",
    cancelRequest: "Aanvraag annuleren",
    acceptOffer: "Kiezen",
    rejectOffer: "Weigeren",
    marketLoadFailed: "De aanvragen konden niet worden geladen.",
    actionFailed: "Deze actie is momenteel niet beschikbaar.",
    selectionReady: "Een dienstverlener is gekozen. De boeking moet nog worden bevestigd.",
    searchInProgress: "KLYX zoekt geschikte dienstverleners.",
  },
  de: {
    title: "Aktivität",
    description:
      "Anfragen, Angebote, Buchungen, Zahlungen und Status: KLYX bündelt alles hier und zeigt die nächste Aktion zuerst.",
    requests: "Laufende Anfragen",
    requestOpen: "Suche läuft",
    requestMatched: "Anbieter ausgewählt",
    requestCancelled: "Anfrage storniert",
    offersReceived: "Angebote erhalten",
    waitingOffers: "KLYX wartet auf Antworten passender Anbieter.",
    chooseProvider: "Anbieter auswählen",
    finalizeBooking: "Buchung abschließen",
    followRequest: "Status ansehen",
    recommended: "Von KLYX empfohlen",
    cheapest: "Niedrigster Preis",
    verified: "Verifiziert",
    reviews: "Bewertungen",
    experience: "Jahre Erfahrung",
    budgetMax: "Max. Budget",
    cancelRequest: "Anfrage stornieren",
    acceptOffer: "Auswählen",
    rejectOffer: "Ablehnen",
    marketLoadFailed: "Die Anfragen konnten nicht geladen werden.",
    actionFailed: "Diese Aktion ist derzeit nicht verfügbar.",
    selectionReady: "Ein Anbieter ist ausgewählt. Die Buchung muss noch bestätigt werden.",
    searchInProgress: "KLYX sucht passende Anbieter.",
  },
};

function normalizeLocale(locale: string): "fr" | "en" | "nl" | "de" {
  const normalized = locale.toLowerCase().slice(0, 2);
  if (normalized === "fr" || normalized === "nl" || normalized === "de") {
    return normalized;
  }
  return "en";
}

export function translateKlyxClientActivity(
  locale: string,
  key: KlyxClientActivityMessageKey
): string {
  return dictionaries[normalizeLocale(locale)][key];
}
