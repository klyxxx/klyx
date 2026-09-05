import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SUPPORT_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
  "es",
] as const;

export type KlyxSupportPageLocale =
  (typeof KLYX_SUPPORT_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_SUPPORT_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "backLegal",
  "title",
  "description",
  "generalSubject",
  "generalBody",
  "contactSupport",
  "paymentTitle",
  "paymentDescription",
  "paymentSubject",
  "paymentBody",
  "securityTitle",
  "securityDescription",
  "securitySubject",
  "securityBody",
  "fallbackBeforeEmail",
  "fallbackAfterEmail",
  "open",
] as const;

export type KlyxSupportPageMessageKey =
  (typeof KLYX_SUPPORT_PAGE_MESSAGE_KEYS)[number];

type SupportPageDictionary = Record<KlyxSupportPageMessageKey, string>;

const SUPPORT_PAGE_MESSAGES: Record<
  KlyxSupportPageLocale,
  SupportPageDictionary
> = {
  fr: {
    metadataTitle: "Assistance KLYX",
    metadataDescription: "Assistance et contact KLYX.",
    backLegal: "Informations KLYX",
    title: "Assistance KLYX",
    description:
      "Choisis le sujet de ta demande. KLYX ouvre ton application e-mail avec l’adresse, le sujet et un message déjà préparés.",
    generalSubject: "Assistance KLYX",
    generalBody: "Bonjour KLYX,\n\nJ’ai besoin d’aide concernant :\n\n",
    contactSupport: "Contacter le support",
    paymentTitle: "Paiement",
    paymentDescription:
      "Réservation, débit, remboursement ou paiement prestataire.",
    paymentSubject: "KLYX — problème de paiement",
    paymentBody:
      "Bonjour KLYX,\n\nIdentifiant de réservation :\nProblème rencontré :\n\nJe n’envoie aucune donnée complète de carte bancaire.",
    securityTitle: "Sécurité",
    securityDescription:
      "Compte suspect, accès non autorisé ou problème de confiance.",
    securitySubject: "KLYX — sécurité du compte",
    securityBody:
      "Bonjour KLYX,\n\nAdresse e-mail du compte :\nProblème de sécurité rencontré :\n\n",
    fallbackBeforeEmail:
      "Si aucun logiciel de messagerie n’est configuré sur ton appareil, copie directement l’adresse",
    fallbackAfterEmail:
      "dans Gmail, Outlook ou ton application e-mail.",
    open: "Ouvrir",
  },
  en: {
    metadataTitle: "KLYX support",
    metadataDescription: "KLYX support and contact information.",
    backLegal: "KLYX information",
    title: "KLYX support",
    description:
      "Choose the topic of your request. KLYX opens your email application with the address, subject, and a prepared message.",
    generalSubject: "KLYX support",
    generalBody: "Hello KLYX,\n\nI need help with:\n\n",
    contactSupport: "Contact support",
    paymentTitle: "Payment",
    paymentDescription:
      "Booking, charge, refund, or provider payment.",
    paymentSubject: "KLYX — payment issue",
    paymentBody:
      "Hello KLYX,\n\nBooking ID:\nIssue encountered:\n\nI am not sending any full payment card details.",
    securityTitle: "Security",
    securityDescription:
      "Suspicious account, unauthorized access, or trust issue.",
    securitySubject: "KLYX — account security",
    securityBody:
      "Hello KLYX,\n\nAccount email address:\nSecurity issue encountered:\n\n",
    fallbackBeforeEmail:
      "If no email application is configured on your device, copy the address",
    fallbackAfterEmail:
      "into Gmail, Outlook, or your email application.",
    open: "Open",
  },
  nl: {
    metadataTitle: "KLYX-ondersteuning",
    metadataDescription: "Ondersteuning en contact voor KLYX.",
    backLegal: "KLYX-informatie",
    title: "KLYX-ondersteuning",
    description:
      "Kies het onderwerp van je aanvraag. KLYX opent je e-mailapp met het adres, onderwerp en een vooraf opgesteld bericht.",
    generalSubject: "KLYX-ondersteuning",
    generalBody: "Hallo KLYX,\n\nIk heb hulp nodig met:\n\n",
    contactSupport: "Contact opnemen met support",
    paymentTitle: "Betaling",
    paymentDescription:
      "Boeking, afschrijving, terugbetaling of betaling aan een dienstverlener.",
    paymentSubject: "KLYX — betalingsprobleem",
    paymentBody:
      "Hallo KLYX,\n\nBoekings-ID:\nOndervonden probleem:\n\nIk stuur geen volledige betaalkaartgegevens.",
    securityTitle: "Beveiliging",
    securityDescription:
      "Verdacht account, ongeoorloofde toegang of vertrouwensprobleem.",
    securitySubject: "KLYX — accountbeveiliging",
    securityBody:
      "Hallo KLYX,\n\nE-mailadres van het account:\nOndervonden beveiligingsprobleem:\n\n",
    fallbackBeforeEmail:
      "Als er geen e-mailapp op je apparaat is ingesteld, kopieer dan het adres",
    fallbackAfterEmail:
      "naar Gmail, Outlook of je e-mailapp.",
    open: "Openen",
  },
  de: {
    metadataTitle: "KLYX-Support",
    metadataDescription: "Support und Kontakt für KLYX.",
    backLegal: "KLYX-Informationen",
    title: "KLYX-Support",
    description:
      "Wähle das Thema deiner Anfrage. KLYX öffnet deine E-Mail-App mit Adresse, Betreff und einer vorbereiteten Nachricht.",
    generalSubject: "KLYX-Support",
    generalBody: "Hallo KLYX,\n\nIch brauche Hilfe bei:\n\n",
    contactSupport: "Support kontaktieren",
    paymentTitle: "Zahlung",
    paymentDescription:
      "Buchung, Belastung, Rückerstattung oder Auszahlung an einen Dienstleister.",
    paymentSubject: "KLYX — Zahlungsproblem",
    paymentBody:
      "Hallo KLYX,\n\nBuchungs-ID:\nAufgetretenes Problem:\n\nIch sende keine vollständigen Zahlungskartendaten.",
    securityTitle: "Sicherheit",
    securityDescription:
      "Verdächtiges Konto, unbefugter Zugriff oder Vertrauensproblem.",
    securitySubject: "KLYX — Kontosicherheit",
    securityBody:
      "Hallo KLYX,\n\nE-Mail-Adresse des Kontos:\nAufgetretenes Sicherheitsproblem:\n\n",
    fallbackBeforeEmail:
      "Wenn auf deinem Gerät keine E-Mail-App eingerichtet ist, kopiere die Adresse",
    fallbackAfterEmail:
      "in Gmail, Outlook oder deine E-Mail-App.",
    open: "Öffnen",
  },
  es: {
    metadataTitle: "Soporte de KLYX",
    metadataDescription: "Soporte y contacto de KLYX.",
    backLegal: "Información de KLYX",
    title: "Soporte de KLYX",
    description:
      "Elige el tema de tu solicitud. KLYX abre tu aplicación de correo electrónico con la dirección, el asunto y un mensaje ya preparados.",
    generalSubject: "Soporte de KLYX",
    generalBody: "Hola KLYX,\n\nNecesito ayuda con:\n\n",
    contactSupport: "Contactar con soporte",
    paymentTitle: "Pago",
    paymentDescription:
      "Reserva, cargo, reembolso o pago al profesional.",
    paymentSubject: "KLYX — problema de pago",
    paymentBody:
      "Hola KLYX,\n\nIdentificador de la reserva:\nProblema encontrado:\n\nNo envío ningún dato completo de mi tarjeta de pago.",
    securityTitle: "Seguridad",
    securityDescription:
      "Cuenta sospechosa, acceso no autorizado o problema de confianza.",
    securitySubject: "KLYX — seguridad de la cuenta",
    securityBody:
      "Hola KLYX,\n\nDirección de correo electrónico de la cuenta:\nProblema de seguridad encontrado:\n\n",
    fallbackBeforeEmail:
      "Si no tienes ninguna aplicación de correo configurada en tu dispositivo, copia directamente la dirección",
    fallbackAfterEmail:
      "en Gmail, Outlook o tu aplicación de correo electrónico.",
    open: "Abrir",
  },
};

const SUPPORT_PAGE_LOCALE_SET = new Set<string>(
  KLYX_SUPPORT_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxSupportPageTranslation(locale: KlyxLocale) {
  return SUPPORT_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxSupportPageLocale(
  locale: KlyxLocale
): KlyxSupportPageLocale {
  return hasKlyxSupportPageTranslation(locale)
    ? (locale as KlyxSupportPageLocale)
    : "fr";
}

export function getKlyxSupportPageDictionary(locale: KlyxLocale) {
  return SUPPORT_PAGE_MESSAGES[resolveKlyxSupportPageLocale(locale)];
}

export function translateKlyxSupportPage(
  locale: KlyxLocale,
  key: KlyxSupportPageMessageKey
) {
  return getKlyxSupportPageDictionary(locale)[key];
}
