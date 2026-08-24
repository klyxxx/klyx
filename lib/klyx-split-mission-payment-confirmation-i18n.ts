import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionPaymentConfirmationLocale =
  (typeof KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "confirmError",
  "loading",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "totalAmount",
  "paymentUnits",
  "providers",
  "provider",
  "slots",
  "blockedTitle",
  "blockPriceConfirmationRequired",
  "blockMissionStructureChanged",
  "blockLivePaymentPlanChanged",
  "blockProviderStripeNotReady",
  "blockProviderStripeLookupFailed",
  "blockPaymentAllocationMismatch",
  "blockDefault",
  "amountConsentTitle",
  "amountConsentDescription",
  "splitConsentTitle",
  "splitConsentDescription",
  "confirmButton",
  "confirmedTitle",
  "confirmedDescription",
  "noDebitSummary",
  "reconfirmationSummary",
] as const;

export type KlyxSplitMissionPaymentConfirmationMessageKey =
  (typeof KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_MESSAGE_KEYS)[number];

type Dictionary = Record<
  KlyxSplitMissionPaymentConfirmationMessageKey,
  string
>;

const MESSAGES: Record<
  KlyxSplitMissionPaymentConfirmationLocale,
  Dictionary
> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "La confirmation du paiement est indisponible pour le moment.",
    confirmError: "La confirmation du paiement n'a pas pu être enregistrée.",
    loading: "Préparation de la confirmation finale...",
    eyebrow: "KLYX 13.26",
    title: "Confirmation finale du paiement",
    description:
      "Confirme le montant final et sa répartition avant que KLYX soit autorisé à créer une étape de paiement.",
    refresh: "Actualiser",
    totalAmount: "Montant total confirmé",
    paymentUnits: "unité(s) de paiement",
    providers: "prestataire(s)",
    provider: "Prestataire",
    slots: "créneau(x)",
    blockedTitle: "Confirmation bloquée",
    blockPriceConfirmationRequired: "Les prix doivent être confirmés.",
    blockMissionStructureChanged: "La structure de la mission a changé.",
    blockLivePaymentPlanChanged: "Les montants ou l'acceptation ont changé.",
    blockProviderStripeNotReady:
      "Au moins un prestataire n'est plus prêt sur Stripe.",
    blockProviderStripeLookupFailed:
      "Impossible de revalider un compte Stripe.",
    blockPaymentAllocationMismatch:
      "La répartition du paiement n'est plus cohérente.",
    blockDefault:
      "La confirmation du paiement n'est pas encore disponible.",
    amountConsentTitle: "Je confirme le montant total affiché.",
    amountConsentDescription:
      "Aucun montant ne pourra être modifié silencieusement après cette confirmation.",
    splitConsentTitle:
      "Je confirme la répartition entre les prestataires.",
    splitConsentDescription:
      "La mission reste unique, mais chaque prestataire correspond à une unité de paiement distincte.",
    confirmButton: "Confirmer le paiement",
    confirmedTitle: "Confirmation explicite enregistrée",
    confirmedDescription:
      "KLYX possède maintenant la preuve exacte du montant et de la répartition approuvés. Aucun débit n'a encore été effectué.",
    noDebitSummary:
      "Confirmation ≠ débit. Aucun PaymentIntent, aucun Checkout, aucun Transfer et aucun mouvement d'argent ne sont créés par 13.26.",
    reconfirmationSummary:
      "Toute modification ultérieure du plan de paiement invalide la preuve et impose une nouvelle confirmation.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Payment confirmation is currently unavailable.",
    confirmError: "Payment confirmation could not be recorded.",
    loading: "Preparing final confirmation...",
    eyebrow: "KLYX 13.26",
    title: "Final payment confirmation",
    description:
      "Confirm the final amount and its allocation before KLYX is authorized to create a payment step.",
    refresh: "Refresh",
    totalAmount: "Confirmed total amount",
    paymentUnits: "payment unit(s)",
    providers: "provider(s)",
    provider: "Provider",
    slots: "slot(s)",
    blockedTitle: "Confirmation blocked",
    blockPriceConfirmationRequired: "Prices must be confirmed.",
    blockMissionStructureChanged: "The mission structure has changed.",
    blockLivePaymentPlanChanged:
      "The amounts or provider acceptance have changed.",
    blockProviderStripeNotReady:
      "At least one provider is no longer ready on Stripe.",
    blockProviderStripeLookupFailed:
      "A Stripe account could not be revalidated.",
    blockPaymentAllocationMismatch:
      "The payment allocation is no longer consistent.",
    blockDefault: "Payment confirmation is not available yet.",
    amountConsentTitle: "I confirm the total amount shown.",
    amountConsentDescription:
      "No amount can be changed silently after this confirmation.",
    splitConsentTitle: "I confirm the allocation between providers.",
    splitConsentDescription:
      "The mission remains a single mission, but each provider corresponds to a separate payment unit.",
    confirmButton: "Confirm payment",
    confirmedTitle: "Explicit confirmation recorded",
    confirmedDescription:
      "KLYX now has exact proof of the approved amount and allocation. No charge has been made yet.",
    noDebitSummary:
      "Confirmation ≠ charge. 13.26 creates no PaymentIntent, Checkout, Transfer, or movement of money.",
    reconfirmationSummary:
      "Any later change to the payment plan invalidates the proof and requires a new confirmation.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "De betalingsbevestiging is momenteel niet beschikbaar.",
    confirmError: "De betalingsbevestiging kon niet worden opgeslagen.",
    loading: "Definitieve bevestiging voorbereiden...",
    eyebrow: "KLYX 13.26",
    title: "Definitieve betalingsbevestiging",
    description:
      "Bevestig het definitieve bedrag en de verdeling voordat KLYX een betalingsstap mag aanmaken.",
    refresh: "Vernieuwen",
    totalAmount: "Bevestigd totaalbedrag",
    paymentUnits: "betalingseenheid/-eenheden",
    providers: "dienstverlener(s)",
    provider: "Dienstverlener",
    slots: "tijdslot(en)",
    blockedTitle: "Bevestiging geblokkeerd",
    blockPriceConfirmationRequired: "De prijzen moeten worden bevestigd.",
    blockMissionStructureChanged: "De structuur van de missie is gewijzigd.",
    blockLivePaymentPlanChanged:
      "De bedragen of de acceptatie door dienstverleners zijn gewijzigd.",
    blockProviderStripeNotReady:
      "Minstens één dienstverlener is niet langer klaar op Stripe.",
    blockProviderStripeLookupFailed:
      "Een Stripe-account kon niet opnieuw worden gevalideerd.",
    blockPaymentAllocationMismatch:
      "De betalingsverdeling is niet langer consistent.",
    blockDefault: "De betalingsbevestiging is nog niet beschikbaar.",
    amountConsentTitle: "Ik bevestig het weergegeven totaalbedrag.",
    amountConsentDescription:
      "Na deze bevestiging kan geen bedrag stilzwijgend worden gewijzigd.",
    splitConsentTitle:
      "Ik bevestig de verdeling tussen de dienstverleners.",
    splitConsentDescription:
      "De missie blijft één geheel, maar elke dienstverlener correspondeert met een afzonderlijke betalingseenheid.",
    confirmButton: "Betaling bevestigen",
    confirmedTitle: "Uitdrukkelijke bevestiging opgeslagen",
    confirmedDescription:
      "KLYX heeft nu exact bewijs van het goedgekeurde bedrag en de verdeling. Er is nog niets afgeschreven.",
    noDebitSummary:
      "Bevestiging ≠ afschrijving. 13.26 maakt geen PaymentIntent, Checkout, Transfer of geldbeweging aan.",
    reconfirmationSummary:
      "Elke latere wijziging van het betalingsplan maakt het bewijs ongeldig en vereist een nieuwe bevestiging.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Die Zahlungsbestätigung ist derzeit nicht verfügbar.",
    confirmError: "Die Zahlungsbestätigung konnte nicht gespeichert werden.",
    loading: "Endgültige Bestätigung wird vorbereitet...",
    eyebrow: "KLYX 13.26",
    title: "Endgültige Zahlungsbestätigung",
    description:
      "Bestätige den endgültigen Betrag und seine Aufteilung, bevor KLYX einen Zahlungsschritt erstellen darf.",
    refresh: "Aktualisieren",
    totalAmount: "Bestätigter Gesamtbetrag",
    paymentUnits: "Zahlungseinheit(en)",
    providers: "Dienstleister",
    provider: "Dienstleister",
    slots: "Zeitfenster",
    blockedTitle: "Bestätigung blockiert",
    blockPriceConfirmationRequired: "Die Preise müssen bestätigt werden.",
    blockMissionStructureChanged: "Die Struktur der Mission hat sich geändert.",
    blockLivePaymentPlanChanged:
      "Die Beträge oder die Annahme durch Dienstleister haben sich geändert.",
    blockProviderStripeNotReady:
      "Mindestens ein Dienstleister ist bei Stripe nicht mehr bereit.",
    blockProviderStripeLookupFailed:
      "Ein Stripe-Konto konnte nicht erneut validiert werden.",
    blockPaymentAllocationMismatch:
      "Die Zahlungsaufteilung ist nicht mehr konsistent.",
    blockDefault: "Die Zahlungsbestätigung ist noch nicht verfügbar.",
    amountConsentTitle: "Ich bestätige den angezeigten Gesamtbetrag.",
    amountConsentDescription:
      "Nach dieser Bestätigung kann kein Betrag stillschweigend geändert werden.",
    splitConsentTitle:
      "Ich bestätige die Aufteilung zwischen den Dienstleistern.",
    splitConsentDescription:
      "Die Mission bleibt eine Einheit, aber jeder Dienstleister entspricht einer separaten Zahlungseinheit.",
    confirmButton: "Zahlung bestätigen",
    confirmedTitle: "Ausdrückliche Bestätigung gespeichert",
    confirmedDescription:
      "KLYX verfügt nun über den exakten Nachweis des genehmigten Betrags und der Aufteilung. Es wurde noch keine Belastung vorgenommen.",
    noDebitSummary:
      "Bestätigung ≠ Belastung. 13.26 erstellt keinen PaymentIntent, Checkout, Transfer und keine Geldbewegung.",
    reconfirmationSummary:
      "Jede spätere Änderung des Zahlungsplans macht den Nachweis ungültig und erfordert eine neue Bestätigung.",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES
);

export function hasKlyxSplitMissionPaymentConfirmationTranslation(
  locale: KlyxLocale
) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionPaymentConfirmationLocale(
  locale: KlyxLocale
): KlyxSplitMissionPaymentConfirmationLocale {
  return hasKlyxSplitMissionPaymentConfirmationTranslation(locale)
    ? (locale as KlyxSplitMissionPaymentConfirmationLocale)
    : "fr";
}

export function getKlyxSplitMissionPaymentConfirmationDictionary(
  locale: KlyxLocale
) {
  return MESSAGES[resolveKlyxSplitMissionPaymentConfirmationLocale(locale)];
}

export function translateKlyxSplitMissionPaymentConfirmation(
  locale: KlyxLocale,
  key: KlyxSplitMissionPaymentConfirmationMessageKey
) {
  return getKlyxSplitMissionPaymentConfirmationDictionary(locale)[key];
}
