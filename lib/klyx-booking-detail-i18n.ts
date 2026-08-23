import {
  formatKlyxBookingAmount,
  resolveKlyxBookingsPageLocale,
  type KlyxBookingsPageLocale,
} from "@/lib/klyx-bookings-page-i18n";

export type KlyxBookingDetailRole = "client" | "provider";

const fr = {
  tracking: "Suivi KLYX",
  providerPendingTitle: "Une demande attend ta réponse",
  clientPendingTitle: "En attente de la réponse du prestataire",
  clientAcceptedUnpaidTitle: "Le prestataire a accepté. Le paiement est la prochaine étape.",
  providerAcceptedUnpaidTitle: "Réservation acceptée. En attente du paiement du client.",
  acceptedPaidTitle: "Tout est prêt pour la prestation",
  completedTitle: "Prestation terminée",
  cancelledTitle: "Cette réservation est annulée",
  rejectedTitle: "Cette demande a été refusée",
  trackingTitle: "Suivi de la réservation",
  providerPendingDescription: "Vérifie la mission puis accepte ou refuse explicitement la demande.",
  clientPendingDescription: "Aucune action n’est nécessaire pour le moment. KLYX attend la décision du prestataire.",
  clientAcceptedUnpaidDescription: "La réservation est acceptée. Rien n’est débité automatiquement : tu décides quand lancer le paiement sécurisé.",
  providerAcceptedUnpaidDescription: "Le client doit encore effectuer le paiement avant le démarrage de la prestation.",
  acceptedPaidDescription: "Le paiement est confirmé. La prestation peut maintenant être suivie.",
  completedDescription: "La prestation est terminée. L’évaluation devient la prochaine étape.",
  cancelledRefundedDescription: "La réservation est annulée et le remboursement est confirmé.",
  cancelledRefundProcessingDescription: "La réservation est annulée. Le remboursement est en cours de traitement.",
  cancelledRefundFailedDescription: "La réservation est annulée, mais le remboursement nécessite une vérification.",
  cancelledDescription: "Le parcours de cette réservation est arrêté.",
  rejectedDescription: "Cette demande ne poursuivra pas le parcours.",
  trackingDescription: "KLYX affiche ici l’état actuel et la prochaine action utile.",
  payNow: "Payer maintenant",
  journeyRequest: "Demande",
  journeyAcceptance: "Acceptation",
  journeyPayment: "Paiement",
  journeyService: "Prestation",
  journeyDone: "Terminé",
  journeyCurrent: "Étape actuelle",
  journeyStopped: "Arrêté",
  journeyUpcoming: "À venir",
  bookingPrefix: "Réservation",
  paymentPrefix: "Paiement",
  actionPayment: "Action requise : paiement",
  serviceReady: "Prestation prête",
  manualPaymentSafety: "Paiement manuel uniquement · aucun débit automatique.",
  backBookings: "Retour aux réservations",
  refresh: "Actualiser",
  requestSent: "Demande envoyée. Le prestataire vient d’être averti.",
  paymentSuccess: "Paiement effectué avec succès.",
  bookingUpdated: "Réservation mise à jour.",
  bookingAccepted: "Réservation acceptée.",
  bookingRejected: "Réservation refusée.",
  bookingCancelled: "Réservation annulée.",
  bookingCancelledRefundStarted: "Réservation annulée et remboursement lancé.",
  loading: "Chargement de la réservation...",
  notFound: "Réservation introuvable.",
  loadFailed: "Impossible de charger la réservation.",
  actionFailed: "Action impossible.",
  paymentFailed: "Paiement impossible.",
  checkoutRetry: "Le paiement sécurisé ne s’est pas ouvert. Clique de nouveau sur Payer la réservation.",
  userFallback: "Utilisateur KLYX",
  date: "Date",
  schedule: "Horaire",
  payment: "Paiement",
  estimatedTotal: "Total estimé",
  provider: "Prestataire",
  client: "Client",
  clientRequest: "Demande du client",
  providerResponse: "Réponse du prestataire",
  cancellationReason: "Motif d’annulation",
  paymentDeclined: "Paiement refusé",
  history: "Historique",
  noEvents: "Aucun événement enregistré.",
  actions: "Actions",
  providerActionHelp: "Réponds à la demande. Ton message sera visible par le client.",
  genericActionHelp: "Les actions disponibles dépendent de l’état de la réservation.",
  responseMessage: "Message de réponse",
  cancellationReasonLabel: "Motif d’annulation",
  responsePlaceholder: "Ex. Je confirme, à bientôt.",
  cancellationPlaceholder: "Explique brièvement l’annulation.",
  accept: "Accepter",
  reject: "Refuser",
  payBooking: "Payer la réservation",
  trackService: "Suivre la prestation",
  openMessages: "Ouvrir la messagerie",
  cancelBooking: "Annuler la réservation",
  noMoreActions: "Aucune action supplémentaire pour le moment.",
  verifiedReview: "Avis vérifié KLYX",
  reviewQuestion: "Comment s’est passée la prestation ?",
  reviewDescription: "Partage ton expérience sur cette mission.",
  missionCompleted: "Mission terminée",
  bookingVerified: "Réservation vérifiée",
  leaveReview: "Laisser mon avis",
  reviewAvailable: "Avis disponible après mission terminée.",
  statusPending: "Demande envoyée",
  statusAccepted: "Réservation acceptée",
  statusRejected: "Demande refusée",
  statusCancelled: "Réservation annulée",
  statusCompleted: "Prestation terminée",
  refundConfirmed: "Remboursement confirmé",
  refundProcessing: "Remboursement en cours",
  refundNeedsReview: "Remboursement à vérifier",
  paymentReceived: "Paiement reçu avec succès",
  paymentDone: "Paiement effectué avec succès",
  waitingClientPayment: "En attente du paiement du client",
  toPay: "À payer",
  automaticRefundRequested: "Remboursement Stripe demandé automatiquement.",
  apiBookingOrStatusMissing: "Réservation ou statut manquant.",
  apiInvalidStatus: "Statut invalide.",
  apiGroupStatusRequired: "Cette réservation appartient à un groupe. Modifie le groupe complet depuis KLYX.",
  apiAccessDenied: "Accès refusé.",
  apiProviderOnly: "Seul le prestataire peut accepter ou refuser cette demande.",
  apiRequestNoLongerPending: "Cette demande n’est plus en attente.",
  apiTimeConflict: "Un autre rendez-vous accepté occupe déjà ce créneau.",
  apiCannotCancel: "Cette réservation ne peut plus être annulée.",
  apiCancellationReasonMin: "Indique un motif d’annulation d’au moins 5 caractères.",
  apiRejectInsteadCancel: "Refuse la demande au lieu de l’annuler.",
  apiStartedServiceDispute: "Une prestation déjà commencée nécessite un litige, pas une annulation automatique.",
  apiBookingChanged: "La réservation vient d’être modifiée. Actualise la page.",
  apiBookingMissing: "Réservation manquante.",
  apiGroupPaymentRequired: "Cette réservation appartient à un groupe. Utilise le paiement groupe KLYX.",
  apiSplitMissionPayment: "Le paiement de cette réservation est géré par sa mission multi-prestataires.",
  apiMustAcceptBeforePayment: "La réservation doit être acceptée avant le paiement.",
  apiAlreadyPaid: "Cette réservation est déjà payée.",
  apiDurationInvalid: "Durée de réservation invalide.",
  apiProviderStripeRequired: "Le prestataire doit terminer la vérification Stripe avant de recevoir un paiement.",
  apiPaymentBusy: "Le paiement est déjà en cours de préparation. Réessaie dans quelques secondes.",
  apiStripeProcessing: "Stripe traite déjà ce paiement. Son statut sera actualisé automatiquement.",
} as const;

