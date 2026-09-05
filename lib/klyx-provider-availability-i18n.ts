import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_AVAILABILITY_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderAvailabilityLocale =
  (typeof KLYX_PROVIDER_AVAILABILITY_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_AVAILABILITY_MESSAGE_KEYS = [
  "loading",
  "title",
  "description",
  "serviceMissing",
  "loadError",
  "saveError",
  "saved",
  "dayFallback",
  "start",
  "end",
  "saving",
  "save",
  "activeDaysOne",
  "activeDaysMany",
  "invalidTime",
] as const;

export type KlyxProviderAvailabilityMessageKey =
  (typeof KLYX_PROVIDER_AVAILABILITY_MESSAGE_KEYS)[number];

export const KLYX_PROVIDER_AVAILABILITY_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type KlyxProviderAvailabilityDayKey =
  (typeof KLYX_PROVIDER_AVAILABILITY_DAY_KEYS)[number];

type MessageDictionary = Record<KlyxProviderAvailabilityMessageKey, string>;
type DayDictionary = Record<KlyxProviderAvailabilityDayKey, string>;

const MESSAGES: Record<KlyxProviderAvailabilityLocale, MessageDictionary> = {
  fr: {
    loading: "Chargement des disponibilités...",
    title: "Disponibilités hebdomadaires",
    description:
      "Sélectionne les jours et les horaires pendant lesquels les clients peuvent te réserver.",
    serviceMissing: "Le service utilisateur est introuvable.",
    loadError: "Impossible de charger les disponibilités pour le moment.",
    saveError: "Impossible d’enregistrer les disponibilités pour le moment.",
    saved: "Disponibilités enregistrées.",
    dayFallback: "Un jour",
    start: "Début",
    end: "Fin",
    saving: "Enregistrement...",
    save: "Enregistrer les disponibilités",
    activeDaysOne: "{count} jour actif",
    activeDaysMany: "{count} jours actifs",
    invalidTime: "{day} : l’heure de fin doit être après l’heure de début.",
  },
  en: {
    loading: "Loading availability...",
    title: "Weekly availability",
    description: "Select the days and hours when clients can book you.",
    serviceMissing: "The provider service could not be found.",
    loadError: "Availability cannot be loaded right now.",
    saveError: "Availability cannot be saved right now.",
    saved: "Availability saved.",
    dayFallback: "A day",
    start: "Start",
    end: "End",
    saving: "Saving...",
    save: "Save availability",
    activeDaysOne: "{count} active day",
    activeDaysMany: "{count} active days",
    invalidTime: "{day}: the end time must be after the start time.",
  },
  nl: {
    loading: "Beschikbaarheid laden...",
    title: "Wekelijkse beschikbaarheid",
    description: "Selecteer de dagen en uren waarop klanten je kunnen boeken.",
    serviceMissing: "De dienst kon niet worden gevonden.",
    loadError: "Beschikbaarheid kan momenteel niet worden geladen.",
    saveError: "Beschikbaarheid kan momenteel niet worden opgeslagen.",
    saved: "Beschikbaarheid opgeslagen.",
    dayFallback: "Een dag",
    start: "Start",
    end: "Einde",
    saving: "Opslaan...",
    save: "Beschikbaarheid opslaan",
    activeDaysOne: "{count} actieve dag",
    activeDaysMany: "{count} actieve dagen",
    invalidTime: "{day}: de eindtijd moet na de begintijd liggen.",
  },
  de: {
    loading: "Verfügbarkeiten werden geladen...",
    title: "Wöchentliche Verfügbarkeit",
    description: "Wähle die Tage und Zeiten aus, zu denen Kunden dich buchen können.",
    serviceMissing: "Der Dienst konnte nicht gefunden werden.",
    loadError: "Verfügbarkeiten können derzeit nicht geladen werden.",
    saveError: "Verfügbarkeiten können derzeit nicht gespeichert werden.",
    saved: "Verfügbarkeiten gespeichert.",
    dayFallback: "Ein Tag",
    start: "Beginn",
    end: "Ende",
    saving: "Wird gespeichert...",
    save: "Verfügbarkeiten speichern",
    activeDaysOne: "{count} aktiver Tag",
    activeDaysMany: "{count} aktive Tage",
    invalidTime: "{day}: Die Endzeit muss nach der Startzeit liegen.",
  },
};

const DAYS: Record<KlyxProviderAvailabilityLocale, DayDictionary> = {
  fr: {
    monday: "Lundi",
    tuesday: "Mardi",
    wednesday: "Mercredi",
    thursday: "Jeudi",
    friday: "Vendredi",
    saturday: "Samedi",
    sunday: "Dimanche",
  },
  en: {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  },
  nl: {
    monday: "Maandag",
    tuesday: "Dinsdag",
    wednesday: "Woensdag",
    thursday: "Donderdag",
    friday: "Vrijdag",
    saturday: "Zaterdag",
    sunday: "Zondag",
  },
  de: {
    monday: "Montag",
    tuesday: "Dienstag",
    wednesday: "Mittwoch",
    thursday: "Donnerstag",
    friday: "Freitag",
    saturday: "Samstag",
    sunday: "Sonntag",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_PROVIDER_AVAILABILITY_TRANSLATED_LOCALES
);

export function resolveKlyxProviderAvailabilityLocale(
  locale: KlyxLocale
): KlyxProviderAvailabilityLocale {
  return LOCALE_SET.has(locale)
    ? (locale as KlyxProviderAvailabilityLocale)
    : "fr";
}

export function translateKlyxProviderAvailability(
  locale: KlyxLocale,
  key: KlyxProviderAvailabilityMessageKey
): string {
  return MESSAGES[resolveKlyxProviderAvailabilityLocale(locale)][key];
}

export function translateKlyxProviderAvailabilityDay(
  locale: KlyxLocale,
  key: KlyxProviderAvailabilityDayKey
): string {
  return DAYS[resolveKlyxProviderAvailabilityLocale(locale)][key];
}

export function formatKlyxProviderAvailabilityActiveDays(
  locale: KlyxLocale,
  count: number
): string {
  const key = count === 1 ? "activeDaysOne" : "activeDaysMany";

  return translateKlyxProviderAvailability(locale, key).replace(
    "{count}",
    String(count)
  );
}

export function formatKlyxProviderAvailabilityInvalidTime(
  locale: KlyxLocale,
  dayLabel: string
): string {
  return translateKlyxProviderAvailability(locale, "invalidTime").replace(
    "{day}",
    dayLabel
  );
}
