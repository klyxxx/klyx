export const KLYX_PROFILE_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProfilePageLocale =
  (typeof KLYX_PROFILE_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_PROFILE_PAGE_MESSAGE_KEYS = [
  "loading",
  "dashboard",
  "providerProfile",
  "clientProfile",
  "title",
  "profilePhoto",
  "avatarAlt",
  "uploading",
  "changePhoto",
  "firstName",
  "lastName",
  "age",
  "agePlaceholder",
  "city",
  "cityPlaceholder",
  "saving",
  "save",
  "manageProviderProfile",
  "loadFailed",
  "profileNotFound",
  "unauthenticated",
  "accessDenied",
  "identityRequired",
  "ageInvalid",
  "saveFailed",
  "saved",
  "avatarMissing",
  "avatarTypeInvalid",
  "avatarTooLarge",
  "uploadFailed",
  "avatarUpdated",
  "avatarUnavailable",
] as const;

export type KlyxProfilePageMessageKey =
  (typeof KLYX_PROFILE_PAGE_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProfilePageMessageKey, string>;

const dictionaries: Record<KlyxProfilePageLocale, Dictionary> = {
  fr: {
    loading: "Chargement du profil...",
    dashboard: "Tableau de bord",
    providerProfile: "Profil prestataire",
    clientProfile: "Profil client",
    title: "Mes informations",
    profilePhoto: "Photo de profil",
    avatarAlt: "Photo de profil",
    uploading: "Envoi...",
    changePhoto: "Changer la photo",
    firstName: "Prénom",
    lastName: "Nom",
    age: "Âge",
    agePlaceholder: "Exemple : 28",
    city: "Ville",
    cityPlaceholder: "Exemple : Bruxelles",
    saving: "Enregistrement...",
    save: "Enregistrer mes informations",
    manageProviderProfile: "Gérer ma fiche commerciale",
    loadFailed: "Impossible de charger le profil.",
    profileNotFound: "Profil KLYX introuvable.",
    unauthenticated: "Connecte-toi pour accéder à ton profil.",
    accessDenied: "Accès au profil refusé.",
    identityRequired: "Le prénom, le nom et la ville sont obligatoires.",
    ageInvalid: "L’âge doit être compris entre 18 et 100 ans.",
    saveFailed: "Impossible d’enregistrer le profil.",
    saved: "Informations personnelles enregistrées.",
    avatarMissing: "Image manquante.",
    avatarTypeInvalid: "Choisis une image JPG, PNG ou WEBP.",
    avatarTooLarge: "La photo doit faire 5 Mo maximum.",
    uploadFailed: "Impossible d’envoyer la photo.",
    avatarUpdated: "Photo de profil mise à jour.",
    avatarUnavailable: "La photo enregistrée est inaccessible.",
  },
  en: {
    loading: "Loading profile...",
    dashboard: "Dashboard",
    providerProfile: "Provider profile",
    clientProfile: "Client profile",
    title: "My information",
    profilePhoto: "Profile photo",
    avatarAlt: "Profile photo",
    uploading: "Uploading...",
    changePhoto: "Change photo",
    firstName: "First name",
    lastName: "Last name",
    age: "Age",
    agePlaceholder: "Example: 28",
    city: "City",
    cityPlaceholder: "Example: Brussels",
    saving: "Saving...",
    save: "Save my information",
    manageProviderProfile: "Manage my business profile",
    loadFailed: "Unable to load the profile.",
    profileNotFound: "KLYX profile not found.",
    unauthenticated: "Sign in to access your profile.",
    accessDenied: "Access to this profile was denied.",
    identityRequired: "First name, last name and city are required.",
    ageInvalid: "Age must be between 18 and 100.",
    saveFailed: "Unable to save the profile.",
    saved: "Personal information saved.",
    avatarMissing: "No image was provided.",
    avatarTypeInvalid: "Choose a JPG, PNG or WEBP image.",
    avatarTooLarge: "The photo must be no larger than 5 MB.",
    uploadFailed: "Unable to upload the photo.",
    avatarUpdated: "Profile photo updated.",
    avatarUnavailable: "The saved photo is unavailable.",
  },
  nl: {
    loading: "Profiel laden...",
    dashboard: "Dashboard",
    providerProfile: "Dienstverlenerprofiel",
    clientProfile: "Klantprofiel",
    title: "Mijn gegevens",
    profilePhoto: "Profielfoto",
    avatarAlt: "Profielfoto",
    uploading: "Uploaden...",
    changePhoto: "Foto wijzigen",
    firstName: "Voornaam",
    lastName: "Achternaam",
    age: "Leeftijd",
    agePlaceholder: "Voorbeeld: 28",
    city: "Stad",
    cityPlaceholder: "Voorbeeld: Brussel",
    saving: "Opslaan...",
    save: "Mijn gegevens opslaan",
    manageProviderProfile: "Mijn bedrijfsprofiel beheren",
    loadFailed: "Het profiel kan niet worden geladen.",
    profileNotFound: "KLYX-profiel niet gevonden.",
    unauthenticated: "Meld je aan om je profiel te openen.",
    accessDenied: "Toegang tot dit profiel geweigerd.",
    identityRequired: "Voornaam, achternaam en stad zijn verplicht.",
    ageInvalid: "De leeftijd moet tussen 18 en 100 jaar liggen.",
    saveFailed: "Het profiel kan niet worden opgeslagen.",
    saved: "Persoonlijke gegevens opgeslagen.",
    avatarMissing: "Er is geen afbeelding geselecteerd.",
    avatarTypeInvalid: "Kies een JPG-, PNG- of WEBP-afbeelding.",
    avatarTooLarge: "De foto mag maximaal 5 MB groot zijn.",
    uploadFailed: "De foto kan niet worden geüpload.",
    avatarUpdated: "Profielfoto bijgewerkt.",
    avatarUnavailable: "De opgeslagen foto is niet beschikbaar.",
  },
  de: {
    loading: "Profil wird geladen...",
    dashboard: "Dashboard",
    providerProfile: "Anbieterprofil",
    clientProfile: "Kundenprofil",
    title: "Meine Angaben",
    profilePhoto: "Profilfoto",
    avatarAlt: "Profilfoto",
    uploading: "Wird hochgeladen...",
    changePhoto: "Foto ändern",
    firstName: "Vorname",
    lastName: "Nachname",
    age: "Alter",
    agePlaceholder: "Beispiel: 28",
    city: "Stadt",
    cityPlaceholder: "Beispiel: Brüssel",
    saving: "Wird gespeichert...",
    save: "Meine Angaben speichern",
    manageProviderProfile: "Mein Geschäftsprofil verwalten",
    loadFailed: "Das Profil konnte nicht geladen werden.",
    profileNotFound: "KLYX-Profil nicht gefunden.",
    unauthenticated: "Melde dich an, um auf dein Profil zuzugreifen.",
    accessDenied: "Zugriff auf dieses Profil verweigert.",
    identityRequired: "Vorname, Nachname und Stadt sind erforderlich.",
    ageInvalid: "Das Alter muss zwischen 18 und 100 Jahren liegen.",
    saveFailed: "Das Profil konnte nicht gespeichert werden.",
    saved: "Persönliche Angaben gespeichert.",
    avatarMissing: "Es wurde kein Bild ausgewählt.",
    avatarTypeInvalid: "Wähle ein JPG-, PNG- oder WEBP-Bild.",
    avatarTooLarge: "Das Foto darf höchstens 5 MB groß sein.",
    uploadFailed: "Das Foto konnte nicht hochgeladen werden.",
    avatarUpdated: "Profilfoto aktualisiert.",
    avatarUnavailable: "Das gespeicherte Foto ist nicht verfügbar.",
  },
};

const publicApiErrorKeys: Readonly<Record<string, KlyxProfilePageMessageKey>> = {
  "Non connecté.": "unauthenticated",
  "Profil KLYX actif introuvable.": "profileNotFound",
  "Profil KLYX introuvable.": "profileNotFound",
  "Accès au profil refusé.": "accessDenied",
  "Le prénom, le nom et la ville sont obligatoires.": "identityRequired",
  "L’âge doit être compris entre 18 et 100 ans.": "ageInvalid",
  "Impossible de modifier ce profil.": "saveFailed",
  "Image manquante.": "avatarMissing",
  "Choisis une image JPG, PNG ou WEBP.": "avatarTypeInvalid",
  "La photo doit faire 5 Mo maximum.": "avatarTooLarge",
};

export function resolveKlyxProfilePageLocale(locale: string): KlyxProfilePageLocale {
  return KLYX_PROFILE_PAGE_TRANSLATED_LOCALES.includes(
    locale as KlyxProfilePageLocale
  )
    ? (locale as KlyxProfilePageLocale)
    : "fr";
}

export function translateKlyxProfilePage(
  locale: string,
  key: KlyxProfilePageMessageKey
): string {
  return dictionaries[resolveKlyxProfilePageLocale(locale)][key];
}

export function resolveKlyxProfilePageApiErrorKey(
  error: unknown,
  fallback: KlyxProfilePageMessageKey
): KlyxProfilePageMessageKey {
  if (typeof error !== "string") return fallback;
  return publicApiErrorKeys[error] ?? fallback;
}
