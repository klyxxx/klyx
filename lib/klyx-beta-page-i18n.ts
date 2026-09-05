import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_BETA_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de", "es"] as const;

export type KlyxBetaPageLocale =
  (typeof KLYX_BETA_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_BETA_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "login",
  "badge",
  "heroTitle",
  "heroDescription",
  "clientTitle",
  "clientDescription",
  "clientCta",
  "providerTitle",
  "providerDescription",
  "providerCta",
  "testSection",
  "featureAccount",
  "featureProfile",
  "featureBookingsQuotes",
  "featureInstall",
  "verificationWarning",
  "installTitle",
  "installDescription",
  "installCta",
  "footer",
] as const;

export type KlyxBetaPageMessageKey =
  (typeof KLYX_BETA_PAGE_MESSAGE_KEYS)[number];

type BetaPageDictionary = Record<KlyxBetaPageMessageKey, string>;

const BETA_PAGE_MESSAGES: Record<KlyxBetaPageLocale, BetaPageDictionary> = {
  fr: {
    metadataTitle: "Beta KLYX",
    metadataDescription:
      "Teste KLYX avec un vrai compte client ou prestataire pendant la phase Beta.",
    login: "Se connecter",
    badge: "Beta KLYX",
    heroTitle: "Testez KLYX avec un vrai compte.",
    heroDescription:
      "Créez votre espace, choisissez votre rôle et utilisez KLYX depuis votre téléphone ou votre ordinateur. Cette version est encore en phase Beta.",
    clientTitle: "Je suis client",
    clientDescription: "Je cherche, compare et réserve des services.",
    clientCta: "Créer mon compte",
    providerTitle: "Je suis prestataire",
    providerDescription:
      "Je propose mes compétences et construis mon activité KLYX.",
    providerCta: "Créer mon espace",
    testSection: "Ce que vous pouvez tester",
    featureAccount: "Création de compte réelle",
    featureProfile: "Profil Client ou Prestataire",
    featureBookingsQuotes: "Réservations et devis KLYX",
    featureInstall: "Installation sur téléphone ou ordinateur",
    verificationWarning:
      "Certaines vérifications externes prestataires peuvent rester en attente pendant la Beta. KLYX ne les présente pas comme validées tant qu’elles ne le sont pas réellement.",
    installTitle: "Installer KLYX",
    installDescription:
      "KLYX peut être installé comme application sur un appareil compatible sans passer par un store.",
    installCta: "Voir l’installation",
    footer: "KLYX Beta · Test en conditions réelles",
  },
  en: {
    metadataTitle: "KLYX Beta",
    metadataDescription:
      "Try KLYX with a real client or provider account during the Beta phase.",
    login: "Sign in",
    badge: "KLYX Beta",
    heroTitle: "Try KLYX with a real account.",
    heroDescription:
      "Create your space, choose your role, and use KLYX from your phone or computer. This version is still in Beta.",
    clientTitle: "I am a client",
    clientDescription: "I search, compare, and book services.",
    clientCta: "Create my account",
    providerTitle: "I am a provider",
    providerDescription:
      "I offer my skills and build my activity on KLYX.",
    providerCta: "Create my space",
    testSection: "What you can test",
    featureAccount: "Real account creation",
    featureProfile: "Client or Provider profile",
    featureBookingsQuotes: "KLYX bookings and quotes",
    featureInstall: "Installation on phone or computer",
    verificationWarning:
      "Some external provider verification checks may remain pending during Beta. KLYX does not present them as verified until they have actually been verified.",
    installTitle: "Install KLYX",
    installDescription:
      "KLYX can be installed like an application on a compatible device without going through an app store.",
    installCta: "View installation",
    footer: "KLYX Beta · Real-world testing",
  },
  nl: {
    metadataTitle: "KLYX Beta",
    metadataDescription:
      "Test KLYX tijdens de bètafase met een echt klant- of dienstverlenersaccount.",
    login: "Inloggen",
    badge: "KLYX Beta",
    heroTitle: "Test KLYX met een echt account.",
    heroDescription:
      "Maak je ruimte aan, kies je rol en gebruik KLYX vanaf je telefoon of computer. Deze versie bevindt zich nog in de bètafase.",
    clientTitle: "Ik ben klant",
    clientDescription: "Ik zoek, vergelijk en boek diensten.",
    clientCta: "Mijn account aanmaken",
    providerTitle: "Ik ben dienstverlener",
    providerDescription:
      "Ik bied mijn vaardigheden aan en bouw mijn activiteit op KLYX uit.",
    providerCta: "Mijn ruimte aanmaken",
    testSection: "Wat je kunt testen",
    featureAccount: "Een echt account aanmaken",
    featureProfile: "Klant- of dienstverlenersprofiel",
    featureBookingsQuotes: "KLYX-boekingen en offertes",
    featureInstall: "Installatie op telefoon of computer",
    verificationWarning:
      "Sommige externe verificaties voor dienstverleners kunnen tijdens de bètafase in behandeling blijven. KLYX presenteert ze niet als geverifieerd zolang ze dat niet werkelijk zijn.",
    installTitle: "KLYX installeren",
    installDescription:
      "KLYX kan als applicatie op een compatibel apparaat worden geïnstalleerd zonder via een appstore te gaan.",
    installCta: "Installatie bekijken",
    footer: "KLYX Beta · Testen in echte omstandigheden",
  },
  de: {
    metadataTitle: "KLYX Beta",
    metadataDescription:
      "Teste KLYX während der Beta mit einem echten Kunden- oder Dienstleisterkonto.",
    login: "Anmelden",
    badge: "KLYX Beta",
    heroTitle: "Teste KLYX mit einem echten Konto.",
    heroDescription:
      "Erstelle deinen Bereich, wähle deine Rolle und nutze KLYX auf deinem Smartphone oder Computer. Diese Version befindet sich noch in der Beta.",
    clientTitle: "Ich bin Kunde",
    clientDescription: "Ich suche, vergleiche und buche Dienstleistungen.",
    clientCta: "Mein Konto erstellen",
    providerTitle: "Ich bin Dienstleister",
    providerDescription:
      "Ich biete meine Fähigkeiten an und baue meine Tätigkeit auf KLYX auf.",
    providerCta: "Meinen Bereich erstellen",
    testSection: "Was du testen kannst",
    featureAccount: "Ein echtes Konto erstellen",
    featureProfile: "Kunden- oder Dienstleisterprofil",
    featureBookingsQuotes: "KLYX-Buchungen und Angebote",
    featureInstall: "Installation auf Smartphone oder Computer",
    verificationWarning:
      "Einige externe Prüfungen von Dienstleistern können während der Beta ausstehend bleiben. KLYX stellt sie erst dann als verifiziert dar, wenn sie tatsächlich verifiziert wurden.",
    installTitle: "KLYX installieren",
    installDescription:
      "KLYX kann wie eine App auf einem kompatiblen Gerät installiert werden, ohne einen App-Store zu verwenden.",
    installCta: "Installation ansehen",
    footer: "KLYX Beta · Test unter realen Bedingungen",
  },
  es: {
    metadataTitle: "Beta de KLYX",
    metadataDescription:
      "Prueba KLYX con una cuenta real de cliente o profesional durante la fase Beta.",
    login: "Iniciar sesión",
    badge: "Beta de KLYX",
    heroTitle: "Prueba KLYX con una cuenta real.",
    heroDescription:
      "Crea tu espacio, elige tu rol y usa KLYX desde tu teléfono u ordenador. Esta versión sigue en fase Beta.",
    clientTitle: "Soy cliente",
    clientDescription: "Busco, comparo y reservo servicios.",
    clientCta: "Crear mi cuenta",
    providerTitle: "Soy profesional",
    providerDescription:
      "Ofrezco mis habilidades y desarrollo mi actividad en KLYX.",
    providerCta: "Crear mi espacio",
    testSection: "Lo que puedes probar",
    featureAccount: "Creación de una cuenta real",
    featureProfile: "Perfil de Cliente o Profesional",
    featureBookingsQuotes: "Reservas y presupuestos de KLYX",
    featureInstall: "Instalación en teléfono u ordenador",
    verificationWarning:
      "Algunas verificaciones externas de profesionales pueden quedar pendientes durante la Beta. KLYX no las presenta como verificadas hasta que realmente lo estén.",
    installTitle: "Instalar KLYX",
    installDescription:
      "KLYX puede instalarse como una aplicación en un dispositivo compatible sin pasar por una tienda de aplicaciones.",
    installCta: "Ver la instalación",
    footer: "KLYX Beta · Pruebas en condiciones reales",
  },
};

const BETA_PAGE_LOCALE_SET = new Set<string>(KLYX_BETA_PAGE_TRANSLATED_LOCALES);

export function hasKlyxBetaPageTranslation(locale: KlyxLocale) {
  return BETA_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxBetaPageLocale(locale: KlyxLocale): KlyxBetaPageLocale {
  return hasKlyxBetaPageTranslation(locale)
    ? (locale as KlyxBetaPageLocale)
    : "fr";
}

export function getKlyxBetaPageDictionary(locale: KlyxLocale) {
  return BETA_PAGE_MESSAGES[resolveKlyxBetaPageLocale(locale)];
}

export function translateKlyxBetaPage(
  locale: KlyxLocale,
  key: KlyxBetaPageMessageKey
) {
  return getKlyxBetaPageDictionary(locale)[key];
}