export type KlyxBookingDetailMessageKey = keyof typeof fr;
export const KLYX_BOOKING_DETAIL_MESSAGE_KEYS = Object.keys(fr) as KlyxBookingDetailMessageKey[];

const en: Record<KlyxBookingDetailMessageKey, string> = {
  tracking: "KLYX tracking",
  providerPendingTitle: "A request is waiting for your response",
  clientPendingTitle: "Waiting for the provider’s response",
  clientAcceptedUnpaidTitle: "The provider accepted. Payment is the next step.",
  providerAcceptedUnpaidTitle: "Booking accepted. Waiting for the client’s payment.",
  acceptedPaidTitle: "Everything is ready for the service",
  completedTitle: "Service completed",
  cancelledTitle: "This booking is cancelled",
  rejectedTitle: "This request was rejected",
  trackingTitle: "Booking tracking",
  providerPendingDescription: "Review the mission, then explicitly accept or reject the request.",
  clientPendingDescription: "No action is needed right now. KLYX is waiting for the provider’s decision.",
  clientAcceptedUnpaidDescription: "The booking is accepted. Nothing is charged automatically: you decide when to start the secure payment.",
  providerAcceptedUnpaidDescription: "The client still needs to pay before the service can begin.",
  acceptedPaidDescription: "Payment is confirmed. The service can now be tracked.",
  completedDescription: "The service is completed. Leaving a review is the next step.",
  cancelledRefundedDescription: "The booking is cancelled and the refund is confirmed.",
  cancelledRefundProcessingDescription: "The booking is cancelled. The refund is being processed.",
  cancelledRefundFailedDescription: "The booking is cancelled, but the refund needs review.",
  cancelledDescription: "This booking journey has stopped.",
  rejectedDescription: "This request will not continue.",
  trackingDescription: "KLYX shows the current state and the next useful action here.",
  payNow: "Pay now",
  journeyRequest: "Request",
  journeyAcceptance: "Acceptance",
  journeyPayment: "Payment",
  journeyService: "Service",
  journeyDone: "Completed",
  journeyCurrent: "Current step",
  journeyStopped: "Stopped",
  journeyUpcoming: "Upcoming",
  bookingPrefix: "Booking",
  paymentPrefix: "Payment",
  actionPayment: "Action required: payment",
  serviceReady: "Service ready",
  manualPaymentSafety: "Manual payment only · no automatic charge.",
  backBookings: "Back to bookings",
  refresh: "Refresh",
  requestSent: "Request sent. The provider has just been notified.",
  paymentSuccess: "Payment completed successfully.",
  bookingUpdated: "Booking updated.",
  bookingAccepted: "Booking accepted.",
  bookingRejected: "Booking rejected.",
  bookingCancelled: "Booking cancelled.",
  bookingCancelledRefundStarted: "Booking cancelled and refund started.",
  loading: "Loading booking...",
  notFound: "Booking not found.",
  loadFailed: "Unable to load the booking.",
  actionFailed: "Unable to complete this action.",
  paymentFailed: "Unable to complete payment.",
  checkoutRetry: "The secure payment did not open. Click Pay booking again.",
  userFallback: "KLYX user",
  date: "Date",
  schedule: "Time",
  payment: "Payment",
  estimatedTotal: "Estimated total",
  provider: "Provider",
  client: "Client",
  clientRequest: "Client request",
  providerResponse: "Provider response",
  cancellationReason: "Cancellation reason",
  paymentDeclined: "Payment declined",
  history: "History",
  noEvents: "No events recorded.",
  actions: "Actions",
  providerActionHelp: "Respond to the request. Your message will be visible to the client.",
  genericActionHelp: "Available actions depend on the booking status.",
  responseMessage: "Response message",
  cancellationReasonLabel: "Cancellation reason",
  responsePlaceholder: "e.g. Confirmed, see you soon.",
  cancellationPlaceholder: "Briefly explain the cancellation.",
  accept: "Accept",
  reject: "Reject",
  payBooking: "Pay booking",
  trackService: "Track service",
  openMessages: "Open messages",
  cancelBooking: "Cancel booking",
  noMoreActions: "No additional action is available right now.",
  verifiedReview: "Verified KLYX review",
  reviewQuestion: "How did the service go?",
  reviewDescription: "Share your experience with this mission.",
  missionCompleted: "Mission completed",
  bookingVerified: "Verified booking",
  leaveReview: "Leave my review",
  reviewAvailable: "Review available after the mission is completed.",
  statusPending: "Request sent",
  statusAccepted: "Booking accepted",
  statusRejected: "Request rejected",
  statusCancelled: "Booking cancelled",
  statusCompleted: "Service completed",
  refundConfirmed: "Refund confirmed",
  refundProcessing: "Refund processing",
  refundNeedsReview: "Refund needs review",
  paymentReceived: "Payment received successfully",
  paymentDone: "Payment completed successfully",
  waitingClientPayment: "Waiting for the client’s payment",
  toPay: "To pay",
  automaticRefundRequested: "Stripe refund requested automatically.",
  apiBookingOrStatusMissing: "Booking or status is missing.",
  apiInvalidStatus: "Invalid status.",
  apiGroupStatusRequired: "This booking belongs to a group. Update the full group from KLYX.",
  apiAccessDenied: "Access denied.",
  apiProviderOnly: "Only the provider can accept or reject this request.",
  apiRequestNoLongerPending: "This request is no longer pending.",
  apiTimeConflict: "Another accepted appointment already uses this time slot.",
  apiCannotCancel: "This booking can no longer be cancelled.",
  apiCancellationReasonMin: "Enter a cancellation reason of at least 5 characters.",
  apiRejectInsteadCancel: "Reject the request instead of cancelling it.",
  apiStartedServiceDispute: "A service that has already started requires a dispute, not an automatic cancellation.",
  apiBookingChanged: "The booking was just updated. Refresh the page.",
  apiBookingMissing: "Booking is missing.",
  apiGroupPaymentRequired: "This booking belongs to a group. Use KLYX group payment.",
  apiSplitMissionPayment: "Payment for this booking is managed by its multi-provider mission.",
  apiMustAcceptBeforePayment: "The booking must be accepted before payment.",
  apiAlreadyPaid: "This booking is already paid.",
  apiDurationInvalid: "Invalid booking duration.",
  apiProviderStripeRequired: "The provider must complete Stripe verification before receiving payment.",
  apiPaymentBusy: "Payment is already being prepared. Try again in a few seconds.",
  apiStripeProcessing: "Stripe is already processing this payment. Its status will update automatically.",
};

