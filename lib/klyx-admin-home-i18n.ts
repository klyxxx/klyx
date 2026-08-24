import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_HOME_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxAdminHomeLocale =
  (typeof KLYX_ADMIN_HOME_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_HOME_MESSAGE_KEYS = [
  "sessionMissing",
  "accessDenied",
  "accessError",
  "deniedTitle",
  "adminAccess",
  "founder",
  "title",
  "description",
  "founderConsoleButton",
  "founderTestsButton",
  "accountAuditButton",
  "searchTitle",
  "searchText",
] as const;

export type KlyxAdminHomeMessageKey =
  (typeof KLYX_ADMIN_HOME_MESSAGE_KEYS)[number];

export const KLYX_ADMIN_HOME_AREA_IDS = [
  "founderConsole",
  "founderTests",
  "accountAudit",
  "launchCenter",
  "providerSkills",
  "providerVerifications",
  "disputes",
  "services",
  "finance",
] as const;

export type KlyxAdminHomeAreaId =
  (typeof KLYX_ADMIN_HOME_AREA_IDS)[number];

type Dictionary = Record<KlyxAdminHomeMessageKey, string>;
type AreaDictionary = Record<KlyxAdminHomeAreaId, { title: string; description: string }>;

const MESSAGES: Record<KlyxAdminHomeLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    accessDenied: "Accès administrateur refusé.",
    accessError: "Impossible de vérifier l’accès administrateur pour le moment.",
    deniedTitle: "Accès administrateur refusé",
    adminAccess: "Accès administrateur",
    founder: "Founder",
    title: "Centre Admin KLYX",
    description:
      "Ton compte dispose de l’accès de supervision KLYX. Les vérifications externes restent l’autorité pour les validations réelles des utilisateurs publics.",
    founderConsoleButton: "Console Founder",
    founderTestsButton: "Tests Founder",
    accountAuditButton: "Audit comptes",
    searchTitle: "Recherche globale disponible",
    searchText:
      "Utilise la barre de recherche du menu ou Ctrl+K pour retrouver rapidement une page KLYX.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    accessDenied: "Administrator access denied.",
    accessError: "Administrator access cannot be verified right now.",
    deniedTitle: "Administrator access denied",
    adminAccess: "Administrator access",
    founder: "Founder",
    title: "KLYX Admin Center",
    description:
      "Your account has KLYX supervision access. External verification providers remain the authority for real public-user validations.",
    founderConsoleButton: "Founder Console",
    founderTestsButton: "Founder Tests",
    accountAuditButton: "Account audit",
    searchTitle: "Global search available",
    searchText:
      "Use the menu search bar or Ctrl+K to quickly find a KLYX page.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    accessDenied: "Beheerderstoegang geweigerd.",
    accessError: "Beheerderstoegang kan momenteel niet worden gecontroleerd.",
    deniedTitle: "Beheerderstoegang geweigerd",
    adminAccess: "Beheerderstoegang",
    founder: "Founder",
    title: "KLYX-beheercentrum",
    description:
      "Je account heeft toegang tot KLYX-supervisie. Externe verificatiepartners blijven de autoriteit voor echte validaties van publieke gebruikers.",
    founderConsoleButton: "Founder-console",
    founderTestsButton: "Founder-tests",
    accountAuditButton: "Accountaudit",
    searchTitle: "Globale zoekfunctie beschikbaar",
    searchText:
      "Gebruik de zoekbalk in het menu of Ctrl+K om snel een KLYX-pagina te vinden.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    accessDenied: "Administratorzugriff verweigert.",
    accessError: "Der Administratorzugriff kann derzeit nicht geprüft werden.",
    deniedTitle: "Administratorzugriff verweigert",
    adminAccess: "Administratorzugriff",
    founder: "Founder",
    title: "KLYX Admin-Center",
    description:
      "Dein Konto hat Zugriff auf die KLYX-Aufsicht. Externe Verifizierungsanbieter bleiben die maßgebliche Stelle für echte Prüfungen öffentlicher Nutzer.",
    founderConsoleButton: "Founder-Konsole",
    founderTestsButton: "Founder-Tests",
    accountAuditButton: "Konten-Audit",
    searchTitle: "Globale Suche verfügbar",
    searchText:
      "Nutze die Suchleiste im Menü oder Ctrl+K, um schnell eine KLYX-Seite zu finden.",
  },
};

