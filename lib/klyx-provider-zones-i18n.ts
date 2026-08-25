import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_ZONES_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxProviderZonesLocale =
  (typeof KLYX_PROVIDER_ZONES_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_ZONES_MESSAGE_KEYS = [
  "loadError",
  "addError",
  "updateError",
  "deleteError",
  "countryRequired",
  "localityCatalogUnavailable",
  "added",
  "primaryUpdated",
  "deleted",
  "confirmDelete",
  "providerOnly",
  "title",
  "description",
  "refresh",
  "addTitle",
  "noServices",
  "service",
  "locality",
  "selectLocality",
  "maxRadius",
  "primary",
  "primaryDescription",
  "addZone",
  "coverageEyebrow",
  "savedTitle",
  "empty",
  "primaryBadge",
  "radius",
  "deleteAria",
  "setPrimary",
  "serviceFallback",
  "belgium",
] as const;

export type KlyxProviderZonesMessageKey =
  (typeof KLYX_PROVIDER_ZONES_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderZonesMessageKey, string>;

const MESSAGES: Record<KlyxProviderZonesLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les zones pour le moment.",
    addError: "Impossible d’enregistrer cette zone pour le moment.",
    updateError: "Impossible de modifier cette zone pour le moment.",
    deleteError: "Impossible de supprimer cette zone pour le moment.",
    countryRequired: "Configure ton pays KLYX avant de créer une zone.",
    localityCatalogUnavailable:
      "La sélection de localités n’est pas encore disponible pour ton pays.",
    added: "Zone enregistrée.",
    primaryUpdated: "Zone principale mise à jour.",
    deleted: "Zone supprimée.",
    confirmDelete: "Supprimer cette zone ?",
    providerOnly: "Espace prestataire uniquement",
    title: "Zones d’intervention",
    description:
      "Choisis les communes où tu acceptes de travailler pour chaque métier. KLYX n’enregistre pas ta position GPS personnelle.",
    refresh: "Actualiser",
    addTitle: "Ajouter une zone",
    noServices: "Active d’abord un métier dans ton Studio prestataire.",
    service: "Métier",
    locality: "Commune principale",
    selectLocality: "Choisir une commune",
    maxRadius: "Rayon maximal",
    primary: "Zone principale",
    primaryDescription: "Cette zone sera prioritaire pour ce métier.",
    addZone: "Ajouter la zone",
    coverageEyebrow: "Couverture professionnelle",
    savedTitle: "Mes zones enregistrées",
    empty: "Aucune zone enregistrée",
    primaryBadge: "Principale",
    radius: "rayon",
    deleteAria: "Supprimer la zone",
    setPrimary: "Définir comme principale",
    serviceFallback: "Métier KLYX",
    belgium: "Belgique",
  },
  en: {
    loadError: "Service areas cannot be loaded right now.",
    addError: "This service area cannot be saved right now.",
    updateError: "This service area cannot be updated right now.",
    deleteError: "This service area cannot be deleted right now.",
    countryRequired: "Set your KLYX country before creating a service area.",
    localityCatalogUnavailable:
      "Locality selection is not available for your country yet.",
    added: "Service area saved.",
    primaryUpdated: "Primary area updated.",
    deleted: "Service area deleted.",
    confirmDelete: "Delete this service area?",
    providerOnly: "Providers only",
    title: "Service areas",
    description:
      "Choose the municipalities where you accept work for each profession. KLYX does not store your personal GPS position.",
    refresh: "Refresh",
    addTitle: "Add a service area",
    noServices: "Enable a profession in your Provider Studio first.",
    service: "Profession",
    locality: "Main municipality",
    selectLocality: "Choose a municipality",
    maxRadius: "Maximum radius",
    primary: "Primary area",
    primaryDescription: "This area will be prioritized for this profession.",
    addZone: "Add area",
    coverageEyebrow: "Professional coverage",
    savedTitle: "My saved areas",
    empty: "No service area saved",
    primaryBadge: "Primary",
    radius: "radius",
    deleteAria: "Delete service area",
    setPrimary: "Set as primary",
    serviceFallback: "KLYX profession",
    belgium: "Belgium",
  },
  nl: {
    loadError: "Werkzones kunnen momenteel niet worden geladen.",
    addError: "Deze werkzone kan momenteel niet worden opgeslagen.",
    updateError: "Deze werkzone kan momenteel niet worden gewijzigd.",
    deleteError: "Deze werkzone kan momenteel niet worden verwijderd.",
    countryRequired: "Stel je KLYX-land in voordat je een werkzone maakt.",
    localityCatalogUnavailable:
      "De selectie van gemeenten is nog niet beschikbaar voor jouw land.",
    added: "Werkzone opgeslagen.",
    primaryUpdated: "Primaire zone bijgewerkt.",
    deleted: "Werkzone verwijderd.",
    confirmDelete: "Deze werkzone verwijderen?",
    providerOnly: "Alleen voor dienstverleners",
    title: "Werkzones",
    description:
      "Kies de gemeenten waar je per beroep wilt werken. KLYX slaat je persoonlijke GPS-positie niet op.",
    refresh: "Vernieuwen",
    addTitle: "Werkzone toevoegen",
    noServices: "Activeer eerst een beroep in je Provider Studio.",
    service: "Beroep",
    locality: "Hoofdgemeente",
    selectLocality: "Kies een gemeente",
    maxRadius: "Maximale straal",
    primary: "Primaire zone",
    primaryDescription: "Deze zone krijgt voorrang voor dit beroep.",
    addZone: "Zone toevoegen",
    coverageEyebrow: "Professionele dekking",
    savedTitle: "Mijn opgeslagen zones",
    empty: "Geen werkzone opgeslagen",
    primaryBadge: "Primair",
    radius: "straal",
    deleteAria: "Werkzone verwijderen",
    setPrimary: "Als primair instellen",
    serviceFallback: "KLYX-beroep",
    belgium: "België",
  },
  de: {
    loadError: "Einsatzgebiete können derzeit nicht geladen werden.",
    addError: "Dieses Einsatzgebiet kann derzeit nicht gespeichert werden.",
    updateError: "Dieses Einsatzgebiet kann derzeit nicht geändert werden.",
    deleteError: "Dieses Einsatzgebiet kann derzeit nicht gelöscht werden.",
    countryRequired: "Lege dein KLYX-Land fest, bevor du ein Einsatzgebiet erstellst.",
    localityCatalogUnavailable:
      "Die Ortsauswahl ist für dein Land noch nicht verfügbar.",
    added: "Einsatzgebiet gespeichert.",
    primaryUpdated: "Primäres Gebiet aktualisiert.",
    deleted: "Einsatzgebiet gelöscht.",
    confirmDelete: "Dieses Einsatzgebiet löschen?",
    providerOnly: "Nur für Anbieter",
    title: "Einsatzgebiete",
    description:
      "Wähle für jeden Beruf die Gemeinden aus, in denen du arbeiten möchtest. KLYX speichert deine persönliche GPS-Position nicht.",
    refresh: "Aktualisieren",
    addTitle: "Einsatzgebiet hinzufügen",
    noServices: "Aktiviere zuerst einen Beruf in deinem Anbieter-Studio.",
    service: "Beruf",
    locality: "Hauptgemeinde",
    selectLocality: "Gemeinde auswählen",
    maxRadius: "Maximaler Radius",
    primary: "Primäres Gebiet",
    primaryDescription: "Dieses Gebiet wird für diesen Beruf priorisiert.",
    addZone: "Gebiet hinzufügen",
    coverageEyebrow: "Professionelle Abdeckung",
    savedTitle: "Meine gespeicherten Gebiete",
    empty: "Kein Einsatzgebiet gespeichert",
    primaryBadge: "Primär",
    radius: "Radius",
    deleteAria: "Einsatzgebiet löschen",
    setPrimary: "Als primär festlegen",
    serviceFallback: "KLYX-Beruf",
    belgium: "Belgien",
  },
};

const LOCALE_SET = new Set<string>(KLYX_PROVIDER_ZONES_TRANSLATED_LOCALES);

export function resolveKlyxProviderZonesLocale(locale: KlyxLocale): KlyxProviderZonesLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxProviderZonesLocale) : "fr";
}

export function translateKlyxProviderZones(
  locale: KlyxLocale,
  key: KlyxProviderZonesMessageKey
): string {
  return MESSAGES[resolveKlyxProviderZonesLocale(locale)][key];
}

export function translateKlyxProviderZoneApiCode(
  locale: KlyxLocale,
  code: string | null | undefined
): string | null {
  if (code === "KLYX_PROFILE_COUNTRY_REQUIRED") {
    return translateKlyxProviderZones(locale, "countryRequired");
  }

  if (code === "KLYX_LOCALITY_CATALOG_NOT_AVAILABLE") {
    return translateKlyxProviderZones(locale, "localityCatalogUnavailable");
  }

  return null;
}
