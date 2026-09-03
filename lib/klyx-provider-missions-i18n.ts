export type KlyxProviderMissionsMessageKey =
  | "description"
  | "confirmed"
  | "opportunities"
  | "actionRequired"
  | "missionAccepted"
  | "missionUpcoming"
  | "missionHistory"
  | "viewMission"
  | "client"
  | "amount"
  | "schedule"
  | "payment"
  | "paid"
  | "paymentPending"
  | "noConfirmed"
  | "noOpportunities"
  | "lifecycleNote";

type Dictionary = Record<KlyxProviderMissionsMessageKey, string>;

const DICTIONARIES: Record<"fr" | "en" | "nl" | "de", Dictionary> = {
  fr: {
    description:
      "Opportunités, missions acceptées, réalisation et paiement : KLYX rassemble le parcours prestataire au même endroit.",
    confirmed: "Missions confirmées",
    opportunities: "Opportunités",
    actionRequired: "Action requise",
    missionAccepted: "Mission à confirmer",
    missionUpcoming: "Mission à réaliser",
    missionHistory: "Mission terminée",
    viewMission: "Ouvrir la mission",
    client: "Client",
    amount: "Montant",
    schedule: "Horaire",
    payment: "Paiement",
    paid: "Payé",
    paymentPending: "En attente",
    noConfirmed: "Aucune mission confirmée pour le moment.",
    noOpportunities: "Aucune opportunité compatible pour le moment.",
    lifecycleNote:
      "KLYX met la prochaine action en premier. Offre, acceptation, réalisation et paiement restent des étapes distinctes.",
  },
  en: {
    description:
      "Opportunities, accepted jobs, delivery and payment: KLYX keeps the provider journey in one place.",
    confirmed: "Confirmed jobs",
    opportunities: "Opportunities",
    actionRequired: "Action required",
    missionAccepted: "Job to confirm",
    missionUpcoming: "Job to complete",
    missionHistory: "Completed job",
    viewMission: "Open job",
    client: "Client",
    amount: "Amount",
    schedule: "Schedule",
    payment: "Payment",
    paid: "Paid",
    paymentPending: "Pending",
    noConfirmed: "No confirmed jobs yet.",
    noOpportunities: "No compatible opportunities right now.",
    lifecycleNote:
      "KLYX puts the next action first. Offer, acceptance, delivery and payment remain separate steps.",
  },
  nl: {
    description:
      "Opportuniteiten, aanvaarde opdrachten, uitvoering en betaling: KLYX bundelt het traject van de dienstverlener op één plek.",
    confirmed: "Bevestigde opdrachten",
    opportunities: "Opportuniteiten",
    actionRequired: "Actie vereist",
    missionAccepted: "Opdracht te bevestigen",
    missionUpcoming: "Opdracht uit te voeren",
    missionHistory: "Afgeronde opdracht",
    viewMission: "Opdracht openen",
    client: "Klant",
    amount: "Bedrag",
    schedule: "Uurrooster",
    payment: "Betaling",
    paid: "Betaald",
    paymentPending: "In afwachting",
    noConfirmed: "Nog geen bevestigde opdrachten.",
    noOpportunities: "Momenteel geen passende opportuniteiten.",
    lifecycleNote:
      "KLYX zet de volgende actie bovenaan. Aanbod, aanvaarding, uitvoering en betaling blijven afzonderlijke stappen.",
  },
  de: {
    description:
      "Chancen, angenommene Aufträge, Durchführung und Zahlung: KLYX bündelt den Anbieterablauf an einem Ort.",
    confirmed: "Bestätigte Aufträge",
    opportunities: "Chancen",
    actionRequired: "Aktion erforderlich",
    missionAccepted: "Auftrag zu bestätigen",
    missionUpcoming: "Auftrag auszuführen",
    missionHistory: "Abgeschlossener Auftrag",
    viewMission: "Auftrag öffnen",
    client: "Kunde",
    amount: "Betrag",
    schedule: "Zeitplan",
    payment: "Zahlung",
    paid: "Bezahlt",
    paymentPending: "Ausstehend",
    noConfirmed: "Noch keine bestätigten Aufträge.",
    noOpportunities: "Derzeit keine passenden Chancen.",
    lifecycleNote:
      "KLYX zeigt die nächste Aktion zuerst. Angebot, Annahme, Durchführung und Zahlung bleiben getrennte Schritte.",
  },
};

function normalizeLocale(locale: string): "fr" | "en" | "nl" | "de" {
  const normalized = locale.toLowerCase().slice(0, 2);
  if (normalized === "fr" || normalized === "nl" || normalized === "de") {
    return normalized;
  }
  return "en";
}

export function translateKlyxProviderMissions(
  locale: string,
  key: KlyxProviderMissionsMessageKey
): string {
  return DICTIONARIES[normalizeLocale(locale)][key];
}
