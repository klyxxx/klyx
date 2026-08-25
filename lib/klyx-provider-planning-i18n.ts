import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderPlanningLocale =
  (typeof KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_PLANNING_MESSAGE_KEYS = [
  "eyebrow",
  "title",
  "description",
  "refresh",
  "missionsAnalyzed",
  "attentionPoints",
  "priorityConflicts",
  "noAutomaticChanges",
  "noAppointments",
  "noAppointmentsDescription",
  "genericError",
] as const;

export type KlyxProviderPlanningMessageKey =
  (typeof KLYX_PROVIDER_PLANNING_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderPlanningMessageKey, string>;

type PlanningBooking = {
  id: string;
  startTime: string;
  endTime: string;
};

type PlanningWarning = {
  code: string;
  title: string;
  detail: string;
  bookingIds: string[];
};

type LocalizedWarning = {
  title: string;
  detail: string;
};

const DICTIONARIES: Record<KlyxProviderPlanningLocale, Dictionary> = {
  fr: {
    eyebrow: "Planning prestataire uniquement",
    title: "Planning intelligent",
    description:
      "KLYX analyse les trente prochains jours et signale les créneaux risqués sans déplacer ni annuler aucune mission.",
    refresh: "Actualiser l’analyse",
    missionsAnalyzed: "Missions analysées",
    attentionPoints: "Points d’attention",
    priorityConflicts: "Conflits prioritaires",
    noAutomaticChanges:
      "Aucune modification automatique : tu gardes le contrôle de toutes les réservations.",
    noAppointments: "Aucun rendez-vous prochain",
    noAppointmentsDescription: "Les futures missions apparaîtront ici.",
    genericError: "Impossible de charger le planning pour le moment.",
  },
  en: {
    eyebrow: "Provider planning only",
    title: "Smart planning",
    description:
      "KLYX analyzes the next thirty days and flags risky time slots without moving or cancelling any job.",
    refresh: "Refresh analysis",
    missionsAnalyzed: "Jobs analyzed",
    attentionPoints: "Attention points",
    priorityConflicts: "Priority conflicts",
    noAutomaticChanges:
      "No automatic changes: you stay in control of every booking.",
    noAppointments: "No upcoming appointments",
    noAppointmentsDescription: "Future jobs will appear here.",
    genericError: "KLYX cannot load provider planning right now.",
  },
  nl: {
    eyebrow: "Alleen planning voor dienstverleners",
    title: "Slimme planning",
    description:
      "KLYX analyseert de komende dertig dagen en signaleert risicovolle tijdsloten zonder opdrachten te verplaatsen of te annuleren.",
    refresh: "Analyse vernieuwen",
    missionsAnalyzed: "Geanalyseerde opdrachten",
    attentionPoints: "Aandachtspunten",
    priorityConflicts: "Prioritaire conflicten",
    noAutomaticChanges:
      "Geen automatische wijzigingen: jij houdt controle over alle boekingen.",
    noAppointments: "Geen komende afspraken",
    noAppointmentsDescription: "Toekomstige opdrachten verschijnen hier.",
    genericError: "KLYX kan de planning van de dienstverlener momenteel niet laden.",
  },
  de: {
    eyebrow: "Nur Anbieterplanung",
    title: "Intelligente Planung",
    description:
      "KLYX analysiert die nächsten dreißig Tage und markiert riskante Zeitfenster, ohne Aufträge zu verschieben oder zu stornieren.",
    refresh: "Analyse aktualisieren",
    missionsAnalyzed: "Analysierte Aufträge",
    attentionPoints: "Hinweise",
    priorityConflicts: "Prioritäre Konflikte",
    noAutomaticChanges:
      "Keine automatischen Änderungen: Du behältst die Kontrolle über alle Buchungen.",
    noAppointments: "Keine bevorstehenden Termine",
    noAppointmentsDescription: "Künftige Aufträge erscheinen hier.",
    genericError: "KLYX kann die Anbieterplanung derzeit nicht laden.",
  },
};

const STATUS_LABELS: Record<
  KlyxProviderPlanningLocale,
  Record<string, string>
> = {
  fr: {
    pending: "En attente",
    accepted: "Confirmée",
    completed: "Terminée",
  },
  en: {
    pending: "Pending",
    accepted: "Confirmed",
    completed: "Completed",
  },
  nl: {
    pending: "In afwachting",
    accepted: "Bevestigd",
    completed: "Voltooid",
  },
  de: {
    pending: "Ausstehend",
    accepted: "Bestätigt",
    completed: "Abgeschlossen",
  },
};

const INTL_LOCALES: Record<KlyxProviderPlanningLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const mins = Number(match[2]);

  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    return null;
  }

  return hours * 60 + mins;
}

