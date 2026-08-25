import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxRequestConfirmLocale =
  (typeof KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES)[number];

export const KLYX_REQUEST_CONFIRM_MESSAGE_KEYS = [
  "backToAssistant",
  "eyebrow",
  "title",
  "description",
  "service",
  "servicePlaceholder",
  "serviceFallback",
  "city",
  "cityPlaceholder",
  "date",
  "time",
  "budget",
  "optional",
  "toSpecify",
  "noMaximum",
  "noPaymentTitle",
  "noPaymentText",
  "continue",
  "loading",
  "pastInterpretedDate",
  "pastDate",
  "pastTodayTime",
] as const;

export type KlyxRequestConfirmMessageKey =
  (typeof KLYX_REQUEST_CONFIRM_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxRequestConfirmMessageKey, string>;

const DICTIONARIES: Record<KlyxRequestConfirmLocale, Dictionary> = {
  fr: {
    backToAssistant: "Revenir à l’assistant",
    eyebrow: "Vérification rapide",
    title: "Confirme ta demande",
    description: "Corrige seulement ce qui est nécessaire. KLYX bloque automatiquement les dates et heures déjà passées.",
    service: "Service",
    servicePlaceholder: "babysitting, cleaning...",
    serviceFallback: "Service à préciser",
    city: "Ville",
    cityPlaceholder: "Bruxelles",
    date: "Date",
    time: "Heure",
    budget: "Budget maximum",
    optional: "Facultatif",
    toSpecify: "À préciser",
    noMaximum: "Aucun maximum",
    noPaymentTitle: "Aucun paiement maintenant",
    noPaymentText: "Le paiement ne sera proposé qu’après l’acceptation réelle de la demande par le prestataire.",
    continue: "Afficher la sélection KLYX",
    loading: "Préparation de ta demande...",
    pastInterpretedDate: "La date comprise par KLYX était déjà passée. Choisis une nouvelle date.",
    pastDate: "Il est impossible de réserver une date passée.",
    pastTodayTime: "Pour aujourd’hui, choisis une heure qui n’est pas déjà passée.",
  },
  en: {
    backToAssistant: "Back to the assistant",
    eyebrow: "Quick check",
    title: "Confirm your request",
    description: "Only correct what is necessary. KLYX automatically blocks dates and times that have already passed.",
    service: "Service",
    servicePlaceholder: "babysitting, cleaning...",
    serviceFallback: "Service to specify",
    city: "City",
    cityPlaceholder: "Brussels",
    date: "Date",
    time: "Time",
    budget: "Maximum budget",
    optional: "Optional",
    toSpecify: "To specify",
    noMaximum: "No maximum",
    noPaymentTitle: "No payment now",
    noPaymentText: "Payment will only be offered after the provider actually accepts the request.",
    continue: "Show KLYX selection",
    loading: "Preparing your request...",
    pastInterpretedDate: "The date understood by KLYX had already passed. Choose a new date.",
    pastDate: "A past date cannot be booked.",
    pastTodayTime: "For today, choose a time that has not already passed.",
  },
  nl: {
    backToAssistant: "Terug naar de assistent",
    eyebrow: "Snelle controle",
    title: "Bevestig je aanvraag",
    description: "Pas alleen aan wat nodig is. KLYX blokkeert automatisch datums en tijden die al voorbij zijn.",
    service: "Dienst",
    servicePlaceholder: "babysitting, cleaning...",
    serviceFallback: "Dienst te bepalen",
    city: "Stad",
    cityPlaceholder: "Brussel",
    date: "Datum",
    time: "Tijd",
    budget: "Maximumbudget",
    optional: "Optioneel",
    toSpecify: "Te bepalen",
    noMaximum: "Geen maximum",
    noPaymentTitle: "Nu geen betaling",
    noPaymentText: "Betaling wordt pas aangeboden nadat de dienstverlener de aanvraag daadwerkelijk heeft aanvaard.",
    continue: "KLYX-selectie tonen",
    loading: "Je aanvraag voorbereiden...",
    pastInterpretedDate: "De datum die KLYX begreep was al voorbij. Kies een nieuwe datum.",
    pastDate: "Een datum in het verleden kan niet worden geboekt.",
    pastTodayTime: "Kies voor vandaag een tijd die nog niet voorbij is.",
  },
  de: {
    backToAssistant: "Zurück zum Assistenten",
    eyebrow: "Schnelle Prüfung",
    title: "Anfrage bestätigen",
    description: "Ändere nur, was nötig ist. KLYX blockiert automatisch bereits vergangene Daten und Uhrzeiten.",
    service: "Dienstleistung",
    servicePlaceholder: "babysitting, cleaning...",
    serviceFallback: "Dienstleistung angeben",
    city: "Stadt",
    cityPlaceholder: "Brüssel",
    date: "Datum",
    time: "Uhrzeit",
    budget: "Maximalbudget",
    optional: "Optional",
    toSpecify: "Anzugeben",
    noMaximum: "Kein Maximum",
    noPaymentTitle: "Jetzt keine Zahlung",
    noPaymentText: "Eine Zahlung wird erst angeboten, nachdem der Anbieter die Anfrage tatsächlich angenommen hat.",
    continue: "KLYX-Auswahl anzeigen",
    loading: "Anfrage wird vorbereitet...",
    pastInterpretedDate: "Das von KLYX verstandene Datum lag bereits in der Vergangenheit. Wähle ein neues Datum.",
    pastDate: "Ein vergangenes Datum kann nicht gebucht werden.",
    pastTodayTime: "Wähle für heute eine Uhrzeit, die noch nicht vergangen ist.",
  },
};

const SERVICE_LABELS: Record<KlyxRequestConfirmLocale, Record<string, string>> = {
  fr: { babysitting: "Baby-sitting", cleaning: "Ménage", moving: "Déménagement", handyman: "Bricolage" },
  en: { babysitting: "Babysitting", cleaning: "Cleaning", moving: "Moving", handyman: "Handyman" },
  nl: { babysitting: "Babysitten", cleaning: "Schoonmaak", moving: "Verhuizen", handyman: "Klusjes" },
  de: { babysitting: "Babysitting", cleaning: "Reinigung", moving: "Umzug", handyman: "Handwerker" },
};

export function resolveKlyxRequestConfirmLocale(
  locale: KlyxLocale | string
): KlyxRequestConfirmLocale {
  return KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES.includes(
    locale as KlyxRequestConfirmLocale
  )
    ? (locale as KlyxRequestConfirmLocale)
    : "fr";
}

export function getKlyxRequestConfirmDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxRequestConfirmLocale(locale)];
}

export function translateKlyxRequestConfirm(
  locale: KlyxLocale | string,
  key: KlyxRequestConfirmMessageKey
): string {
  return getKlyxRequestConfirmDictionary(locale)[key];
}

export function formatKlyxRequestConfirmService(
  locale: KlyxLocale | string,
  service: string
): string {
  const normalized = service.trim();
  if (!normalized) return translateKlyxRequestConfirm(locale, "serviceFallback");
  return (
    SERVICE_LABELS[resolveKlyxRequestConfirmLocale(locale)][normalized] ?? normalized
  );
}
