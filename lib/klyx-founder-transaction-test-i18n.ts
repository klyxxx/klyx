import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_TRANSACTION_TEST_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderTransactionTestLocale = (typeof KLYX_FOUNDER_TRANSACTION_TEST_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_TRANSACTION_TEST_MESSAGE_KEYS = [
  "eyebrow", "title", "description", "rerun", "loadError", "state", "ready", "blocked",
  "blockers", "warnings", "checks", "requiredFlow",
] as const;
export type KlyxFounderTransactionTestMessageKey = (typeof KLYX_FOUNDER_TRANSACTION_TEST_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderTransactionTestMessageKey, string>;

const MESSAGES: Record<KlyxFounderTransactionTestLocale, Dictionary> = {
  fr: {
    eyebrow: "Founder · KLYX 12.17", title: "Test transactionnel",
    description: "Vérifie la chaîne réservation → paiement → mission → avis avant KLYX Mobile.",
    rerun: "Relancer", loadError: "Audit transactionnel impossible pour le moment.", state: "État",
    ready: "PRÊT", blocked: "BLOQUÉ", blockers: "Blocages", warnings: "Alertes",
    checks: "Contrôles", requiredFlow: "Parcours obligatoire",
  },
  en: {
    eyebrow: "Founder · KLYX 12.17", title: "Transaction test",
    description: "Checks the booking → payment → job → review chain before KLYX Mobile.",
    rerun: "Run again", loadError: "The transaction audit cannot run right now.", state: "Status",
    ready: "READY", blocked: "BLOCKED", blockers: "Blockers", warnings: "Warnings",
    checks: "Checks", requiredFlow: "Required flow",
  },
  nl: {
    eyebrow: "Founder · KLYX 12.17", title: "Transactietest",
    description: "Controleert de keten boeking → betaling → opdracht → beoordeling vóór KLYX Mobile.",
    rerun: "Opnieuw uitvoeren", loadError: "De transactie-audit kan momenteel niet worden uitgevoerd.", state: "Status",
    ready: "KLAAR", blocked: "GEBLOKKEERD", blockers: "Blokkades", warnings: "Waarschuwingen",
    checks: "Controles", requiredFlow: "Verplicht traject",
  },
  de: {
    eyebrow: "Founder · KLYX 12.17", title: "Transaktionstest",
    description: "Prüft die Kette Buchung → Zahlung → Auftrag → Bewertung vor KLYX Mobile.",
    rerun: "Erneut ausführen", loadError: "Die Transaktionsprüfung kann derzeit nicht ausgeführt werden.", state: "Status",
    ready: "BEREIT", blocked: "BLOCKIERT", blockers: "Blocker", warnings: "Warnungen",
    checks: "Prüfungen", requiredFlow: "Erforderlicher Ablauf",
  },
};

const LOCALE_SET = new Set<string>(KLYX_FOUNDER_TRANSACTION_TEST_TRANSLATED_LOCALES);

export function resolveKlyxFounderTransactionTestLocale(locale: KlyxLocale): KlyxFounderTransactionTestLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderTransactionTestLocale) : "fr";
}
export function getKlyxFounderTransactionTestDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderTransactionTestLocale(locale)];
}
export function translateKlyxFounderTransactionTest(locale: KlyxLocale, key: KlyxFounderTransactionTestMessageKey) {
  return getKlyxFounderTransactionTestDictionary(locale)[key];
}
