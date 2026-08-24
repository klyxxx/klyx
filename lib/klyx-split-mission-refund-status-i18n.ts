import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_REFUND_STATUS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionRefundStatusLocale =
  (typeof KLYX_SPLIT_MISSION_REFUND_STATUS_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_REFUND_STATUS_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "loading",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "totalMission",
  "refunded",
  "refundedUnits",
  "provider",
  "statusRefunded",
  "statusPartiallyRefunded",
  "statusProcessing",
  "statusFailed",
  "statusNone",
  "currencyUnavailable",
  "failureReasonHidden",
  "inProgressTitle",
  "inProgressDescription",
  "failureTitle",
  "failureDescription",
  "fullyRefundedTitle",
  "fullyRefundedDescription",
  "safetySummary",
] as const;

export type KlyxSplitMissionRefundStatusMessageKey =
  (typeof KLYX_SPLIT_MISSION_REFUND_STATUS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSplitMissionRefundStatusMessageKey, string>;

const MESSAGES: Record<KlyxSplitMissionRefundStatusLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "L'état des remboursements est indisponible pour le moment.",
    loading: "Vérification des remboursements...",
    eyebrow: "KLYX 13.28",
    title: "Remboursements de la mission",
    description:
      "Chaque paiement prestataire est suivi séparément afin qu'un remboursement n'affecte pas le mauvais créneau ou le mauvais prestataire.",
    refresh: "Actualiser",
    totalMission: "Total mission",
    refunded: "Remboursé",
    refundedUnits: "Unités remboursées",
    provider: "Prestataire",
    statusRefunded: "Remboursé",
    statusPartiallyRefunded: "Partiellement remboursé",
    statusProcessing: "Remboursement en cours",
    statusFailed: "Remboursement à vérifier",
    statusNone: "Aucun remboursement",
    currencyUnavailable: "devise indisponible",
    failureReasonHidden:
      "Le remboursement nécessite une vérification. Les détails techniques restent dans l'historique financier sécurisé.",
    inProgressTitle: "Remboursement Stripe en cours",
    inProgressDescription:
      "KLYX attend la confirmation finale de Stripe avant de considérer les fonds comme remboursés.",
    failureTitle: "Un remboursement nécessite une vérification",
    failureDescription:
      "KLYX conserve l'incident dans l'historique financier au lieu de prétendre que le remboursement a réussi.",
    fullyRefundedTitle: "Mission entièrement remboursée",
    fullyRefundedDescription:
      "Toutes les unités Stripe de cette mission ont été réconciliées comme remboursées.",
    safetySummary:
      "Cette page suit les remboursements mais ne permet pas au client d'en déclencher arbitrairement. L'exécution reste liée à une décision d'annulation KLYX explicite ; aucun remboursement n'est automatique ici.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Refund status is currently unavailable.",
    loading: "Checking refunds...",
    eyebrow: "KLYX 13.28",
    title: "Mission refunds",
    description:
      "Each provider payment is tracked separately so a refund cannot affect the wrong slot or provider.",
    refresh: "Refresh",
    totalMission: "Mission total",
    refunded: "Refunded",
    refundedUnits: "Refunded units",
    provider: "Provider",
    statusRefunded: "Refunded",
    statusPartiallyRefunded: "Partially refunded",
    statusProcessing: "Refund in progress",
    statusFailed: "Refund needs review",
    statusNone: "No refund",
    currencyUnavailable: "currency unavailable",
    failureReasonHidden:
      "The refund needs review. Technical details remain in the secured financial history.",
    inProgressTitle: "Stripe refund in progress",
    inProgressDescription:
      "KLYX waits for Stripe's final confirmation before treating the funds as refunded.",
    failureTitle: "A refund needs review",
    failureDescription:
      "KLYX keeps the incident in the financial history instead of claiming the refund succeeded.",
    fullyRefundedTitle: "Mission fully refunded",
    fullyRefundedDescription:
      "All Stripe units for this mission have been reconciled as refunded.",
    safetySummary:
      "This page tracks refunds but does not let the client trigger one arbitrarily. Execution remains tied to an explicit KLYX cancellation decision; no refund is automatic here.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "De terugbetalingsstatus is momenteel niet beschikbaar.",
    loading: "Terugbetalingen controleren...",
    eyebrow: "KLYX 13.28",
    title: "Terugbetalingen van de missie",
    description:
      "Elke betaling aan een dienstverlener wordt apart gevolgd zodat een terugbetaling niet het verkeerde tijdslot of de verkeerde dienstverlener raakt.",
    refresh: "Vernieuwen",
    totalMission: "Totaal missie",
    refunded: "Terugbetaald",
    refundedUnits: "Terugbetaalde eenheden",
    provider: "Dienstverlener",
    statusRefunded: "Terugbetaald",
    statusPartiallyRefunded: "Gedeeltelijk terugbetaald",
    statusProcessing: "Terugbetaling bezig",
    statusFailed: "Terugbetaling moet worden gecontroleerd",
    statusNone: "Geen terugbetaling",
    currencyUnavailable: "valuta niet beschikbaar",
    failureReasonHidden:
      "De terugbetaling moet worden gecontroleerd. Technische details blijven in de beveiligde financiële historiek.",
    inProgressTitle: "Stripe-terugbetaling bezig",
    inProgressDescription:
      "KLYX wacht op de definitieve bevestiging van Stripe voordat het geld als terugbetaald wordt beschouwd.",
    failureTitle: "Een terugbetaling moet worden gecontroleerd",
    failureDescription:
      "KLYX bewaart het incident in de financiële historiek in plaats van te doen alsof de terugbetaling geslaagd is.",
    fullyRefundedTitle: "Missie volledig terugbetaald",
    fullyRefundedDescription:
      "Alle Stripe-eenheden van deze missie zijn als terugbetaald gereconcilieerd.",
    safetySummary:
      "Deze pagina volgt terugbetalingen maar laat de klant er niet willekeurig één starten. Uitvoering blijft gekoppeld aan een uitdrukkelijke KLYX-annuleringsbeslissing; hier gebeurt geen automatische terugbetaling.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Der Rückerstattungsstatus ist derzeit nicht verfügbar.",
    loading: "Rückerstattungen werden geprüft...",
    eyebrow: "KLYX 13.28",
    title: "Rückerstattungen der Mission",
    description:
      "Jede Zahlung an einen Dienstleister wird separat verfolgt, damit eine Rückerstattung nicht das falsche Zeitfenster oder den falschen Dienstleister betrifft.",
    refresh: "Aktualisieren",
    totalMission: "Gesamtsumme der Mission",
    refunded: "Rückerstattet",
    refundedUnits: "Rückerstattete Einheiten",
    provider: "Dienstleister",
    statusRefunded: "Rückerstattet",
    statusPartiallyRefunded: "Teilweise rückerstattet",
    statusProcessing: "Rückerstattung läuft",
    statusFailed: "Rückerstattung muss geprüft werden",
    statusNone: "Keine Rückerstattung",
    currencyUnavailable: "Währung nicht verfügbar",
    failureReasonHidden:
      "Die Rückerstattung muss geprüft werden. Technische Details verbleiben im geschützten Finanzverlauf.",
    inProgressTitle: "Stripe-Rückerstattung läuft",
    inProgressDescription:
      "KLYX wartet auf die endgültige Bestätigung von Stripe, bevor die Gelder als rückerstattet gelten.",
    failureTitle: "Eine Rückerstattung muss geprüft werden",
    failureDescription:
      "KLYX bewahrt den Vorfall im Finanzverlauf auf, statt fälschlich zu behaupten, die Rückerstattung sei erfolgreich gewesen.",
    fullyRefundedTitle: "Mission vollständig rückerstattet",
    fullyRefundedDescription:
      "Alle Stripe-Einheiten dieser Mission wurden als rückerstattet abgeglichen.",
    safetySummary:
      "Diese Seite verfolgt Rückerstattungen, erlaubt dem Kunden aber nicht, beliebig eine auszulösen. Die Ausführung bleibt an eine ausdrückliche KLYX-Stornierungsentscheidung gebunden; hier erfolgt keine automatische Rückerstattung.",
  },
};

const LOCALE_SET = new Set<string>(KLYX_SPLIT_MISSION_REFUND_STATUS_TRANSLATED_LOCALES);

export function hasKlyxSplitMissionRefundStatusTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionRefundStatusLocale(
  locale: KlyxLocale
): KlyxSplitMissionRefundStatusLocale {
  return hasKlyxSplitMissionRefundStatusTranslation(locale)
    ? (locale as KlyxSplitMissionRefundStatusLocale)
    : "fr";
}

export function getKlyxSplitMissionRefundStatusDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxSplitMissionRefundStatusLocale(locale)];
}

export function translateKlyxSplitMissionRefundStatus(
  locale: KlyxLocale,
  key: KlyxSplitMissionRefundStatusMessageKey
) {
  return getKlyxSplitMissionRefundStatusDictionary(locale)[key];
}
