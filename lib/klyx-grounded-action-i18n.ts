import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_GROUNDED_ACTION_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxGroundedActionLocale =
  (typeof KLYX_GROUNDED_ACTION_LOCALES)[number];

type GroundedActionCopy = {
  kind: string;
  title: string;
  description: string;
  label: string;
};

type CopyDictionary = Record<string, string>;

const COPY: Record<KlyxGroundedActionLocale, CopyDictionary> = {
  fr: {
    "Le prestataire est arrive": "Le prestataire est arrivé",
    "Le prestataire est en route": "Le prestataire est en route",
    "Prestation en cours": "Prestation en cours",
    "Mission planifiee": "Mission planifiée",
    "Le prestataire est en route. Suis la mission depuis KLYX.":
      "Le prestataire est en route. Suis la mission depuis KLYX.",
    "Le prestataire indique etre arrive. La prestation peut commencer.":
      "Le prestataire indique être arrivé. La prestation peut commencer.",
    "La prestation est en cours. KLYX centralise son suivi.":
      "La prestation est en cours. KLYX centralise son suivi.",
    "Le paiement est confirme et la mission est planifiee.":
      "Le paiement est confirmé et la mission est planifiée.",
    "Continue ton trajet": "Continue ton trajet",
    "Demarre la prestation": "Démarre la prestation",
    "Mission prete a executer": "Mission prête à exécuter",
    "Indique ton arrivee au client depuis le suivi KLYX.":
      "Indique ton arrivée au client depuis le suivi KLYX.",
    "Tu es arrive. Confirme le debut de la prestation.":
      "Tu es arrivé. Confirme le début de la prestation.",
    "Quand le travail est termine, declare la fin de mission.":
      "Quand le travail est terminé, déclare la fin de mission.",
    "Le paiement est confirme. Tu peux commencer le suivi.":
      "Le paiement est confirmé. Tu peux commencer le suivi.",
    "Comparer avec KLYX": "Comparer avec KLYX",
    "Finaliser la reservation": "Finaliser la réservation",
    "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.":
      "Le prestataire et le prix sont choisis. Il reste à confirmer le créneau.",
    "Choisir le creneau": "Choisir le créneau",
    "Paiement groupe a finaliser": "Paiement groupé à finaliser",
    "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.":
      "Tous les créneaux sont acceptés. Le groupe attend un paiement unique.",
    "Voir le groupe": "Voir le groupe",
    "Paiement a finaliser": "Paiement à finaliser",
    "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.":
      "Le prestataire a accepté. Le paiement est la prochaine étape avant la mission.",
    "Finaliser le paiement": "Finaliser le paiement",
    "Confirme la fin de mission": "Confirme la fin de mission",
    "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.":
      "Le prestataire a déclaré son travail terminé. Vérifie la prestation puis confirme.",
    "Verifier et confirmer": "Vérifier et confirmer",
    "Suivre la mission": "Suivre la mission",
    "Mission terminee": "Mission terminée",
    "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.":
      "La mission est terminée. Consulte le résultat et laisse un avis si nécessaire.",
    "Voir la mission": "Voir la mission",
    "Mission groupee terminee": "Mission groupée terminée",
    "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.":
      "Tous les créneaux sont terminés. Un seul avis KLYX évalue toute la mission.",
    "Donner mon avis": "Donner mon avis",
    "Une offre a ete acceptee": "Une offre a été acceptée",
    "Voir mes reservations": "Voir mes réservations",
    "Reservation groupee a confirmer": "Réservation groupée à confirmer",
    "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.":
      "Le client t’a sélectionné pour plusieurs créneaux. Confirme le groupe complet.",
    "Traiter le groupe": "Traiter le groupe",
    "Nouvelle reservation a traiter": "Nouvelle réservation à traiter",
    "Un client attend ta reponse. Accepte ou refuse la demande.":
      "Un client attend ta réponse. Accepte ou refuse la demande.",
    "Repondre maintenant": "Répondre maintenant",
    "Termine la mission dans KLYX": "Termine la mission dans KLYX",
    "La prestation est en cours. Quand le travail est fini, declare la mission terminee.":
      "La prestation est en cours. Quand le travail est fini, déclare la mission terminée.",
    "Declarer la fin": "Déclarer la fin",
    "Ouvrir le suivi": "Ouvrir le suivi",
  },
  en: {
    "Le prestataire est arrive": "The provider has arrived",
    "Le prestataire est en route": "The provider is on the way",
    "Prestation en cours": "Service in progress",
    "Mission planifiee": "Mission scheduled",
    "Le prestataire est en route. Suis la mission depuis KLYX.":
      "The provider is on the way. Track the mission in KLYX.",
    "Le prestataire indique etre arrive. La prestation peut commencer.":
      "The provider has marked themselves as arrived. The service can begin.",
    "La prestation est en cours. KLYX centralise son suivi.":
      "The service is in progress. KLYX keeps its tracking in one place.",
    "Le paiement est confirme et la mission est planifiee.":
      "Payment is confirmed and the mission is scheduled.",
    "Continue ton trajet": "Continue your trip",
    "Demarre la prestation": "Start the service",
    "Mission prete a executer": "Mission ready to start",
    "Indique ton arrivee au client depuis le suivi KLYX.":
      "Mark your arrival for the client from KLYX tracking.",
    "Tu es arrive. Confirme le debut de la prestation.":
      "You have arrived. Confirm the start of the service.",
    "Quand le travail est termine, declare la fin de mission.":
      "When the work is finished, mark the mission as complete.",
    "Le paiement est confirme. Tu peux commencer le suivi.":
      "Payment is confirmed. You can start tracking the mission.",
    "Comparer avec KLYX": "Compare with KLYX",
    "Finaliser la reservation": "Finalize the booking",
    "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.":
      "The provider and price are selected. The remaining step is to confirm the time slot.",
    "Choisir le creneau": "Choose the time slot",
    "Paiement groupe a finaliser": "Group payment to finalize",
    "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.":
      "All time slots are accepted. The group is waiting for one payment.",
    "Voir le groupe": "View the group",
    "Paiement a finaliser": "Payment to finalize",
    "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.":
      "The provider accepted. Payment is the next step before the mission.",
    "Finaliser le paiement": "Finalize payment",
    "Confirme la fin de mission": "Confirm mission completion",
    "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.":
      "The provider marked the work as finished. Check the service, then confirm.",
    "Verifier et confirmer": "Check and confirm",
    "Suivre la mission": "Track the mission",
    "Mission terminee": "Mission completed",
    "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.":
      "The mission is complete. Review the result and leave feedback if needed.",
    "Voir la mission": "View the mission",
    "Mission groupee terminee": "Grouped mission completed",
    "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.":
      "All time slots are complete. One KLYX review covers the whole mission.",
    "Donner mon avis": "Leave a review",
    "Une offre a ete acceptee": "An offer was accepted",
    "Voir mes reservations": "View my bookings",
    "Reservation groupee a confirmer": "Grouped booking to confirm",
    "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.":
      "The client selected you for several time slots. Confirm the full group.",
    "Traiter le groupe": "Handle the group",
    "Nouvelle reservation a traiter": "New booking to handle",
    "Un client attend ta reponse. Accepte ou refuse la demande.":
      "A client is waiting for your response. Accept or decline the request.",
    "Repondre maintenant": "Respond now",
    "Termine la mission dans KLYX": "Complete the mission in KLYX",
    "La prestation est en cours. Quand le travail est fini, declare la mission terminee.":
      "The service is in progress. When the work is finished, mark the mission as complete.",
    "Declarer la fin": "Mark as complete",
    "Ouvrir le suivi": "Open tracking",
  },
  nl: {
    "Le prestataire est arrive": "De dienstverlener is aangekomen",
    "Le prestataire est en route": "De dienstverlener is onderweg",
    "Prestation en cours": "Dienst is bezig",
    "Mission planifiee": "Opdracht gepland",
    "Le prestataire est en route. Suis la mission depuis KLYX.":
      "De dienstverlener is onderweg. Volg de opdracht in KLYX.",
    "Le prestataire indique etre arrive. La prestation peut commencer.":
      "De dienstverlener heeft de aankomst gemeld. De dienst kan beginnen.",
    "La prestation est en cours. KLYX centralise son suivi.":
      "De dienst is bezig. KLYX houdt de opvolging op één plek.",
    "Le paiement est confirme et la mission est planifiee.":
      "De betaling is bevestigd en de opdracht is gepland.",
    "Continue ton trajet": "Vervolg je rit",
    "Demarre la prestation": "Start de dienst",
    "Mission prete a executer": "Opdracht klaar om te starten",
    "Indique ton arrivee au client depuis le suivi KLYX.":
      "Meld je aankomst aan de klant via KLYX-opvolging.",
    "Tu es arrive. Confirme le debut de la prestation.":
      "Je bent aangekomen. Bevestig de start van de dienst.",
    "Quand le travail est termine, declare la fin de mission.":
      "Markeer de opdracht als voltooid wanneer het werk klaar is.",
    "Le paiement est confirme. Tu peux commencer le suivi.":
      "De betaling is bevestigd. Je kunt de opvolging starten.",
    "Comparer avec KLYX": "Vergelijken met KLYX",
    "Finaliser la reservation": "Boeking afronden",
    "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.":
      "De dienstverlener en prijs zijn gekozen. Bevestig nu het tijdslot.",
    "Choisir le creneau": "Tijdslot kiezen",
    "Paiement groupe a finaliser": "Groepsbetaling afronden",
    "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.":
      "Alle tijdsloten zijn aanvaard. De groep wacht op één betaling.",
    "Voir le groupe": "Groep bekijken",
    "Paiement a finaliser": "Betaling afronden",
    "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.":
      "De dienstverlener heeft aanvaard. Betaling is de volgende stap vóór de opdracht.",
    "Finaliser le paiement": "Betaling afronden",
    "Confirme la fin de mission": "Bevestig het einde van de opdracht",
    "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.":
      "De dienstverlener heeft het werk als klaar gemeld. Controleer de dienst en bevestig.",
    "Verifier et confirmer": "Controleren en bevestigen",
    "Suivre la mission": "Opdracht volgen",
    "Mission terminee": "Opdracht voltooid",
    "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.":
      "De opdracht is voltooid. Bekijk het resultaat en laat indien nodig een beoordeling achter.",
    "Voir la mission": "Opdracht bekijken",
    "Mission groupee terminee": "Gegroepeerde opdracht voltooid",
    "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.":
      "Alle tijdsloten zijn voltooid. Eén KLYX-beoordeling geldt voor de hele opdracht.",
    "Donner mon avis": "Beoordeling geven",
    "Une offre a ete acceptee": "Een aanbod is aanvaard",
    "Voir mes reservations": "Mijn boekingen bekijken",
    "Reservation groupee a confirmer": "Gegroepeerde boeking bevestigen",
    "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.":
      "De klant heeft je voor meerdere tijdsloten gekozen. Bevestig de volledige groep.",
    "Traiter le groupe": "Groep behandelen",
    "Nouvelle reservation a traiter": "Nieuwe boeking behandelen",
    "Un client attend ta reponse. Accepte ou refuse la demande.":
      "Een klant wacht op je antwoord. Aanvaard of weiger de aanvraag.",
    "Repondre maintenant": "Nu antwoorden",
    "Termine la mission dans KLYX": "Voltooi de opdracht in KLYX",
    "La prestation est en cours. Quand le travail est fini, declare la mission terminee.":
      "De dienst is bezig. Markeer de opdracht als voltooid wanneer het werk klaar is.",
    "Declarer la fin": "Als voltooid markeren",
    "Ouvrir le suivi": "Opvolging openen",
  },
  de: {
    "Le prestataire est arrive": "Der Anbieter ist angekommen",
    "Le prestataire est en route": "Der Anbieter ist unterwegs",
    "Prestation en cours": "Service läuft",
    "Mission planifiee": "Auftrag geplant",
    "Le prestataire est en route. Suis la mission depuis KLYX.":
      "Der Anbieter ist unterwegs. Verfolge den Auftrag in KLYX.",
    "Le prestataire indique etre arrive. La prestation peut commencer.":
      "Der Anbieter hat seine Ankunft gemeldet. Der Service kann beginnen.",
    "La prestation est en cours. KLYX centralise son suivi.":
      "Der Service läuft. KLYX bündelt die Nachverfolgung an einem Ort.",
    "Le paiement est confirme et la mission est planifiee.":
      "Die Zahlung ist bestätigt und der Auftrag ist geplant.",
    "Continue ton trajet": "Setze deine Fahrt fort",
    "Demarre la prestation": "Service starten",
    "Mission prete a executer": "Auftrag bereit zum Start",
    "Indique ton arrivee au client depuis le suivi KLYX.":
      "Melde dem Kunden deine Ankunft über die KLYX-Nachverfolgung.",
    "Tu es arrive. Confirme le debut de la prestation.":
      "Du bist angekommen. Bestätige den Start des Services.",
    "Quand le travail est termine, declare la fin de mission.":
      "Markiere den Auftrag als abgeschlossen, wenn die Arbeit fertig ist.",
    "Le paiement est confirme. Tu peux commencer le suivi.":
      "Die Zahlung ist bestätigt. Du kannst die Nachverfolgung starten.",
    "Comparer avec KLYX": "Mit KLYX vergleichen",
    "Finaliser la reservation": "Buchung abschließen",
    "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.":
      "Anbieter und Preis sind gewählt. Jetzt muss nur noch das Zeitfenster bestätigt werden.",
    "Choisir le creneau": "Zeitfenster wählen",
    "Paiement groupe a finaliser": "Gruppenzahlung abschließen",
    "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.":
      "Alle Zeitfenster sind bestätigt. Die Gruppe wartet auf eine einzige Zahlung.",
    "Voir le groupe": "Gruppe ansehen",
    "Paiement a finaliser": "Zahlung abschließen",
    "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.":
      "Der Anbieter hat angenommen. Die Zahlung ist der nächste Schritt vor dem Auftrag.",
    "Finaliser le paiement": "Zahlung abschließen",
    "Confirme la fin de mission": "Auftragsabschluss bestätigen",
    "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.":
      "Der Anbieter hat die Arbeit als beendet gemeldet. Prüfe den Service und bestätige anschließend.",
    "Verifier et confirmer": "Prüfen und bestätigen",
    "Suivre la mission": "Auftrag verfolgen",
    "Mission terminee": "Auftrag abgeschlossen",
    "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.":
      "Der Auftrag ist abgeschlossen. Prüfe das Ergebnis und hinterlasse bei Bedarf eine Bewertung.",
    "Voir la mission": "Auftrag ansehen",
    "Mission groupee terminee": "Gruppierter Auftrag abgeschlossen",
    "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.":
      "Alle Zeitfenster sind abgeschlossen. Eine KLYX-Bewertung gilt für den gesamten Auftrag.",
    "Donner mon avis": "Bewertung abgeben",
    "Une offre a ete acceptee": "Ein Angebot wurde angenommen",
    "Voir mes reservations": "Meine Buchungen ansehen",
    "Reservation groupee a confirmer": "Gruppenbuchung bestätigen",
    "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.":
      "Der Kunde hat dich für mehrere Zeitfenster ausgewählt. Bestätige die gesamte Gruppe.",
    "Traiter le groupe": "Gruppe bearbeiten",
    "Nouvelle reservation a traiter": "Neue Buchung bearbeiten",
    "Un client attend ta reponse. Accepte ou refuse la demande.":
      "Ein Kunde wartet auf deine Antwort. Nimm die Anfrage an oder lehne sie ab.",
    "Repondre maintenant": "Jetzt antworten",
    "Termine la mission dans KLYX": "Auftrag in KLYX abschließen",
    "La prestation est en cours. Quand le travail est fini, declare la mission terminee.":
      "Der Service läuft. Markiere den Auftrag als abgeschlossen, wenn die Arbeit fertig ist.",
    "Declarer la fin": "Als abgeschlossen markieren",
    "Ouvrir le suivi": "Nachverfolgung öffnen",
  },
};