const AREAS: Record<KlyxAdminHomeLocale, AreaDictionary> = {
  fr: {
    founderConsole: { title: "Console Founder", description: "Basculer entre Client, Prestataire et Super Admin." },
    founderTests: { title: "Tests Founder", description: "Valider le compte unique et ses accès critiques." },
    accountAudit: { title: "Audit des comptes", description: "Identifier les anciens comptes Auth sans suppression risquée." },
    launchCenter: { title: "Centre de lancement", description: "Contrôler les briques essentielles avant ouverture de KLYX." },
    providerSkills: { title: "Compétences prestataires", description: "Voir les preuves et les décisions métier par métier." },
    providerVerifications: { title: "Vérifications prestataires", description: "Suivre identité, adresse et documents généraux." },
    disputes: { title: "Litiges", description: "Suivre les incidents et dossiers de confiance." },
    services: { title: "Services KLYX", description: "Voir le catalogue et les propositions de services." },
    finance: { title: "Audit financier", description: "Contrôler paiements, remboursements et cohérence Stripe." },
  },
  en: {
    founderConsole: { title: "Founder Console", description: "Switch between Client, Provider, and Super Admin." },
    founderTests: { title: "Founder Tests", description: "Validate the single account and its critical access paths." },
    accountAudit: { title: "Account audit", description: "Identify legacy Auth accounts without risky deletion." },
    launchCenter: { title: "Launch Center", description: "Check essential building blocks before opening KLYX." },
    providerSkills: { title: "Provider skills", description: "Review evidence and decisions skill by skill." },
    providerVerifications: { title: "Provider verifications", description: "Track identity, address, and general documents." },
    disputes: { title: "Disputes", description: "Track incidents and trust cases." },
    services: { title: "KLYX services", description: "Review the catalog and service proposals." },
    finance: { title: "Financial audit", description: "Check payments, refunds, and Stripe consistency." },
  },
  nl: {
    founderConsole: { title: "Founder-console", description: "Schakel tussen Klant, Dienstverlener en Super Admin." },
    founderTests: { title: "Founder-tests", description: "Valideer het unieke account en de kritieke toegangen." },
    accountAudit: { title: "Accountaudit", description: "Identificeer oude Auth-accounts zonder riskante verwijdering." },
    launchCenter: { title: "Lanceringscentrum", description: "Controleer essentiële onderdelen vóór de opening van KLYX." },
    providerSkills: { title: "Vaardigheden dienstverleners", description: "Bekijk bewijs en beslissingen per vaardigheid." },
    providerVerifications: { title: "Verificaties dienstverleners", description: "Volg identiteit, adres en algemene documenten." },
    disputes: { title: "Geschillen", description: "Volg incidenten en vertrouwensdossiers." },
    services: { title: "KLYX-diensten", description: "Bekijk de catalogus en dienstvoorstellen." },
    finance: { title: "Financiële audit", description: "Controleer betalingen, terugbetalingen en Stripe-consistentie." },
  },
  de: {
    founderConsole: { title: "Founder-Konsole", description: "Zwischen Kunde, Anbieter und Super Admin wechseln." },
    founderTests: { title: "Founder-Tests", description: "Das zentrale Konto und seine kritischen Zugriffe prüfen." },
    accountAudit: { title: "Konten-Audit", description: "Alte Auth-Konten ohne riskante Löschung identifizieren." },
    launchCenter: { title: "Launch-Center", description: "Wesentliche Bausteine vor der Öffnung von KLYX prüfen." },
    providerSkills: { title: "Anbieterkompetenzen", description: "Nachweise und Entscheidungen Kompetenz für Kompetenz prüfen." },
    providerVerifications: { title: "Anbieterverifizierungen", description: "Identität, Adresse und allgemeine Dokumente verfolgen." },
    disputes: { title: "Streitfälle", description: "Vorfälle und Vertrauensfälle verfolgen." },
    services: { title: "KLYX-Dienste", description: "Katalog und Dienstvorschläge prüfen." },
    finance: { title: "Finanz-Audit", description: "Zahlungen, Rückerstattungen und Stripe-Konsistenz prüfen." },
  },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_HOME_TRANSLATED_LOCALES);

export function resolveKlyxAdminHomeLocale(locale: KlyxLocale): KlyxAdminHomeLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminHomeLocale) : "fr";
}

export function getKlyxAdminHomeDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminHomeLocale(locale)];
}

export function translateKlyxAdminHome(
  locale: KlyxLocale,
  key: KlyxAdminHomeMessageKey
) {
  return getKlyxAdminHomeDictionary(locale)[key];
}

export function getKlyxAdminHomeAreaCopy(locale: KlyxLocale, id: KlyxAdminHomeAreaId) {
  return AREAS[resolveKlyxAdminHomeLocale(locale)][id];
}
