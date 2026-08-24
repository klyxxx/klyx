import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxAdminLaunchLocale =
  (typeof KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_LAUNCH_MESSAGE_KEYS = [
  "sessionMissing",
  "accessDenied",
  "auditError",
  "inaccessible",
  "deniedTitle",
  "backAdmin",
  "step",
  "title",
  "description",
  "rerun",
  "globalState",
  "readyTitle",
  "blockedTitle",
  "readyBadge",
  "notReadyBadge",
  "okMetric",
  "warningsMetric",
  "blockersMetric",
  "optional",
  "open",
  "launchRule",
  "launchRuleText",
  "probeFailed",
] as const;

export type KlyxAdminLaunchMessageKey =
  (typeof KLYX_ADMIN_LAUNCH_MESSAGE_KEYS)[number];

export const KLYX_ADMIN_LAUNCH_PROBE_IDS = [
  "home",
  "login",
  "signup",
  "install",
  "manifest",
  "service-worker",
  "offline",
  "verifications",
  "skills",
  "stripe",
  "sumsub",
] as const;

export type KlyxAdminLaunchProbeId =
  (typeof KLYX_ADMIN_LAUNCH_PROBE_IDS)[number];

type Dictionary = Record<KlyxAdminLaunchMessageKey, string>;
type ProbeCopy = Record<KlyxAdminLaunchProbeId, { title: string; description: string }>;

const MESSAGES: Record<KlyxAdminLaunchLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    accessDenied: "Accès administrateur refusé.",
    auditError: "Impossible d’exécuter l’audit de lancement pour le moment.",
    inaccessible: "Accès impossible.",
    deniedTitle: "Accès administrateur refusé",
    backAdmin: "Centre Admin",
    step: "Étape 11",
    title: "Centre de lancement KLYX",
    description:
      "Cette page contrôle les briques essentielles du lancement. Un avertissement optionnel ne bloque pas KLYX. Une erreur sur un contrôle obligatoire doit être corrigée avant ouverture.",
    rerun: "Relancer l’audit",
    globalState: "État global",
    readyTitle: "Socle de lancement prêt",
    blockedTitle: "Blocage avant lancement",
    readyBadge: "PRÊT",
    notReadyBadge: "NON PRÊT",
    okMetric: "OK",
    warningsMetric: "Avertissements",
    blockersMetric: "Blocages",
    optional: "OPTIONNEL",
    open: "Ouvrir",
    launchRule: "Règle de lancement",
    launchRuleText:
      "KLYX peut continuer vers les derniers tests utilisateurs quand tous les contrôles obligatoires sont verts. Sumsub reste volontairement non bloquant tant que cette intégration externe n’est pas activée.",
    probeFailed: "Échec du contrôle.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    accessDenied: "Administrator access denied.",
    auditError: "The launch audit cannot be run right now.",
    inaccessible: "Access unavailable.",
    deniedTitle: "Administrator access denied",
    backAdmin: "Admin Center",
    step: "Step 11",
    title: "KLYX Launch Center",
    description:
      "This page checks the essential launch building blocks. An optional warning does not block KLYX. An error on a required check must be fixed before launch.",
    rerun: "Run audit again",
    globalState: "Overall status",
    readyTitle: "Launch foundation ready",
    blockedTitle: "Launch blocked",
    readyBadge: "READY",
    notReadyBadge: "NOT READY",
    okMetric: "OK",
    warningsMetric: "Warnings",
    blockersMetric: "Blockers",
    optional: "OPTIONAL",
    open: "Open",
    launchRule: "Launch rule",
    launchRuleText:
      "KLYX can proceed to the final user tests when every required check is green. Sumsub intentionally remains non-blocking until that external integration is enabled.",
    probeFailed: "Check failed.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    accessDenied: "Beheerderstoegang geweigerd.",
    auditError: "De lanceringsaudit kan momenteel niet worden uitgevoerd.",
    inaccessible: "Toegang niet beschikbaar.",
    deniedTitle: "Beheerderstoegang geweigerd",
    backAdmin: "Beheercentrum",
    step: "Stap 11",
    title: "KLYX-lanceringscentrum",
    description:
      "Deze pagina controleert de essentiële onderdelen voor de lancering. Een optionele waarschuwing blokkeert KLYX niet. Een fout bij een verplichte controle moet vóór de lancering worden opgelost.",
    rerun: "Audit opnieuw uitvoeren",
    globalState: "Algemene status",
    readyTitle: "Lanceringsbasis gereed",
    blockedTitle: "Lancering geblokkeerd",
    readyBadge: "GEREED",
    notReadyBadge: "NIET GEREED",
    okMetric: "OK",
    warningsMetric: "Waarschuwingen",
    blockersMetric: "Blokkeringen",
    optional: "OPTIONEEL",
    open: "Openen",
    launchRule: "Lanceringsregel",
    launchRuleText:
      "KLYX kan doorgaan naar de laatste gebruikerstests wanneer alle verplichte controles groen zijn. Sumsub blijft bewust niet-blokkerend zolang die externe integratie niet is geactiveerd.",
    probeFailed: "Controle mislukt.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    accessDenied: "Administratorzugriff verweigert.",
    auditError: "Das Launch-Audit kann derzeit nicht ausgeführt werden.",
    inaccessible: "Zugriff nicht verfügbar.",
    deniedTitle: "Administratorzugriff verweigert",
    backAdmin: "Admin-Center",
    step: "Schritt 11",
    title: "KLYX Launch-Center",
    description:
      "Diese Seite prüft die wesentlichen Bausteine für den Launch. Eine optionale Warnung blockiert KLYX nicht. Ein Fehler bei einer verpflichtenden Prüfung muss vor dem Launch behoben werden.",
    rerun: "Audit erneut ausführen",
    globalState: "Gesamtstatus",
    readyTitle: "Launch-Grundlage bereit",
    blockedTitle: "Launch blockiert",
    readyBadge: "BEREIT",
    notReadyBadge: "NICHT BEREIT",
    okMetric: "OK",
    warningsMetric: "Warnungen",
    blockersMetric: "Blockierungen",
    optional: "OPTIONAL",
    open: "Öffnen",
    launchRule: "Launch-Regel",
    launchRuleText:
      "KLYX kann mit den letzten Nutzertests fortfahren, wenn alle verpflichtenden Prüfungen grün sind. Sumsub bleibt bewusst nicht blockierend, solange diese externe Integration nicht aktiviert ist.",
    probeFailed: "Prüfung fehlgeschlagen.",
  },
};

