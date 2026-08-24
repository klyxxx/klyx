import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionPaymentPlanLocale =
  (typeof KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_PAYMENT_PLAN_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "loading",
  "errorTitle",
  "retry",
  "title",
  "description",
  "refresh",
  "providers",
  "paymentUnits",
  "missionTotal",
  "providerPayment",
  "slots",
  "readyTitle",
  "readyDescription",
  "blockedTitle",
  "blockMissionStructureChanged",
  "blockProviderAcceptanceChanged",
  "blockLivePriceChanged",
  "blockPriceProofMismatch",
  "blockMultiProviderAllocationRequired",
  "blockPriceConfirmationRequired",
  "blockDefault",
  "noPaymentTitle",
  "noPaymentDescription",
  "safetySummary",
  "currencyUnavailable",
] as const;

export type KlyxSplitMissionPaymentPlanMessageKey =
  (typeof KLYX_SPLIT_MISSION_PAYMENT_PLAN_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSplitMissionPaymentPlanMessageKey, string>;

const MESSAGES: Record<KlyxSplitMissionPaymentPlanLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Le contrat de paiement est indisponible pour le moment.",
    loading: "Préparation du contrat de paiement...",
    errorTitle: "Contrat de paiement indisponible",
    retry: "Réessayer",
    title: "Architecture du paiement",
    description:
      "La mission reste unique pour le client, mais KLYX prépare une unité de paiement distincte pour chaque prestataire.",
    refresh: "Actualiser",
    providers: "Prestataires",
    paymentUnits: "Unités de paiement",
    missionTotal: "Total mission",
    providerPayment: "Paiement prestataire",
    slots: "Créneaux",
    readyTitle: "Contrat de paiement cohérent",
    readyDescription:
      "Les montants correspondent toujours exactement à la confirmation de prix et tous les prestataires sont encore acceptés.",
    blockedTitle: "Paiement bloqué",
    blockMissionStructureChanged: "La structure de la mission a changé.",
    blockProviderAcceptanceChanged:
      "Un prestataire n'est plus dans l'état accepté.",
    blockLivePriceChanged:
      "Un montant diffère de la preuve de prix confirmée.",
    blockPriceProofMismatch: "La preuve de prix n'est plus cohérente.",
    blockMultiProviderAllocationRequired:
      "La mission ne contient plus plusieurs unités prestataires.",
    blockPriceConfirmationRequired: "Les prix doivent d'abord être confirmés.",
    blockDefault: "Le paiement n'est pas encore prêt.",
    noPaymentTitle: "Aucun paiement n'est créé ici",
    noPaymentDescription:
      "13.24 définit seulement le contrat commercial. La disponibilité Stripe Connect de chaque prestataire sera vérifiée avant d'autoriser une création de paiement.",
    safetySummary:
      "Une mission client · plusieurs unités prestataires · confirmation de paiement explicite obligatoire · aucun Checkout Stripe automatique.",
    currencyUnavailable: "devise indisponible",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "The payment contract is currently unavailable.",
    loading: "Preparing the payment contract...",
    errorTitle: "Payment contract unavailable",
    retry: "Try again",
    title: "Payment architecture",
    description:
      "The mission remains a single mission for the client, while KLYX prepares a separate payment unit for each provider.",
    refresh: "Refresh",
    providers: "Providers",
    paymentUnits: "Payment units",
    missionTotal: "Mission total",
    providerPayment: "Provider payment",
    slots: "Slots",
    readyTitle: "Payment contract is consistent",
    readyDescription:
      "The amounts still exactly match the confirmed price proof and every provider is still accepted.",
    blockedTitle: "Payment blocked",
    blockMissionStructureChanged: "The mission structure has changed.",
    blockProviderAcceptanceChanged:
      "A provider is no longer in the accepted state.",
    blockLivePriceChanged:
      "An amount differs from the confirmed price proof.",
    blockPriceProofMismatch: "The price proof is no longer consistent.",
    blockMultiProviderAllocationRequired:
      "The mission no longer contains multiple provider units.",
    blockPriceConfirmationRequired: "Prices must be confirmed first.",
    blockDefault: "Payment is not ready yet.",
    noPaymentTitle: "No payment is created here",
    noPaymentDescription:
      "13.24 only defines the commercial contract. Each provider's Stripe Connect readiness will be checked before any payment creation can be authorized.",
    safetySummary:
      "One client mission · multiple provider units · explicit payment confirmation required · no automatic Stripe Checkout.",
    currencyUnavailable: "currency unavailable",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "Het betalingscontract is momenteel niet beschikbaar.",
    loading: "Betalingscontract voorbereiden...",
    errorTitle: "Betalingscontract niet beschikbaar",
    retry: "Opnieuw proberen",
    title: "Betalingsarchitectuur",
    description:
      "De missie blijft één geheel voor de klant, terwijl KLYX voor elke dienstverlener een afzonderlijke betalingseenheid voorbereidt.",
    refresh: "Vernieuwen",
    providers: "Dienstverleners",
    paymentUnits: "Betalingseenheden",
    missionTotal: "Totaal missie",
    providerPayment: "Betaling dienstverlener",
    slots: "Tijdsloten",
    readyTitle: "Betalingscontract is consistent",
    readyDescription:
      "De bedragen komen nog exact overeen met de bevestigde prijsbewijzen en alle dienstverleners zijn nog geaccepteerd.",
    blockedTitle: "Betaling geblokkeerd",
    blockMissionStructureChanged: "De structuur van de missie is gewijzigd.",
    blockProviderAcceptanceChanged:
      "Een dienstverlener heeft niet langer de status geaccepteerd.",
    blockLivePriceChanged:
      "Een bedrag wijkt af van het bevestigde prijsbewijs.",
    blockPriceProofMismatch: "Het prijsbewijs is niet langer consistent.",
    blockMultiProviderAllocationRequired:
      "De missie bevat niet langer meerdere dienstverlenereenheden.",
    blockPriceConfirmationRequired: "De prijzen moeten eerst worden bevestigd.",
    blockDefault: "De betaling is nog niet klaar.",
    noPaymentTitle: "Hier wordt geen betaling aangemaakt",
    noPaymentDescription:
      "13.24 definieert alleen het commerciële contract. De Stripe Connect-gereedheid van elke dienstverlener wordt gecontroleerd voordat een betaling kan worden aangemaakt.",
    safetySummary:
      "Eén klantmissie · meerdere dienstverlenereenheden · expliciete betalingsbevestiging verplicht · geen automatische Stripe Checkout.",
    currencyUnavailable: "valuta niet beschikbaar",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Der Zahlungsvertrag ist derzeit nicht verfügbar.",
    loading: "Zahlungsvertrag wird vorbereitet...",
    errorTitle: "Zahlungsvertrag nicht verfügbar",
    retry: "Erneut versuchen",
    title: "Zahlungsarchitektur",
    description:
      "Die Mission bleibt für den Kunden eine Einheit, während KLYX für jeden Dienstleister eine separate Zahlungseinheit vorbereitet.",
    refresh: "Aktualisieren",
    providers: "Dienstleister",
    paymentUnits: "Zahlungseinheiten",
    missionTotal: "Gesamtsumme der Mission",
    providerPayment: "Dienstleisterzahlung",
    slots: "Zeitfenster",
    readyTitle: "Zahlungsvertrag ist konsistent",
    readyDescription:
      "Die Beträge entsprechen weiterhin exakt dem bestätigten Preisnachweis und alle Dienstleister sind noch angenommen.",
    blockedTitle: "Zahlung blockiert",
    blockMissionStructureChanged: "Die Struktur der Mission hat sich geändert.",
    blockProviderAcceptanceChanged:
      "Ein Dienstleister befindet sich nicht mehr im angenommenen Status.",
    blockLivePriceChanged:
      "Ein Betrag weicht vom bestätigten Preisnachweis ab.",
    blockPriceProofMismatch: "Der Preisnachweis ist nicht mehr konsistent.",
    blockMultiProviderAllocationRequired:
      "Die Mission enthält nicht mehr mehrere Dienstleistereinheiten.",
    blockPriceConfirmationRequired: "Die Preise müssen zuerst bestätigt werden.",
    blockDefault: "Die Zahlung ist noch nicht bereit.",
    noPaymentTitle: "Hier wird keine Zahlung erstellt",
    noPaymentDescription:
      "13.24 definiert nur den kommerziellen Vertrag. Die Stripe-Connect-Bereitschaft jedes Dienstleisters wird geprüft, bevor eine Zahlungserstellung autorisiert werden kann.",
    safetySummary:
      "Eine Kundenmission · mehrere Dienstleistereinheiten · ausdrückliche Zahlungsbestätigung erforderlich · kein automatischer Stripe Checkout.",
    currencyUnavailable: "Währung nicht verfügbar",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES
);

export function hasKlyxSplitMissionPaymentPlanTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionPaymentPlanLocale(
  locale: KlyxLocale
): KlyxSplitMissionPaymentPlanLocale {
  return hasKlyxSplitMissionPaymentPlanTranslation(locale)
    ? (locale as KlyxSplitMissionPaymentPlanLocale)
    : "fr";
}

export function getKlyxSplitMissionPaymentPlanDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxSplitMissionPaymentPlanLocale(locale)];
}

export function translateKlyxSplitMissionPaymentPlan(
  locale: KlyxLocale,
  key: KlyxSplitMissionPaymentPlanMessageKey
) {
  return getKlyxSplitMissionPaymentPlanDictionary(locale)[key];
}