const nl: Record<KlyxBookingDetailMessageKey, string> = {
  tracking: "KLYX-opvolging",
  providerPendingTitle: "Een aanvraag wacht op je antwoord",
  clientPendingTitle: "Wachten op het antwoord van de dienstverlener",
  clientAcceptedUnpaidTitle: "De dienstverlener heeft geaccepteerd. Betaling is de volgende stap.",
  providerAcceptedUnpaidTitle: "Boeking geaccepteerd. Wachten op de betaling van de klant.",
  acceptedPaidTitle: "Alles is klaar voor de dienst",
  completedTitle: "Dienst voltooid",
  cancelledTitle: "Deze boeking is geannuleerd",
  rejectedTitle: "Deze aanvraag is geweigerd",
  trackingTitle: "Boeking opvolgen",
  providerPendingDescription: "Controleer de missie en accepteer of weiger de aanvraag daarna expliciet.",
  clientPendingDescription: "Er is nu geen actie nodig. KLYX wacht op de beslissing van de dienstverlener.",
  clientAcceptedUnpaidDescription: "De boeking is geaccepteerd. Er wordt niets automatisch afgeschreven: jij beslist wanneer je de beveiligde betaling start.",
  providerAcceptedUnpaidDescription: "De klant moet nog betalen voordat de dienst kan beginnen.",
  acceptedPaidDescription: "De betaling is bevestigd. De dienst kan nu worden opgevolgd.",
  completedDescription: "De dienst is voltooid. Een beoordeling achterlaten is de volgende stap.",
  cancelledRefundedDescription: "De boeking is geannuleerd en de terugbetaling is bevestigd.",
  cancelledRefundProcessingDescription: "De boeking is geannuleerd. De terugbetaling wordt verwerkt.",
  cancelledRefundFailedDescription: "De boeking is geannuleerd, maar de terugbetaling moet worden gecontroleerd.",
  cancelledDescription: "Het traject van deze boeking is gestopt.",
  rejectedDescription: "Deze aanvraag gaat niet verder.",
  trackingDescription: "KLYX toont hier de huidige status en de volgende nuttige actie.",
  payNow: "Nu betalen",
  journeyRequest: "Aanvraag",
  journeyAcceptance: "Acceptatie",
  journeyPayment: "Betaling",
  journeyService: "Dienst",
  journeyDone: "Voltooid",
  journeyCurrent: "Huidige stap",
  journeyStopped: "Gestopt",
  journeyUpcoming: "Aankomend",
  bookingPrefix: "Boeking",
  paymentPrefix: "Betaling",
  actionPayment: "Actie vereist: betaling",
  serviceReady: "Dienst klaar",
  manualPaymentSafety: "Alleen handmatige betaling · geen automatische afschrijving.",
  backBookings: "Terug naar boekingen",
  refresh: "Vernieuwen",
  requestSent: "Aanvraag verzonden. De dienstverlener is zojuist verwittigd.",
  paymentSuccess: "Betaling succesvol uitgevoerd.",
  bookingUpdated: "Boeking bijgewerkt.",
  bookingAccepted: "Boeking geaccepteerd.",
  bookingRejected: "Boeking geweigerd.",
  bookingCancelled: "Boeking geannuleerd.",
  bookingCancelledRefundStarted: "Boeking geannuleerd en terugbetaling gestart.",
  loading: "Boeking laden...",
  notFound: "Boeking niet gevonden.",
  loadFailed: "De boeking kan niet worden geladen.",
  actionFailed: "Deze actie kan niet worden uitgevoerd.",
  paymentFailed: "De betaling kan niet worden uitgevoerd.",
  checkoutRetry: "De beveiligde betaling is niet geopend. Klik opnieuw op Boeking betalen.",
  userFallback: "KLYX-gebruiker",
  date: "Datum",
  schedule: "Tijd",
  payment: "Betaling",
  estimatedTotal: "Geschat totaal",
  provider: "Dienstverlener",
  client: "Klant",
  clientRequest: "Aanvraag van de klant",
  providerResponse: "Antwoord van de dienstverlener",
  cancellationReason: "Reden van annulering",
  paymentDeclined: "Betaling geweigerd",
  history: "Geschiedenis",
  noEvents: "Geen gebeurtenissen geregistreerd.",
  actions: "Acties",
  providerActionHelp: "Beantwoord de aanvraag. Je bericht is zichtbaar voor de klant.",
  genericActionHelp: "Beschikbare acties hangen af van de boekingsstatus.",
  responseMessage: "Antwoordbericht",
  cancellationReasonLabel: "Reden van annulering",
  responsePlaceholder: "Bijv. Bevestigd, tot binnenkort.",
  cancellationPlaceholder: "Leg de annulering kort uit.",
  accept: "Accepteren",
  reject: "Weigeren",
  payBooking: "Boeking betalen",
  trackService: "Dienst volgen",
  openMessages: "Berichten openen",
  cancelBooking: "Boeking annuleren",
  noMoreActions: "Momenteel is geen extra actie beschikbaar.",
  verifiedReview: "Geverifieerde KLYX-beoordeling",
  reviewQuestion: "Hoe is de dienst verlopen?",
  reviewDescription: "Deel je ervaring met deze missie.",
  missionCompleted: "Missie voltooid",
  bookingVerified: "Geverifieerde boeking",
  leaveReview: "Mijn beoordeling plaatsen",
  reviewAvailable: "Beoordeling beschikbaar nadat de missie is voltooid.",
  statusPending: "Aanvraag verzonden",
  statusAccepted: "Boeking geaccepteerd",
  statusRejected: "Aanvraag geweigerd",
  statusCancelled: "Boeking geannuleerd",
  statusCompleted: "Dienst voltooid",
  refundConfirmed: "Terugbetaling bevestigd",
  refundProcessing: "Terugbetaling wordt verwerkt",
  refundNeedsReview: "Terugbetaling moet worden gecontroleerd",
  paymentReceived: "Betaling succesvol ontvangen",
  paymentDone: "Betaling succesvol uitgevoerd",
  waitingClientPayment: "Wachten op de betaling van de klant",
  toPay: "Te betalen",
  automaticRefundRequested: "Stripe-terugbetaling automatisch aangevraagd.",
  apiBookingOrStatusMissing: "Boeking of status ontbreekt.",
  apiInvalidStatus: "Ongeldige status.",
  apiGroupStatusRequired: "Deze boeking behoort tot een groep. Wijzig de volledige groep via KLYX.",
  apiAccessDenied: "Toegang geweigerd.",
  apiProviderOnly: "Alleen de dienstverlener kan deze aanvraag accepteren of weigeren.",
  apiRequestNoLongerPending: "Deze aanvraag is niet meer in afwachting.",
  apiTimeConflict: "Een andere geaccepteerde afspraak gebruikt dit tijdslot al.",
  apiCannotCancel: "Deze boeking kan niet meer worden geannuleerd.",
  apiCancellationReasonMin: "Geef een annuleringsreden van minstens 5 tekens op.",
  apiRejectInsteadCancel: "Weiger de aanvraag in plaats van ze te annuleren.",
  apiStartedServiceDispute: "Een reeds begonnen dienst vereist een geschil, geen automatische annulering.",
  apiBookingChanged: "De boeking is net gewijzigd. Vernieuw de pagina.",
  apiBookingMissing: "Boeking ontbreekt.",
  apiGroupPaymentRequired: "Deze boeking behoort tot een groep. Gebruik de KLYX-groepsbetaling.",
  apiSplitMissionPayment: "De betaling van deze boeking wordt beheerd door de multi-dienstverlenersmissie.",
  apiMustAcceptBeforePayment: "De boeking moet worden geaccepteerd vóór de betaling.",
  apiAlreadyPaid: "Deze boeking is al betaald.",
  apiDurationInvalid: "Ongeldige boekingsduur.",
  apiProviderStripeRequired: "De dienstverlener moet de Stripe-verificatie voltooien voordat betaling kan worden ontvangen.",
  apiPaymentBusy: "De betaling wordt al voorbereid. Probeer over enkele seconden opnieuw.",
  apiStripeProcessing: "Stripe verwerkt deze betaling al. De status wordt automatisch bijgewerkt.",
};

