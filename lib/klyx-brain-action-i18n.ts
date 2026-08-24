import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_BRAIN_ACTION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxBrainActionLocale =
  (typeof KLYX_BRAIN_ACTION_TRANSLATED_LOCALES)[number];

export type KlyxBrainActionLike = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type StaticVariant =
  | "finalizeBooking"
  | "paymentSingle"
  | "paymentGroup"
  | "confirmCompletion"
  | "clientTrackArrived"
  | "clientTrackEnRoute"
  | "clientTrackInProgress"
  | "clientTrackPlanned"
  | "reviewSingle"
  | "reviewGroup"
  | "providerBookingSingle"
  | "providerBookingGroup"
  | "providerFinish"
  | "providerTrackArrived"
  | "providerTrackEnRoute"
  | "providerTrackInProgress"
  | "providerTrackPlanned"
  | "groupCancellationWaitingPaid"
  | "groupCancellationWaitingUnpaid"
  | "groupCancellationDecisionPaid"
  | "groupCancellationDecisionUnpaid"
  | "groupRefundProcessing"
  | "groupRefundFailed";

type Copy = {
  title: string;
  description: string;
  label: string;
};

const STATIC_COPY: Record<
  KlyxBrainActionLocale,
  Record<StaticVariant, Copy>
> = {
  fr: {
    finalizeBooking: {
      title: "Finaliser la réservation",
      description:
        "Le prestataire et le prix sont choisis. Il reste à confirmer le créneau.",
      label: "Choisir le créneau",
    },
    paymentSingle: {
      title: "Paiement à finaliser",
      description:
        "Le prestataire a accepté. Le paiement est la prochaine étape avant la mission.",
      label: "Finaliser le paiement",
    },
    paymentGroup: {
      title: "Paiement groupé à finaliser",
      description:
        "Tous les créneaux sont acceptés. Le groupe attend un paiement unique.",
      label: "Voir le groupe",
    },
    confirmCompletion: {
      title: "Confirme la fin de mission",
      description:
        "Le prestataire a déclaré son travail terminé. Vérifie la prestation puis confirme.",
      label: "Vérifier et confirmer",
    },
    clientTrackArrived: {
      title: "Le prestataire est arrivé",
      description:
        "Le prestataire indique être arrivé. La prestation peut commencer.",
      label: "Suivre la mission",
    },
    clientTrackEnRoute: {
      title: "Le prestataire est en route",
      description:
        "Le prestataire est en route. Suis la mission depuis KLYX.",
      label: "Suivre la mission",
    },
    clientTrackInProgress: {
      title: "Prestation en cours",
      description:
        "La prestation est en cours. KLYX centralise son suivi.",
      label: "Suivre la mission",
    },
    clientTrackPlanned: {
      title: "Mission planifiée",
      description:
        "Le paiement est confirmé et la mission est planifiée.",
      label: "Suivre la mission",
    },
    reviewSingle: {
      title: "Mission terminée",
      description:
        "La mission est terminée. Consulte le résultat et laisse un avis si nécessaire.",
      label: "Voir la mission",
    },
    reviewGroup: {
      title: "Mission groupée terminée",
      description:
        "Tous les créneaux sont terminés. Un seul avis KLYX évalue toute la mission.",
      label: "Donner mon avis",
    },
    providerBookingSingle: {
      title: "Nouvelle réservation à traiter",
      description:
        "Un client attend ta réponse. Accepte ou refuse la demande.",
      label: "Répondre maintenant",
    },
    providerBookingGroup: {
      title: "Réservation groupée à confirmer",
      description:
        "Le client t’a sélectionné pour plusieurs créneaux. Confirme le groupe complet.",
      label: "Traiter le groupe",
    },
    providerFinish: {
      title: "Termine la mission dans KLYX",
      description:
        "La prestation est en cours. Quand le travail est fini, déclare la mission terminée.",
      label: "Déclarer la fin",
    },
    providerTrackArrived: {
      title: "Démarre la prestation",
      description:
        "Tu es arrivé. Confirme le début de la prestation.",
      label: "Ouvrir le suivi",
    },
    providerTrackEnRoute: {
      title: "Continue ton trajet",
      description:
        "Indique ton arrivée au client depuis le suivi KLYX.",
      label: "Ouvrir le suivi",
    },
    providerTrackInProgress: {
      title: "Prestation en cours",
      description:
        "Quand le travail est terminé, déclare la fin de mission.",
      label: "Ouvrir le suivi",
    },
    providerTrackPlanned: {
      title: "Mission prête à exécuter",
      description:
        "Le paiement est confirmé. Tu peux commencer le suivi.",
      label: "Ouvrir le suivi",
    },
    groupCancellationWaitingPaid: {
      title: "Annulation en attente",
      description:
        "Ta demande concerne une mission groupée déjà payée. L’autre participant doit encore accepter ou refuser avant tout remboursement.",
      label: "Voir la demande",
    },
    groupCancellationWaitingUnpaid: {
      title: "Annulation en attente",
      description:
        "Ta demande d’annulation groupée attend la décision de l’autre participant.",
      label: "Voir la demande",
    },
    groupCancellationDecisionPaid: {
      title: "Décision d’annulation requise",
      description:
        "L’autre participant demande l’annulation de toute la mission. Ton accord explicite peut déclencher le remboursement Stripe du groupe.",
      label: "Examiner la demande",
    },
    groupCancellationDecisionUnpaid: {
      title: "Décision d’annulation requise",
      description:
        "L’autre participant demande l’annulation de toute la mission groupée. Accepte ou refuse la demande.",
      label: "Examiner la demande",
    },
    groupRefundProcessing: {
      title: "Remboursement groupé en cours",
      description:
        "Stripe traite le remboursement unique de cette mission groupée. Les créneaux restent synchronisés par KLYX.",
      label: "Voir le remboursement",
    },
    groupRefundFailed: {
      title: "Remboursement groupé à vérifier",
      description:
        "Stripe n’a pas finalisé le remboursement de la mission groupée. Le dossier doit être vérifié avant toute nouvelle action financière.",
      label: "Vérifier le dossier",
    },
  },
  en: {
    finalizeBooking: {
      title: "Finalize the booking",
      description:
        "The provider and price are selected. The time slot still needs to be confirmed.",
      label: "Choose the time slot",
    },
    paymentSingle: {
      title: "Payment to finalize",
      description:
        "The provider accepted. Payment is the next step before the mission.",
      label: "Finalize payment",
    },
    paymentGroup: {
      title: "Grouped payment to finalize",
      description:
        "All time slots are accepted. The group is waiting for one payment.",
      label: "View the group",
    },
    confirmCompletion: {
      title: "Confirm mission completion",
      description:
        "The provider marked the work as finished. Check the service, then confirm.",
      label: "Check and confirm",
    },
    clientTrackArrived: {
      title: "The provider has arrived",
      description:
        "The provider says they have arrived. The service can begin.",
      label: "Track the mission",
    },
    clientTrackEnRoute: {
      title: "The provider is on the way",
      description:
        "The provider is on the way. Track the mission in KLYX.",
      label: "Track the mission",
    },
    clientTrackInProgress: {
      title: "Service in progress",
      description:
        "The service is in progress. KLYX centralizes its tracking.",
      label: "Track the mission",
    },
    clientTrackPlanned: {
      title: "Mission scheduled",
      description:
        "Payment is confirmed and the mission is scheduled.",
      label: "Track the mission",
    },
    reviewSingle: {
      title: "Mission completed",
      description:
        "The mission is complete. Review the result and leave feedback if needed.",
      label: "View the mission",
    },
    reviewGroup: {
      title: "Grouped mission completed",
      description:
        "All time slots are complete. One KLYX review covers the whole mission.",
      label: "Leave a review",
    },
    providerBookingSingle: {
      title: "New booking to handle",
      description:
        "A client is waiting for your response. Accept or decline the request.",
      label: "Respond now",
    },
    providerBookingGroup: {
      title: "Grouped booking to confirm",
      description:
        "The client selected you for several time slots. Confirm the full group.",
      label: "Handle the group",
    },
    providerFinish: {
      title: "Finish the mission in KLYX",
      description:
        "The service is in progress. When the work is finished, mark the mission complete.",
      label: "Mark as finished",
    },
    providerTrackArrived: {
      title: "Start the service",
      description:
        "You have arrived. Confirm the start of the service.",
      label: "Open tracking",
    },
    providerTrackEnRoute: {
      title: "Continue your journey",
      description:
        "Tell the client you have arrived from KLYX tracking.",
      label: "Open tracking",
    },
    providerTrackInProgress: {
      title: "Service in progress",
      description:
        "When the work is finished, mark the mission complete.",
      label: "Open tracking",
    },
    providerTrackPlanned: {
      title: "Mission ready to start",
      description:
        "Payment is confirmed. You can start tracking.",
      label: "Open tracking",
    },
    groupCancellationWaitingPaid: {
      title: "Cancellation pending",
      description:
        "Your request concerns a grouped mission that is already paid. The other participant must still accept or decline before any refund.",
      label: "View the request",
    },
    groupCancellationWaitingUnpaid: {
      title: "Cancellation pending",
      description:
        "Your grouped cancellation request is waiting for the other participant’s decision.",
      label: "View the request",
    },
    groupCancellationDecisionPaid: {
      title: "Cancellation decision required",
      description:
        "The other participant is requesting cancellation of the whole mission. Your explicit agreement can trigger the group Stripe refund.",
      label: "Review the request",
    },
    groupCancellationDecisionUnpaid: {
      title: "Cancellation decision required",
      description:
        "The other participant is requesting cancellation of the whole grouped mission. Accept or decline the request.",
      label: "Review the request",
    },
    groupRefundProcessing: {
      title: "Grouped refund processing",
      description:
        "Stripe is processing the single refund for this grouped mission. KLYX keeps the time slots synchronized.",
      label: "View the refund",
    },
    groupRefundFailed: {
      title: "Grouped refund needs review",
      description:
        "Stripe did not finalize the grouped mission refund. The case must be reviewed before any new financial action.",
      label: "Review the case",
    },
  },
  nl: {
    finalizeBooking: {
      title: "Boeking afronden",
      description:
        "De dienstverlener en prijs zijn gekozen. Het tijdslot moet nog worden bevestigd.",
      label: "Tijdslot kiezen",
    },
    paymentSingle: {
      title: "Betaling afronden",
      description:
        "De dienstverlener heeft geaccepteerd. Betaling is de volgende stap vóór de missie.",
      label: "Betaling afronden",
    },
    paymentGroup: {
      title: "Groepsbetaling afronden",
      description:
        "Alle tijdsloten zijn geaccepteerd. De groep wacht op één betaling.",
      label: "Groep bekijken",
    },
    confirmCompletion: {
      title: "Bevestig het einde van de missie",
      description:
        "De dienstverlener heeft het werk als voltooid gemeld. Controleer de dienst en bevestig daarna.",
      label: "Controleren en bevestigen",
    },
    clientTrackArrived: {
      title: "De dienstverlener is aangekomen",
      description:
        "De dienstverlener geeft aan te zijn aangekomen. De dienst kan beginnen.",
      label: "Missie volgen",
    },
    clientTrackEnRoute: {
      title: "De dienstverlener is onderweg",
      description:
        "De dienstverlener is onderweg. Volg de missie in KLYX.",
      label: "Missie volgen",
    },
    clientTrackInProgress: {
      title: "Dienst bezig",
      description:
        "De dienst is bezig. KLYX centraliseert de opvolging.",
      label: "Missie volgen",
    },
    clientTrackPlanned: {
      title: "Missie gepland",
      description:
        "De betaling is bevestigd en de missie is gepland.",
      label: "Missie volgen",
    },
    reviewSingle: {
      title: "Missie voltooid",
      description:
        "De missie is voltooid. Bekijk het resultaat en laat indien nodig een beoordeling achter.",
      label: "Missie bekijken",
    },
    reviewGroup: {
      title: "Groepsmissie voltooid",
      description:
        "Alle tijdsloten zijn voltooid. Eén KLYX-beoordeling geldt voor de hele missie.",
      label: "Beoordeling geven",
    },
    providerBookingSingle: {
      title: "Nieuwe boeking te behandelen",
      description:
        "Een klant wacht op je antwoord. Accepteer of weiger de aanvraag.",
      label: "Nu antwoorden",
    },
    providerBookingGroup: {
      title: "Groepsboeking bevestigen",
      description:
        "De klant heeft je voor meerdere tijdsloten gekozen. Bevestig de volledige groep.",
      label: "Groep behandelen",
    },
    providerFinish: {
      title: "Rond de missie af in KLYX",
      description:
        "De dienst is bezig. Wanneer het werk klaar is, markeer je de missie als voltooid.",
      label: "Einde melden",
    },
    providerTrackArrived: {
      title: "Start de dienst",
      description:
        "Je bent aangekomen. Bevestig de start van de dienst.",
      label: "Opvolging openen",
    },
    providerTrackEnRoute: {
      title: "Vervolg je route",
      description:
        "Meld je aankomst aan de klant vanuit de KLYX-opvolging.",
      label: "Opvolging openen",
    },
    providerTrackInProgress: {
      title: "Dienst bezig",
      description:
        "Wanneer het werk klaar is, markeer je het einde van de missie.",
      label: "Opvolging openen",
    },
    providerTrackPlanned: {
      title: "Missie klaar om te starten",
      description:
        "De betaling is bevestigd. Je kunt de opvolging starten.",
      label: "Opvolging openen",
    },
    groupCancellationWaitingPaid: {
      title: "Annulering in afwachting",
      description:
        "Je aanvraag betreft een reeds betaalde groepsmissie. De andere deelnemer moet nog accepteren of weigeren vóór enige terugbetaling.",
      label: "Aanvraag bekijken",
    },
    groupCancellationWaitingUnpaid: {
      title: "Annulering in afwachting",
      description:
        "Je gegroepeerde annuleringsaanvraag wacht op de beslissing van de andere deelnemer.",
      label: "Aanvraag bekijken",
    },
    groupCancellationDecisionPaid: {
      title: "Annuleringsbeslissing vereist",
      description:
        "De andere deelnemer vraagt om de volledige missie te annuleren. Jouw uitdrukkelijke akkoord kan de Stripe-terugbetaling van de groep activeren.",
      label: "Aanvraag beoordelen",
    },
    groupCancellationDecisionUnpaid: {
      title: "Annuleringsbeslissing vereist",
      description:
        "De andere deelnemer vraagt om de volledige groepsmissie te annuleren. Accepteer of weiger de aanvraag.",
      label: "Aanvraag beoordelen",
    },
    groupRefundProcessing: {
      title: "Groepsterugbetaling wordt verwerkt",
      description:
        "Stripe verwerkt de enige terugbetaling voor deze groepsmissie. KLYX houdt de tijdsloten gesynchroniseerd.",
      label: "Terugbetaling bekijken",
    },
    groupRefundFailed: {
      title: "Groepsterugbetaling moet worden nagekeken",
      description:
        "Stripe heeft de terugbetaling van de groepsmissie niet afgerond. Het dossier moet worden gecontroleerd vóór een nieuwe financiële actie.",
      label: "Dossier controleren",
    },
  },
  de: {
    finalizeBooking: {
      title: "Buchung abschließen",
      description:
        "Dienstleister und Preis sind ausgewählt. Das Zeitfenster muss noch bestätigt werden.",
      label: "Zeitfenster wählen",
    },
    paymentSingle: {
      title: "Zahlung abschließen",
      description:
        "Der Dienstleister hat angenommen. Die Zahlung ist der nächste Schritt vor der Mission.",
      label: "Zahlung abschließen",
    },
    paymentGroup: {
      title: "Gruppenzahlung abschließen",
      description:
        "Alle Zeitfenster sind angenommen. Die Gruppe wartet auf eine einzige Zahlung.",
      label: "Gruppe ansehen",
    },
    confirmCompletion: {
      title: "Missionsende bestätigen",
      description:
        "Der Dienstleister hat die Arbeit als beendet gemeldet. Prüfe die Leistung und bestätige anschließend.",
      label: "Prüfen und bestätigen",
    },
    clientTrackArrived: {
      title: "Der Dienstleister ist angekommen",
      description:
        "Der Dienstleister meldet seine Ankunft. Die Leistung kann beginnen.",
      label: "Mission verfolgen",
    },
    clientTrackEnRoute: {
      title: "Der Dienstleister ist unterwegs",
      description:
        "Der Dienstleister ist unterwegs. Verfolge die Mission in KLYX.",
      label: "Mission verfolgen",
    },
    clientTrackInProgress: {
      title: "Leistung läuft",
      description:
        "Die Leistung läuft. KLYX bündelt die Nachverfolgung.",
      label: "Mission verfolgen",
    },
    clientTrackPlanned: {
      title: "Mission geplant",
      description:
        "Die Zahlung ist bestätigt und die Mission ist geplant.",
      label: "Mission verfolgen",
    },
    reviewSingle: {
      title: "Mission abgeschlossen",
      description:
        "Die Mission ist abgeschlossen. Prüfe das Ergebnis und hinterlasse bei Bedarf eine Bewertung.",
      label: "Mission ansehen",
    },
    reviewGroup: {
      title: "Gruppenmission abgeschlossen",
      description:
        "Alle Zeitfenster sind abgeschlossen. Eine KLYX-Bewertung gilt für die gesamte Mission.",
      label: "Bewertung abgeben",
    },
    providerBookingSingle: {
      title: "Neue Buchung zu bearbeiten",
      description:
        "Ein Kunde wartet auf deine Antwort. Nimm die Anfrage an oder lehne sie ab.",
      label: "Jetzt antworten",
    },
    providerBookingGroup: {
      title: "Gruppenbuchung bestätigen",
      description:
        "Der Kunde hat dich für mehrere Zeitfenster ausgewählt. Bestätige die gesamte Gruppe.",
      label: "Gruppe bearbeiten",
    },
    providerFinish: {
      title: "Mission in KLYX abschließen",
      description:
        "Die Leistung läuft. Wenn die Arbeit beendet ist, markiere die Mission als abgeschlossen.",
      label: "Ende melden",
    },
    providerTrackArrived: {
      title: "Leistung starten",
      description:
        "Du bist angekommen. Bestätige den Beginn der Leistung.",
      label: "Nachverfolgung öffnen",
    },
    providerTrackEnRoute: {
      title: "Fahrt fortsetzen",
      description:
        "Melde dem Kunden deine Ankunft über die KLYX-Nachverfolgung.",
      label: "Nachverfolgung öffnen",
    },
    providerTrackInProgress: {
      title: "Leistung läuft",
      description:
        "Wenn die Arbeit beendet ist, markiere die Mission als abgeschlossen.",
      label: "Nachverfolgung öffnen",
    },
    providerTrackPlanned: {
      title: "Mission startbereit",
      description:
        "Die Zahlung ist bestätigt. Du kannst die Nachverfolgung starten.",
      label: "Nachverfolgung öffnen",
    },
    groupCancellationWaitingPaid: {
      title: "Stornierung ausstehend",
      description:
        "Deine Anfrage betrifft eine bereits bezahlte Gruppenmission. Der andere Teilnehmer muss vor einer Erstattung noch zustimmen oder ablehnen.",
      label: "Anfrage ansehen",
    },
    groupCancellationWaitingUnpaid: {
      title: "Stornierung ausstehend",
      description:
        "Deine Gruppenstornierung wartet auf die Entscheidung des anderen Teilnehmers.",
      label: "Anfrage ansehen",
    },
    groupCancellationDecisionPaid: {
      title: "Stornierungsentscheidung erforderlich",
      description:
        "Der andere Teilnehmer möchte die gesamte Mission stornieren. Deine ausdrückliche Zustimmung kann die Stripe-Erstattung der Gruppe auslösen.",
      label: "Anfrage prüfen",
    },
    groupCancellationDecisionUnpaid: {
      title: "Stornierungsentscheidung erforderlich",
      description:
        "Der andere Teilnehmer möchte die gesamte Gruppenmission stornieren. Nimm die Anfrage an oder lehne sie ab.",
      label: "Anfrage prüfen",
    },
    groupRefundProcessing: {
      title: "Gruppenerstattung wird verarbeitet",
      description:
        "Stripe verarbeitet die einmalige Erstattung für diese Gruppenmission. KLYX hält die Zeitfenster synchron.",
      label: "Erstattung ansehen",
    },
    groupRefundFailed: {
      title: "Gruppenerstattung muss geprüft werden",
      description:
        "Stripe hat die Erstattung der Gruppenmission nicht abgeschlossen. Der Fall muss vor jeder neuen finanziellen Aktion geprüft werden.",
      label: "Fall prüfen",
    },
  },
};

