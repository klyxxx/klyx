import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_TRUST_NEW_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxTrustNewLocale = (typeof KLYX_TRUST_NEW_TRANSLATED_LOCALES)[number];

export const KLYX_TRUST_NEW_MESSAGE_KEYS = [
  "loadError",
  "submitError",
  "back",
  "eyebrow",
  "title",
  "description",
  "bookingLabel",
  "bookingPlaceholder",
  "bookingAria",
  "reasonLabel",
  "reasonPlaceholder",
  "reasonAria",
  "descriptionLabel",
  "descriptionPlaceholder",
  "characters",
  "submit",
  "at",
] as const;

export type KlyxTrustNewMessageKey = (typeof KLYX_TRUST_NEW_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxTrustNewMessageKey, string>;

const MESSAGES: Record<KlyxTrustNewLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les réservations pour le moment.",
    submitError: "Le signalement n’a pas pu être enregistré pour le moment.",
    back: "Centre de confiance",
    eyebrow: "Étape 3 · Trust & Safety",
    title: "Signaler un problème",
    description:
      "Décris précisément les faits. Un signalement n’annule pas automatiquement une mission et ne déclenche pas automatiquement un remboursement.",
    bookingLabel: "Réservation concernée",
    bookingPlaceholder: "Choisir une réservation",
    bookingAria: "Réservation concernée",
    reasonLabel: "Motif",
    reasonPlaceholder: "Choisir un motif",
    reasonAria: "Motif du signalement",
    descriptionLabel: "Description détaillée",
    descriptionPlaceholder: "Explique les faits, les horaires et ce qui s’est passé.",
    characters: "caractères",
    submit: "Enregistrer le signalement",
    at: "à",
  },
  en: {
    loadError: "Bookings are currently unavailable.",
    submitError: "The report could not be saved right now.",
    back: "Trust Center",
    eyebrow: "Step 3 · Trust & Safety",
    title: "Report an issue",
    description:
      "Describe the facts precisely. A report does not automatically cancel a mission and does not automatically trigger a refund.",
    bookingLabel: "Booking concerned",
    bookingPlaceholder: "Choose a booking",
    bookingAria: "Booking concerned",
    reasonLabel: "Reason",
    reasonPlaceholder: "Choose a reason",
    reasonAria: "Report reason",
    descriptionLabel: "Detailed description",
    descriptionPlaceholder: "Explain the facts, timing, and what happened.",
    characters: "characters",
    submit: "Save report",
    at: "at",
  },
  nl: {
    loadError: "De boekingen zijn momenteel niet beschikbaar.",
    submitError: "De melding kon momenteel niet worden opgeslagen.",
    back: "Vertrouwenscentrum",
    eyebrow: "Stap 3 · Trust & Safety",
    title: "Een probleem melden",
    description:
      "Beschrijf de feiten nauwkeurig. Een melding annuleert een missie niet automatisch en start niet automatisch een terugbetaling.",
    bookingLabel: "Betrokken boeking",
    bookingPlaceholder: "Kies een boeking",
    bookingAria: "Betrokken boeking",
    reasonLabel: "Reden",
    reasonPlaceholder: "Kies een reden",
    reasonAria: "Reden van de melding",
    descriptionLabel: "Gedetailleerde beschrijving",
    descriptionPlaceholder: "Leg de feiten, tijdstippen en wat er is gebeurd uit.",
    characters: "tekens",
    submit: "Melding opslaan",
    at: "om",
  },
  de: {
    loadError: "Die Buchungen sind derzeit nicht verfügbar.",
    submitError: "Die Meldung konnte derzeit nicht gespeichert werden.",
    back: "Vertrauenszentrum",
    eyebrow: "Schritt 3 · Trust & Safety",
    title: "Problem melden",
    description:
      "Beschreibe die Fakten genau. Eine Meldung storniert eine Mission nicht automatisch und löst nicht automatisch eine Rückerstattung aus.",
    bookingLabel: "Betroffene Buchung",
    bookingPlaceholder: "Buchung auswählen",
    bookingAria: "Betroffene Buchung",
    reasonLabel: "Grund",
    reasonPlaceholder: "Grund auswählen",
    reasonAria: "Grund der Meldung",
    descriptionLabel: "Detaillierte Beschreibung",
    descriptionPlaceholder: "Beschreibe die Fakten, Uhrzeiten und was passiert ist.",
    characters: "Zeichen",
    submit: "Meldung speichern",
    at: "um",
  },
};

const LOCALE_SET = new Set<string>(KLYX_TRUST_NEW_TRANSLATED_LOCALES);
export function hasKlyxTrustNewTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}
export function resolveKlyxTrustNewLocale(locale: KlyxLocale): KlyxTrustNewLocale {
  return hasKlyxTrustNewTranslation(locale) ? (locale as KlyxTrustNewLocale) : "fr";
}
export function getKlyxTrustNewDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxTrustNewLocale(locale)];
}
export function translateKlyxTrustNew(locale: KlyxLocale, key: KlyxTrustNewMessageKey) {
  return getKlyxTrustNewDictionary(locale)[key];
}
