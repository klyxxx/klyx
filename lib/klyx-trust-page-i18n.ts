import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_TRUST_TRANSLATED_LOCALES = ["fr", "en", "nl", "de", "es"] as const;

export type KlyxTrustLocale = (typeof KLYX_TRUST_TRANSLATED_LOCALES)[number];

export const KLYX_TRUST_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "eyebrow",
  "title",
  "description",
  "openReport",
  "factsTitle",
  "factsText",
  "protectedTitle",
  "protectedText",
  "decisionTitle",
  "decisionText",
  "filesEyebrow",
  "filesTitle",
  "emptyTitle",
  "emptyText",
  "viewBooking",
  "unknownReason",
  "unknownStatus",
] as const;

export type KlyxTrustMessageKey = (typeof KLYX_TRUST_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxTrustMessageKey, string>;
type ReasonDictionary = Record<string, string>;
type StatusDictionary = Record<string, string>;

const MESSAGES: Record<KlyxTrustLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Impossible de charger le Centre de confiance pour le moment.",
    eyebrow: "Protection client",
    title: "Centre de confiance client",
    description:
      "Signale un problème lié à une prestation, conserve les faits et suis la décision de KLYX.",
    openReport: "Ouvrir un signalement",
    factsTitle: "Décrire les faits",
    factsText: "Indique précisément ce qui s’est passé.",
    protectedTitle: "Dossier protégé",
    protectedText: "Le dossier reste lié à la réservation.",
    decisionTitle: "Suivre la décision",
    decisionText: "Le statut évoluera dans cet espace.",
    filesEyebrow: "Mes dossiers",
    filesTitle: "Mes litiges et signalements",
    emptyTitle: "Aucun dossier actif",
    emptyText: "Tes signalements apparaîtront ici.",
    viewBooking: "Voir la réservation",
    unknownReason: "Autre problème",
    unknownStatus: "Statut à vérifier",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "The Trust Center is currently unavailable.",
    eyebrow: "Client protection",
    title: "Client Trust Center",
    description:
      "Report an issue related to a service, keep the facts together, and follow KLYX's decision.",
    openReport: "Open a report",
    factsTitle: "Describe the facts",
    factsText: "Explain precisely what happened.",
    protectedTitle: "Protected case",
    protectedText: "The case remains linked to the booking.",
    decisionTitle: "Follow the decision",
    decisionText: "The status will evolve in this space.",
    filesEyebrow: "My cases",
    filesTitle: "My disputes and reports",
    emptyTitle: "No active case",
    emptyText: "Your reports will appear here.",
    viewBooking: "View booking",
    unknownReason: "Other issue",
    unknownStatus: "Status needs review",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "Het Vertrouwenscentrum is momenteel niet beschikbaar.",
    eyebrow: "Bescherming van de klant",
    title: "Vertrouwenscentrum voor klanten",
    description:
      "Meld een probleem met een dienst, bewaar de feiten samen en volg de beslissing van KLYX.",
    openReport: "Een melding openen",
    factsTitle: "De feiten beschrijven",
    factsText: "Beschrijf nauwkeurig wat er is gebeurd.",
    protectedTitle: "Beschermd dossier",
    protectedText: "Het dossier blijft aan de boeking gekoppeld.",
    decisionTitle: "De beslissing volgen",
    decisionText: "De status wordt in deze ruimte bijgewerkt.",
    filesEyebrow: "Mijn dossiers",
    filesTitle: "Mijn geschillen en meldingen",
    emptyTitle: "Geen actief dossier",
    emptyText: "Je meldingen verschijnen hier.",
    viewBooking: "Boeking bekijken",
    unknownReason: "Ander probleem",
    unknownStatus: "Status moet worden gecontroleerd",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Das Vertrauenszentrum ist derzeit nicht verfügbar.",
    eyebrow: "Kundenschutz",
    title: "Vertrauenszentrum für Kunden",
    description:
      "Melde ein Problem mit einer Dienstleistung, halte die Fakten fest und verfolge die Entscheidung von KLYX.",
    openReport: "Meldung eröffnen",
    factsTitle: "Fakten beschreiben",
    factsText: "Beschreibe genau, was passiert ist.",
    protectedTitle: "Geschützter Fall",
    protectedText: "Der Fall bleibt mit der Buchung verknüpft.",
    decisionTitle: "Entscheidung verfolgen",
    decisionText: "Der Status wird in diesem Bereich aktualisiert.",
    filesEyebrow: "Meine Fälle",
    filesTitle: "Meine Streitfälle und Meldungen",
    emptyTitle: "Kein aktiver Fall",
    emptyText: "Deine Meldungen erscheinen hier.",
    viewBooking: "Buchung ansehen",
    unknownReason: "Anderes Problem",
    unknownStatus: "Status muss geprüft werden",
  },
  es: {
    sessionMissing: "Falta la sesión de KLYX.",
    loadError: "No se puede cargar el Centro de confianza en este momento.",
    eyebrow: "Protección del cliente",
    title: "Centro de confianza del cliente",
    description:
      "Informa de un problema relacionado con un servicio, conserva los hechos y sigue la decisión de KLYX.",
    openReport: "Abrir una incidencia",
    factsTitle: "Describir los hechos",
    factsText: "Indica con precisión qué ha ocurrido.",
    protectedTitle: "Expediente protegido",
    protectedText: "El expediente permanece vinculado a la reserva.",
    decisionTitle: "Seguir la decisión",
    decisionText: "El estado se actualizará en este espacio.",
    filesEyebrow: "Mis expedientes",
    filesTitle: "Mis disputas e incidencias",
    emptyTitle: "Ningún expediente activo",
    emptyText: "Tus incidencias aparecerán aquí.",
    viewBooking: "Ver la reserva",
    unknownReason: "Otro problema",
    unknownStatus: "Estado por verificar",
  },
};