const LOCALE_SET = new Set<string>(KLYX_BRAIN_ACTION_TRANSLATED_LOCALES);

const INTL_LOCALES: Record<KlyxBrainActionLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

export function resolveKlyxBrainActionLocale(
  locale: KlyxLocale
): KlyxBrainActionLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxBrainActionLocale) : "fr";
}

function staticVariant(action: KlyxBrainActionLike): StaticVariant | null {
  if (action.kind === "finalize_booking") return "finalizeBooking";

  if (action.kind === "payment_pending") {
    return action.id.startsWith("payment-group-")
      ? "paymentGroup"
      : "paymentSingle";
  }

  if (action.kind === "confirm_completion") return "confirmCompletion";

  if (action.kind === "track_mission") {
    if (action.title === "Le prestataire est arrive") return "clientTrackArrived";
    if (action.title === "Le prestataire est en route") return "clientTrackEnRoute";
    if (action.title === "Prestation en cours") return "clientTrackInProgress";
    return "clientTrackPlanned";
  }

  if (action.kind === "review_completed") {
    return action.id.startsWith("review-group-") ? "reviewGroup" : "reviewSingle";
  }

  if (action.kind === "provider_booking_request") {
    return action.id.startsWith("provider-group-")
      ? "providerBookingGroup"
      : "providerBookingSingle";
  }

  if (action.kind === "provider_finish_mission") return "providerFinish";

  if (action.kind === "provider_track_mission") {
    if (action.title === "Continue ton trajet") return "providerTrackEnRoute";
    if (action.title === "Demarre la prestation") return "providerTrackArrived";
    if (action.title === "Prestation en cours") return "providerTrackInProgress";
    return "providerTrackPlanned";
  }

  if (action.kind === "group_cancellation_waiting") {
    return action.priority >= 126
      ? "groupCancellationWaitingPaid"
      : "groupCancellationWaitingUnpaid";
  }

  if (action.kind === "group_cancellation_decision") {
    return action.description.includes("remboursement Stripe")
      ? "groupCancellationDecisionPaid"
      : "groupCancellationDecisionUnpaid";
  }

  if (action.kind === "group_refund_processing") return "groupRefundProcessing";
  if (action.kind === "group_refund_failed") return "groupRefundFailed";

  return null;
}

