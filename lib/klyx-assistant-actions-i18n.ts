import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_ASSISTANT_ACTIONS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAssistantActionsLocale =
  (typeof KLYX_ASSISTANT_ACTIONS_TRANSLATED_LOCALES)[number];

export const KLYX_ASSISTANT_ACTIONS_MESSAGE_KEYS = [
  "eyebrow",
  "title",
  "description",
  "profileClient",
  "profileProvider",
  "refresh",
  "loading",
  "emptyTitle",
  "emptyDescription",
  "priority",
  "important",
  "loadError",
] as const;

export type KlyxAssistantActionsMessageKey =
  (typeof KLYX_ASSISTANT_ACTIONS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAssistantActionsMessageKey, string>;

const DICTIONARIES: Record<KlyxAssistantActionsLocale, Dictionary> = {
  fr: {
    eyebrow: "KLYX Action Center",
    title: "Ce que KLYX te recommande maintenant",
    description:
      "Offres, réservation, paiement et exécution de mission sont réunis dans un seul ordre de priorité.",
    profileClient: "Profil client",
    profileProvider: "Profil prestataire",
    refresh: "Actualiser",
    loading: "KLYX prépare tes prochaines actions...",
    emptyTitle: "Rien à faire maintenant",
    emptyDescription: "KLYX ne détecte aucune action nécessaire pour ce profil.",
    priority: "Priorité",
    important: "Important",
    loadError: "Les actions KLYX sont indisponibles pour le moment.",
  },
  en: {
    eyebrow: "KLYX Action Center",
    title: "What KLYX recommends now",
    description:
      "Offers, booking, payment and mission execution are brought together in one priority order.",
    profileClient: "Client profile",
    profileProvider: "Provider profile",
    refresh: "Refresh",
    loading: "KLYX is preparing your next actions...",
    emptyTitle: "Nothing to do right now",
    emptyDescription: "KLYX does not detect any action required for this profile.",
    priority: "Priority",
    important: "Important",
    loadError: "KLYX actions are unavailable right now.",
  },
  nl: {
    eyebrow: "KLYX Actiecentrum",
    title: "Wat KLYX nu aanbeveelt",
    description:
      "Offertes, boeking, betaling en uitvoering van de missie staan samen in één prioriteitsvolgorde.",
    profileClient: "Klantprofiel",
    profileProvider: "Dienstverlenerprofiel",
    refresh: "Vernieuwen",
    loading: "KLYX bereidt je volgende acties voor...",
    emptyTitle: "Nu niets te doen",
    emptyDescription: "KLYX detecteert geen noodzakelijke actie voor dit profiel.",
    priority: "Prioriteit",
    important: "Belangrijk",
    loadError: "KLYX-acties zijn momenteel niet beschikbaar.",
  },
  de: {
    eyebrow: "KLYX Aktionszentrum",
    title: "Was KLYX jetzt empfiehlt",
    description:
      "Angebote, Buchung, Zahlung und Missionsausführung sind in einer Prioritätenfolge gebündelt.",
    profileClient: "Kundenprofil",
    profileProvider: "Anbieterprofil",
    refresh: "Aktualisieren",
    loading: "KLYX bereitet deine nächsten Aktionen vor...",
    emptyTitle: "Im Moment nichts zu tun",
    emptyDescription: "KLYX erkennt für dieses Profil keine notwendige Aktion.",
    priority: "Priorität",
    important: "Wichtig",
    loadError: "KLYX-Aktionen sind derzeit nicht verfügbar.",
  },
};

export function resolveKlyxAssistantActionsLocale(
  locale: KlyxLocale | string
): KlyxAssistantActionsLocale {
  return KLYX_ASSISTANT_ACTIONS_TRANSLATED_LOCALES.includes(
    locale as KlyxAssistantActionsLocale
  )
    ? (locale as KlyxAssistantActionsLocale)
    : "fr";
}

export function getKlyxAssistantActionsDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxAssistantActionsLocale(locale)];
}

export function translateKlyxAssistantActions(
  locale: KlyxLocale | string,
  key: KlyxAssistantActionsMessageKey
): string {
  return getKlyxAssistantActionsDictionary(locale)[key];
}

export function formatKlyxAssistantActionCount(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxAssistantActionsLocale(locale);

  if (resolved === "en") {
    return `${count} ${count === 1 ? "action" : "actions"}`;
  }

  if (resolved === "nl") {
    return `${count} ${count === 1 ? "actie" : "acties"}`;
  }

  if (resolved === "de") {
    return `${count} ${count === 1 ? "Aktion" : "Aktionen"}`;
  }

  return `${count} action${count > 1 ? "s" : ""}`;
}