export function resolveKlyxGroundedActionLocale(
  locale: KlyxLocale | string
): KlyxGroundedActionLocale {
  return KLYX_GROUNDED_ACTION_LOCALES.includes(
    locale as KlyxGroundedActionLocale
  )
    ? (locale as KlyxGroundedActionLocale)
    : "fr";
}

function localizeStaticCopy(
  locale: KlyxGroundedActionLocale,
  value: string
): string {
  return COPY[locale][value] ?? value;
}

function localizeDynamicTitle(
  locale: KlyxGroundedActionLocale,
  kind: string,
  value: string
): string {
  if (kind !== "compare_offers") {
    return localizeStaticCopy(locale, value);
  }

  const match = /^(\d+) offre(?:s)? a comparer$/.exec(value);

  if (!match) {
    return localizeStaticCopy(locale, value);
  }

  const count = Number(match[1]);

  if (locale === "en") {
    return `${count} ${count === 1 ? "offer" : "offers"} to compare`;
  }

  if (locale === "nl") {
    return `${count} ${count === 1 ? "offerte" : "offertes"} vergelijken`;
  }

  if (locale === "de") {
    return `${count} ${count === 1 ? "Angebot" : "Angebote"} vergleichen`;
  }

  return `${count} offre${count === 1 ? "" : "s"} à comparer`;
}

function localizeDynamicDescription(
  locale: KlyxGroundedActionLocale,
  kind: string,
  value: string
): string {
  if (kind === "provider_offer_update") {
    const match = /^Montant accepte : (.+) EUR\.$/.exec(value);

    if (match) {
      const amount = match[1];

      if (locale === "en") return `Accepted amount: ${amount} EUR.`;
      if (locale === "nl") return `Aanvaard bedrag: ${amount} EUR.`;
      if (locale === "de") return `Angenommener Betrag: ${amount} EUR.`;
      return `Montant accepté : ${amount} EUR.`;
    }
  }

  return localizeStaticCopy(locale, value);
}

export function localizeKlyxGroundedAction<T extends GroundedActionCopy>(
  action: T,
  locale: KlyxLocale | string
): T {
  const resolvedLocale = resolveKlyxGroundedActionLocale(locale);

  return {
    ...action,
    title: localizeDynamicTitle(resolvedLocale, action.kind, action.title),
    description: localizeDynamicDescription(
      resolvedLocale,
      action.kind,
      action.description
    ),
    label: localizeStaticCopy(resolvedLocale, action.label),
  };
}