const REASONS: Record<KlyxTrustLocale, ReasonDictionary> = {
  fr: {
    provider_absent: "Prestataire absent",
    client_absent: "Client absent",
    major_delay: "Retard important",
    unfinished_work: "Mission non terminée",
    unsatisfactory_work: "Travail insatisfaisant",
    unsafe_behavior: "Comportement dangereux",
    payment_problem: "Problème de paiement",
    other: "Autre problème",
  },
  en: {
    provider_absent: "Provider absent",
    client_absent: "Client absent",
    major_delay: "Major delay",
    unfinished_work: "Service not completed",
    unsatisfactory_work: "Unsatisfactory work",
    unsafe_behavior: "Unsafe behavior",
    payment_problem: "Payment issue",
    other: "Other issue",
  },
  nl: {
    provider_absent: "Dienstverlener afwezig",
    client_absent: "Klant afwezig",
    major_delay: "Grote vertraging",
    unfinished_work: "Opdracht niet voltooid",
    unsatisfactory_work: "Onbevredigend werk",
    unsafe_behavior: "Onveilig gedrag",
    payment_problem: "Betalingsprobleem",
    other: "Ander probleem",
  },
  de: {
    provider_absent: "Dienstleister abwesend",
    client_absent: "Kunde abwesend",
    major_delay: "Erhebliche Verspätung",
    unfinished_work: "Auftrag nicht abgeschlossen",
    unsatisfactory_work: "Unzufriedenstellende Arbeit",
    unsafe_behavior: "Unsicheres Verhalten",
    payment_problem: "Zahlungsproblem",
    other: "Anderes Problem",
  },
  es: {
    provider_absent: "Proveedor ausente",
    client_absent: "Cliente ausente",
    major_delay: "Retraso importante",
    unfinished_work: "Servicio no finalizado",
    unsatisfactory_work: "Trabajo insatisfactorio",
    unsafe_behavior: "Comportamiento peligroso",
    payment_problem: "Problema de pago",
    other: "Otro problema",
  },
};

const STATUSES: Record<KlyxTrustLocale, StatusDictionary> = {
  fr: {
    open: "Ouvert",
    under_review: "En analyse",
    waiting_user: "Informations attendues",
    resolved: "Résolu",
    closed: "Fermé",
  },
  en: {
    open: "Open",
    under_review: "Under review",
    waiting_user: "Waiting for information",
    resolved: "Resolved",
    closed: "Closed",
  },
  nl: {
    open: "Open",
    under_review: "In beoordeling",
    waiting_user: "Wachten op informatie",
    resolved: "Opgelost",
    closed: "Gesloten",
  },
  de: {
    open: "Offen",
    under_review: "In Prüfung",
    waiting_user: "Informationen ausstehend",
    resolved: "Gelöst",
    closed: "Geschlossen",
  },
  es: {
    open: "Abierto",
    under_review: "En revisión",
    waiting_user: "Información pendiente",
    resolved: "Resuelto",
    closed: "Cerrado",
  },
};

const INTL_LOCALES: Record<KlyxTrustLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
  es: "es-BE",
};

const LOCALE_SET = new Set<string>(KLYX_TRUST_TRANSLATED_LOCALES);

export function hasKlyxTrustTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxTrustLocale(locale: KlyxLocale): KlyxTrustLocale {
  return hasKlyxTrustTranslation(locale) ? (locale as KlyxTrustLocale) : "fr";
}

export function getKlyxTrustDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxTrustLocale(locale)];
}

export function translateKlyxTrust(locale: KlyxLocale, key: KlyxTrustMessageKey) {
  return getKlyxTrustDictionary(locale)[key];
}

export function translateKlyxTrustReason(locale: KlyxLocale, reason: string) {
  const resolved = resolveKlyxTrustLocale(locale);
  return REASONS[resolved][reason] ?? MESSAGES[resolved].unknownReason;
}

export function translateKlyxTrustStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxTrustLocale(locale);
  return STATUSES[resolved][status] ?? MESSAGES[resolved].unknownStatus;
}

export function getKlyxTrustIntlLocale(locale: KlyxLocale) {
  return INTL_LOCALES[resolveKlyxTrustLocale(locale)];
}
