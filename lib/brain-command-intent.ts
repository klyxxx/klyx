export type BrainCommandActionLike = {
  kind: string;
  priority: number;
};

const INTENTS = {
  payment: [
    "payer",
    "paiement",
    "payement",
    "regler",
    "carte bancaire",
    "c est paye",
    "est ce paye",
    "deja paye",
    "paiement confirme",
    "payment",
    "pay my",
    "pay for",
    "pay now",
    "want to pay",
    "card payment",
    "is it paid",
    "has it been paid",
    "already paid",
    "payment confirmed",
    "betalen",
    "betaling",
    "afrekenen",
    "bankkaart",
    "is het betaald",
    "al betaald",
    "betaling bevestigd",
    "bezahlen",
    "zahlung",
    "bezahle",
    "karte bezahlen",
    "ist es bezahlt",
    "schon bezahlt",
    "zahlung bestatigt",
  ],
  tracking: [
    "suivre",
    "suivi",
    "ou en est",
    "ou est le prestataire",
    "prestataire en route",
    "prestataire arrive",
    "etat de la mission",
    "etat de la prestation",
    "track mission",
    "track my mission",
    "where is the provider",
    "provider on the way",
    "provider arrived",
    "mission status",
    "service status",
    "missie volgen",
    "opvolging",
    "waar is de dienstverlener",
    "dienstverlener onderweg",
    "dienstverlener aangekomen",
    "status van de missie",
    "status van de dienst",
    "mission verfolgen",
    "wo ist der anbieter",
    "anbieter unterwegs",
    "anbieter angekommen",
    "missionsstatus",
    "status der dienstleistung",
  ],
  confirmCompletion: [
    "confirmer la fin",
    "confirmer mission",
    "confirmer la mission",
    "mission terminee",
    "prestation terminee",
    "travail termine",
    "confirm completion",
    "confirm mission completion",
    "mission completed",
    "service completed",
    "work finished",
    "einde bevestigen",
    "missie voltooid",
    "dienst voltooid",
    "werk klaar",
    "abschluss bestatigen",
    "missionsabschluss bestatigen",
    "mission abgeschlossen",
    "dienstleistung abgeschlossen",
    "arbeit beendet",
  ],
  providerFinish: [
    "declarer la fin",
    "terminer la mission",
    "finir la mission",
    "mission finie",
    "travail fini",
    "mark mission complete",
    "finish mission",
    "complete mission",
    "mark work finished",
    "missie afronden",
    "missie beeindigen",
    "werk afronden",
    "mission abschliessen",
    "mission beenden",
    "arbeit fertig melden",
  ],
  providerBooking: [
    "nouvelle reservation",
    "demande client",
    "accepter la reservation",
    "refuser la reservation",
    "repondre au client",
    "new booking",
    "client request",
    "accept booking",
    "decline booking",
    "reply to client",
    "nieuwe boeking",
    "klantaanvraag",
    "boeking accepteren",
    "boeking weigeren",
    "klant antwoorden",
    "neue buchung",
    "kundenanfrage",
    "buchung annehmen",
    "buchung ablehnen",
    "kunden antworten",
  ],
  compareOffers: [
    "comparer les offres",
    "voir les offres",
    "choisir une offre",
    "choisir prestataire",
    "compare offers",
    "view offers",
    "choose an offer",
    "choose provider",
    "offertes vergelijken",
    "offertes bekijken",
    "offerte kiezen",
    "dienstverlener kiezen",
    "angebote vergleichen",
    "angebote ansehen",
    "angebot auswahlen",
    "anbieter auswahlen",
  ],
  finalizeBooking: [
    "finaliser la reservation",
    "choisir le creneau",
    "confirmer le creneau",
    "finalize booking",
    "choose time slot",
    "confirm time slot",
    "boeking afronden",
    "tijdslot kiezen",
    "tijdslot bevestigen",
    "buchung abschliessen",
    "zeitfenster wahlen",
    "zeitfenster bestatigen",
  ],
  review: [
    "laisser un avis",
    "donner mon avis",
    "noter le prestataire",
    "leave a review",
    "give a review",
    "rate provider",
    "beoordeling achterlaten",
    "beoordeling geven",
    "dienstverlener beoordelen",
    "bewertung abgeben",
    "anbieter bewerten",
  ],
  generalAction: [
    "que dois je faire",
    "quoi faire maintenant",
    "prochaine action",
    "prochaine etape",
    "quelle est la suite",
    "continuer ma demande",
    "reprendre ma demande",
    "mes actions",
    "ma priorite",
    "qu est ce qui bloque",
    "qu est ce qui est bloque",
    "j attends quoi",
    "qu est ce que j attends",
    "quel est le statut",
    "statut actuel",
    "what should i do",
    "what to do now",
    "next action",
    "next step",
    "what is next",
    "continue my request",
    "resume my request",
    "my actions",
    "my priority",
    "what is blocking",
    "what am i waiting for",
    "what are we waiting for",
    "what is the status",
    "current status",
    "wat moet ik doen",
    "wat nu",
    "volgende actie",
    "volgende stap",
    "wat is de volgende stap",
    "mijn aanvraag voortzetten",
    "mijn aanvraag hervatten",
    "mijn acties",
    "mijn prioriteit",
    "wat blokkeert",
    "waar wacht ik op",
    "wat is de status",
    "huidige status",
    "was soll ich tun",
    "was jetzt",
    "nachste aktion",
    "nachster schritt",
    "wie geht es weiter",
    "anfrage fortsetzen",
    "anfrage wieder aufnehmen",
    "meine aktionen",
    "meine prioritat",
    "was blockiert",
    "worauf warte ich",
    "wie ist der status",
    "aktueller status",
  ],
  newNeed: [
    "j ai besoin de",
    "je cherche",
    "trouve moi",
    "trouver quelqu un",
    "cherche quelqu un",
    "besoin d un",
    "besoin d une",
    "je voudrais un",
    "je voudrais une",
    "i need",
    "i am looking for",
    "i m looking for",
    "find me",
    "find someone",
    "looking for someone",
    "i would like a",
    "i would like an",
    "ik heb een",
    "nodig",
    "ik zoek",
    "vind voor mij",
    "zoek iemand",
    "ik wil een",
    "ik wil iemand",
    "ich brauche",
    "ich suche",
    "finde mir",
    "finde jemanden",
    "ich mochte einen",
    "ich mochte eine",
  ],
} as const;

