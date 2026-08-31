import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PROVIDER_READINESS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderReadinessLocale =
  (typeof KLYX_PROVIDER_READINESS_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_READINESS_MESSAGE_KEYS = [
  "visibility",
  "checking",
  "ready",
  "incomplete",
  "refresh",
  "publishedProfile",
  "completeService",
  "activeZone",
  "verifiedIdentity",
  "done",
  "todo",
  "finishSetup",
  "nextAction",
  "viewMissions",
  "details",
  "genericError",
] as const;

export type KlyxProviderReadinessMessageKey =
  (typeof KLYX_PROVIDER_READINESS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderReadinessMessageKey, string>;

const DICTIONARIES: Record<KlyxProviderReadinessLocale, Dictionary> = {
  fr: {
    visibility: "Visibilité",
    checking: "Vérification de ton activité...",
    ready: "Prêt à apparaître dans les recherches",
    incomplete: "Configuration encore incomplète",
    refresh: "Actualiser",
    publishedProfile: "Profil professionnel publié",
    completeService: "Service complet et disponible",
    activeZone: "Zone d’intervention active",
    verifiedIdentity: "Identité vérifiée",
    done: "Terminé",
    todo: "À compléter",
    finishSetup: "Terminer ma configuration",
    nextAction: "Prochaine action",
    viewMissions: "Voir mes missions",
    details: "Voir les détails",
    genericError: "Impossible de vérifier le statut prestataire pour le moment.",
  },
  en: {
    visibility: "Visibility",
    checking: "Checking your activity...",
    ready: "Ready to appear in search results",
    incomplete: "Setup is still incomplete",
    refresh: "Refresh",
    publishedProfile: "Professional profile published",
    completeService: "Complete and available service",
    activeZone: "Active service area",
    verifiedIdentity: "Identity verified",
    done: "Done",
    todo: "To complete",
    finishSetup: "Finish my setup",
    nextAction: "Next action",
    viewMissions: "View my jobs",
    details: "View details",
    genericError: "KLYX cannot check provider readiness right now.",
  },
  nl: {
    visibility: "Zichtbaarheid",
    checking: "Je activiteit wordt gecontroleerd...",
    ready: "Klaar om in zoekresultaten te verschijnen",
    incomplete: "Configuratie is nog niet volledig",
    refresh: "Vernieuwen",
    publishedProfile: "Professioneel profiel gepubliceerd",
    completeService: "Volledige en beschikbare dienst",
    activeZone: "Actief werkgebied",
    verifiedIdentity: "Identiteit geverifieerd",
    done: "Voltooid",
    todo: "Nog te voltooien",
    finishSetup: "Mijn configuratie voltooien",
    nextAction: "Volgende actie",
    viewMissions: "Mijn opdrachten bekijken",
    details: "Details bekijken",
    genericError: "KLYX kan de status van de dienstverlener momenteel niet controleren.",
  },
  de: {
    visibility: "Sichtbarkeit",
    checking: "Deine Aktivität wird geprüft...",
    ready: "Bereit, in den Suchergebnissen zu erscheinen",
    incomplete: "Einrichtung noch unvollständig",
    refresh: "Aktualisieren",
    publishedProfile: "Berufsprofil veröffentlicht",
    completeService: "Vollständiger und verfügbarer Service",
    activeZone: "Aktives Einsatzgebiet",
    verifiedIdentity: "Identität verifiziert",
    done: "Erledigt",
    todo: "Noch offen",
    finishSetup: "Einrichtung abschließen",
    nextAction: "Nächste Aktion",
    viewMissions: "Meine Aufträge ansehen",
    details: "Details anzeigen",
    genericError: "KLYX kann den Anbieterstatus derzeit nicht prüfen.",
  },
};

export function resolveKlyxProviderReadinessLocale(
  locale: KlyxLocale | string
): KlyxProviderReadinessLocale {
  return KLYX_PROVIDER_READINESS_TRANSLATED_LOCALES.includes(
    locale as KlyxProviderReadinessLocale
  )
    ? (locale as KlyxProviderReadinessLocale)
    : "fr";
}

export function getKlyxProviderReadinessDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxProviderReadinessLocale(locale)];
}

export function translateKlyxProviderReadiness(
  locale: KlyxLocale | string,
  key: KlyxProviderReadinessMessageKey
): string {
  return getKlyxProviderReadinessDictionary(locale)[key];
}

export function formatKlyxProviderReadinessCompleted(
  locale: KlyxLocale | string,
  completed: number,
  total = 4
): string {
  const resolved = resolveKlyxProviderReadinessLocale(locale);

  if (resolved === "en") {
    return `${completed}/${total} items completed`;
  }

  if (resolved === "nl") {
    return `${completed}/${total} onderdelen voltooid`;
  }

  if (resolved === "de") {
    return `${completed}/${total} Punkte abgeschlossen`;
  }

  return `${completed}/${total} éléments complétés`;
}