const de: Record<KlyxBookingDetailMessageKey, string> = {
  tracking: "KLYX-Verfolgung",
  providerPendingTitle: "Eine Anfrage wartet auf deine Antwort",
  clientPendingTitle: "Warten auf die Antwort des Anbieters",
  clientAcceptedUnpaidTitle: "Der Anbieter hat angenommen. Die Zahlung ist der nächste Schritt.",
  providerAcceptedUnpaidTitle: "Buchung angenommen. Warten auf die Zahlung des Kunden.",
  acceptedPaidTitle: "Alles ist für die Leistung bereit",
  completedTitle: "Leistung abgeschlossen",
  cancelledTitle: "Diese Buchung ist storniert",
  rejectedTitle: "Diese Anfrage wurde abgelehnt",
  trackingTitle: "Buchungsverfolgung",
  providerPendingDescription: "Prüfe den Auftrag und nimm die Anfrage danach ausdrücklich an oder lehne sie ab.",
  clientPendingDescription: "Im Moment ist keine Aktion nötig. KLYX wartet auf die Entscheidung des Anbieters.",
  clientAcceptedUnpaidDescription: "Die Buchung ist angenommen. Es wird nichts automatisch belastet: Du entscheidest, wann du die sichere Zahlung startest.",
  providerAcceptedUnpaidDescription: "Der Kunde muss noch bezahlen, bevor die Leistung beginnen kann.",
  acceptedPaidDescription: "Die Zahlung ist bestätigt. Die Leistung kann jetzt verfolgt werden.",
  completedDescription: "Die Leistung ist abgeschlossen. Eine Bewertung abzugeben ist der nächste Schritt.",
  cancelledRefundedDescription: "Die Buchung ist storniert und die Rückerstattung ist bestätigt.",
  cancelledRefundProcessingDescription: "Die Buchung ist storniert. Die Rückerstattung wird bearbeitet.",
  cancelledRefundFailedDescription: "Die Buchung ist storniert, aber die Rückerstattung muss geprüft werden.",
  cancelledDescription: "Der Ablauf dieser Buchung wurde beendet.",
  rejectedDescription: "Diese Anfrage wird nicht fortgesetzt.",
  trackingDescription: "KLYX zeigt hier den aktuellen Status und die nächste sinnvolle Aktion.",
  payNow: "Jetzt bezahlen",
  journeyRequest: "Anfrage",
  journeyAcceptance: "Annahme",
  journeyPayment: "Zahlung",
  journeyService: "Leistung",
  journeyDone: "Abgeschlossen",
  journeyCurrent: "Aktueller Schritt",
  journeyStopped: "Beendet",
  journeyUpcoming: "Bevorstehend",
  bookingPrefix: "Buchung",
  paymentPrefix: "Zahlung",
  actionPayment: "Aktion erforderlich: Zahlung",
  serviceReady: "Leistung bereit",
  manualPaymentSafety: "Nur manuelle Zahlung · keine automatische Belastung.",
  backBookings: "Zurück zu Buchungen",
  refresh: "Aktualisieren",
  requestSent: "Anfrage gesendet. Der Anbieter wurde soeben benachrichtigt.",
  paymentSuccess: "Zahlung erfolgreich durchgeführt.",
  bookingUpdated: "Buchung aktualisiert.",
  bookingAccepted: "Buchung angenommen.",
  bookingRejected: "Buchung abgelehnt.",
  bookingCancelled: "Buchung storniert.",
  bookingCancelledRefundStarted: "Buchung storniert und Rückerstattung gestartet.",
  loading: "Buchung wird geladen...",
  notFound: "Buchung nicht gefunden.",
  loadFailed: "Die Buchung konnte nicht geladen werden.",
  actionFailed: "Diese Aktion konnte nicht ausgeführt werden.",
  paymentFailed: "Die Zahlung konnte nicht ausgeführt werden.",
  checkoutRetry: "Die sichere Zahlung wurde nicht geöffnet. Klicke erneut auf Buchung bezahlen.",
  userFallback: "KLYX-Nutzer",
  date: "Datum",
  schedule: "Uhrzeit",
  payment: "Zahlung",
  estimatedTotal: "Geschätzte Summe",
  provider: "Anbieter",
  client: "Kunde",
  clientRequest: "Anfrage des Kunden",
  providerResponse: "Antwort des Anbieters",
  cancellationReason: "Stornierungsgrund",
  paymentDeclined: "Zahlung abgelehnt",
  history: "Verlauf",
  noEvents: "Keine Ereignisse aufgezeichnet.",
  actions: "Aktionen",
  providerActionHelp: "Beantworte die Anfrage. Deine Nachricht ist für den Kunden sichtbar.",
  genericActionHelp: "Verfügbare Aktionen hängen vom Buchungsstatus ab.",
  responseMessage: "Antwortnachricht",
  cancellationReasonLabel: "Stornierungsgrund",
  responsePlaceholder: "z. B. Bestätigt, bis bald.",
  cancellationPlaceholder: "Erkläre die Stornierung kurz.",
  accept: "Annehmen",
  reject: "Ablehnen",
  payBooking: "Buchung bezahlen",
  trackService: "Leistung verfolgen",
  openMessages: "Nachrichten öffnen",
  cancelBooking: "Buchung stornieren",
  noMoreActions: "Im Moment ist keine weitere Aktion verfügbar.",
  verifiedReview: "Verifizierte KLYX-Bewertung",
  reviewQuestion: "Wie ist die Leistung gelaufen?",
  reviewDescription: "Teile deine Erfahrung mit diesem Auftrag.",
  missionCompleted: "Auftrag abgeschlossen",
  bookingVerified: "Verifizierte Buchung",
  leaveReview: "Bewertung abgeben",
  reviewAvailable: "Bewertung nach abgeschlossenem Auftrag verfügbar.",
  statusPending: "Anfrage gesendet",
  statusAccepted: "Buchung angenommen",
  statusRejected: "Anfrage abgelehnt",
  statusCancelled: "Buchung storniert",
  statusCompleted: "Leistung abgeschlossen",
  refundConfirmed: "Rückerstattung bestätigt",
  refundProcessing: "Rückerstattung wird bearbeitet",
  refundNeedsReview: "Rückerstattung muss geprüft werden",
  paymentReceived: "Zahlung erfolgreich erhalten",
  paymentDone: "Zahlung erfolgreich durchgeführt",
  waitingClientPayment: "Warten auf die Zahlung des Kunden",
  toPay: "Zu bezahlen",
  automaticRefundRequested: "Stripe-Rückerstattung automatisch angefordert.",
  apiBookingOrStatusMissing: "Buchung oder Status fehlt.",
  apiInvalidStatus: "Ungültiger Status.",
  apiGroupStatusRequired: "Diese Buchung gehört zu einer Gruppe. Ändere die vollständige Gruppe in KLYX.",
  apiAccessDenied: "Zugriff verweigert.",
  apiProviderOnly: "Nur der Anbieter kann diese Anfrage annehmen oder ablehnen.",
  apiRequestNoLongerPending: "Diese Anfrage ist nicht mehr ausstehend.",
  apiTimeConflict: "Ein anderer angenommener Termin belegt dieses Zeitfenster bereits.",
  apiCannotCancel: "Diese Buchung kann nicht mehr storniert werden.",
  apiCancellationReasonMin: "Gib einen Stornierungsgrund mit mindestens 5 Zeichen an.",
  apiRejectInsteadCancel: "Lehne die Anfrage ab, statt sie zu stornieren.",
  apiStartedServiceDispute: "Eine bereits begonnene Leistung erfordert einen Streitfall, keine automatische Stornierung.",
  apiBookingChanged: "Die Buchung wurde gerade geändert. Aktualisiere die Seite.",
  apiBookingMissing: "Buchung fehlt.",
  apiGroupPaymentRequired: "Diese Buchung gehört zu einer Gruppe. Verwende die KLYX-Gruppenzahlung.",
  apiSplitMissionPayment: "Die Zahlung dieser Buchung wird über den Auftrag mit mehreren Anbietern verwaltet.",
  apiMustAcceptBeforePayment: "Die Buchung muss vor der Zahlung angenommen werden.",
  apiAlreadyPaid: "Diese Buchung ist bereits bezahlt.",
  apiDurationInvalid: "Ungültige Buchungsdauer.",
  apiProviderStripeRequired: "Der Anbieter muss die Stripe-Verifizierung abschließen, bevor eine Zahlung empfangen werden kann.",
  apiPaymentBusy: "Die Zahlung wird bereits vorbereitet. Versuche es in einigen Sekunden erneut.",
  apiStripeProcessing: "Stripe verarbeitet diese Zahlung bereits. Der Status wird automatisch aktualisiert.",
};

