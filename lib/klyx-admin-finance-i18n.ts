import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxAdminFinanceLocale = (typeof KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_FINANCE_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "backAdmin",
  "readOnly",
  "title",
  "description",
  "refresh",
  "overall",
  "ready",
  "blocked",
  "stripeRuntime",
  "webhookHealth",
  "mode",
  "testMode",
  "liveMode",
  "unknownMode",
  "livePayments",
  "enabled",
  "disabled",
  "connectAccounts",
  "connectNone",
  "connectSummary",
  "checks",
  "checkOk",
  "checkFailed",
  "unknownCheck",
  "safetyNote",
] as const;

export type KlyxAdminFinanceMessageKey = (typeof KLYX_ADMIN_FINANCE_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxAdminFinanceMessageKey, string>;

const MESSAGES: Record<KlyxAdminFinanceLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Impossible de charger le diagnostic financier pour le moment.",
    backAdmin: "Centre Admin KLYX",
    readOnly: "Lecture seule",
    title: "Diagnostic financier KLYX",
    description: "Contrôle la préparation Stripe, Connect et webhook sans déclencher de paiement ni de remboursement.",
    refresh: "Actualiser",
    overall: "État global",
    ready: "Prêt",
    blocked: "À corriger",
    stripeRuntime: "Configuration Stripe",
    webhookHealth: "Webhook Stripe",
    mode: "Mode",
    testMode: "Test",
    liveMode: "Production",
    unknownMode: "Mode à vérifier",
    livePayments: "Paiements réels",
    enabled: "Activés",
    disabled: "Désactivés",
    connectAccounts: "Comptes Connect",
    connectNone: "Aucun compte Connect à contrôler.",
    connectSummary: "{ok}/{total} comptes accessibles",
    checks: "Contrôles",
    checkOk: "OK",
    checkFailed: "À corriger",
    unknownCheck: "Contrôle à vérifier",
    safetyNote: "Cette console est uniquement diagnostique. Aucun paiement, remboursement, Checkout ou transfert n’est créé ici.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Financial diagnostics are currently unavailable.",
    backAdmin: "KLYX Admin Center",
    readOnly: "Read only",
    title: "KLYX financial diagnostics",
    description: "Checks Stripe, Connect, and webhook readiness without triggering payments or refunds.",
    refresh: "Refresh",
    overall: "Overall status",
    ready: "Ready",
    blocked: "Needs attention",
    stripeRuntime: "Stripe configuration",
    webhookHealth: "Stripe webhook",
    mode: "Mode",
    testMode: "Test",
    liveMode: "Production",
    unknownMode: "Mode needs review",
    livePayments: "Live payments",
    enabled: "Enabled",
    disabled: "Disabled",
    connectAccounts: "Connect accounts",
    connectNone: "No Connect account to check.",
    connectSummary: "{ok}/{total} accounts accessible",
    checks: "Checks",
    checkOk: "OK",
    checkFailed: "Needs attention",
    unknownCheck: "Check needs review",
    safetyNote: "This console is diagnostic only. It creates no payment, refund, Checkout, or transfer.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "De financiële diagnose is momenteel niet beschikbaar.",
    backAdmin: "KLYX-beheercentrum",
    readOnly: "Alleen-lezen",
    title: "Financiële diagnose KLYX",
    description: "Controleert Stripe-, Connect- en webhookgereedheid zonder betalingen of terugbetalingen te starten.",
    refresh: "Vernieuwen",
    overall: "Algemene status",
    ready: "Klaar",
    blocked: "Actie vereist",
    stripeRuntime: "Stripe-configuratie",
    webhookHealth: "Stripe-webhook",
    mode: "Modus",
    testMode: "Test",
    liveMode: "Productie",
    unknownMode: "Modus moet worden gecontroleerd",
    livePayments: "Echte betalingen",
    enabled: "Ingeschakeld",
    disabled: "Uitgeschakeld",
    connectAccounts: "Connect-accounts",
    connectNone: "Geen Connect-account om te controleren.",
    connectSummary: "{ok}/{total} accounts toegankelijk",
    checks: "Controles",
    checkOk: "OK",
    checkFailed: "Actie vereist",
    unknownCheck: "Controle moet worden nagekeken",
    safetyNote: "Deze console is alleen diagnostisch. Ze maakt geen betaling, terugbetaling, Checkout of transfer aan.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Die Finanzdiagnose ist derzeit nicht verfügbar.",
    backAdmin: "KLYX Admin-Center",
    readOnly: "Nur lesen",
    title: "KLYX-Finanzdiagnose",
    description: "Prüft Stripe-, Connect- und Webhook-Bereitschaft, ohne Zahlungen oder Rückerstattungen auszulösen.",
    refresh: "Aktualisieren",
    overall: "Gesamtstatus",
    ready: "Bereit",
    blocked: "Zu korrigieren",
    stripeRuntime: "Stripe-Konfiguration",
    webhookHealth: "Stripe-Webhook",
    mode: "Modus",
    testMode: "Test",
    liveMode: "Produktion",
    unknownMode: "Modus muss geprüft werden",
    livePayments: "Echte Zahlungen",
    enabled: "Aktiviert",
    disabled: "Deaktiviert",
    connectAccounts: "Connect-Konten",
    connectNone: "Keine Connect-Konten zu prüfen.",
    connectSummary: "{ok}/{total} Konten erreichbar",
    checks: "Prüfungen",
    checkOk: "OK",
    checkFailed: "Zu korrigieren",
    unknownCheck: "Prüfung muss kontrolliert werden",
    safetyNote: "Diese Konsole dient nur der Diagnose. Sie erstellt keine Zahlung, Rückerstattung, Checkout-Sitzung oder Überweisung.",
  },
};

