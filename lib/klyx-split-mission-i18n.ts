export const KLYX_SPLIT_MISSION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionLocale =
  (typeof KLYX_SPLIT_MISSION_TRANSLATED_LOCALES)[number];

export type KlyxSplitMissionState =
  | "creating"
  | "recovery_required"
  | "awaiting_providers"
  | "partially_accepted"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "mixed_issue";

export const KLYX_SPLIT_MISSION_MESSAGE_KEYS = [
  "sectionEyebrow",
  "sectionTitle",
  "datePending",
  "providers",
  "period",
  "dangerNotice",
  "completedNotice",
  "viewMission",
  "paymentNotice",
  "statusCreating",
  "statusRecoveryRequired",
  "statusAwaitingProviders",
  "statusPartiallyAccepted",
  "statusConfirmed",
  "statusInProgress",
  "statusCompleted",
  "statusCancelled",
  "statusMixedIssue",
  "detailBackToBookings",
  "detailRefresh",
  "detailEyebrow",
  "detailIntro",
  "detailTimeline",
  "detailDate",
  "detailSchedule",
  "detailOpenBooking",
  "detailUnifiedTitle",
  "detailUnifiedDescription",
  "detailNoPayment",
  "detailSessionMissing",
  "detailUnavailable",
  "detailLoadFailed",
  "bookingStatusPending",
  "bookingStatusAccepted",
  "bookingStatusConfirmed",
  "bookingStatusRejected",
  "bookingStatusCancelled",
  "bookingStatusCompleted",
  "bookingStatusMissing",
  "bookingStatusUnknown",
] as const;