const dictionaries: Record<KlyxBookingsPageLocale, Record<KlyxBookingDetailMessageKey, string>> = { fr, en, nl, de };

const STATUS_KEYS: Record<string, KlyxBookingDetailMessageKey> = {
  pending: "statusPending",
  accepted: "statusAccepted",
  rejected: "statusRejected",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
};

const STATUS_ERROR_KEYS: Record<string, KlyxBookingDetailMessageKey> = {
  "Réservation ou statut manquant.": "apiBookingOrStatusMissing",
  "Statut invalide.": "apiInvalidStatus",
  "Cette reservation appartient a un groupe. Modifie le groupe complet depuis KLYX.": "apiGroupStatusRequired",
  "Accès refusé.": "apiAccessDenied",
  "Seul le prestataire peut accepter ou refuser cette demande.": "apiProviderOnly",
  "Cette demande n’est plus en attente.": "apiRequestNoLongerPending",
  "Un autre rendez-vous accepté occupe déjà ce créneau.": "apiTimeConflict",
  "Cette réservation ne peut plus être annulée.": "apiCannotCancel",
  "Indique un motif d’annulation d’au moins 5 caractères.": "apiCancellationReasonMin",
  "Refuse la demande au lieu de l’annuler.": "apiRejectInsteadCancel",
  "Une prestation déjà commencée nécessite un litige, pas une annulation automatique.": "apiStartedServiceDispute",
  "La réservation vient d’être modifiée. Actualise la page.": "apiBookingChanged",
  "Réservation introuvable.": "notFound",
};