function bookingById(
  bookings: PlanningBooking[],
  id: string | undefined
): PlanningBooking | null {
  if (!id) return null;
  return bookings.find((booking) => booking.id === id) ?? null;
}

function range(booking: PlanningBooking | null): string | null {
  if (!booking) return null;
  return `${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)}`;
}

export function resolveKlyxProviderPlanningLocale(
  locale: KlyxLocale | string
): KlyxProviderPlanningLocale {
  return KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES.includes(
    locale as KlyxProviderPlanningLocale
  )
    ? (locale as KlyxProviderPlanningLocale)
    : "fr";
}

export function getKlyxProviderPlanningDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxProviderPlanningLocale(locale)];
}

export function translateKlyxProviderPlanning(
  locale: KlyxLocale | string,
  key: KlyxProviderPlanningMessageKey
): string {
  return getKlyxProviderPlanningDictionary(locale)[key];
}

export function getKlyxProviderPlanningIntlLocale(
  locale: KlyxLocale | string
): string {
  return INTL_LOCALES[resolveKlyxProviderPlanningLocale(locale)];
}

export function translateKlyxProviderPlanningStatus(
  locale: KlyxLocale | string,
  status: string
): string {
  const resolved = resolveKlyxProviderPlanningLocale(locale);
  return STATUS_LABELS[resolved][status] ?? status;
}

