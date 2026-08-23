import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_INSTALL_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxInstallPageLocale =
  (typeof KLYX_INSTALL_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_INSTALL_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "login",
  "backHome",
  "badge",
  "heroTitle",
  "heroDescription",
  "androidTitle",
  "androidDescription",
  "iosTitle",
  "iosDescription",
  "desktopTitle",
  "desktopDescription",
  "benefitsEyebrow",
  "benefitIcon",
  "benefitAppMode",
  "benefitSameAccount",
  "benefitNoStore",
  "browserTitle",
  "browserDescription",
  "browserLogin",
  "browserSignup",
  "currentVersionTitle",
  "currentVersionDescription",
] as const;

export type KlyxInstallPageMessageKey =
  (typeof KLYX_INSTALL_PAGE_MESSAGE_KEYS)[number];

type InstallPageDictionary = Record<KlyxInstallPageMessageKey, string>;

const INSTALL_PAGE_MESSAGES: Record<
  KlyxInstallPageLocale,
  InstallPageDictionary
> = {
  fr: {
    metadataTitle: "Installer KLYX",
    metadataDescription:
      "Installe KLYX sur ton téléphone, ta tablette ou ton ordinateur.",
    login: "Se connecter",
    backHome: "Retour à l’accueil",
    badge: "Installer KLYX",
    heroTitle: "KLYX directement sur ton appareil.",
    heroDescription:
      "KLYX fonctionne déjà dans ton navigateur. L’installation est facultative : elle ajoute une icône KLYX et permet une ouverture plus proche d’une application classique.",
    androidTitle: "Android",
    androidDescription:
      "Sur Chrome ou Edge compatible, utilise le bouton Installer KLYX quand il apparaît.",
    iosTitle: "iPhone / iPad",
    iosDescription:
      "Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.",
    desktopTitle: "Ordinateur",
    desktopDescription:
      "Chrome ou Edge peut installer KLYX dans une fenêtre dédiée avec son icône.",
    benefitsEyebrow: "Ce que tu obtiens",
    benefitIcon: "Une icône KLYX sur ton appareil",
    benefitAppMode:
      "Une ouverture en mode application quand le navigateur le permet",
    benefitSameAccount: "Le même compte et les mêmes données que sur le site",
    benefitNoStore:
      "Aucun App Store ou Google Play nécessaire pour cette version",
    browserTitle: "Pas envie d’installer ?",
    browserDescription:
      "Aucun problème. KLYX reste entièrement accessible depuis le navigateur sur téléphone, tablette et ordinateur.",
    browserLogin: "Se connecter",
    browserSignup: "Créer un compte",
    currentVersionTitle: "Version actuelle",
    currentVersionDescription:
      "Cette version est une application web installable (PWA). Ce n’est pas encore une application publiée sur l’App Store ou Google Play. Les applications magasin viendront après la stabilisation de KLYX.",
  },
  en: {
    metadataTitle: "Install KLYX",
    metadataDescription:
      "Install KLYX on your phone, tablet or computer.",
    login: "Sign in",
    backHome: "Back to home",
    badge: "Install KLYX",
    heroTitle: "KLYX directly on your device.",
    heroDescription:
      "KLYX already works in your browser. Installation is optional: it adds a KLYX icon and lets KLYX open more like a traditional app.",
    androidTitle: "Android",
    androidDescription:
      "In compatible Chrome or Edge, use the Install KLYX button when it appears.",
    iosTitle: "iPhone / iPad",
    iosDescription: "In Safari: Share → Add to Home Screen → Add.",
    desktopTitle: "Computer",
    desktopDescription:
      "Chrome or Edge can install KLYX in a dedicated window with its icon.",
    benefitsEyebrow: "What you get",
    benefitIcon: "A KLYX icon on your device",
    benefitAppMode: "App-like opening when the browser supports it",
    benefitSameAccount: "The same account and data as on the website",
    benefitNoStore:
      "No App Store or Google Play is required for this version",
    browserTitle: "Don’t want to install it?",
    browserDescription:
      "No problem. KLYX remains fully accessible from the browser on phone, tablet and computer.",
    browserLogin: "Sign in",
    browserSignup: "Create an account",
    currentVersionTitle: "Current version",
    currentVersionDescription:
      "This version is an installable web application (PWA). It is not yet an app published on the App Store or Google Play. Store apps will come after KLYX is stabilized.",
  },
  nl: {
    metadataTitle: "KLYX installeren",
    metadataDescription:
      "Installeer KLYX op je telefoon, tablet of computer.",
    login: "Aanmelden",
    backHome: "Terug naar de startpagina",
    badge: "KLYX installeren",
    heroTitle: "KLYX rechtstreeks op je apparaat.",
    heroDescription:
      "KLYX werkt al in je browser. Installatie is optioneel: ze voegt een KLYX-pictogram toe en laat KLYX meer als een klassieke app openen.",
    androidTitle: "Android",
    androidDescription:
      "Gebruik in een compatibele Chrome- of Edge-browser de knop KLYX installeren wanneer die verschijnt.",
    iosTitle: "iPhone / iPad",
    iosDescription: "In Safari: Delen → Zet op beginscherm → Voeg toe.",
    desktopTitle: "Computer",
    desktopDescription:
      "Chrome of Edge kan KLYX installeren in een apart venster met het eigen pictogram.",
    benefitsEyebrow: "Wat je krijgt",
    benefitIcon: "Een KLYX-pictogram op je apparaat",
    benefitAppMode:
      "Openen in app-modus wanneer de browser dat ondersteunt",
    benefitSameAccount: "Hetzelfde account en dezelfde gegevens als op de website",
    benefitNoStore:
      "Voor deze versie is geen App Store of Google Play nodig",
    browserTitle: "Wil je niet installeren?",
    browserDescription:
      "Geen probleem. KLYX blijft volledig toegankelijk via de browser op telefoon, tablet en computer.",
    browserLogin: "Aanmelden",
    browserSignup: "Een account maken",
    currentVersionTitle: "Huidige versie",
    currentVersionDescription:
      "Deze versie is een installeerbare webapplicatie (PWA). Het is nog geen app die in de App Store of Google Play is gepubliceerd. Winkelapps komen nadat KLYX is gestabiliseerd.",
  },
  de: {
    metadataTitle: "KLYX installieren",
    metadataDescription:
      "Installiere KLYX auf deinem Smartphone, Tablet oder Computer.",
    login: "Anmelden",
    backHome: "Zurück zur Startseite",
    badge: "KLYX installieren",
    heroTitle: "KLYX direkt auf deinem Gerät.",
    heroDescription:
      "KLYX funktioniert bereits in deinem Browser. Die Installation ist optional: Sie fügt ein KLYX-Symbol hinzu und lässt KLYX eher wie eine klassische App öffnen.",
    androidTitle: "Android",
    androidDescription:
      "Verwende in einem kompatiblen Chrome- oder Edge-Browser die Schaltfläche KLYX installieren, sobald sie erscheint.",
    iosTitle: "iPhone / iPad",
    iosDescription: "In Safari: Teilen → Zum Home-Bildschirm → Hinzufügen.",
    desktopTitle: "Computer",
    desktopDescription:
      "Chrome oder Edge kann KLYX mit eigenem Symbol in einem separaten Fenster installieren.",
    benefitsEyebrow: "Das erhältst du",
    benefitIcon: "Ein KLYX-Symbol auf deinem Gerät",
    benefitAppMode:
      "Öffnen im App-Modus, wenn der Browser dies unterstützt",
    benefitSameAccount: "Dasselbe Konto und dieselben Daten wie auf der Website",
    benefitNoStore:
      "Für diese Version sind weder App Store noch Google Play erforderlich",
    browserTitle: "Du möchtest nicht installieren?",
    browserDescription:
      "Kein Problem. KLYX bleibt im Browser auf Smartphone, Tablet und Computer vollständig zugänglich.",
    browserLogin: "Anmelden",
    browserSignup: "Konto erstellen",
    currentVersionTitle: "Aktuelle Version",
    currentVersionDescription:
      "Diese Version ist eine installierbare Webanwendung (PWA). Sie ist noch keine im App Store oder bei Google Play veröffentlichte App. Store-Apps folgen nach der Stabilisierung von KLYX.",
  },
};

const INSTALL_PAGE_LOCALE_SET = new Set<string>(
  KLYX_INSTALL_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxInstallPageTranslation(locale: KlyxLocale) {
  return INSTALL_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxInstallPageLocale(
  locale: KlyxLocale
): KlyxInstallPageLocale {
  return hasKlyxInstallPageTranslation(locale)
    ? (locale as KlyxInstallPageLocale)
    : "fr";
}

export function getKlyxInstallPageDictionary(locale: KlyxLocale) {
  return INSTALL_PAGE_MESSAGES[resolveKlyxInstallPageLocale(locale)];
}

export function translateKlyxInstallPage(
  locale: KlyxLocale,
  key: KlyxInstallPageMessageKey
) {
  return getKlyxInstallPageDictionary(locale)[key];
}
