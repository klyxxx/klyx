import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_LEGAL_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
  "es",
] as const;

export type KlyxLegalPageLocale =
  (typeof KLYX_LEGAL_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_LEGAL_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "badge",
  "title",
  "description",
  "privacyTitle",
  "privacyDescription",
  "termsTitle",
  "termsDescription",
  "supportTitle",
  "supportDescription",
  "deleteTitle",
  "deleteDescription",
] as const;

export type KlyxLegalPageMessageKey =
  (typeof KLYX_LEGAL_PAGE_MESSAGE_KEYS)[number];

type LegalPageDictionary = Record<KlyxLegalPageMessageKey, string>;

const LEGAL_PAGE_MESSAGES: Record<KlyxLegalPageLocale, LegalPageDictionary> = {
  fr: {
    metadataTitle: "Informations légales KLYX",
    metadataDescription:
      "Accède aux informations légales, à la confidentialité, à l’assistance et à la suppression de compte KLYX.",
    badge: "Informations KLYX",
    title: "Légal, confidentialité et assistance",
    description:
      "Les informations essentielles pour comprendre tes droits et utiliser KLYX en toute transparence.",
    privacyTitle: "Politique de confidentialité",
    privacyDescription:
      "Données collectées, finalités, prestataires, conservation et droits.",
    termsTitle: "Conditions d’utilisation",
    termsDescription:
      "Règles d’utilisation de KLYX pour les clients et les prestataires.",
    supportTitle: "Assistance",
    supportDescription:
      "Contacter KLYX pour un problème de compte, paiement ou réservation.",
    deleteTitle: "Suppression du compte",
    deleteDescription:
      "Demander la suppression de ton compte et de tes données associées.",
  },
  en: {
    metadataTitle: "KLYX legal information",
    metadataDescription:
      "Access KLYX legal information, privacy, support, and account deletion.",
    badge: "KLYX information",
    title: "Legal, privacy and support",
    description:
      "Essential information to understand your rights and use KLYX transparently.",
    privacyTitle: "Privacy policy",
    privacyDescription:
      "Collected data, purposes, providers, retention and rights.",
    termsTitle: "Terms of use",
    termsDescription:
      "Rules for using KLYX as a client or provider.",
    supportTitle: "Support",
    supportDescription:
      "Contact KLYX about an account, payment or booking issue.",
    deleteTitle: "Account deletion",
    deleteDescription:
      "Request deletion of your account and associated data.",
  },
  nl: {
    metadataTitle: "Juridische informatie van KLYX",
    metadataDescription:
      "Bekijk juridische informatie, privacy, ondersteuning en accountverwijdering van KLYX.",
    badge: "KLYX-informatie",
    title: "Juridisch, privacy en ondersteuning",
    description:
      "Essentiële informatie om je rechten te begrijpen en KLYX transparant te gebruiken.",
    privacyTitle: "Privacybeleid",
    privacyDescription:
      "Verzamelde gegevens, doeleinden, dienstverleners, bewaartermijnen en rechten.",
    termsTitle: "Gebruiksvoorwaarden",
    termsDescription:
      "Regels voor het gebruik van KLYX door klanten en dienstverleners.",
    supportTitle: "Ondersteuning",
    supportDescription:
      "Neem contact op met KLYX voor een probleem met account, betaling of boeking.",
    deleteTitle: "Account verwijderen",
    deleteDescription:
      "Vraag om verwijdering van je account en de bijbehorende gegevens.",
  },
  de: {
    metadataTitle: "Rechtliche Informationen von KLYX",
    metadataDescription:
      "Rufe rechtliche Informationen, Datenschutz, Support und Kontolöschung von KLYX auf.",
    badge: "KLYX-Informationen",
    title: "Rechtliches, Datenschutz und Support",
    description:
      "Wesentliche Informationen, um deine Rechte zu verstehen und KLYX transparent zu nutzen.",
    privacyTitle: "Datenschutzerklärung",
    privacyDescription:
      "Erhobene Daten, Zwecke, Dienstleister, Aufbewahrung und Rechte.",
    termsTitle: "Nutzungsbedingungen",
    termsDescription:
      "Regeln für die Nutzung von KLYX durch Kunden und Dienstleister.",
    supportTitle: "Support",
    supportDescription:
      "Kontaktiere KLYX bei Problemen mit Konto, Zahlung oder Buchung.",
    deleteTitle: "Konto löschen",
    deleteDescription:
      "Fordere die Löschung deines Kontos und der zugehörigen Daten an.",
  },
  es: {
    metadataTitle: "Información legal de KLYX",
    metadataDescription:
      "Accede a la información legal, privacidad, asistencia y eliminación de cuenta de KLYX.",
    badge: "Información de KLYX",
    title: "Información legal, privacidad y asistencia",
    description:
      "Información esencial para comprender tus derechos y utilizar KLYX con transparencia.",
    privacyTitle: "Política de privacidad",
    privacyDescription:
      "Datos recopilados, finalidades, proveedores, conservación y derechos.",
    termsTitle: "Condiciones de uso",
    termsDescription:
      "Reglas de uso de KLYX para clientes y prestadores de servicios.",
    supportTitle: "Asistencia",
    supportDescription:
      "Contacta con KLYX por un problema de cuenta, pago o reserva.",
    deleteTitle: "Eliminación de la cuenta",
    deleteDescription:
      "Solicita la eliminación de tu cuenta y de los datos asociados.",
  },
};

const LEGAL_PAGE_LOCALE_SET = new Set<string>(KLYX_LEGAL_PAGE_TRANSLATED_LOCALES);

export function hasKlyxLegalPageTranslation(locale: KlyxLocale) {
  return LEGAL_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxLegalPageLocale(locale: KlyxLocale): KlyxLegalPageLocale {
  return hasKlyxLegalPageTranslation(locale)
    ? (locale as KlyxLegalPageLocale)
    : "fr";
}

export function getKlyxLegalPageDictionary(locale: KlyxLocale) {
  return LEGAL_PAGE_MESSAGES[resolveKlyxLegalPageLocale(locale)];
}

export function translateKlyxLegalPage(
  locale: KlyxLocale,
  key: KlyxLegalPageMessageKey
) {
  return getKlyxLegalPageDictionary(locale)[key];
}