const PROBES: Record<KlyxAdminLaunchLocale, ProbeCopy> = {
  fr: {
    home: { title: "Accueil public", description: "La porte d’entrée KLYX répond." },
    login: { title: "Connexion", description: "La page de connexion est accessible." },
    signup: { title: "Inscription", description: "La création de compte est accessible." },
    install: { title: "Installation PWA", description: "La page Installer KLYX est accessible." },
    manifest: { title: "Manifest PWA", description: "Le manifest de l’application est servi." },
    "service-worker": { title: "Service worker", description: "Le service worker KLYX est disponible." },
    offline: { title: "Mode hors ligne", description: "La page de secours hors ligne est disponible." },
    verifications: { title: "Vérifications prestataires", description: "Le centre de vérification admin répond." },
    skills: { title: "Validation des compétences", description: "Le contrôle métier par métier répond." },
    stripe: { title: "Stripe / paiements", description: "Le contrôle de préparation Stripe répond." },
    sumsub: { title: "Sumsub", description: "Vérification externe optionnelle pour le lancement actuel." },
  },
  en: {
    home: { title: "Public home", description: "The KLYX entry point responds." },
    login: { title: "Sign in", description: "The sign-in page is accessible." },
    signup: { title: "Sign up", description: "Account creation is accessible." },
    install: { title: "PWA installation", description: "The KLYX install page is accessible." },
    manifest: { title: "PWA manifest", description: "The application manifest is served." },
    "service-worker": { title: "Service worker", description: "The KLYX service worker is available." },
    offline: { title: "Offline mode", description: "The offline fallback page is available." },
    verifications: { title: "Provider verification", description: "The admin verification center responds." },
    skills: { title: "Skill validation", description: "The per-skill verification check responds." },
    stripe: { title: "Stripe / payments", description: "The Stripe readiness check responds." },
    sumsub: { title: "Sumsub", description: "Optional external verification for the current launch." },
  },
  nl: {
    home: { title: "Openbare startpagina", description: "Het KLYX-toegangspunt reageert." },
    login: { title: "Aanmelden", description: "De aanmeldpagina is bereikbaar." },
    signup: { title: "Registreren", description: "Accountregistratie is bereikbaar." },
    install: { title: "PWA-installatie", description: "De installatiepagina van KLYX is bereikbaar." },
    manifest: { title: "PWA-manifest", description: "Het applicatiemanifest wordt geleverd." },
    "service-worker": { title: "Service worker", description: "De KLYX-serviceworker is beschikbaar." },
    offline: { title: "Offline modus", description: "De offline noodpagina is beschikbaar." },
    verifications: { title: "Dienstverlenersverificatie", description: "Het beheerverificatiecentrum reageert." },
    skills: { title: "Vaardigheden valideren", description: "De controle per vaardigheid reageert." },
    stripe: { title: "Stripe / betalingen", description: "De Stripe-gereedheidscontrole reageert." },
    sumsub: { title: "Sumsub", description: "Optionele externe verificatie voor de huidige lancering." },
  },
  de: {
    home: { title: "Öffentliche Startseite", description: "Der KLYX-Einstiegspunkt antwortet." },
    login: { title: "Anmeldung", description: "Die Anmeldeseite ist erreichbar." },
    signup: { title: "Registrierung", description: "Die Kontoerstellung ist erreichbar." },
    install: { title: "PWA-Installation", description: "Die KLYX-Installationsseite ist erreichbar." },
    manifest: { title: "PWA-Manifest", description: "Das App-Manifest wird ausgeliefert." },
    "service-worker": { title: "Service Worker", description: "Der KLYX Service Worker ist verfügbar." },
    offline: { title: "Offline-Modus", description: "Die Offline-Ersatzseite ist verfügbar." },
    verifications: { title: "Anbieterverifizierung", description: "Das Admin-Verifizierungszentrum antwortet." },
    skills: { title: "Kompetenzprüfung", description: "Die Prüfung je Kompetenz antwortet." },
    stripe: { title: "Stripe / Zahlungen", description: "Die Stripe-Bereitschaftsprüfung antwortet." },
    sumsub: { title: "Sumsub", description: "Optionale externe Verifizierung für den aktuellen Launch." },
  },
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_LAUNCH_TRANSLATED_LOCALES);

export function resolveKlyxAdminLaunchLocale(locale: KlyxLocale): KlyxAdminLaunchLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminLaunchLocale) : "fr";
}

export function getKlyxAdminLaunchDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxAdminLaunchLocale(locale)];
}

export function translateKlyxAdminLaunch(
  locale: KlyxLocale,
  key: KlyxAdminLaunchMessageKey
) {
  return getKlyxAdminLaunchDictionary(locale)[key];
}

export function getKlyxAdminLaunchProbeCopy(
  locale: KlyxLocale,
  id: KlyxAdminLaunchProbeId
) {
  return PROBES[resolveKlyxAdminLaunchLocale(locale)][id];
}

export function formatKlyxAdminLaunchProbeDetail(
  locale: KlyxLocale,
  httpStatus: number | null
) {
  return httpStatus === null
    ? translateKlyxAdminLaunch(locale, "probeFailed")
    : `HTTP ${httpStatus}`;
}
