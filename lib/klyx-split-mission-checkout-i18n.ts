import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionCheckoutLocale =
  (typeof KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_CHECKOUT_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "prepareError",
  "loading",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "lastStepTitle",
  "lastStepDescription",
  "preparePayments",
  "payments",
  "confirmed",
  "total",
  "provider",
  "slots",
  "paid",
  "payProvider",
  "refreshRequired",
  "missionPaidTitle",
  "missionPaidDescription",
  "currencyUnavailable",
  "safetySummary",
] as const;

export type KlyxSplitMissionCheckoutMessageKey =
  (typeof KLYX_SPLIT_MISSION_CHECKOUT_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxSplitMissionCheckoutMessageKey, string>;

const MESSAGES: Record<KlyxSplitMissionCheckoutLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Les paiements sont indisponibles pour le moment.",
    prepareError: "La préparation des paiements est impossible pour le moment.",
    loading: "Vérification des paiements...",
    eyebrow: "KLYX 13.27",
    title: "Paiement sécurisé",
    description:
      "Chaque prestataire possède son propre Checkout Stripe. Aucun paiement n'est lancé automatiquement.",
    refresh: "Actualiser",
    lastStepTitle: "Dernière étape avant Stripe",
    lastStepDescription:
      "Cette action crée ou réutilise uniquement les pages Stripe correspondant exactement à la confirmation enregistrée. Elle ne débite rien.",
    preparePayments: "Préparer mes paiements",
    payments: "Paiements",
    confirmed: "Confirmés",
    total: "Total",
    provider: "Prestataire",
    slots: "créneau(x)",
    paid: "Payé",
    payProvider: "Payer ce prestataire",
    refreshRequired: "Actualisation requise",
    missionPaidTitle: "Mission entièrement payée",
    missionPaidDescription:
      "Toutes les unités Stripe ont été confirmées comme payées par le webhook KLYX.",
    currencyUnavailable: "devise indisponible",
    safetySummary:
      "Une session Stripe ouverte peut être réutilisée et une session expirée peut être recréée avec une nouvelle tentative idempotente. Le client doit ouvrir explicitement chaque Checkout non payé ; une unité déjà payée ne peut jamais être repayée silencieusement.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Payments are currently unavailable.",
    prepareError: "Payment preparation is currently unavailable.",
    loading: "Checking payments...",
    eyebrow: "KLYX 13.27",
    title: "Secure payment",
    description:
      "Each provider has their own Stripe Checkout. No payment is started automatically.",
    refresh: "Refresh",
    lastStepTitle: "Final step before Stripe",
    lastStepDescription:
      "This action only creates or reuses the Stripe pages that exactly match the recorded confirmation. It does not charge anything.",
    preparePayments: "Prepare my payments",
    payments: "Payments",
    confirmed: "Confirmed",
    total: "Total",
    provider: "Provider",
    slots: "slot(s)",
    paid: "Paid",
    payProvider: "Pay this provider",
    refreshRequired: "Refresh required",
    missionPaidTitle: "Mission fully paid",
    missionPaidDescription:
      "Every Stripe unit has been confirmed as paid by the KLYX webhook.",
    currencyUnavailable: "currency unavailable",
    safetySummary:
      "An open Stripe session can be reused and an expired session can be recreated with a new idempotent attempt. The client must explicitly open each unpaid Checkout; an already paid unit can never be silently paid again.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "Betalingen zijn momenteel niet beschikbaar.",
    prepareError: "De voorbereiding van betalingen is momenteel niet beschikbaar.",
    loading: "Betalingen controleren...",
    eyebrow: "KLYX 13.27",
    title: "Veilige betaling",
    description:
      "Elke dienstverlener heeft een eigen Stripe Checkout. Geen enkele betaling wordt automatisch gestart.",
    refresh: "Vernieuwen",
    lastStepTitle: "Laatste stap vóór Stripe",
    lastStepDescription:
      "Deze actie maakt alleen de Stripe-pagina's aan of hergebruikt ze wanneer ze exact overeenkomen met de geregistreerde bevestiging. Er wordt niets afgeschreven.",
    preparePayments: "Mijn betalingen voorbereiden",
    payments: "Betalingen",
    confirmed: "Bevestigd",
    total: "Totaal",
    provider: "Dienstverlener",
    slots: "tijdslot(en)",
    paid: "Betaald",
    payProvider: "Deze dienstverlener betalen",
    refreshRequired: "Vernieuwing vereist",
    missionPaidTitle: "Missie volledig betaald",
    missionPaidDescription:
      "Alle Stripe-eenheden zijn door de KLYX-webhook als betaald bevestigd.",
    currencyUnavailable: "valuta niet beschikbaar",
    safetySummary:
      "Een open Stripe-sessie kan worden hergebruikt en een verlopen sessie kan met een nieuwe idempotente poging opnieuw worden aangemaakt. De klant moet elke onbetaalde Checkout uitdrukkelijk openen; een reeds betaalde eenheid kan nooit stilzwijgend opnieuw worden betaald.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Zahlungen sind derzeit nicht verfügbar.",
    prepareError: "Die Vorbereitung der Zahlungen ist derzeit nicht verfügbar.",
    loading: "Zahlungen werden geprüft...",
    eyebrow: "KLYX 13.27",
    title: "Sichere Zahlung",
    description:
      "Jeder Dienstleister hat einen eigenen Stripe Checkout. Keine Zahlung wird automatisch gestartet.",
    refresh: "Aktualisieren",
    lastStepTitle: "Letzter Schritt vor Stripe",
    lastStepDescription:
      "Diese Aktion erstellt oder verwendet nur die Stripe-Seiten, die exakt der gespeicherten Bestätigung entsprechen. Es wird nichts belastet.",
    preparePayments: "Meine Zahlungen vorbereiten",
    payments: "Zahlungen",
    confirmed: "Bestätigt",
    total: "Gesamt",
    provider: "Dienstleister",
    slots: "Zeitfenster",
    paid: "Bezahlt",
    payProvider: "Diesen Dienstleister bezahlen",
    refreshRequired: "Aktualisierung erforderlich",
    missionPaidTitle: "Mission vollständig bezahlt",
    missionPaidDescription:
      "Alle Stripe-Einheiten wurden durch den KLYX-Webhook als bezahlt bestätigt.",
    currencyUnavailable: "Währung nicht verfügbar",
    safetySummary:
      "Eine offene Stripe-Sitzung kann wiederverwendet und eine abgelaufene Sitzung mit einem neuen idempotenten Versuch neu erstellt werden. Der Kunde muss jeden unbezahlten Checkout ausdrücklich öffnen; eine bereits bezahlte Einheit kann niemals stillschweigend erneut bezahlt werden.",
  },
};

const LOCALE_SET = new Set<string>(KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES);

export function hasKlyxSplitMissionCheckoutTranslation(locale: KlyxLocale) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionCheckoutLocale(
  locale: KlyxLocale
): KlyxSplitMissionCheckoutLocale {
  return hasKlyxSplitMissionCheckoutTranslation(locale)
    ? (locale as KlyxSplitMissionCheckoutLocale)
    : "fr";
}

export function getKlyxSplitMissionCheckoutDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxSplitMissionCheckoutLocale(locale)];
}

export function translateKlyxSplitMissionCheckout(
  locale: KlyxLocale,
  key: KlyxSplitMissionCheckoutMessageKey
) {
  return getKlyxSplitMissionCheckoutDictionary(locale)[key];
}
