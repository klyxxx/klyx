export const KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxPhonePrivacyLocale =
  (typeof KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES)[number];

export const KLYX_PHONE_PRIVACY_MESSAGE_KEYS = [
  "sessionMissing",
  "loadFailed",
  "saveFailed",
  "invalidOption",
  "title",
  "description",
  "loading",
  "phoneRequired",
  "verificationRequired",
  "participantsTitle",
  "participantsDescription",
  "privateTitle",
  "privateDescription",
  "saving",
  "privateSaved",
  "participantsSaved",
] as const;

export type KlyxPhonePrivacyMessageKey =
  (typeof KLYX_PHONE_PRIVACY_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxPhonePrivacyMessageKey, string>;

const dictionaries: Record<KlyxPhonePrivacyLocale, Dictionary> = {
  fr: {
    sessionMissing: "Session KLYX introuvable.",
    loadFailed: "Impossible de charger la confidentialité du téléphone.",
    saveFailed: "Impossible de modifier la confidentialité du téléphone.",
    invalidOption: "Option de confidentialité invalide.",
    title: "Confidentialité du téléphone",
    description: "Tu contrôles si ton numéro peut être révélé aux personnes liées à une mission KLYX.",
    loading: "Chargement de la confidentialité...",
    phoneRequired: "Ajoute d’abord ton numéro de téléphone.",
    verificationRequired: "Ton numéro doit être vérifié par SMS avant tout partage.",
    participantsTitle: "Participants de mission",
    participantsDescription: "Ton numéro peut être révélé uniquement à ton client ou prestataire autorisé.",
    privateTitle: "Toujours privé",
    privateDescription: "Ton numéro ne peut plus être révélé dans aucune mission.",
    saving: "Enregistrement...",
    privateSaved: "Ton numéro est maintenant privé.",
    participantsSaved: "Le partage avec les participants de mission est activé.",
  },
  en: {
    sessionMissing: "KLYX session not found.",
    loadFailed: "Unable to load phone privacy settings.",
    saveFailed: "Unable to update phone privacy settings.",
    invalidOption: "Invalid privacy option.",
    title: "Phone privacy",
    description: "You control whether your phone number can be revealed to people connected to a KLYX mission.",
    loading: "Loading privacy settings...",
    phoneRequired: "Add your phone number first.",
    verificationRequired: "Your phone number must be verified by SMS before any sharing.",
    participantsTitle: "Mission participants",
    participantsDescription: "Your phone number can be revealed only to your authorised client or provider.",
    privateTitle: "Always private",
    privateDescription: "Your phone number can no longer be revealed in any mission.",
    saving: "Saving...",
    privateSaved: "Your phone number is now private.",
    participantsSaved: "Sharing with mission participants is enabled.",
  },
  nl: {
    sessionMissing: "KLYX-sessie niet gevonden.",
    loadFailed: "De privacy-instellingen voor het telefoonnummer kunnen niet worden geladen.",
    saveFailed: "De privacy-instellingen voor het telefoonnummer kunnen niet worden gewijzigd.",
    invalidOption: "Ongeldige privacyoptie.",
    title: "Privacy van telefoonnummer",
    description: "Je bepaalt of je telefoonnummer mag worden getoond aan personen die bij een KLYX-opdracht betrokken zijn.",
    loading: "Privacy-instellingen laden...",
    phoneRequired: "Voeg eerst je telefoonnummer toe.",
    verificationRequired: "Je telefoonnummer moet via sms zijn geverifieerd voordat het kan worden gedeeld.",
    participantsTitle: "Deelnemers aan de opdracht",
    participantsDescription: "Je telefoonnummer kan alleen worden getoond aan je bevoegde klant of dienstverlener.",
    privateTitle: "Altijd privé",
    privateDescription: "Je telefoonnummer kan in geen enkele opdracht meer worden getoond.",
    saving: "Opslaan...",
    privateSaved: "Je telefoonnummer is nu privé.",
    participantsSaved: "Delen met deelnemers aan de opdracht is ingeschakeld.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung nicht gefunden.",
    loadFailed: "Die Datenschutzeinstellungen für die Telefonnummer konnten nicht geladen werden.",
    saveFailed: "Die Datenschutzeinstellungen für die Telefonnummer konnten nicht geändert werden.",
    invalidOption: "Ungültige Datenschutzoption.",
    title: "Telefon-Datenschutz",
    description: "Du bestimmst, ob deine Telefonnummer Personen angezeigt werden darf, die an einer KLYX-Mission beteiligt sind.",
    loading: "Datenschutzeinstellungen werden geladen...",
    phoneRequired: "Füge zuerst deine Telefonnummer hinzu.",
    verificationRequired: "Deine Telefonnummer muss vor jeder Freigabe per SMS verifiziert sein.",
    participantsTitle: "Missionsteilnehmer",
    participantsDescription: "Deine Telefonnummer darf nur deinem autorisierten Kunden oder Anbieter angezeigt werden.",
    privateTitle: "Immer privat",
    privateDescription: "Deine Telefonnummer darf in keiner Mission mehr angezeigt werden.",
    saving: "Speichern...",
    privateSaved: "Deine Telefonnummer ist jetzt privat.",
    participantsSaved: "Die Freigabe für Missionsteilnehmer ist aktiviert.",
  },
};

const publicErrors: Readonly<Record<string, KlyxPhonePrivacyMessageKey>> = {
  "Session manquante.": "sessionMissing",
  "Session invalide.": "sessionMissing",
  "Profil KLYX introuvable.": "sessionMissing",
  "Option de confidentialite invalide.": "invalidOption",
};

export function resolveKlyxPhonePrivacyLocale(locale: string): KlyxPhonePrivacyLocale {
  return (KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES as readonly string[]).includes(locale)
    ? (locale as KlyxPhonePrivacyLocale)
    : "fr";
}

export function translateKlyxPhonePrivacy(
  locale: string,
  key: KlyxPhonePrivacyMessageKey
): string {
  return dictionaries[resolveKlyxPhonePrivacyLocale(locale)][key];
}

export function resolveKlyxPhonePrivacyPublicErrorKey(
  message: string | undefined,
  fallback: KlyxPhonePrivacyMessageKey
): KlyxPhonePrivacyMessageKey {
  return (message && publicErrors[message]) || fallback;
}