function localizeCompareOffers(
  locale: KlyxBrainActionLocale,
  action: KlyxBrainActionLike
): KlyxBrainActionLike {
  const match = action.title.match(/^(\d+)/);
  const count = match ? Number(match[1]) : 0;

  let title: string;
  if (locale === "en") {
    title = count > 0
      ? `${count} offer${count === 1 ? "" : "s"} to compare`
      : "Offers to compare";
  } else if (locale === "nl") {
    title = count > 0
      ? `${count} ${count === 1 ? "aanbieding" : "aanbiedingen"} te vergelijken`
      : "Aanbiedingen vergelijken";
  } else if (locale === "de") {
    title = count > 0
      ? `${count} ${count === 1 ? "Angebot" : "Angebote"} vergleichen`
      : "Angebote vergleichen";
  } else {
    title = count > 0
      ? `${count} offre${count === 1 ? "" : "s"} à comparer`
      : "Offres à comparer";
  }

  const label =
    locale === "en"
      ? "Compare with KLYX"
      : locale === "nl"
        ? "Vergelijken met KLYX"
        : locale === "de"
          ? "Mit KLYX vergleichen"
          : "Comparer avec KLYX";

  return {
    ...action,
    title,
    description: action.description,
    label,
  };
}

function localizeProviderOffer(
  locale: KlyxBrainActionLocale,
  action: KlyxBrainActionLike
): KlyxBrainActionLike {
  const amountMatch = action.description.match(
    /Montant accepte\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*EUR\.?/i
  );
  const parsedAmount = amountMatch ? Number(amountMatch[1]) : Number.NaN;
  const amount = Number.isFinite(parsedAmount)
    ? new Intl.NumberFormat(INTL_LOCALES[locale], {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(parsedAmount)
    : null;

  if (locale === "en") {
    return {
      ...action,
      title: "An offer was accepted",
      description: amount
        ? `Accepted amount: ${amount}.`
        : "The accepted amount is available in your bookings.",
      label: "View my bookings",
    };
  }

  if (locale === "nl") {
    return {
      ...action,
      title: "Een aanbieding is geaccepteerd",
      description: amount
        ? `Geaccepteerd bedrag: ${amount}.`
        : "Het geaccepteerde bedrag staat in je boekingen.",
      label: "Mijn boekingen bekijken",
    };
  }

  if (locale === "de") {
    return {
      ...action,
      title: "Ein Angebot wurde angenommen",
      description: amount
        ? `Akzeptierter Betrag: ${amount}.`
        : "Der akzeptierte Betrag ist in deinen Buchungen verfügbar.",
      label: "Meine Buchungen ansehen",
    };
  }

  return {
    ...action,
    title: "Une offre a été acceptée",
    description: amount
      ? `Montant accepté : ${amount}.`
      : "Le montant accepté est disponible dans tes réservations.",
    label: "Voir mes réservations",
  };
}

export function localizeKlyxBrainAction(
  locale: KlyxLocale,
  action: KlyxBrainActionLike
): KlyxBrainActionLike {
  const resolved = resolveKlyxBrainActionLocale(locale);

  if (action.kind === "compare_offers") {
    return localizeCompareOffers(resolved, action);
  }

  if (action.kind === "provider_offer_update") {
    return localizeProviderOffer(resolved, action);
  }

  const variant = staticVariant(action);
  if (!variant) {
    return { ...action };
  }

  return {
    ...action,
    ...STATIC_COPY[resolved][variant],
  };
}

export function localizeKlyxBrainActions(
  locale: KlyxLocale,
  actions: readonly KlyxBrainActionLike[]
): KlyxBrainActionLike[] {
  return actions.map((action) => localizeKlyxBrainAction(locale, action));
}