export function formatKlyxProviderPlanningDuration(
  totalMinutes: number
): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function translateKlyxProviderPlanningWarning(
  locale: KlyxLocale | string,
  warning: PlanningWarning,
  bookings: PlanningBooking[],
  totalMinutes: number
): LocalizedWarning {
  const resolved = resolveKlyxProviderPlanningLocale(locale);
  const first = bookingById(bookings, warning.bookingIds[0]);
  const second = bookingById(bookings, warning.bookingIds[1]);
  const firstRange = range(first);
  const secondRange = range(second);

  if (warning.code === "outside_availability") {
    const noUsualAvailability =
      warning.title === "Aucune disponibilité habituelle";

    if (resolved === "en") {
      return noUsualAvailability
        ? {
            title: "No usual availability",
            detail: "A job is scheduled on a day that is normally disabled.",
          }
        : {
            title: "Job outside availability",
            detail: firstRange
              ? `${firstRange} does not match the usual working hours.`
              : "This job does not match the usual working hours.",
          };
    }

    if (resolved === "nl") {
      return noUsualAvailability
        ? {
            title: "Geen gebruikelijke beschikbaarheid",
            detail: "Er staat een opdracht gepland op een dag die normaal is uitgeschakeld.",
          }
        : {
            title: "Opdracht buiten beschikbaarheid",
            detail: firstRange
              ? `${firstRange} valt buiten de gebruikelijke werkuren.`
              : "Deze opdracht valt buiten de gebruikelijke werkuren.",
          };
    }

    if (resolved === "de") {
      return noUsualAvailability
        ? {
            title: "Keine übliche Verfügbarkeit",
            detail: "Ein Auftrag ist an einem normalerweise deaktivierten Tag geplant.",
          }
        : {
            title: "Auftrag außerhalb der Verfügbarkeit",
            detail: firstRange
              ? `${firstRange} liegt außerhalb der üblichen Arbeitszeiten.`
              : "Dieser Auftrag liegt außerhalb der üblichen Arbeitszeiten.",
          };
    }

    return noUsualAvailability
      ? {
          title: "Aucune disponibilité habituelle",
          detail: "Une mission est prévue un jour normalement désactivé.",
        }
      : {
          title: "Mission hors disponibilité",
          detail: firstRange
            ? `${firstRange} ne correspond pas aux horaires habituels.`
            : "Cette mission ne correspond pas aux horaires habituels.",
        };
  }

  if (warning.code === "overlap") {
    if (resolved === "en") {
      return {
        title: "Overlap detected",
        detail:
          firstRange && secondRange
            ? `${firstRange} overlaps ${secondRange}.`
            : "Two confirmed jobs overlap.",
      };
    }

    if (resolved === "nl") {
      return {
        title: "Overlap gedetecteerd",
        detail:
          firstRange && secondRange
            ? `${firstRange} overlapt met ${secondRange}.`
            : "Twee bevestigde opdrachten overlappen.",
      };
    }

    if (resolved === "de") {
      return {
        title: "Überschneidung erkannt",
        detail:
          firstRange && secondRange
            ? `${firstRange} überschneidet sich mit ${secondRange}.`
            : "Zwei bestätigte Aufträge überschneiden sich.",
      };
    }

    return {
      title: "Chevauchement détecté",
      detail:
        firstRange && secondRange
          ? `${firstRange} chevauche ${secondRange}.`
          : "Deux missions confirmées se chevauchent.",
    };
  }

  if (warning.code === "short_break") {
    const firstEnd = first ? minutes(first.endTime) : null;
    const secondStart = second ? minutes(second.startTime) : null;
    const breakMinutes =
      firstEnd !== null && secondStart !== null
        ? Math.max(0, secondStart - firstEnd)
        : null;

    if (resolved === "en") {
      return {
        title: "Very short break",
        detail:
          breakMinutes !== null
            ? `Only ${breakMinutes} minute(s) between two jobs. Allow time for travel.`
            : "Two confirmed jobs are less than 30 minutes apart. Allow time for travel.",
      };
    }

    if (resolved === "nl") {
      return {
        title: "Zeer korte pauze",
        detail:
          breakMinutes !== null
            ? `Slechts ${breakMinutes} minuut/minuten tussen twee opdrachten. Voorzie reistijd.`
            : "Twee bevestigde opdrachten liggen minder dan 30 minuten uit elkaar. Voorzie reistijd.",
      };
    }

    if (resolved === "de") {
      return {
        title: "Sehr kurze Pause",
        detail:
          breakMinutes !== null
            ? `Nur ${breakMinutes} Minute(n) zwischen zwei Aufträgen. Plane Fahrzeit ein.`
            : "Zwischen zwei bestätigten Aufträgen liegen weniger als 30 Minuten. Plane Fahrzeit ein.",
      };
    }

    return {
      title: "Pause très courte",
      detail:
        breakMinutes !== null
          ? `Seulement ${breakMinutes} minute(s) entre deux missions. Prévois le déplacement.`
          : "Deux missions confirmées sont séparées par moins de 30 minutes. Prévois le déplacement.",
    };
  }

  if (warning.code === "pending_near_confirmed") {
    if (resolved === "en") {
      return {
        title: "Request close to a confirmed job",
        detail: "Check travel time before accepting this request.",
      };
    }

    if (resolved === "nl") {
      return {
        title: "Aanvraag dicht bij een bevestigde opdracht",
        detail: "Controleer de reistijd voordat je deze aanvraag accepteert.",
      };
    }

    if (resolved === "de") {
      return {
        title: "Anfrage nahe an einem bestätigten Auftrag",
        detail: "Prüfe die Fahrzeit, bevor du diese Anfrage annimmst.",
      };
    }

    return {
      title: "Demande proche d’une mission confirmée",
      detail: "Vérifie le temps de déplacement avant d’accepter cette demande.",
    };
  }

  if (warning.code === "long_day") {
    const duration = formatKlyxProviderPlanningDuration(totalMinutes);

    if (resolved === "en") {
      return {
        title: "Very busy day",
        detail: `${duration} of confirmed jobs.`,
      };
    }

    if (resolved === "nl") {
      return {
        title: "Zeer drukke dag",
        detail: `${duration} aan bevestigde opdrachten.`,
      };
    }

    if (resolved === "de") {
      return {
        title: "Sehr voller Tag",
        detail: `${duration} bestätigte Aufträge.`,
      };
    }

    return {
      title: "Journée très chargée",
      detail: `${duration} de missions confirmées.`,
    };
  }

  return {
    title: warning.title,
    detail: warning.detail,
  };
}
