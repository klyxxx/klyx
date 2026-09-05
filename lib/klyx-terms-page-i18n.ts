import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_TERMS_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
  "es",
] as const;

export type KlyxTermsPageLocale =
  (typeof KLYX_TERMS_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_TERMS_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "backLegal",
  "lastUpdated",
  "title",
  "section1Title",
  "section1Text",
  "section2Title",
  "section2Text",
  "section3Title",
  "section3Text",
  "section4Title",
  "section4Text",
  "section5Title",
  "section5Text",
  "section6Title",
  "section6Text",
  "section7Title",
  "section7Text",
  "section8Title",
  "section8Text",
  "section9Title",
  "section9Intro",
  "privacyLink",
  "section10Title",
  "contactIntro",
] as const;

export type KlyxTermsPageMessageKey =
  (typeof KLYX_TERMS_PAGE_MESSAGE_KEYS)[number];

type TermsPageDictionary = Record<KlyxTermsPageMessageKey, string>;

const TERMS_PAGE_MESSAGES: Record<KlyxTermsPageLocale, TermsPageDictionary> = {
  fr: {
    metadataTitle: "Conditions d’utilisation",
    metadataDescription: "Conditions d’utilisation de la plateforme KLYX.",
    backLegal: "Informations KLYX",
    lastUpdated: "Dernière mise à jour : 10 août 2026",
    title: "Conditions d’utilisation",
    section1Title: "1. Objet",
    section1Text:
      "KLYX est une plateforme permettant notamment de rechercher des services, consulter des prestataires, demander des devis, réserver, communiquer, payer et suivre une mission.",
    section2Title: "2. Comptes",
    section2Text:
      "L’utilisateur doit fournir des informations exactes, protéger ses accès et ne pas utiliser le compte d’une autre personne sans autorisation. KLYX peut appliquer des vérifications supplémentaires aux prestataires avant la publication de certains métiers.",
    section3Title: "3. Prestataires",
    section3Text:
      "Sauf indication contraire, les prestataires présents sur KLYX fournissent leurs services sous leur propre responsabilité. Ils doivent décrire honnêtement leurs compétences, prix, disponibilités et zones d’intervention et respecter les règles professionnelles applicables à leur activité.",
    section4Title: "4. Réservations, prix et paiement",
    section4Text:
      "Le prix et le mode de tarification applicables sont présentés au moment du parcours de réservation ou dans un devis accepté. Le paiement peut être traité par un prestataire de paiement externe. Une réservation ne doit pas être considérée comme payée tant que KLYX n’a pas reçu la confirmation correspondante.",
    section5Title: "5. Annulations et remboursements",
    section5Text:
      "Les possibilités d’annulation dépendent de l’état de la réservation et de la mission. Lorsqu’un paiement doit être remboursé, le traitement peut dépendre du prestataire de paiement. Une prestation déjà commencée peut nécessiter une procédure de litige plutôt qu’une annulation automatique.",
    section6Title: "6. Avis et confiance",
    section6Text:
      "KLYX peut limiter les avis aux missions réellement terminées. Les scores, badges et vérifications constituent des indicateurs de confiance et ne remplacent pas le jugement de l’utilisateur ni une garantie absolue sur l’exécution future d’un service.",
    section7Title: "7. Utilisations interdites",
    section7Text:
      "Il est interdit d’utiliser KLYX pour frauder, usurper une identité, contourner les mécanismes de paiement ou de sécurité, publier des informations trompeuses, harceler un utilisateur ou proposer une activité illégale.",
    section8Title: "8. Disponibilité",
    section8Text:
      "KLYX cherche à maintenir le service disponible et fiable, mais des opérations de maintenance, défaillances externes ou événements techniques peuvent entraîner des interruptions.",
    section9Title: "9. Données personnelles",
    section9Intro: "Le traitement des données personnelles est décrit dans la",
    privacyLink: "politique de confidentialité",
    section10Title: "10. Contact",
    contactIntro: "Pour une question relative à ces conditions :",
  },
  en: {
    metadataTitle: "Terms of Use",
    metadataDescription: "Terms of Use for the KLYX platform.",
    backLegal: "KLYX information",
    lastUpdated: "Last updated: August 10, 2026",
    title: "Terms of Use",
    section1Title: "1. Purpose",
    section1Text:
      "KLYX is a platform that notably enables users to search for services, view providers, request quotes, book, communicate, pay, and track a job.",
    section2Title: "2. Accounts",
    section2Text:
      "Users must provide accurate information, protect their access credentials, and not use another person’s account without authorization. KLYX may apply additional checks to providers before certain professions are published.",
    section3Title: "3. Providers",
    section3Text:
      "Unless otherwise indicated, providers on KLYX provide their services under their own responsibility. They must honestly describe their skills, prices, availability, and service areas and comply with the professional rules applicable to their activity.",
    section4Title: "4. Bookings, prices and payment",
    section4Text:
      "The applicable price and pricing method are presented during the booking flow or in an accepted quote. Payment may be processed by an external payment provider. A booking must not be considered paid until KLYX has received the corresponding confirmation.",
    section5Title: "5. Cancellations and refunds",
    section5Text:
      "Cancellation options depend on the status of the booking and the job. When a payment must be refunded, processing may depend on the payment provider. A service that has already started may require a dispute procedure rather than automatic cancellation.",
    section6Title: "6. Reviews and trust",
    section6Text:
      "KLYX may limit reviews to jobs that have actually been completed. Scores, badges, and verifications are trust indicators and do not replace the user’s judgment or constitute an absolute guarantee of future service performance.",
    section7Title: "7. Prohibited uses",
    section7Text:
      "It is prohibited to use KLYX to commit fraud, impersonate another person, bypass payment or security mechanisms, publish misleading information, harass a user, or offer an illegal activity.",
    section8Title: "8. Availability",
    section8Text:
      "KLYX seeks to keep the service available and reliable, but maintenance operations, external failures, or technical events may cause interruptions.",
    section9Title: "9. Personal data",
    section9Intro: "The processing of personal data is described in the",
    privacyLink: "privacy policy",
    section10Title: "10. Contact",
    contactIntro: "For questions about these terms:",
  },
  nl: {
    metadataTitle: "Gebruiksvoorwaarden",
    metadataDescription: "Gebruiksvoorwaarden van het KLYX-platform.",
    backLegal: "KLYX-informatie",
    lastUpdated: "Laatst bijgewerkt: 10 augustus 2026",
    title: "Gebruiksvoorwaarden",
    section1Title: "1. Doel",
    section1Text:
      "KLYX is een platform waarmee gebruikers onder meer diensten kunnen zoeken, dienstverleners kunnen bekijken, offertes kunnen aanvragen, reserveren, communiceren, betalen en een opdracht kunnen volgen.",
    section2Title: "2. Accounts",
    section2Text:
      "De gebruiker moet juiste informatie verstrekken, zijn toegangsgegevens beschermen en het account van een andere persoon niet zonder toestemming gebruiken. KLYX kan aanvullende controles toepassen op dienstverleners voordat bepaalde beroepen worden gepubliceerd.",
    section3Title: "3. Dienstverleners",
    section3Text:
      "Tenzij anders vermeld, leveren de dienstverleners op KLYX hun diensten onder hun eigen verantwoordelijkheid. Zij moeten hun vaardigheden, prijzen, beschikbaarheid en werkgebieden eerlijk beschrijven en de professionele regels naleven die op hun activiteit van toepassing zijn.",
    section4Title: "4. Boekingen, prijzen en betaling",
    section4Text:
      "De toepasselijke prijs en tariferingsmethode worden weergegeven tijdens het boekingsproces of in een aanvaarde offerte. De betaling kan door een externe betalingsdienstaanbieder worden verwerkt. Een boeking mag niet als betaald worden beschouwd zolang KLYX de bijbehorende bevestiging niet heeft ontvangen.",
    section5Title: "5. Annuleringen en terugbetalingen",
    section5Text:
      "De annuleringsmogelijkheden hangen af van de status van de boeking en de opdracht. Wanneer een betaling moet worden terugbetaald, kan de verwerking afhangen van de betalingsdienstaanbieder. Een dienstverlening die al is begonnen kan een geschillenprocedure vereisen in plaats van een automatische annulering.",
    section6Title: "6. Beoordelingen en vertrouwen",
    section6Text:
      "KLYX kan beoordelingen beperken tot daadwerkelijk voltooide opdrachten. Scores, badges en verificaties zijn vertrouwensindicatoren en vervangen het oordeel van de gebruiker niet en vormen geen absolute garantie voor de toekomstige uitvoering van een dienst.",
    section7Title: "7. Verboden gebruik",
    section7Text:
      "Het is verboden KLYX te gebruiken om fraude te plegen, iemands identiteit aan te nemen, betalings- of beveiligingsmechanismen te omzeilen, misleidende informatie te publiceren, een gebruiker lastig te vallen of een illegale activiteit aan te bieden.",
    section8Title: "8. Beschikbaarheid",
    section8Text:
      "KLYX streeft ernaar de dienst beschikbaar en betrouwbaar te houden, maar onderhoudswerkzaamheden, externe storingen of technische gebeurtenissen kunnen tot onderbrekingen leiden.",
    section9Title: "9. Persoonsgegevens",
    section9Intro: "De verwerking van persoonsgegevens wordt beschreven in het",
    privacyLink: "privacybeleid",
    section10Title: "10. Contact",
    contactIntro: "Voor een vraag over deze voorwaarden:",
  },
  de: {
    metadataTitle: "Nutzungsbedingungen",
    metadataDescription: "Nutzungsbedingungen der KLYX-Plattform.",
    backLegal: "KLYX-Informationen",
    lastUpdated: "Zuletzt aktualisiert: 10. August 2026",
    title: "Nutzungsbedingungen",
    section1Title: "1. Zweck",
    section1Text:
      "KLYX ist eine Plattform, die es insbesondere ermöglicht, Dienstleistungen zu suchen, Anbieter anzusehen, Angebote anzufordern, zu buchen, zu kommunizieren, zu bezahlen und einen Auftrag zu verfolgen.",
    section2Title: "2. Konten",
    section2Text:
      "Der Nutzer muss korrekte Angaben machen, seine Zugangsdaten schützen und das Konto einer anderen Person nicht ohne Erlaubnis verwenden. KLYX kann bei Dienstleistern zusätzliche Prüfungen durchführen, bevor bestimmte Tätigkeiten veröffentlicht werden.",
    section3Title: "3. Dienstleister",
    section3Text:
      "Sofern nicht anders angegeben, erbringen die auf KLYX vertretenen Dienstleister ihre Leistungen in eigener Verantwortung. Sie müssen ihre Fähigkeiten, Preise, Verfügbarkeiten und Einsatzgebiete wahrheitsgemäß beschreiben und die für ihre Tätigkeit geltenden beruflichen Regeln einhalten.",
    section4Title: "4. Buchungen, Preise und Zahlung",
    section4Text:
      "Der anwendbare Preis und die Preisberechnung werden im Buchungsprozess oder in einem angenommenen Angebot angezeigt. Die Zahlung kann von einem externen Zahlungsdienstleister verarbeitet werden. Eine Buchung darf erst dann als bezahlt gelten, wenn KLYX die entsprechende Bestätigung erhalten hat.",
    section5Title: "5. Stornierungen und Rückerstattungen",
    section5Text:
      "Die Stornierungsmöglichkeiten hängen vom Status der Buchung und des Auftrags ab. Wenn eine Zahlung zurückerstattet werden muss, kann die Abwicklung vom Zahlungsdienstleister abhängen. Eine bereits begonnene Leistung kann ein Streitbeilegungsverfahren erfordern statt einer automatischen Stornierung.",
    section6Title: "6. Bewertungen und Vertrauen",
    section6Text:
      "KLYX kann Bewertungen auf tatsächlich abgeschlossene Aufträge beschränken. Bewertungen, Badges und Verifizierungen sind Vertrauensindikatoren und ersetzen weder das Urteil des Nutzers noch stellen sie eine absolute Garantie für die zukünftige Ausführung einer Dienstleistung dar.",
    section7Title: "7. Verbotene Nutzung",
    section7Text:
      "Es ist verboten, KLYX zu verwenden, um zu betrügen, sich als eine andere Person auszugeben, Zahlungs- oder Sicherheitsmechanismen zu umgehen, irreführende Informationen zu veröffentlichen, einen Nutzer zu belästigen oder eine illegale Tätigkeit anzubieten.",
    section8Title: "8. Verfügbarkeit",
    section8Text:
      "KLYX bemüht sich, den Dienst verfügbar und zuverlässig zu halten. Wartungsarbeiten, externe Ausfälle oder technische Ereignisse können jedoch zu Unterbrechungen führen.",
    section9Title: "9. Personenbezogene Daten",
    section9Intro: "Die Verarbeitung personenbezogener Daten wird beschrieben in der",
    privacyLink: "Datenschutzerklärung",
    section10Title: "10. Kontakt",
    contactIntro: "Bei Fragen zu diesen Bedingungen:",
  },
  es: {
    metadataTitle: "Condiciones de uso",
    metadataDescription: "Condiciones de uso de la plataforma KLYX.",
    backLegal: "Información de KLYX",
    lastUpdated: "Última actualización: 10 de agosto de 2026",
    title: "Condiciones de uso",
    section1Title: "1. Objeto",
    section1Text:
      "KLYX es una plataforma que permite, entre otras cosas, buscar servicios, consultar proveedores, solicitar presupuestos, reservar, comunicarse, pagar y seguir una misión.",
    section2Title: "2. Cuentas",
    section2Text:
      "El usuario debe proporcionar información exacta, proteger sus datos de acceso y no utilizar la cuenta de otra persona sin autorización. KLYX puede aplicar verificaciones adicionales a los proveedores antes de publicar determinadas profesiones.",
    section3Title: "3. Proveedores",
    section3Text:
      "Salvo indicación contraria, los proveedores presentes en KLYX prestan sus servicios bajo su propia responsabilidad. Deben describir honestamente sus competencias, precios, disponibilidad y zonas de intervención, y respetar las normas profesionales aplicables a su actividad.",
    section4Title: "4. Reservas, precios y pago",
    section4Text:
      "El precio y el método de tarificación aplicables se presentan durante el proceso de reserva o en un presupuesto aceptado. El pago puede ser procesado por un proveedor de pagos externo. Una reserva no debe considerarse pagada hasta que KLYX haya recibido la confirmación correspondiente.",
    section5Title: "5. Cancelaciones y reembolsos",
    section5Text:
      "Las posibilidades de cancelación dependen del estado de la reserva y de la misión. Cuando un pago deba reembolsarse, el procesamiento puede depender del proveedor de pagos. Un servicio que ya haya comenzado puede requerir un procedimiento de disputa en lugar de una cancelación automática.",
    section6Title: "6. Reseñas y confianza",
    section6Text:
      "KLYX puede limitar las reseñas a las misiones realmente finalizadas. Las puntuaciones, insignias y verificaciones son indicadores de confianza y no sustituyen el criterio del usuario ni constituyen una garantía absoluta sobre la ejecución futura de un servicio.",
    section7Title: "7. Usos prohibidos",
    section7Text:
      "Está prohibido utilizar KLYX para cometer fraude, suplantar una identidad, eludir mecanismos de pago o seguridad, publicar información engañosa, acosar a un usuario u ofrecer una actividad ilegal.",
    section8Title: "8. Disponibilidad",
    section8Text:
      "KLYX procura mantener el servicio disponible y fiable, pero las operaciones de mantenimiento, fallos externos o eventos técnicos pueden provocar interrupciones.",
    section9Title: "9. Datos personales",
    section9Intro: "El tratamiento de los datos personales se describe en la",
    privacyLink: "política de privacidad",
    section10Title: "10. Contacto",
    contactIntro: "Para cualquier pregunta relacionada con estas condiciones:",
  },
};

const TERMS_PAGE_LOCALE_SET = new Set<string>(KLYX_TERMS_PAGE_TRANSLATED_LOCALES);

export function hasKlyxTermsPageTranslation(locale: KlyxLocale) {
  return TERMS_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxTermsPageLocale(
  locale: KlyxLocale
): KlyxTermsPageLocale {
  return hasKlyxTermsPageTranslation(locale)
    ? (locale as KlyxTermsPageLocale)
    : "fr";
}

export function getKlyxTermsPageDictionary(locale: KlyxLocale) {
  return TERMS_PAGE_MESSAGES[resolveKlyxTermsPageLocale(locale)];
}

export function translateKlyxTermsPage(
  locale: KlyxLocale,
  key: KlyxTermsPageMessageKey
) {
  return getKlyxTermsPageDictionary(locale)[key];
}
