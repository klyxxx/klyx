export const KLYX_BOOKING_CONTACT_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxBookingContactLocale =
  (typeof KLYX_BOOKING_CONTACT_TRANSLATED_LOCALES)[number];

export const KLYX_BOOKING_CONTACT_MESSAGE_KEYS = [
  "protectedTitle",
  "availableAfterAcceptance",
  "verifying",
  "expiredTitle",
  "protectedKlyxTitle",
  "verifyOwnNumber",
  "contactUnavailable",
  "contactOf",
  "maskedUntilRequest",
  "availableUntil",
  "revealNumber",
  "verified",
  "remaskFiveMinutes",
  "hide",
  "call",
  "revealFailed",
  "callFailed",
  "statusNotAllowed",
  "missingCompletionTime",
  "contactExpired",
  "ownMissingPhone",
  "ownUnverifiedPhone",
  "ownPrivatePhone",
  "otherMissingPhone",
  "otherUnverifiedPhone",
  "otherPrivatePhone",
] as const;

export type KlyxBookingContactMessageKey =
  (typeof KLYX_BOOKING_CONTACT_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxBookingContactMessageKey, string>;

const dictionaries: Record<KlyxBookingContactLocale, Dictionary> = {
  fr: {
    protectedTitle: "Contact protégé",
    availableAfterAcceptance: "Le contact devient disponible après acceptation.",
    verifying: "Vérification du contact...",
    expiredTitle: "Contact expiré",
    protectedKlyxTitle: "Contact KLYX protégé",
    verifyOwnNumber: "Vérifier mon numéro",
    contactUnavailable: "Contact indisponible.",
    contactOf: "Contact de {name}",
    maskedUntilRequest: "Le numéro reste masqué jusqu’à ta demande.",
    availableUntil: "Disponible jusqu’au {date}",
    revealNumber: "Afficher le numéro",
    verified: "Vérifié",
    remaskFiveMinutes: "Le numéro sera remasqué automatiquement après 5 minutes.",
    hide: "Masquer",
    call: "Appeler",
    revealFailed: "Impossible d’afficher le numéro.",
    callFailed: "Appel impossible.",
    statusNotAllowed: "Le contact est disponible uniquement pour une mission acceptée.",
    missingCompletionTime: "La période de contact ne peut pas être déterminée.",
    contactExpired: "La période de contact téléphonique est terminée.",
    ownMissingPhone: "Ajoute ton numéro avant d’accéder au contact.",
    ownUnverifiedPhone: "Vérifie ton numéro par SMS avant d’accéder au contact.",
    ownPrivatePhone: "Ton numéro est actuellement privé.",
    otherMissingPhone: "{name} n’a pas encore ajouté de numéro.",
    otherUnverifiedPhone: "Le numéro de {name} doit encore être vérifié.",
    otherPrivatePhone: "{name} ne partage pas son numéro.",
  },
  en: {
    protectedTitle: "Protected contact",
    availableAfterAcceptance: "Contact becomes available after acceptance.",
    verifying: "Checking contact access...",
    expiredTitle: "Contact expired",
    protectedKlyxTitle: "Protected KLYX contact",
    verifyOwnNumber: "Verify my number",
    contactUnavailable: "Contact unavailable.",
    contactOf: "Contact for {name}",
    maskedUntilRequest: "The number stays hidden until you request it.",
    availableUntil: "Available until {date}",
    revealNumber: "Show number",
    verified: "Verified",
    remaskFiveMinutes: "The number will be hidden again automatically after 5 minutes.",
    hide: "Hide",
    call: "Call",
    revealFailed: "Unable to show the number.",
    callFailed: "Unable to start the call.",
    statusNotAllowed: "Contact is available only for an accepted mission.",
    missingCompletionTime: "The contact window cannot be determined.",
    contactExpired: "The phone contact window has ended.",
    ownMissingPhone: "Add your number before accessing the contact.",
    ownUnverifiedPhone: "Verify your number by SMS before accessing the contact.",
    ownPrivatePhone: "Your number is currently private.",
    otherMissingPhone: "{name} has not added a phone number yet.",
    otherUnverifiedPhone: "{name}’s number still needs to be verified.",
    otherPrivatePhone: "{name} does not share their number.",
  },
  nl: {
    protectedTitle: "Beschermd contact",
    availableAfterAcceptance: "Contact wordt beschikbaar na aanvaarding.",
    verifying: "Contacttoegang controleren...",
    expiredTitle: "Contact verlopen",
    protectedKlyxTitle: "Beschermd KLYX-contact",
    verifyOwnNumber: "Mijn nummer verifiëren",
    contactUnavailable: "Contact niet beschikbaar.",
    contactOf: "Contact van {name}",
    maskedUntilRequest: "Het nummer blijft verborgen tot je het opvraagt.",
    availableUntil: "Beschikbaar tot {date}",
    revealNumber: "Nummer tonen",
    verified: "Geverifieerd",
    remaskFiveMinutes: "Het nummer wordt na 5 minuten automatisch opnieuw verborgen.",
    hide: "Verbergen",
    call: "Bellen",
    revealFailed: "Het nummer kan niet worden getoond.",
    callFailed: "De oproep kan niet worden gestart.",
    statusNotAllowed: "Contact is alleen beschikbaar voor een aanvaarde missie.",
    missingCompletionTime: "De contactperiode kan niet worden bepaald.",
    contactExpired: "De periode voor telefonisch contact is afgelopen.",
    ownMissingPhone: "Voeg je nummer toe voordat je het contact opent.",
    ownUnverifiedPhone: "Verifieer je nummer via sms voordat je het contact opent.",
    ownPrivatePhone: "Je nummer is momenteel privé.",
    otherMissingPhone: "{name} heeft nog geen telefoonnummer toegevoegd.",
    otherUnverifiedPhone: "Het nummer van {name} moet nog worden geverifieerd.",
    otherPrivatePhone: "{name} deelt het telefoonnummer niet.",
  },
  de: {
    protectedTitle: "Geschützter Kontakt",
    availableAfterAcceptance: "Der Kontakt wird nach der Annahme verfügbar.",
    verifying: "Kontaktzugriff wird geprüft...",
    expiredTitle: "Kontakt abgelaufen",
    protectedKlyxTitle: "Geschützter KLYX-Kontakt",
    verifyOwnNumber: "Meine Nummer verifizieren",
    contactUnavailable: "Kontakt nicht verfügbar.",
    contactOf: "Kontakt von {name}",
    maskedUntilRequest: "Die Nummer bleibt verborgen, bis du sie anforderst.",
    availableUntil: "Verfügbar bis {date}",
    revealNumber: "Nummer anzeigen",
    verified: "Verifiziert",
    remaskFiveMinutes: "Die Nummer wird nach 5 Minuten automatisch wieder ausgeblendet.",
    hide: "Ausblenden",
    call: "Anrufen",
    revealFailed: "Die Nummer kann nicht angezeigt werden.",
    callFailed: "Der Anruf kann nicht gestartet werden.",
    statusNotAllowed: "Kontakt ist nur für einen angenommenen Auftrag verfügbar.",
    missingCompletionTime: "Der Kontaktzeitraum kann nicht bestimmt werden.",
    contactExpired: "Der Zeitraum für telefonischen Kontakt ist beendet.",
    ownMissingPhone: "Füge deine Nummer hinzu, bevor du auf den Kontakt zugreifst.",
    ownUnverifiedPhone: "Verifiziere deine Nummer per SMS, bevor du auf den Kontakt zugreifst.",
    ownPrivatePhone: "Deine Nummer ist derzeit privat.",
    otherMissingPhone: "{name} hat noch keine Telefonnummer hinzugefügt.",
    otherUnverifiedPhone: "Die Nummer von {name} muss noch verifiziert werden.",
    otherPrivatePhone: "{name} teilt die Telefonnummer nicht.",
  },
};

const INTL_LOCALES: Record<KlyxBookingContactLocale, string> = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
  de: "de-BE",
};

