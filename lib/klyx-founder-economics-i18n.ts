import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_ECONOMICS_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderEconomicsLocale = (typeof KLYX_FOUNDER_ECONOMICS_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_ECONOMICS_MESSAGE_KEYS = [
  "eyebrow", "title", "description", "clientPrice", "commission", "clientPays",
  "klyxReceives", "providerReceives", "examples", "mission", "klyx", "provider", "disclaimer",
] as const;
export type KlyxFounderEconomicsMessageKey = (typeof KLYX_FOUNDER_ECONOMICS_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderEconomicsMessageKey, string>;

const MESSAGES: Record<KlyxFounderEconomicsLocale, Dictionary> = {
  fr: {
    eyebrow: "Économie KLYX", title: "Combien gagne KLYX par mission ?",
    description: "Le checkout Stripe utilise actuellement une commission configurable avec KLYX_COMMISSION_PERCENT. La valeur par défaut est 15 %.",
    clientPrice: "Prix payé par le client", commission: "Commission KLYX (%)", clientPays: "Client paie",
    klyxReceives: "KLYX reçoit", providerReceives: "Prestataire reçoit", examples: "Exemples avec 15 %",
    mission: "Mission", klyx: "KLYX", provider: "Prestataire",
    disclaimer: "Ces montants représentent la commission applicative KLYX avant prise en compte d’éventuels coûts Stripe, taxes, remboursements ou autres charges de l’entreprise.",
  },
  en: {
    eyebrow: "KLYX economics", title: "How much does KLYX earn per job?",
    description: "Stripe Checkout currently uses a commission configurable with KLYX_COMMISSION_PERCENT. The default value is 15%.",
    clientPrice: "Price paid by the client", commission: "KLYX commission (%)", clientPays: "Client pays",
    klyxReceives: "KLYX receives", providerReceives: "Provider receives", examples: "Examples at 15%",
    mission: "Job", klyx: "KLYX", provider: "Provider",
    disclaimer: "These amounts represent the KLYX application commission before any Stripe costs, taxes, refunds, or other company expenses.",
  },
  nl: {
    eyebrow: "KLYX-economie", title: "Hoeveel verdient KLYX per opdracht?",
    description: "Stripe Checkout gebruikt momenteel een commissie die instelbaar is met KLYX_COMMISSION_PERCENT. De standaardwaarde is 15%.",
    clientPrice: "Prijs betaald door de klant", commission: "KLYX-commissie (%)", clientPays: "Klant betaalt",
    klyxReceives: "KLYX ontvangt", providerReceives: "Dienstverlener ontvangt", examples: "Voorbeelden met 15%",
    mission: "Opdracht", klyx: "KLYX", provider: "Dienstverlener",
    disclaimer: "Deze bedragen tonen de KLYX-applicatiecommissie vóór eventuele Stripe-kosten, belastingen, terugbetalingen of andere bedrijfskosten.",
  },
  de: {
    eyebrow: "KLYX-Wirtschaft", title: "Wie viel verdient KLYX pro Auftrag?",
    description: "Stripe Checkout verwendet derzeit eine über KLYX_COMMISSION_PERCENT konfigurierbare Provision. Der Standardwert beträgt 15 %.",
    clientPrice: "Vom Kunden gezahlter Preis", commission: "KLYX-Provision (%)", clientPays: "Kunde zahlt",
    klyxReceives: "KLYX erhält", providerReceives: "Anbieter erhält", examples: "Beispiele mit 15 %",
    mission: "Auftrag", klyx: "KLYX", provider: "Anbieter",
    disclaimer: "Diese Beträge zeigen die KLYX-Anwendungsprovision vor möglichen Stripe-Kosten, Steuern, Rückerstattungen oder anderen Unternehmenskosten.",
  },
};

const INTL: Record<KlyxFounderEconomicsLocale, string> = {
  fr: "fr-BE", en: "en-BE", nl: "nl-BE", de: "de-BE",
};
const LOCALE_SET = new Set<string>(KLYX_FOUNDER_ECONOMICS_TRANSLATED_LOCALES);

export function resolveKlyxFounderEconomicsLocale(locale: KlyxLocale): KlyxFounderEconomicsLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderEconomicsLocale) : "fr";
}
export function getKlyxFounderEconomicsDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderEconomicsLocale(locale)];
}
export function translateKlyxFounderEconomics(locale: KlyxLocale, key: KlyxFounderEconomicsMessageKey) {
  return getKlyxFounderEconomicsDictionary(locale)[key];
}
export function formatKlyxFounderEconomicsMoney(locale: KlyxLocale, value: number): string {
  return new Intl.NumberFormat(INTL[resolveKlyxFounderEconomicsLocale(locale)], {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
