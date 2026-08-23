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

const SERVICE_SLUG_ALIASES: Record<string, "babysitting" | "cleaning" | "moving" | "handyman"> = {
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

export function formatKlyxSplitMissionStatus(
  locale: string,
  status: KlyxSplitMissionState
): string {
  return translateKlyxSplitMission(locale, STATUS_KEYS[status]);
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
