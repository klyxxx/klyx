import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionStripeReadinessLocale =
  (typeof KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_STRIPE_READINESS_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "loading",
  "errorTitle",
  "retry",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "providersChecked",
  "readyForStripe",
  "stateReady",
  "stateMissingProfile",
  "stateMarketNotReady",
  "stateMissingAccount",
  "stateLookupFailed",
  "stateRestricted",
  "chargesEnabled",
  "payoutsEnabled",
  "detailsComplete",
  "requirementsDue",
  "yes",
  "no",
  "readyTitle",
  "readyDescription",
  "blockedTitle",
  "blockPriceConfirmationRequired",
  "blockPaymentPlanRevalidationRequired",
  "blockStripeServerConfigurationRequired",
  "blockClientMarketNotReady",
  "blockProviderMarketNotReady",
  "blockProviderCountryMismatch",
  "blockProviderStripeNotReady",
  "blockMultiProviderRequired",
  "blockDefault",
  "noDebitTitle",
  "noDebitDescription",
  "safetySummary",
] as const;

export type KlyxSplitMissionStripeReadinessMessageKey =
  (typeof KLYX_SPLIT_MISSION_STRIPE_READINESS_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSplitMissionStripeReadinessMessageKey, string>;

const MESSAGES: Record<KlyxSplitMissionStripeReadinessLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "La vérification Stripe Connect est indisponible pour le moment.",
    loading: "Vérification Stripe Connect...",
    errorTitle: "Stripe Connect indisponible",
    retry: "Réessayer",
    eyebrow: "KLYX 13.25",
    title: "Disponibilité Stripe Connect",
    description:
      "KLYX vérifie en direct si chaque prestataire peut réellement recevoir sa part du paiement.",
    refresh: "Actualiser",
    providersChecked: "Prestataires vérifiés",
    readyForStripe: "Prêts pour Stripe",
    stateReady: "Stripe prêt",
    stateMissingProfile: "Profil prestataire introuvable",
    stateMarketNotReady: "Marché KLYX non ouvert",
    stateMissingAccount: "Compte Stripe manquant",
    stateLookupFailed: "Vérification impossible",
    stateRestricted: "Compte Stripe incomplet",
    chargesEnabled: "Paiements activés",
    payoutsEnabled: "Versements activés",
    detailsComplete: "Informations complètes",
    requirementsDue: "Exigences restantes",
    yes: "oui",
    no: "non",
    readyTitle: "Infrastructure Stripe prête",
    readyDescription:
      "Le marché client et tous les prestataires sont actuellement prêts pour Stripe.",
    blockedTitle: "Paiement toujours bloqué",
    blockPriceConfirmationRequired:
      "Les prix doivent être confirmés avant la vérification Stripe.",
    blockPaymentPlanRevalidationRequired:
      "Le contrat de paiement doit être revalidé.",
    blockStripeServerConfigurationRequired:
      "La configuration Stripe serveur est indisponible.",
    blockClientMarketNotReady:
      "KLYX n'est pas encore ouvert aux paiements Stripe dans le marché du client.",
    blockProviderMarketNotReady:
      "Au moins un prestataire se trouve dans un marché KLYX qui n'est pas encore ouvert aux paiements Stripe.",
    blockProviderCountryMismatch:
      "Le pays KLYX d'au moins un prestataire ne correspond plus au pays de son compte Stripe. Le paiement reste bloqué jusqu'à régularisation.",
    blockProviderStripeNotReady:
      "Au moins un prestataire n'est pas encore prêt à recevoir un paiement.",
    blockMultiProviderRequired:
      "Au moins deux prestataires sont requis pour cette mission.",
    blockDefault: "L'infrastructure de paiement n'est pas encore prête.",
    noDebitTitle: "Aucun débit à cette étape",
    noDebitDescription:
      "Même lorsque tous les comptes Stripe sont prêts, KLYX exige encore une confirmation explicite du client avant toute création de paiement.",
    safetySummary:
      "Vérification Stripe en direct · aucun PaymentIntent · aucun Checkout · aucun Transfer · aucun paiement automatique.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Stripe Connect verification is currently unavailable.",
    loading: "Checking Stripe Connect...",
    errorTitle: "Stripe Connect unavailable",
    retry: "Try again",
    eyebrow: "KLYX 13.25",
    title: "Stripe Connect readiness",
    description:
      "KLYX checks live whether each provider can actually receive their share of the payment.",
    refresh: "Refresh",
    providersChecked: "Providers checked",
    readyForStripe: "Ready for Stripe",
    stateReady: "Stripe ready",
    stateMissingProfile: "Provider profile missing",
    stateMarketNotReady: "KLYX market not open",
    stateMissingAccount: "Stripe account missing",
    stateLookupFailed: "Verification unavailable",
    stateRestricted: "Stripe account incomplete",
    chargesEnabled: "Charges enabled",
    payoutsEnabled: "Payouts enabled",
    detailsComplete: "Details complete",
    requirementsDue: "Requirements remaining",
    yes: "yes",
    no: "no",
    readyTitle: "Stripe infrastructure ready",
    readyDescription:
      "The client market and every provider are currently ready for Stripe.",
    blockedTitle: "Payment still blocked",
    blockPriceConfirmationRequired:
      "Prices must be confirmed before Stripe verification.",
    blockPaymentPlanRevalidationRequired:
      "The payment contract must be revalidated.",
    blockStripeServerConfigurationRequired:
      "Server-side Stripe configuration is unavailable.",
    blockClientMarketNotReady:
      "KLYX is not yet open for Stripe payments in the client's market.",
    blockProviderMarketNotReady:
      "At least one provider is in a KLYX market that is not yet open for Stripe payments.",
    blockProviderCountryMismatch:
      "At least one provider's KLYX country no longer matches their Stripe account country. Payment stays blocked until this is resolved.",
    blockProviderStripeNotReady:
      "At least one provider is not yet ready to receive a payment.",
    blockMultiProviderRequired:
      "At least two providers are required for this mission.",
    blockDefault: "The payment infrastructure is not ready yet.",
    noDebitTitle: "No charge at this step",
    noDebitDescription:
      "Even when every Stripe account is ready, KLYX still requires explicit client confirmation before any payment can be created.",
    safetySummary:
      "Live Stripe verification · no PaymentIntent · no Checkout · no Transfer · no automatic payment.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "De Stripe Connect-controle is momenteel niet beschikbaar.",
    loading: "Stripe Connect controleren...",
    errorTitle: "Stripe Connect niet beschikbaar",
    retry: "Opnieuw proberen",
    eyebrow: "KLYX 13.25",
    title: "Stripe Connect-gereedheid",
    description:
      "KLYX controleert live of elke dienstverlener zijn deel van de betaling werkelijk kan ontvangen.",
    refresh: "Vernieuwen",
    providersChecked: "Gecontroleerde dienstverleners",
    readyForStripe: "Klaar voor Stripe",
    stateReady: "Stripe klaar",
    stateMissingProfile: "Profiel van dienstverlener ontbreekt",
    stateMarketNotReady: "KLYX-markt nog niet open",
    stateMissingAccount: "Stripe-account ontbreekt",
    stateLookupFailed: "Controle niet mogelijk",
    stateRestricted: "Stripe-account onvolledig",
    chargesEnabled: "Betalingen geactiveerd",
    payoutsEnabled: "Uitbetalingen geactiveerd",
    detailsComplete: "Gegevens volledig",
    requirementsDue: "Resterende vereisten",
    yes: "ja",
    no: "nee",
    readyTitle: "Stripe-infrastructuur klaar",
    readyDescription:
      "De markt van de klant en alle dienstverleners zijn momenteel klaar voor Stripe.",
    blockedTitle: "Betaling blijft geblokkeerd",
    blockPriceConfirmationRequired:
      "De prijzen moeten worden bevestigd vóór de Stripe-controle.",
    blockPaymentPlanRevalidationRequired:
      "Het betalingscontract moet opnieuw worden gevalideerd.",
    blockStripeServerConfigurationRequired:
      "De Stripe-serverconfiguratie is niet beschikbaar.",
    blockClientMarketNotReady:
      "KLYX is nog niet geopend voor Stripe-betalingen in de markt van de klant.",
    blockProviderMarketNotReady:
      "Minstens één dienstverlener bevindt zich in een KLYX-markt die nog niet open is voor Stripe-betalingen.",
    blockProviderCountryMismatch:
      "Het KLYX-land van minstens één dienstverlener komt niet meer overeen met het land van diens Stripe-account. De betaling blijft geblokkeerd tot dit is opgelost.",
    blockProviderStripeNotReady:
      "Minstens één dienstverlener is nog niet klaar om een betaling te ontvangen.",
    blockMultiProviderRequired:
      "Voor deze missie zijn minstens twee dienstverleners vereist.",
    blockDefault: "De betalingsinfrastructuur is nog niet klaar.",
    noDebitTitle: "Geen afschrijving in deze stap",
    noDebitDescription:
      "Zelfs wanneer alle Stripe-accounts klaar zijn, vereist KLYX nog steeds een uitdrukkelijke bevestiging van de klant voordat een betaling kan worden aangemaakt.",
    safetySummary:
      "Live Stripe-controle · geen PaymentIntent · geen Checkout · geen Transfer · geen automatische betaling.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Die Stripe-Connect-Prüfung ist derzeit nicht verfügbar.",
    loading: "Stripe Connect wird geprüft...",
    errorTitle: "Stripe Connect nicht verfügbar",
    retry: "Erneut versuchen",
    eyebrow: "KLYX 13.25",
    title: "Stripe-Connect-Bereitschaft",
    description:
      "KLYX prüft live, ob jeder Dienstleister seinen Anteil der Zahlung tatsächlich erhalten kann.",
    refresh: "Aktualisieren",
    providersChecked: "Geprüfte Dienstleister",
    readyForStripe: "Bereit für Stripe",
    stateReady: "Stripe bereit",
    stateMissingProfile: "Dienstleisterprofil fehlt",
    stateMarketNotReady: "KLYX-Markt noch nicht geöffnet",
    stateMissingAccount: "Stripe-Konto fehlt",
    stateLookupFailed: "Überprüfung nicht möglich",
    stateRestricted: "Stripe-Konto unvollständig",
    chargesEnabled: "Zahlungen aktiviert",
    payoutsEnabled: "Auszahlungen aktiviert",
    detailsComplete: "Angaben vollständig",
    requirementsDue: "Verbleibende Anforderungen",
    yes: "ja",
    no: "nein",
    readyTitle: "Stripe-Infrastruktur bereit",
    readyDescription:
      "Der Kundenmarkt und alle Dienstleister sind derzeit für Stripe bereit.",
    blockedTitle: "Zahlung weiterhin blockiert",
    blockPriceConfirmationRequired:
      "Die Preise müssen vor der Stripe-Prüfung bestätigt werden.",
    blockPaymentPlanRevalidationRequired:
      "Der Zahlungsvertrag muss erneut validiert werden.",
    blockStripeServerConfigurationRequired:
      "Die serverseitige Stripe-Konfiguration ist nicht verfügbar.",
    blockClientMarketNotReady:
      "KLYX ist im Markt des Kunden noch nicht für Stripe-Zahlungen geöffnet.",
    blockProviderMarketNotReady:
      "Mindestens ein Dienstleister befindet sich in einem KLYX-Markt, der noch nicht für Stripe-Zahlungen geöffnet ist.",
    blockProviderCountryMismatch:
      "Das KLYX-Land mindestens eines Dienstleisters stimmt nicht mehr mit dem Land seines Stripe-Kontos überein. Die Zahlung bleibt bis zur Klärung gesperrt.",
    blockProviderStripeNotReady:
      "Mindestens ein Dienstleister ist noch nicht bereit, eine Zahlung zu erhalten.",
    blockMultiProviderRequired:
      "Für diese Mission sind mindestens zwei Dienstleister erforderlich.",
    blockDefault: "Die Zahlungsinfrastruktur ist noch nicht bereit.",
    noDebitTitle: "Keine Belastung in diesem Schritt",
    noDebitDescription:
      "Auch wenn alle Stripe-Konten bereit sind, verlangt KLYX weiterhin eine ausdrückliche Bestätigung des Kunden, bevor eine Zahlung erstellt werden kann.",
    safetySummary:
      "Live-Stripe-Prüfung · kein PaymentIntent · kein Checkout · kein Transfer · keine automatische Zahlung.",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES
);

export function hasKlyxSplitMissionStripeReadinessTranslation(
  locale: KlyxLocale
) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionStripeReadinessLocale(
  locale: KlyxLocale
): KlyxSplitMissionStripeReadinessLocale {
  return hasKlyxSplitMissionStripeReadinessTranslation(locale)
    ? (locale as KlyxSplitMissionStripeReadinessLocale)
    : "fr";
}

export function getKlyxSplitMissionStripeReadinessDictionary(
  locale: KlyxLocale
) {
  return MESSAGES[resolveKlyxSplitMissionStripeReadinessLocale(locale)];
}

export function translateKlyxSplitMissionStripeReadiness(
  locale: KlyxLocale,
  key: KlyxSplitMissionStripeReadinessMessageKey
) {
  return getKlyxSplitMissionStripeReadinessDictionary(locale)[key];
}
