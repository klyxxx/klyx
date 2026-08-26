import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderFinalCheckLocale = (typeof KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_FINAL_CHECK_MESSAGE_KEYS = [
  "backFounder", "badge", "title", "description", "rerun", "loadError",
  "step", "readyTitle", "notReadyTitle", "readyBadge", "notReadyBadge",
  "ok", "warnings", "blockers", "nonBlocking", "validatedTitle", "validatedDescription",
  "founderTitle", "founderDescription", "founderActive", "founderUnavailable",
  "adminTitle", "adminDescription", "adminActive", "adminUnavailable",
  "clientProfileTitle", "clientProfileDescription", "providerProfileTitle", "providerProfileDescription",
  "activeProfileTitle", "activeProfileDescription", "noActiveProfile",
  "cleanupTitle", "cleanupOkDescription", "cleanupAuditDescription", "cleanupNone", "cleanupUnavailable",
  "sumsubTitle", "sumsubDescription", "sumsubPending", "networkError",
] as const;
export type KlyxFounderFinalCheckMessageKey = (typeof KLYX_FOUNDER_FINAL_CHECK_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderFinalCheckMessageKey, string>;

const MESSAGES: Record<KlyxFounderFinalCheckLocale, Dictionary> = {
  fr: {
    backFounder: "Console Founder", badge: "Contrôle final", title: "Validation finale Founder",
    description: "Dernier contrôle avant la validation finale. Aucun compte ni donnée n’est modifié par cette page.",
    rerun: "Relancer", loadError: "Validation impossible pour le moment.", step: "Statut",
    readyTitle: "Validation prête à être finalisée", notReadyTitle: "Corrections requises avant validation", readyBadge: "PRÊT", notReadyBadge: "À CORRIGER",
    ok: "OK", warnings: "Avertissements", blockers: "Blocages", nonBlocking: "NON BLOQUANT",
    validatedTitle: "Validation finale réussie", validatedDescription: "Founder, Client, Prestataire et Admin sont prêts. Les avertissements non bloquants peuvent être traités plus tard.",
    founderTitle: "Founder", founderDescription: "Le compte connecté est reconnu comme Founder.", founderActive: "Founder actif", founderUnavailable: "Accès Founder indisponible",
    adminTitle: "Super Admin", adminDescription: "Le même compte peut accéder au Centre Admin.", adminActive: "Admin actif", adminUnavailable: "Accès Admin indisponible",
    clientProfileTitle: "Profil Client", clientProfileDescription: "Un profil Client appartient au compte unique.",
    providerProfileTitle: "Profil Prestataire", providerProfileDescription: "Un profil Prestataire appartient au compte unique.",
    activeProfileTitle: "Profil actif", activeProfileDescription: "KLYX dispose d’un profil actif valide.", noActiveProfile: "Aucun profil actif",
    cleanupTitle: "Nettoyage comptes", cleanupOkDescription: "Les anciens comptes Auth inutiles ont été contrôlés.", cleanupAuditDescription: "L’audit des comptes doit rester accessible.", cleanupNone: "Aucun compte non référencé restant", cleanupUnavailable: "Audit des comptes indisponible",
    sumsubTitle: "Sumsub", sumsubDescription: "Sumsub reste non bloquant tant que l’intégration externe n’est pas activée.", sumsubPending: "En attente", networkError: "Erreur réseau",
  },
  en: {
    backFounder: "Founder Console", badge: "Final check", title: "Founder final validation",
    description: "Final check before final validation. This page does not modify any account or data.",
    rerun: "Run again", loadError: "Validation cannot run right now.", step: "Status",
    readyTitle: "Ready for final validation", notReadyTitle: "Corrections required before validation", readyBadge: "READY", notReadyBadge: "NEEDS FIXES",
    ok: "OK", warnings: "Warnings", blockers: "Blockers", nonBlocking: "NON-BLOCKING",
    validatedTitle: "Final validation successful", validatedDescription: "Founder, Client, Provider, and Admin are ready. Non-blocking warnings can be handled later.",
    founderTitle: "Founder", founderDescription: "The signed-in account is recognized as Founder.", founderActive: "Founder active", founderUnavailable: "Founder access unavailable",
    adminTitle: "Super Admin", adminDescription: "The same account can access the Admin Center.", adminActive: "Admin active", adminUnavailable: "Admin access unavailable",
    clientProfileTitle: "Client profile", clientProfileDescription: "A Client profile belongs to the single account.",
    providerProfileTitle: "Provider profile", providerProfileDescription: "A Provider profile belongs to the single account.",
    activeProfileTitle: "Active profile", activeProfileDescription: "KLYX has a valid active profile.", noActiveProfile: "No active profile",
    cleanupTitle: "Account cleanup", cleanupOkDescription: "Unused legacy Auth accounts have been checked.", cleanupAuditDescription: "The account audit must remain accessible.", cleanupNone: "No unreferenced account remains", cleanupUnavailable: "Account audit unavailable",
    sumsubTitle: "Sumsub", sumsubDescription: "Sumsub remains non-blocking until the external integration is enabled.", sumsubPending: "Pending", networkError: "Network error",
  },
  nl: {
    backFounder: "Founder-console", badge: "Eindcontrole", title: "Definitieve Founder-validatie",
    description: "Laatste controle vóór de definitieve validatie. Deze pagina wijzigt geen account of gegevens.",
    rerun: "Opnieuw uitvoeren", loadError: "De validatie kan momenteel niet worden uitgevoerd.", step: "Status",
    readyTitle: "Klaar voor definitieve validatie", notReadyTitle: "Correcties vereist vóór validatie", readyBadge: "KLAAR", notReadyBadge: "TE CORRIGEREN",
    ok: "OK", warnings: "Waarschuwingen", blockers: "Blokkades", nonBlocking: "NIET BLOKKEREND",
    validatedTitle: "Definitieve validatie geslaagd", validatedDescription: "Founder, Klant, Dienstverlener en Admin zijn klaar. Niet-blokkerende waarschuwingen kunnen later worden behandeld.",
    founderTitle: "Founder", founderDescription: "Het aangemelde account wordt als Founder herkend.", founderActive: "Founder actief", founderUnavailable: "Founder-toegang niet beschikbaar",
    adminTitle: "Super Admin", adminDescription: "Hetzelfde account heeft toegang tot het Admin Center.", adminActive: "Admin actief", adminUnavailable: "Admin-toegang niet beschikbaar",
    clientProfileTitle: "Klantprofiel", clientProfileDescription: "Een Klantprofiel behoort tot het ene account.",
    providerProfileTitle: "Dienstverlenerprofiel", providerProfileDescription: "Een Dienstverlenerprofiel behoort tot het ene account.",
    activeProfileTitle: "Actief profiel", activeProfileDescription: "KLYX heeft een geldig actief profiel.", noActiveProfile: "Geen actief profiel",
    cleanupTitle: "Accounts opschonen", cleanupOkDescription: "Ongebruikte oude Auth-accounts zijn gecontroleerd.", cleanupAuditDescription: "De accountaudit moet toegankelijk blijven.", cleanupNone: "Geen niet-gerefereerd account meer", cleanupUnavailable: "Accountaudit niet beschikbaar",
    sumsubTitle: "Sumsub", sumsubDescription: "Sumsub blijft niet-blokkerend totdat de externe integratie is geactiveerd.", sumsubPending: "In afwachting", networkError: "Netwerkfout",
  },
  de: {
    backFounder: "Founder-Konsole", badge: "Abschlussprüfung", title: "Abschließende Founder-Validierung",
    description: "Letzte Prüfung vor der endgültigen Freigabe. Diese Seite ändert weder Konten noch Daten.",
    rerun: "Erneut ausführen", loadError: "Die Validierung kann derzeit nicht ausgeführt werden.", step: "Status",
    readyTitle: "Bereit für die endgültige Freigabe", notReadyTitle: "Korrekturen vor der Freigabe erforderlich", readyBadge: "BEREIT", notReadyBadge: "ZU KORRIGIEREN",
    ok: "OK", warnings: "Warnungen", blockers: "Blocker", nonBlocking: "NICHT BLOCKIEREND",
    validatedTitle: "Endgültige Freigabe erfolgreich", validatedDescription: "Founder, Kunde, Anbieter und Admin sind bereit. Nicht blockierende Warnungen können später bearbeitet werden.",
    founderTitle: "Founder", founderDescription: "Das angemeldete Konto wird als Founder erkannt.", founderActive: "Founder aktiv", founderUnavailable: "Founder-Zugriff nicht verfügbar",
    adminTitle: "Super Admin", adminDescription: "Dasselbe Konto kann auf das Admin Center zugreifen.", adminActive: "Admin aktiv", adminUnavailable: "Admin-Zugriff nicht verfügbar",
    clientProfileTitle: "Kundenprofil", clientProfileDescription: "Ein Kundenprofil gehört zum einzigen Konto.",
    providerProfileTitle: "Anbieterprofil", providerProfileDescription: "Ein Anbieterprofil gehört zum einzigen Konto.",
    activeProfileTitle: "Aktives Profil", activeProfileDescription: "KLYX verfügt über ein gültiges aktives Profil.", noActiveProfile: "Kein aktives Profil",
    cleanupTitle: "Kontenbereinigung", cleanupOkDescription: "Nicht mehr benötigte alte Auth-Konten wurden geprüft.", cleanupAuditDescription: "Die Kontoprüfung muss erreichbar bleiben.", cleanupNone: "Kein nicht referenziertes Konto verbleibt", cleanupUnavailable: "Kontoprüfung nicht verfügbar",
    sumsubTitle: "Sumsub", sumsubDescription: "Sumsub bleibt nicht blockierend, bis die externe Integration aktiviert ist.", sumsubPending: "Ausstehend", networkError: "Netzwerkfehler",
  },
};

const PAGE_LABELS: Record<KlyxFounderFinalCheckLocale, Record<string, string>> = {
  fr: { "/dashboard": "Dashboard", "/accounts": "Profils", "/profile": "Profil personnel", "/provider": "Espace Prestataire", "/admin": "Centre Admin", "/founder": "Console Founder", "/founder/test": "Tests Founder", "/founder/cleanup": "Nettoyage comptes" },
  en: { "/dashboard": "Dashboard", "/accounts": "Profiles", "/profile": "Personal profile", "/provider": "Provider area", "/admin": "Admin Center", "/founder": "Founder Console", "/founder/test": "Founder tests", "/founder/cleanup": "Account cleanup" },
  nl: { "/dashboard": "Dashboard", "/accounts": "Profielen", "/profile": "Persoonlijk profiel", "/provider": "Dienstverlenersruimte", "/admin": "Admin Center", "/founder": "Founder-console", "/founder/test": "Founder-tests", "/founder/cleanup": "Accounts opschonen" },
  de: { "/dashboard": "Dashboard", "/accounts": "Profile", "/profile": "Persönliches Profil", "/provider": "Anbieterbereich", "/admin": "Admin Center", "/founder": "Founder-Konsole", "/founder/test": "Founder-Tests", "/founder/cleanup": "Kontenbereinigung" },
};

const LOCALE_SET = new Set<string>(KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES);

export function resolveKlyxFounderFinalCheckLocale(locale: KlyxLocale): KlyxFounderFinalCheckLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderFinalCheckLocale) : "fr";
}
export function getKlyxFounderFinalCheckDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderFinalCheckLocale(locale)];
}
export function translateKlyxFounderFinalCheck(locale: KlyxLocale, key: KlyxFounderFinalCheckMessageKey) {
  return getKlyxFounderFinalCheckDictionary(locale)[key];
}
export function translateKlyxFounderFinalCheckPageLabel(locale: KlyxLocale, path: string) {
  return PAGE_LABELS[resolveKlyxFounderFinalCheckLocale(locale)][path] ?? path;
}
export function formatKlyxFounderFinalCheckPageDescription(locale: KlyxLocale, path: string) {
  const resolved = resolveKlyxFounderFinalCheckLocale(locale);
  if (resolved === "en") return `${path} responds correctly.`;
  if (resolved === "nl") return `${path} reageert correct.`;
  if (resolved === "de") return `${path} antwortet korrekt.`;
  return `${path} répond correctement.`;
}
export function formatKlyxFounderFinalCheckProfileCount(locale: KlyxLocale, count: number, kind: "client" | "provider") {
  const resolved = resolveKlyxFounderFinalCheckLocale(locale);
  if (resolved === "en") return `${count} ${kind === "client" ? "Client" : "Provider"} profile(s)`;
  if (resolved === "nl") return `${count} ${kind === "client" ? "Klant" : "Dienstverlener"}-profiel(en)`;
  if (resolved === "de") return `${count} ${kind === "client" ? "Kunden" : "Anbieter"}profil(e)`;
  return `${count} profil(s) ${kind === "client" ? "Client" : "Prestataire"}`;
}
export function formatKlyxFounderFinalCheckUnreferenced(locale: KlyxLocale, count: number) {
  const resolved = resolveKlyxFounderFinalCheckLocale(locale);
  if (resolved === "en") return `${count} unreferenced account(s) still present`;
  if (resolved === "nl") return `${count} niet-gerefereerd(e) account(s) nog aanwezig`;
  if (resolved === "de") return `${count} nicht referenzierte(s) Konto/Konten noch vorhanden`;
  return `${count} compte(s) non référencé(s) encore présent(s)`;
}
export function formatKlyxFounderFinalCheckPending(locale: KlyxLocale, status?: number) {
  const base = translateKlyxFounderFinalCheck(locale, "sumsubPending");
  return typeof status === "number" ? `${base} - HTTP ${status}` : base;
}