const CHECKOUT_ERROR_KEYS: Record<string, KlyxBookingDetailMessageKey> = {
  "Réservation manquante.": "apiBookingMissing",
  "Accès refusé.": "apiAccessDenied",
  "Cette reservation appartient a un groupe. Utilise le paiement groupe KLYX.": "apiGroupPaymentRequired",
  "Le paiement de cette réservation est géré par sa mission multi-prestataires.": "apiSplitMissionPayment",
  "La réservation doit être acceptée avant le paiement.": "apiMustAcceptBeforePayment",
  "Cette réservation est déjà payée.": "apiAlreadyPaid",
  "Durée de réservation invalide.": "apiDurationInvalid",
  "Le prestataire doit terminer la vérification Stripe avant de recevoir un paiement.": "apiProviderStripeRequired",
  "Le paiement est déjà en cours de préparation. Réessaie dans quelques secondes.": "apiPaymentBusy",
  "Le paiement est déjà en cours. Réessaie dans quelques secondes.": "apiPaymentBusy",
  "Stripe traite déjà ce paiement. Son statut sera actualisé automatiquement.": "apiStripeProcessing",
  "Réservation introuvable.": "notFound",
};

const STATUS_SUCCESS_KEYS: Record<string, KlyxBookingDetailMessageKey> = {
  "Réservation acceptée.": "bookingAccepted",
  "Réservation refusée.": "bookingRejected",
  "Réservation annulée.": "bookingCancelled",
  "Réservation annulée et remboursement lancé.": "bookingCancelledRefundStarted",
};

