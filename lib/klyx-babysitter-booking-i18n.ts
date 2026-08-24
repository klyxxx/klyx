import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_BABYSITTER_BOOKING_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxBabysitterBookingLocale = (typeof KLYX_BABYSITTER_BOOKING_TRANSLATED_LOCALES)[number];

export const KLYX_BABYSITTER_BOOKING_MESSAGE_KEYS = [
  "loading",
  "unavailable",
  "title",
  "cityMissing",
  "weeklyAvailability",
  "noAvailability",
  "date",
  "startTime",
  "endTime",
  "children",
  "message",
  "messagePlaceholder",
  "sending",
  "sendRequest",
  "success",
  "loadError",
  "missingDateTime",
  "endBeforeStart",
  "dayUnavailable",
  "outsideAvailability",
  "childrenInvalid",
  "actionError",
] as const;

export type KlyxBabysitterBookingMessageKey =
  (typeof KLYX_BABYSITTER_BOOKING_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxBabysitterBookingMessageKey, string>;

const MESSAGES: Record<KlyxBabysitterBookingLocale, Dictionary> = {
  fr: {
    loading: "Chargement...",
    unavailable: "Baby-sitter introuvable ou indisponible.",
    title: "Réserver une baby-sitter",
    cityMissing: "Ville non renseignée",
    weeklyAvailability: "Disponibilités hebdomadaires",
    noAvailability: "Aucune disponibilité renseignée.",
    date: "Date",
    startTime: "Heure de début",
    endTime: "Heure de fin",
    children: "Nombre d'enfants",
    message: "Message",
    messagePlaceholder: "Précise tes besoins.",
    sending: "Envoi...",
    sendRequest: "Envoyer la demande",
    success: "Demande envoyée.",
    loadError: "Impossible de charger la baby-sitter.",
    missingDateTime: "Complète la date et les heures.",
    endBeforeStart: "L'heure de fin doit être après l'heure de début.",
    dayUnavailable: "La baby-sitter n'est pas disponible ce jour-là.",
    outsideAvailability: "Les heures choisies sont en dehors des disponibilités.",
    childrenInvalid: "Le nombre d'enfants doit être au minimum 1.",
    actionError: "Impossible d'envoyer la demande.",
  },
  en: {
    loading: "Loading...",
    unavailable: "Babysitter not found or unavailable.",
    title: "Book a babysitter",
    cityMissing: "City not provided",
    weeklyAvailability: "Weekly availability",
    noAvailability: "No availability provided.",
    date: "Date",
    startTime: "Start time",
    endTime: "End time",
    children: "Number of children",
    message: "Message",
    messagePlaceholder: "Describe your needs.",
    sending: "Sending...",
    sendRequest: "Send request",
    success: "Request sent.",
    loadError: "Unable to load the babysitter.",
    missingDateTime: "Complete the date and times.",
    endBeforeStart: "The end time must be after the start time.",
    dayUnavailable: "The babysitter is not available that day.",
    outsideAvailability: "The selected times are outside the available hours.",
    childrenInvalid: "The number of children must be at least 1.",
    actionError: "Unable to send the request.",
  },
  nl: {
    loading: "Laden...",
    unavailable: "Babysitter niet gevonden of niet beschikbaar.",
    title: "Een babysitter boeken",
    cityMissing: "Stad niet opgegeven",
    weeklyAvailability: "Wekelijkse beschikbaarheid",
    noAvailability: "Geen beschikbaarheid opgegeven.",
    date: "Datum",
    startTime: "Starttijd",
    endTime: "Eindtijd",
    children: "Aantal kinderen",
    message: "Bericht",
    messagePlaceholder: "Beschrijf je behoeften.",
    sending: "Verzenden...",
    sendRequest: "Aanvraag verzenden",
    success: "Aanvraag verzonden.",
    loadError: "Kan de babysitter niet laden.",
    missingDateTime: "Vul de datum en tijden in.",
    endBeforeStart: "De eindtijd moet na de starttijd liggen.",
    dayUnavailable: "De babysitter is die dag niet beschikbaar.",
    outsideAvailability: "De gekozen tijden vallen buiten de beschikbaarheid.",
    childrenInvalid: "Het aantal kinderen moet minstens 1 zijn.",
    actionError: "Kan de aanvraag niet verzenden.",
  },
  de: {
    loading: "Wird geladen...",
    unavailable: "Babysitter nicht gefunden oder nicht verfügbar.",
    title: "Babysitter buchen",
    cityMissing: "Stadt nicht angegeben",
    weeklyAvailability: "Wöchentliche Verfügbarkeit",
    noAvailability: "Keine Verfügbarkeit angegeben.",
    date: "Datum",
    startTime: "Startzeit",
    endTime: "Endzeit",
    children: "Anzahl der Kinder",
    message: "Nachricht",
    messagePlaceholder: "Beschreibe deinen Bedarf.",
    sending: "Wird gesendet...",
    sendRequest: "Anfrage senden",
    success: "Anfrage gesendet.",
    loadError: "Babysitter konnte nicht geladen werden.",
    missingDateTime: "Vervollständige Datum und Uhrzeiten.",
    endBeforeStart: "Die Endzeit muss nach der Startzeit liegen.",
    dayUnavailable: "Der Babysitter ist an diesem Tag nicht verfügbar.",
    outsideAvailability: "Die gewählten Zeiten liegen außerhalb der Verfügbarkeit.",
    childrenInvalid: "Die Anzahl der Kinder muss mindestens 1 sein.",
    actionError: "Die Anfrage konnte nicht gesendet werden.",
  },
};

const DAYS: Record<KlyxBabysitterBookingLocale, string[]> = {
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  nl: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
};

const LOCALE_SET = new Set<string>(KLYX_BABYSITTER_BOOKING_TRANSLATED_LOCALES);

export function resolveKlyxBabysitterBookingLocale(locale: KlyxLocale): KlyxBabysitterBookingLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxBabysitterBookingLocale) : "fr";
}