export function normalizeBrainCommandMessage(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, expressions: readonly string[]): boolean {
  return expressions.some((expression) => value.includes(expression));
}

export function brainCommandActionMatchesSpecificIntent(
  action: BrainCommandActionLike,
  message: string
): boolean {
  if (action.kind === "payment_pending") return includesAny(message, INTENTS.payment);

  if (action.kind === "track_mission" || action.kind === "provider_track_mission") {
    return includesAny(message, INTENTS.tracking);
  }

  if (action.kind === "confirm_completion") {
    return includesAny(message, INTENTS.confirmCompletion);
  }

  if (action.kind === "provider_finish_mission") {
    return includesAny(message, INTENTS.providerFinish);
  }

  if (action.kind === "provider_booking_request") {
    return includesAny(message, INTENTS.providerBooking);
  }

  if (action.kind === "compare_offers") return includesAny(message, INTENTS.compareOffers);

  if (action.kind === "finalize_booking") {
    return includesAny(message, INTENTS.finalizeBooking);
  }

  if (action.kind === "review_completed") return includesAny(message, INTENTS.review);

  return false;
}

export function brainCommandActionIntentScore(
  action: BrainCommandActionLike,
  message: string
): number {
  let score = action.priority;

  if (action.kind === "payment_pending" && includesAny(message, INTENTS.payment)) score += 2000;

  if (
    (action.kind === "track_mission" || action.kind === "provider_track_mission") &&
    includesAny(message, INTENTS.tracking)
  ) score += 1900;

  if (action.kind === "confirm_completion" && includesAny(message, INTENTS.confirmCompletion)) {
    score += 2100;
  }

  if (action.kind === "provider_finish_mission" && includesAny(message, INTENTS.providerFinish)) {
    score += 2100;
  }

  if (action.kind === "provider_booking_request" && includesAny(message, INTENTS.providerBooking)) {
    score += 1900;
  }

  if (action.kind === "compare_offers" && includesAny(message, INTENTS.compareOffers)) score += 1800;

  if (action.kind === "finalize_booking" && includesAny(message, INTENTS.finalizeBooking)) {
    score += 1800;
  }

  if (action.kind === "review_completed" && includesAny(message, INTENTS.review)) score += 1700;

  return score;
}

export function hasSpecificBrainCommandIntent(message: string): boolean {
  return (
    includesAny(message, INTENTS.payment) ||
    includesAny(message, INTENTS.tracking) ||
    includesAny(message, INTENTS.confirmCompletion) ||
    includesAny(message, INTENTS.providerFinish) ||
    includesAny(message, INTENTS.providerBooking) ||
    includesAny(message, INTENTS.compareOffers) ||
    includesAny(message, INTENTS.finalizeBooking) ||
    includesAny(message, INTENTS.review)
  );
}

export function hasGeneralBrainCommandIntent(message: string): boolean {
  return includesAny(message, INTENTS.generalAction);
}

export function hasNewNeedBrainCommandIntent(message: string): boolean {
  return includesAny(message, INTENTS.newNeed);
}

export function bestBrainCommandAction<T extends BrainCommandActionLike>(
  actions: T[],
  message: string
): T | null {
  if (actions.length === 0) return null;

  return [...actions].sort(
    (first, second) =>
      brainCommandActionIntentScore(second, message) -
      brainCommandActionIntentScore(first, message)
  )[0] ?? null;
}

export function bestSpecificBrainCommandAction<T extends BrainCommandActionLike>(
  actions: T[],
  message: string
): T | null {
  const matchingActions = actions.filter((action) =>
    brainCommandActionMatchesSpecificIntent(action, message)
  );

  return bestBrainCommandAction(matchingActions, message);
}
