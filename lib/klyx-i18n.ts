export const KLYX_LOCALES = [
  "fr",
  "en",
  "nl",
] as const;

export type KlyxLocale =
  (typeof KLYX_LOCALES)[number];

export const KLYX_DEFAULT_LOCALE: KlyxLocale =
  "fr";

export const KLYX_LANGUAGE_STORAGE_KEY =
  "klyx_language";
export const KLYX_LANGUAGE_COOKIE_KEY =
  "klyx_locale";

export type KlyxUiMessageKey =
  | "skipToMain"
  | "sidebar.providerTagline"
  | "sidebar.clientTagline"
  | "sidebar.loadingProfile"
  | "sidebar.providerAccount"
  | "sidebar.clientAccount"
  | "sidebar.searchPlaceholder"
  | "sidebar.noResults"
  | "sidebar.adminCenter"
  | "sidebar.loggingOut"
  | "sidebar.logout"
  | "sidebar.openMenu"
  | "sidebar.closeMenu";

const UI_MESSAGES: Record<
  KlyxLocale,
  Record<KlyxUiMessageKey, string>
> = {
  fr: {
    skipToMain: "Aller au contenu principal",
    "sidebar.providerTagline":
      "Ton activité professionnelle KLYX.",
    "sidebar.clientTagline":
      "Tous tes services du quotidien.",
    "sidebar.loadingProfile":
      "Chargement du profil...",
    "sidebar.providerAccount":
      "Compte prestataire",
    "sidebar.clientAccount":
      "Compte client",
    "sidebar.searchPlaceholder":
      "Rechercher dans KLYX",
    "sidebar.noResults": "Aucun résultat.",
    "sidebar.adminCenter": "Centre Admin KLYX",
    "sidebar.loggingOut": "Déconnexion...",
    "sidebar.logout": "Se déconnecter",
    "sidebar.openMenu": "Ouvrir le menu",
    "sidebar.closeMenu": "Fermer le menu",
  },
  en: {
    skipToMain: "Skip to main content",
    "sidebar.providerTagline":
      "Your KLYX professional activity.",
    "sidebar.clientTagline":
      "All your everyday services.",
    "sidebar.loadingProfile":
      "Loading profile...",
    "sidebar.providerAccount":
      "Provider account",
    "sidebar.clientAccount":
      "Client account",
    "sidebar.searchPlaceholder":
      "Search KLYX",
    "sidebar.noResults": "No results.",
    "sidebar.adminCenter": "KLYX Admin Center",
    "sidebar.loggingOut": "Signing out...",
    "sidebar.logout": "Sign out",
    "sidebar.openMenu": "Open menu",
    "sidebar.closeMenu": "Close menu",
  },
  nl: {
    skipToMain: "Ga naar de hoofdinhoud",
    "sidebar.providerTagline":
      "Je professionele KLYX-activiteit.",
    "sidebar.clientTagline":
      "Al je dagelijkse diensten.",
    "sidebar.loadingProfile":
      "Profiel laden...",
    "sidebar.providerAccount":
      "Dienstverleneraccount",
    "sidebar.clientAccount":
      "Klantaccount",
    "sidebar.searchPlaceholder":
      "Zoeken in KLYX",
    "sidebar.noResults": "Geen resultaten.",
    "sidebar.adminCenter": "KLYX-beheercentrum",
    "sidebar.loggingOut": "Afmelden...",
    "sidebar.logout": "Afmelden",
    "sidebar.openMenu": "Menu openen",
    "sidebar.closeMenu": "Menu sluiten",
  },
};

const NAVIGATION_TRANSLATIONS: Record<
  Exclude<KlyxLocale, "fr">,
  Record<string, string>