export function getKlyxBabysitterBookingDictionary(locale: KlyxLocale): Dictionary {
  return MESSAGES[resolveKlyxBabysitterBookingLocale(locale)];
}

export function translateKlyxBabysitterBooking(
  locale: KlyxLocale,
  key: KlyxBabysitterBookingMessageKey
): string {
  return getKlyxBabysitterBookingDictionary(locale)[key];
}

export function getKlyxBabysitterBookingDayLabel(locale: KlyxLocale, dayOfWeek: number): string {
  return DAYS[resolveKlyxBabysitterBookingLocale(locale)][dayOfWeek] ?? String(dayOfWeek);
}

export function formatKlyxBabysitterBookingAvailability(
  locale: KlyxLocale,
  dayOfWeek: number,
  slots: Array<{ start_time: string; end_time: string }>
): string {
  const day = getKlyxBabysitterBookingDayLabel(locale, dayOfWeek);
  const hours = slots
    .map((slot) => `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`)
    .join(", ");

  const resolved = resolveKlyxBabysitterBookingLocale(locale);
  if (resolved === "en") return `Available on ${day}: ${hours}`;
  if (resolved === "nl") return `Beschikbaar op ${day}: ${hours}`;
  if (resolved === "de") return `Verfügbar am ${day}: ${hours}`;
  return `Disponible le ${day} : ${hours}`;
}

export function formatKlyxBabysitterBookingUnavailableDay(
  locale: KlyxLocale,
  dayOfWeek: number
): string {
  const day = getKlyxBabysitterBookingDayLabel(locale, dayOfWeek);
  const resolved = resolveKlyxBabysitterBookingLocale(locale);
  if (resolved === "en") return `Unavailable on ${day}`;
  if (resolved === "nl") return `Niet beschikbaar op ${day}`;
  if (resolved === "de") return `Nicht verfügbar am ${day}`;
  return `Indisponible le ${day}`;
}

export function formatKlyxBabysitterBookingHourlyPrice(locale: KlyxLocale, price: number): string {
  const resolved = resolveKlyxBabysitterBookingLocale(locale);
  const suffix = resolved === "en" ? "€/hour" : resolved === "nl" ? "€/uur" : resolved === "de" ? "€/Stunde" : "€/heure";
  return `${price.toFixed(2)} ${suffix}`;
}