const INTL_LOCALES: Record<KlyxBookingsPageLocale, string> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-BE",
};

export function translateKlyxBookingDetail(locale: string, key: KlyxBookingDetailMessageKey): string {
  return dictionaries[resolveKlyxBookingsPageLocale(locale)][key];
}

export function formatKlyxBookingDetailStatus(locale: string, status: string): string {
  const key = STATUS_KEYS[status];
  return key ? translateKlyxBookingDetail(locale, key) : status.replace(/_/g, " ");
}

export function formatKlyxBookingDetailDate(locale: string, value: string): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatKlyxBookingDetailDateTime(locale: string, value: string): string {
  const resolved = resolveKlyxBookingsPageLocale(locale);
  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatKlyxBookingDetailAmount(locale: string, amount: number | null, currency: string): string {
  return formatKlyxBookingAmount(locale, amount, currency);
}

export function formatKlyxBookingPaymentLabel(
  locale: string,
  input: {
    paymentStatus: string | null;
    refundStatus: string | null;
    paymentFailureMessage: string | null;
    role: KlyxBookingDetailRole | null;
  }
): string {
  const { paymentStatus, refundStatus, paymentFailureMessage, role } = input;
  if (paymentStatus === "refunded" || refundStatus === "succeeded") return translateKlyxBookingDetail(locale, "refundConfirmed");
  if (refundStatus === "processing") return translateKlyxBookingDetail(locale, "refundProcessing");
  if (refundStatus === "failed") return translateKlyxBookingDetail(locale, "refundNeedsReview");
  if (paymentStatus === "paid") return translateKlyxBookingDetail(locale, role === "provider" ? "paymentReceived" : "paymentDone");
  if (paymentFailureMessage && role === "client") return translateKlyxBookingDetail(locale, "paymentDeclined");
  return translateKlyxBookingDetail(locale, role === "provider" ? "waitingClientPayment" : "toPay");
}

export function formatKlyxBookingNextTitle(
  locale: string,
  input: { status: string; paymentStatus: string | null; role: KlyxBookingDetailRole | null }
): string {
  const { status, paymentStatus, role } = input;
  let key: KlyxBookingDetailMessageKey = "trackingTitle";
  if (status === "pending") key = role === "provider" ? "providerPendingTitle" : "clientPendingTitle";
  else if (status === "accepted" && paymentStatus !== "paid") key = role === "client" ? "clientAcceptedUnpaidTitle" : "providerAcceptedUnpaidTitle";
  else if (status === "accepted" && paymentStatus === "paid") key = "acceptedPaidTitle";
  else if (status === "completed") key = "completedTitle";
  else if (status === "cancelled") key = "cancelledTitle";
  else if (status === "rejected") key = "rejectedTitle";
  return translateKlyxBookingDetail(locale, key);
}

export function formatKlyxBookingNextDescription(
  locale: string,
  input: {
    status: string;
    paymentStatus: string | null;
    refundStatus: string | null;
    role: KlyxBookingDetailRole | null;
  }
): string {
  const { status, paymentStatus, refundStatus, role } = input;
  let key: KlyxBookingDetailMessageKey = "trackingDescription";
  if (status === "pending") key = role === "provider" ? "providerPendingDescription" : "clientPendingDescription";
  else if (status === "accepted" && paymentStatus !== "paid") key = role === "client" ? "clientAcceptedUnpaidDescription" : "providerAcceptedUnpaidDescription";
  else if (status === "accepted" && paymentStatus === "paid") key = "acceptedPaidDescription";
  else if (status === "completed") key = "completedDescription";
  else if (status === "cancelled") {
    key = paymentStatus === "refunded" || refundStatus === "succeeded"
      ? "cancelledRefundedDescription"
      : refundStatus === "processing"
        ? "cancelledRefundProcessingDescription"
        : refundStatus === "failed"
          ? "cancelledRefundFailedDescription"
          : "cancelledDescription";
  } else if (status === "rejected") key = "rejectedDescription";
  return translateKlyxBookingDetail(locale, key);
}

export function klyxBookingStatusErrorKey(
  message: string | undefined,
  code: string | undefined
): KlyxBookingDetailMessageKey {
  if (code === "GROUP_STATUS_REQUIRED") return "apiGroupStatusRequired";
  return (message && STATUS_ERROR_KEYS[message]) || "actionFailed";
}

export function klyxBookingCheckoutErrorKey(
  message: string | undefined,
  input?: {
    alreadyPaid?: boolean;
    paymentPending?: boolean;
    splitMissionPayment?: boolean;
    code?: string;
  }
): KlyxBookingDetailMessageKey {
  if (input?.alreadyPaid) return "apiAlreadyPaid";
  if (input?.splitMissionPayment) return "apiSplitMissionPayment";
  if (input?.code === "GROUP_PAYMENT_REQUIRED") return "apiGroupPaymentRequired";
  if (input?.paymentPending) return "apiPaymentBusy";
  return (message && CHECKOUT_ERROR_KEYS[message]) || "paymentFailed";
}

export function klyxBookingStatusSuccessKey(message: string | undefined): KlyxBookingDetailMessageKey {
  return (message && STATUS_SUCCESS_KEYS[message]) || "bookingUpdated";
}

export function formatKlyxBookingEventNote(locale: string, note: string): string {
  const suffix = "Remboursement Stripe demandé automatiquement.";
  if (!note.endsWith(suffix)) return note;
  const prefix = note.slice(0, -suffix.length).trim();
  const localized = translateKlyxBookingDetail(locale, "automaticRefundRequested");
  return prefix ? `${prefix} ${localized}` : localized;
}