const CHECK_LABELS: Record<KlyxAdminFinanceLocale, Record<string, string>> = {
  fr: {
    secret_key: "Clé secrète Stripe", publishable_key: "Clé publique Stripe", webhook_secret: "Secret webhook", app_url: "Domaine KLYX", commission: "Commission KLYX", platform_only: "Paiement plateforme de test", live_switch: "Activation paiements réels", stripe_secret: "Clé Stripe du webhook", stripe_mode: "Mode Stripe", webhook_events_table: "Journal anti-doublon",
  },
  en: {
    secret_key: "Stripe secret key", publishable_key: "Stripe publishable key", webhook_secret: "Webhook secret", app_url: "KLYX domain", commission: "KLYX commission", platform_only: "Test platform payment", live_switch: "Live payments switch", stripe_secret: "Webhook Stripe key", stripe_mode: "Stripe mode", webhook_events_table: "Deduplication log",
  },
  nl: {
    secret_key: "Stripe-geheime sleutel", publishable_key: "Stripe-publieke sleutel", webhook_secret: "Webhookgeheim", app_url: "KLYX-domein", commission: "KLYX-commissie", platform_only: "Testplatformbetaling", live_switch: "Schakelaar echte betalingen", stripe_secret: "Stripe-sleutel webhook", stripe_mode: "Stripe-modus", webhook_events_table: "Anti-dubbel logboek",
  },
  de: {
    secret_key: "Stripe-Geheimschlüssel", publishable_key: "Öffentlicher Stripe-Schlüssel", webhook_secret: "Webhook-Geheimnis", app_url: "KLYX-Domain", commission: "KLYX-Provision", platform_only: "Test-Plattformzahlung", live_switch: "Schalter für echte Zahlungen", stripe_secret: "Stripe-Schlüssel des Webhooks", stripe_mode: "Stripe-Modus", webhook_events_table: "Duplikatschutz-Protokoll",
  },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES);

export function resolveKlyxAdminFinanceLocale(locale: KlyxLocale): KlyxAdminFinanceLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminFinanceLocale) : "fr";
}

export function getKlyxAdminFinanceDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminFinanceLocale(locale)];
}

export function translateKlyxAdminFinance(locale: KlyxLocale, key: KlyxAdminFinanceMessageKey) {
  return getKlyxAdminFinanceDictionary(locale)[key];
}

export function translateKlyxAdminFinanceCheck(locale: KlyxLocale, key: string) {
  const resolved = resolveKlyxAdminFinanceLocale(locale);
  return CHECK_LABELS[resolved][key] ?? MESSAGES[resolved].unknownCheck;
}

export function translateKlyxAdminFinanceMode(locale: KlyxLocale, mode: string | undefined) {
  const dictionary = getKlyxAdminFinanceDictionary(locale);
  if (mode === "test") return dictionary.testMode;
  if (mode === "live") return dictionary.liveMode;
  return dictionary.unknownMode;
}

export function formatKlyxAdminFinanceConnect(locale: KlyxLocale, ok: number, total: number) {
  const dictionary = getKlyxAdminFinanceDictionary(locale);
  if (total === 0) return dictionary.connectNone;
  return dictionary.connectSummary.replace("{ok}", String(ok)).replace("{total}", String(total));
}