export type KlyxSplitMissionMessageKey =
  (typeof KLYX_SPLIT_MISSION_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSplitMissionMessageKey, string>;

const dictionaries: Record<KlyxSplitMissionLocale, Dictionary> = {
  fr: {
    sectionEyebrow: "Missions KLYX",
    sectionTitle: "Missions multi-prestataires",
    datePending: "Date à confirmer",
    providers: "Prestataires",
    period: "Période",
    dangerNotice: "KLYX a détecté une mission qui nécessite une vérification.",
    completedNotice: "Tous les créneaux sont terminés.",
    viewMission: "Voir la mission complète",
    paymentNotice:
      "Les réservations individuelles restent accessibles dans le détail de la mission. Aucun paiement supplémentaire n’est déclenché ici.",
    statusCreating: "Création en cours",
    statusRecoveryRequired: "Vérification requise",
    statusAwaitingProviders: "En attente des prestataires",
    statusPartiallyAccepted: "Acceptation partielle",
    statusConfirmed: "Confirmée",
    statusInProgress: "En cours",
    statusCompleted: "Terminée",
    statusCancelled: "Annulée",
    statusMixedIssue: "Action requise",
    detailBackToBookings: "Mes réservations",
    detailRefresh: "Actualiser",
    detailEyebrow: "Mission multi-prestataires KLYX",
    detailIntro:
      "Cette mission regroupe toutes les réservations créées à partir du même plan confirmé.",
    detailTimeline: "Déroulement de la mission",
    detailDate: "Date",
    detailSchedule: "Horaire",
    detailOpenBooking: "Ouvrir cette réservation",
    detailUnifiedTitle: "Une seule mission côté client",
    detailUnifiedDescription:
      "Les créneaux restent des réservations techniques distinctes pour permettre à chaque prestataire de gérer sa partie. Cette page les réunit en une seule expérience client.",
    detailNoPayment: "Aucun paiement n'est créé depuis cette page.",
    detailSessionMissing: "Session KLYX manquante.",
    detailUnavailable: "Mission indisponible.",
    detailLoadFailed: "Impossible de charger la mission.",
    bookingStatusPending: "En attente",
    bookingStatusAccepted: "Acceptée",
    bookingStatusConfirmed: "Confirmée",
    bookingStatusRejected: "Refusée",
    bookingStatusCancelled: "Annulée",
    bookingStatusCompleted: "Terminée",
    bookingStatusMissing: "Réservation manquante",
    bookingStatusUnknown: "Statut inconnu",
  },
  en: {
    sectionEyebrow: "KLYX missions",
    sectionTitle: "Multi-provider missions",
    datePending: "Date to be confirmed",
    providers: "Providers",
    period: "Period",
    dangerNotice: "KLYX detected a mission that requires review.",
    completedNotice: "All time slots are complete.",
    viewMission: "View full mission",
    paymentNotice:
      "Individual bookings remain available in the mission details. No additional payment is triggered here.",
    statusCreating: "Creating",
    statusRecoveryRequired: "Review required",
    statusAwaitingProviders: "Waiting for providers",
    statusPartiallyAccepted: "Partially accepted",
    statusConfirmed: "Confirmed",
    statusInProgress: "In progress",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    statusMixedIssue: "Action required",
    detailBackToBookings: "My bookings",
    detailRefresh: "Refresh",
    detailEyebrow: "KLYX multi-provider mission",
    detailIntro:
      "This mission brings together every booking created from the same confirmed plan.",
    detailTimeline: "Mission timeline",
    detailDate: "Date",
    detailSchedule: "Time",
    detailOpenBooking: "Open this booking",
    detailUnifiedTitle: "One client-side mission",
    detailUnifiedDescription:
      "Time slots remain separate technical bookings so each provider can manage their part. This page brings them together into one client experience.",
    detailNoPayment: "No payment is created from this page.",
    detailSessionMissing: "KLYX session missing.",
    detailUnavailable: "Mission unavailable.",
    detailLoadFailed: "Unable to load the mission.",
    bookingStatusPending: "Pending",
    bookingStatusAccepted: "Accepted",
    bookingStatusConfirmed: "Confirmed",
    bookingStatusRejected: "Rejected",
    bookingStatusCancelled: "Cancelled",
    bookingStatusCompleted: "Completed",
    bookingStatusMissing: "Booking missing",
    bookingStatusUnknown: "Unknown status",
  },
  nl: {
    sectionEyebrow: "KLYX-missies",
    sectionTitle: "Missies met meerdere dienstverleners",
    datePending: "Datum nog te bevestigen",
    providers: "Dienstverleners",
    period: "Periode",
    dangerNotice: "KLYX heeft een missie gedetecteerd die controle vereist.",
    completedNotice: "Alle tijdsloten zijn voltooid.",
    viewMission: "Volledige missie bekijken",
    paymentNotice:
      "Individuele boekingen blijven beschikbaar in de missiedetails. Hier wordt geen extra betaling gestart.",
    statusCreating: "Wordt aangemaakt",
    statusRecoveryRequired: "Controle vereist",
    statusAwaitingProviders: "Wachten op dienstverleners",
    statusPartiallyAccepted: "Gedeeltelijk geaccepteerd",
    statusConfirmed: "Bevestigd",
    statusInProgress: "Bezig",
    statusCompleted: "Voltooid",
    statusCancelled: "Geannuleerd",
    statusMixedIssue: "Actie vereist",
    detailBackToBookings: "Mijn boekingen",
    detailRefresh: "Vernieuwen",
    detailEyebrow: "KLYX-missie met meerdere dienstverleners",
    detailIntro:
      "Deze missie bundelt alle boekingen die vanuit hetzelfde bevestigde plan zijn aangemaakt.",
    detailTimeline: "Verloop van de missie",
    detailDate: "Datum",
    detailSchedule: "Tijd",
    detailOpenBooking: "Deze boeking openen",
    detailUnifiedTitle: "Eén missie voor de klant",
    detailUnifiedDescription:
      "Tijdsloten blijven technisch aparte boekingen zodat elke dienstverlener zijn deel kan beheren. Deze pagina bundelt ze tot één klantervaring.",
    detailNoPayment: "Vanaf deze pagina wordt geen betaling aangemaakt.",
    detailSessionMissing: "KLYX-sessie ontbreekt.",
    detailUnavailable: "Missie niet beschikbaar.",
    detailLoadFailed: "De missie kan niet worden geladen.",
    bookingStatusPending: "In afwachting",
    bookingStatusAccepted: "Geaccepteerd",
    bookingStatusConfirmed: "Bevestigd",
    bookingStatusRejected: "Geweigerd",
    bookingStatusCancelled: "Geannuleerd",
    bookingStatusCompleted: "Voltooid",
    bookingStatusMissing: "Boeking ontbreekt",
    bookingStatusUnknown: "Onbekende status",
  },
  de: {
    sectionEyebrow: "KLYX-Aufträge",
    sectionTitle: "Aufträge mit mehreren Anbietern",
    datePending: "Datum noch zu bestätigen",
    providers: "Anbieter",
    period: "Zeitraum",
    dangerNotice: "KLYX hat einen Auftrag erkannt, der geprüft werden muss.",
    completedNotice: "Alle Zeitfenster sind abgeschlossen.",
    viewMission: "Gesamten Auftrag ansehen",
    paymentNotice:
      "Einzelne Buchungen bleiben in den Auftragsdetails verfügbar. Hier wird keine zusätzliche Zahlung ausgelöst.",
    statusCreating: "Wird erstellt",
    statusRecoveryRequired: "Prüfung erforderlich",
    statusAwaitingProviders: "Warten auf Anbieter",
    statusPartiallyAccepted: "Teilweise angenommen",
    statusConfirmed: "Bestätigt",
    statusInProgress: "In Bearbeitung",
    statusCompleted: "Abgeschlossen",
    statusCancelled: "Storniert",
    statusMixedIssue: "Aktion erforderlich",
    detailBackToBookings: "Meine Buchungen",
    detailRefresh: "Aktualisieren",
    detailEyebrow: "KLYX-Auftrag mit mehreren Anbietern",
    detailIntro:
      "Dieser Auftrag bündelt alle Buchungen, die aus demselben bestätigten Plan erstellt wurden.",
    detailTimeline: "Ablauf des Auftrags",
    detailDate: "Datum",
    detailSchedule: "Uhrzeit",
    detailOpenBooking: "Diese Buchung öffnen",
    detailUnifiedTitle: "Ein Auftrag für den Kunden",
    detailUnifiedDescription:
      "Die Zeitfenster bleiben technisch getrennte Buchungen, damit jeder Anbieter seinen Teil verwalten kann. Diese Seite bündelt sie zu einem Kundenerlebnis.",
    detailNoPayment: "Auf dieser Seite wird keine Zahlung erstellt.",
    detailSessionMissing: "KLYX-Sitzung fehlt.",
    detailUnavailable: "Auftrag nicht verfügbar.",
    detailLoadFailed: "Der Auftrag konnte nicht geladen werden.",
    bookingStatusPending: "Ausstehend",
    bookingStatusAccepted: "Angenommen",
    bookingStatusConfirmed: "Bestätigt",
    bookingStatusRejected: "Abgelehnt",
    bookingStatusCancelled: "Storniert",
    bookingStatusCompleted: "Abgeschlossen",
    bookingStatusMissing: "Buchung fehlt",
    bookingStatusUnknown: "Unbekannter Status",
  },
};

const INTL_LOCALES: Record<KlyxSplitMissionLocale, string> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-BE",
};

