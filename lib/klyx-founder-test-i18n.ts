import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_TEST_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderTestLocale = (typeof KLYX_FOUNDER_TEST_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_TEST_MESSAGE_KEYS = [
  "backFounder", "badge", "title", "description", "rerun", "loadError",
  "overall", "readyTitle", "notReadyTitle", "readyBadge", "notReadyBadge",
  "tests", "ok", "warnings", "blockers", "nonBlocking", "testClient",
  "testProvider", "testAdmin", "lastDiagnostic",
] as const;
export type KlyxFounderTestMessageKey = (typeof KLYX_FOUNDER_TEST_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderTestMessageKey, string>;

const MESSAGES: Record<KlyxFounderTestLocale, Dictionary> = {
  fr: {
    backFounder: "Console Founder", badge: "KLYX Test Center", title: "Diagnostic KLYX",
    description: "Contrôles non destructifs du compte Founder, des profils, du catalogue, des tarifs, des favoris, des transactions et de l’infrastructure.",
    rerun: "Relancer les tests", loadError: "Impossible d’exécuter les tests pour le moment.",
    overall: "État global", readyTitle: "KLYX prêt pour les tests Beta", notReadyTitle: "Corrections nécessaires",
    readyBadge: "PRÊT", notReadyBadge: "NON PRÊT", tests: "Tests", ok: "OK", warnings: "Attention",
    blockers: "Blocages", nonBlocking: "NON BLOQUANT", testClient: "Tester Client",
    testProvider: "Tester Prestataire", testAdmin: "Tester Admin", lastDiagnostic: "Dernier diagnostic",
  },
  en: {
    backFounder: "Founder Console", badge: "KLYX Test Center", title: "KLYX diagnostics",
    description: "Non-destructive checks of the Founder account, profiles, catalog, pricing, favorites, transactions, and infrastructure.",
    rerun: "Run tests again", loadError: "The tests cannot be run right now.", overall: "Overall status",
    readyTitle: "KLYX is ready for Beta testing", notReadyTitle: "Corrections required", readyBadge: "READY",
    notReadyBadge: "NOT READY", tests: "Tests", ok: "OK", warnings: "Warnings", blockers: "Blockers",
    nonBlocking: "NON-BLOCKING", testClient: "Test Client", testProvider: "Test Provider", testAdmin: "Test Admin",
    lastDiagnostic: "Last diagnostic",
  },
  nl: {
    backFounder: "Founder-console", badge: "KLYX Test Center", title: "KLYX-diagnose",
    description: "Niet-destructieve controles van het Founder-account, profielen, de catalogus, tarieven, favorieten, transacties en infrastructuur.",
    rerun: "Tests opnieuw uitvoeren", loadError: "De tests kunnen momenteel niet worden uitgevoerd.", overall: "Algemene status",
    readyTitle: "KLYX is klaar voor Beta-tests", notReadyTitle: "Correcties vereist", readyBadge: "KLAAR",
    notReadyBadge: "NIET KLAAR", tests: "Tests", ok: "OK", warnings: "Waarschuwingen", blockers: "Blokkades",
    nonBlocking: "NIET BLOKKEREND", testClient: "Klant testen", testProvider: "Dienstverlener testen", testAdmin: "Admin testen",
    lastDiagnostic: "Laatste diagnose",
  },
  de: {
    backFounder: "Founder-Konsole", badge: "KLYX Test Center", title: "KLYX-Diagnose",
    description: "Nicht-destruktive Prüfungen des Founder-Kontos, der Profile, des Katalogs, der Preise, Favoriten, Transaktionen und Infrastruktur.",
    rerun: "Tests erneut ausführen", loadError: "Die Tests können derzeit nicht ausgeführt werden.", overall: "Gesamtstatus",
    readyTitle: "KLYX ist bereit für Beta-Tests", notReadyTitle: "Korrekturen erforderlich", readyBadge: "BEREIT",
    notReadyBadge: "NICHT BEREIT", tests: "Tests", ok: "OK", warnings: "Warnungen", blockers: "Blocker",
    nonBlocking: "NICHT BLOCKIEREND", testClient: "Kunde testen", testProvider: "Anbieter testen", testAdmin: "Admin testen",
    lastDiagnostic: "Letzte Diagnose",
  },
};

const GROUPS: Record<KlyxFounderTestLocale, Record<string, string>> = {
  fr: {
    "Accès": "Accès", "Profils": "Profils", "Catalogue": "Catalogue", "Prestataire": "Prestataire",
    "Client": "Client", "Transactions": "Transactions", "Paiement": "Paiement", "Vérification": "Vérification",
    "Sécurité": "Sécurité", "Beta 12.6": "Beta 12.6",
  },
  en: {
    "Accès": "Access", "Profils": "Profiles", "Catalogue": "Catalog", "Prestataire": "Provider",
    "Client": "Client", "Transactions": "Transactions", "Paiement": "Payment", "Vérification": "Verification",
    "Sécurité": "Security", "Beta 12.6": "Beta 12.6",
  },
  nl: {
    "Accès": "Toegang", "Profils": "Profielen", "Catalogue": "Catalogus", "Prestataire": "Dienstverlener",
    "Client": "Klant", "Transactions": "Transacties", "Paiement": "Betaling", "Vérification": "Verificatie",
    "Sécurité": "Beveiliging", "Beta 12.6": "Beta 12.6",
  },
  de: {
    "Accès": "Zugriff", "Profils": "Profile", "Catalogue": "Katalog", "Prestataire": "Anbieter",
    "Client": "Kunde", "Transactions": "Transaktionen", "Paiement": "Zahlung", "Vérification": "Verifizierung",
    "Sécurité": "Sicherheit", "Beta 12.6": "Beta 12.6",
  },
};

const INTL: Record<KlyxFounderTestLocale, string> = {
  fr: "fr-BE", en: "en-BE", nl: "nl-BE", de: "de-BE",
};
const LOCALE_SET = new Set<string>(KLYX_FOUNDER_TEST_TRANSLATED_LOCALES);

export function resolveKlyxFounderTestLocale(locale: KlyxLocale): KlyxFounderTestLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderTestLocale) : "fr";
}
export function getKlyxFounderTestDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderTestLocale(locale)];
}
export function translateKlyxFounderTest(locale: KlyxLocale, key: KlyxFounderTestMessageKey) {
  return getKlyxFounderTestDictionary(locale)[key];
}
export function translateKlyxFounderTestGroup(locale: KlyxLocale, group: string) {
  const resolved = resolveKlyxFounderTestLocale(locale);
  return GROUPS[resolved][group] ?? group;
}
export function formatKlyxFounderTestDateTime(locale: KlyxLocale, value: string) {
  return new Date(value).toLocaleString(INTL[resolveKlyxFounderTestLocale(locale)]);
}