> = {
  en: {
    "Centre KLYX": "KLYX Center",
    "Vue d’ensemble": "Overview",
    "Assistant KLYX": "KLYX Assistant",
    "KLYX Agent": "KLYX Agent",
    "Ma mémoire KLYX": "My KLYX memory",
    "Trouver un service": "Find a service",
    "Couverture locale": "Local coverage",
    "Recherche par photo": "Search by photo",
    "Mes réservations": "My bookings",
    Messages: "Messages",
    Favoris: "Favorites",
    "Mes demandes": "My requests",
    "Mes devis": "My quotes",
    Notifications: "Notifications",
    "Centre de confiance": "Trust Center",
    "Mon profil": "My profile",
    Paramètres: "Settings",
    "Tableau professionnel": "Professional dashboard",
    "Mon activité": "My business",
    "Assistant professionnel": "Professional assistant",
    "Réservations & missions": "Bookings & jobs",
    "Missions disponibles": "Available jobs",
    "Demandes de devis": "Quote requests",
    "Planning intelligent": "Smart schedule",
    "Zones d'intervention": "Service areas",
    "Messagerie clients": "Client messages",
    "Ajouter un métier": "Add a profession",
    "Mes compétences": "My skills",
    Paiements: "Payments",
    Vérification: "Verification",
    "Vérification prestataire": "Provider verification",
    "Score et avis": "Score & reviews",
    "Confiance professionnelle": "Professional trust",
    "Profil public": "Public profile",
    "Centre Admin KLYX": "KLYX Admin Center",
    "Compétences prestataires": "Provider skills",
    "Vérifications prestataires": "Provider verifications",
    Litiges: "Disputes",
    "Services KLYX": "KLYX services",
    "Audit financier": "Financial audit",
    Principal: "Main",
    IA: "AI",
    Services: "Services",
    Réservations: "Bookings",
    Communication: "Communication",
    Compte: "Account",
    Confiance: "Trust",
    Prestataire: "Provider",
    Finance: "Finance",
    Administration: "Administration",
  },
  nl: {
    "Centre KLYX": "KLYX-centrum",
    "Vue d’ensemble": "Overzicht",
    "Assistant KLYX": "KLYX-assistent",
    "KLYX Agent": "KLYX Agent",
    "Ma mémoire KLYX": "Mijn KLYX-geheugen",
    "Trouver un service": "Een dienst vinden",
    "Couverture locale": "Lokale dekking",
    "Recherche par photo": "Zoeken met foto",
    "Mes réservations": "Mijn boekingen",
    Messages: "Berichten",
    Favoris: "Favorieten",
    "Mes demandes": "Mijn aanvragen",
    "Mes devis": "Mijn offertes",
    Notifications: "Meldingen",
    "Centre de confiance": "Vertrouwenscentrum",
    "Mon profil": "Mijn profiel",
    Paramètres: "Instellingen",
    "Tableau professionnel": "Professioneel dashboard",
    "Mon activité": "Mijn activiteit",
    "Assistant professionnel": "Professionele assistent",
    "Réservations & missions": "Boekingen & opdrachten",
    "Missions disponibles": "Beschikbare opdrachten",
    "Demandes de devis": "Offerteaanvragen",
    "Planning intelligent": "Slimme planning",
    "Zones d'intervention": "Werkgebieden",
    "Messagerie clients": "Klantberichten",
    "Ajouter un métier": "Een beroep toevoegen",
    "Mes compétences": "Mijn vaardigheden",
    Paiements: "Betalingen",
    Vérification: "Verificatie",
    "Vérification prestataire": "Verificatie dienstverlener",
    "Score et avis": "Score & beoordelingen",
    "Confiance professionnelle": "Professioneel vertrouwen",
    "Profil public": "Openbaar profiel",
    "Centre Admin KLYX": "KLYX-beheercentrum",
    "Compétences prestataires": "Vaardigheden dienstverleners",
    "Vérifications prestataires": "Verificaties dienstverleners",
    Litiges: "Geschillen",
    "Services KLYX": "KLYX-diensten",
    "Audit financier": "Financiële audit",
    Principal: "Hoofdmenu",
    IA: "AI",
    Services: "Diensten",
    Réservations: "Boekingen",
    Communication: "Communicatie",
    Compte: "Account",
    Confiance: "Vertrouwen",
    Prestataire: "Dienstverlener",
    Finance: "Financiën",
    Administration: "Beheer",
  },
};

export function normalizeKlyxLocale(
  value: string | null | undefined
): KlyxLocale {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace("_", "-");

  if (!normalized) {
    return KLYX_DEFAULT_LOCALE;
  }

  if (normalized === "nl" || normalized.startsWith("nl-")) {
    return "nl";
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return "fr";
}

export function resolveKlyxLocale(
  candidates: readonly string[]
): KlyxLocale {
  for (const candidate of candidates) {
    const normalized = candidate
      .trim()
      .toLowerCase();

    if (normalized === "nl" || normalized.startsWith("nl-")) {
      return "nl";
    }

    if (normalized === "en" || normalized.startsWith("en-")) {
      return "en";
    }

    if (normalized === "fr" || normalized.startsWith("fr-")) {
      return "fr";
    }
  }

  return KLYX_DEFAULT_LOCALE;
}

export function translateKlyxUi(
  locale: KlyxLocale,
  key: KlyxUiMessageKey
) {
  return UI_MESSAGES[locale][key];
}

export function translateKlyxNavigationLabel(
  locale: KlyxLocale,
  frenchLabel: string
) {
  if (locale === "fr") {
    return frenchLabel;
  }

  return (
    NAVIGATION_TRANSLATIONS[locale][frenchLabel] ??
    frenchLabel
  );
}