const STATUS_KEYS: Record<KlyxSplitMissionState, KlyxSplitMissionMessageKey> = {
  creating: "statusCreating",
  recovery_required: "statusRecoveryRequired",
  awaiting_providers: "statusAwaitingProviders",
  partially_accepted: "statusPartiallyAccepted",
  confirmed: "statusConfirmed",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  mixed_issue: "statusMixedIssue",
};

const BOOKING_STATUS_KEYS: Record<string, KlyxSplitMissionMessageKey> = {
  pending: "bookingStatusPending",
  accepted: "bookingStatusAccepted",
  confirmed: "bookingStatusConfirmed",
  rejected: "bookingStatusRejected",
  cancelled: "bookingStatusCancelled",
  completed: "bookingStatusCompleted",
  missing: "bookingStatusMissing",
  unknown: "bookingStatusUnknown",
};

const SERVICE_SLUG_ALIASES: Record<
  string,
  "babysitting" | "cleaning" | "moving" | "handyman"
> = {
  babysitting: "babysitting",
  "baby-sitting": "babysitting",
  cleaning: "cleaning",
  "menage-a-domicile": "cleaning",
  moving: "moving",
  demenagement: "moving",
  handyman: "handyman",
  bricolage: "handyman",
};

const SERVICE_LABELS: Record<
  KlyxSplitMissionLocale,
  Record<"babysitting" | "cleaning" | "moving" | "handyman", string>
> = {
  fr: {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  },
  en: {
    babysitting: "Babysitting",
    cleaning: "Cleaning",
    moving: "Moving",
    handyman: "Handyman",
  },
  nl: {
    babysitting: "Babysitting",
    cleaning: "Schoonmaak",
    moving: "Verhuizing",
    handyman: "Kluswerk",
  },
  de: {
    babysitting: "Babysitting",
    cleaning: "Reinigung",
    moving: "Umzug",
    handyman: "Handwerksservice",
  },
};