const REASON_KEYS: Record<string, KlyxBookingContactMessageKey> = {
  status_not_allowed: "statusNotAllowed",
  missing_completion_time: "missingCompletionTime",
  contact_expired: "contactExpired",
  own_missing_phone: "ownMissingPhone",
  own_unverified_phone: "ownUnverifiedPhone",
  own_private_phone: "ownPrivatePhone",
  other_missing_phone: "otherMissingPhone",
  other_unverified_phone: "otherUnverifiedPhone",
  other_private_phone: "otherPrivatePhone",
};

export function resolveKlyxBookingContactLocale(
  locale: string
): KlyxBookingContactLocale {
  return KLYX_BOOKING_CONTACT_TRANSLATED_LOCALES.includes(
    locale as KlyxBookingContactLocale
  )
    ? (locale as KlyxBookingContactLocale)
    : "fr";
}

export function translateKlyxBookingContact(
  locale: string,
  key: KlyxBookingContactMessageKey,
  replacements: Record<string, string> = {}
): string {
  let value = dictionaries[resolveKlyxBookingContactLocale(locale)][key];
  for (const [name, replacement] of Object.entries(replacements)) {
    value = value.replaceAll(`{${name}}`, replacement);
  }
  return value;
}

export function bookingContactReasonMessage(
  locale: string,
  reason: string | undefined,
  otherName: string
): string {
  const key = reason ? REASON_KEYS[reason] : undefined;
  return key
    ? translateKlyxBookingContact(locale, key, { name: otherName })
    : translateKlyxBookingContact(locale, "contactUnavailable");
}

export function formatKlyxBookingContactExpiry(
  locale: string,
  value: string
): string {
  const resolved = resolveKlyxBookingContactLocale(locale);
  return new Intl.DateTimeFormat(INTL_LOCALES[resolved], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