export function resolveKlyxSplitMissionLocale(
  locale: string
): KlyxSplitMissionLocale {
  return KLYX_SPLIT_MISSION_TRANSLATED_LOCALES.includes(
    locale as KlyxSplitMissionLocale
  )
    ? (locale as KlyxSplitMissionLocale)
    : "fr";
}

export function translateKlyxSplitMission(
  locale: string,
  key: KlyxSplitMissionMessageKey
): string {
  return dictionaries[resolveKlyxSplitMissionLocale(locale)][key];
}

export function formatKlyxSplitMissionDate(
  locale: string,
  value: string | null
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  if (!value) {
    return dictionaries[resolved].datePending;
  }

  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export function formatKlyxSplitMissionDetailDate(
  locale: string,
  value: string
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export function formatKlyxSplitMissionStatus(
  locale: string,
  status: KlyxSplitMissionState
): string {
  return translateKlyxSplitMission(locale, STATUS_KEYS[status]);
}

export function formatKlyxSplitBookingStatus(
  locale: string,
  status: string
): string {
  const normalized = status.trim().toLowerCase();
  const key = BOOKING_STATUS_KEYS[normalized];

  return key
    ? translateKlyxSplitMission(locale, key)
    : status.trim() || translateKlyxSplitMission(locale, "bookingStatusUnknown");
}

export function formatKlyxSplitMissionService(
  locale: string,
  slug: string | null,
  fallback: string
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);
  const normalized = slug?.trim().toLowerCase() ?? "";
  const canonical = normalized ? SERVICE_SLUG_ALIASES[normalized] : undefined;

  if (canonical) {
    return SERVICE_LABELS[resolved][canonical];
  }

  const label = fallback.trim();
  if (label) {
    return label;
  }

  return normalized
    ? normalized
        .replace(/[-_]+/g, " ")
        .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    : "KLYX";
}

export function formatKlyxSplitMissionSlotCount(
  locale: string,
  count: number
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  if (resolved === "en") {
    return `${count} ${count === 1 ? "time slot" : "time slots"}`;
  }

  if (resolved === "nl") {
    return `${count} ${count === 1 ? "tijdslot" : "tijdsloten"}`;
  }

  if (resolved === "de") {
    return `${count} Zeitfenster`;
  }

  return `${count} ${count === 1 ? "créneau" : "créneaux"}`;
}

export function formatKlyxSplitMissionProviderCount(
  locale: string,
  count: number
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  if (resolved === "en") {
    return `${count} ${count === 1 ? "provider" : "providers"}`;
  }

  if (resolved === "nl") {
    return `${count} ${count === 1 ? "dienstverlener" : "dienstverleners"}`;
  }

  if (resolved === "de") {
    return `${count} ${count === 1 ? "Anbieter" : "Anbieter"}`;
  }

  return `${count} ${count === 1 ? "prestataire" : "prestataires"}`;
}

export function formatKlyxSplitMissionSlotPosition(
  locale: string,
  position: number
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  if (resolved === "en") {
    return `Time slot ${position}`;
  }

  if (resolved === "nl") {
    return `Tijdslot ${position}`;
  }

  if (resolved === "de") {
    return `Zeitfenster ${position}`;
  }

  return `Créneau ${position}`;
}

export function formatKlyxSplitMissionSummary(
  locale: string,
  count: number
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);
  const slots = formatKlyxSplitMissionSlotCount(resolved, count);

  if (resolved === "en") {
    return `One mission · ${slots}`;
  }

  if (resolved === "nl") {
    return `Eén missie · ${slots}`;
  }

  if (resolved === "de") {
    return `Ein Auftrag · ${slots}`;
  }

  return `Une mission · ${slots}`;
}

export function formatKlyxSplitMissionAdditionalSlots(
  locale: string,
  count: number
): string {
  const resolved = resolveKlyxSplitMissionLocale(locale);

  if (resolved === "en") {
    return `+ ${count} more ${count === 1 ? "time slot" : "time slots"}`;
  }

  if (resolved === "nl") {
    return `+ ${count} ${count === 1 ? "ander tijdslot" : "andere tijdsloten"}`;
  }

  if (resolved === "de") {
    return `+ ${count} ${count === 1 ? "weiteres Zeitfenster" : "weitere Zeitfenster"}`;
  }

  return `+ ${count} ${count === 1 ? "autre créneau" : "autres créneaux"}`;
}
