import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxPrivacyPageLocale =
  (typeof KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_PRIVACY_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "backLegal",
  "lastUpdated",
  "title",
  "section1Title",
  "controllerIntro",
  "addressLabel",
  "companyNumberLabel",
  "privacyContactLabel",
  "section2Title",
  "section2AccountText",
  "section2PaymentText",
  "section2OptionalText",
  "section3Title",
  "section3Text",
  "section4Title",
  "section4Text",
  "section5Title",
  "section5Text",
  "section6Title",
  "deletionIntro",
  "deletionAfterLink",
  "rightsIntro",
  "section7Title",
  "section7Text",
  "section8Title",
  "section8Text",
] as const;

export type KlyxPrivacyPageMessageKey =
  (typeof KLYX_PRIVACY_PAGE_MESSAGE_KEYS)[number];

type PrivacyPageDictionary = Record<KlyxPrivacyPageMessageKey, string>;

const PRIVACY_PAGE_MESSAGES: Record<
  KlyxPrivacyPageLocale,
  PrivacyPageDictionary
> = {
  fr: {
    metadataTitle: "Politique de confidentialité",
    metadataDescription:
      "Politique de confidentialité de KLYX et informations sur le traitement des données.",
    backLegal: "Informations KLYX",
    lastUpdated: "Dernière mise à jour : 10 août 2026",
    title: "Politique de confidentialité",
    section1Title: "1. Responsable",
    controllerIntro:
      "KLYX est le service responsable des traitements décrits ici. L’éditeur public indiqué par la configuration de l’application est",
    addressLabel: "Adresse :",
    companyNumberLabel: "Numéro d’entreprise :",
    privacyContactLabel: "Contact confidentialité :",
    section2Title: "2. Données pouvant être traitées",
    section2AccountText:
      "Selon les fonctions utilisées, KLYX peut traiter des données de compte et de profil, coordonnées, informations de service, disponibilités et zones d’intervention, réservations, devis, messages, avis, préférences, notifications et données techniques nécessaires à la sécurité du service.",
    section2PaymentText:
      "Pour les paiements, KLYX conserve les identifiants et états nécessaires au suivi des transactions. Les données de carte sont traitées par le prestataire de paiement et ne sont pas destinées à être stockées directement par KLYX.",
    section2OptionalText:
      "Certaines fonctions facultatives peuvent traiter des images, informations de localisation saisies par l’utilisateur, éléments de vérification prestataire ou contenu envoyé à des fonctions d’assistance par intelligence artificielle.",
    section3Title: "3. Finalités",
    section3Text:
      "Ces données servent notamment à créer et sécuriser les comptes, mettre en relation clients et prestataires, fournir la recherche, les devis, la réservation et le suivi des missions, traiter les paiements et remboursements, prévenir la fraude, gérer la confiance et les avis, fournir l’assistance et améliorer le fonctionnement de KLYX.",
    section4Title: "4. Prestataires techniques",
    section4Text:
      "KLYX peut s’appuyer sur des prestataires techniques nécessaires à son fonctionnement, notamment pour l’hébergement, la base de données et l’authentification, les paiements, la vérification d’identité lorsque celle-ci est activée, la livraison de l’application et les fonctions d’intelligence artificielle. L’accès doit être limité à ce qui est nécessaire à leur mission.",
    section5Title: "5. Conservation",
    section5Text:
      "KLYX conserve les données pendant la durée nécessaire au service, à la sécurité, à la résolution des litiges et aux obligations légales applicables. Lors d’une suppression de compte, les données personnelles qui ne doivent plus être conservées doivent être supprimées ou anonymisées. Certaines informations liées à des transactions, à la fraude, à la sécurité ou à une obligation réglementaire peuvent devoir être conservées pendant une durée supplémentaire.",
    section6Title: "6. Suppression et droits",
    deletionIntro:
      "Un utilisateur connecté peut initier la suppression dans Paramètres. Une ressource web indépendante est également disponible sur",
    deletionAfterLink:
      "Une vérification d’identité peut être demandée avant de traiter une demande externe afin d’éviter la suppression frauduleuse d’un compte.",
    rightsIntro:
      "Pour demander l’accès, la rectification, l’effacement ou une autre action concernant tes données, contacte",
    section7Title: "7. Sécurité",
    section7Text:
      "KLYX utilise des contrôles d’accès, des mécanismes d’authentification et des protections côté serveur. Aucun système n’est toutefois exempt de risque ; les incidents doivent être analysés et traités conformément aux obligations applicables.",
    section8Title: "8. Évolution de cette politique",
    section8Text:
      "Cette politique peut évoluer avec KLYX. La date affichée en haut de cette page permet d’identifier la version publiée.",
  },
  en: {
    metadataTitle: "Privacy Policy",
    metadataDescription:
      "KLYX Privacy Policy and information about data processing.",
    backLegal: "KLYX information",
    lastUpdated: "Last updated: August 10, 2026",
    title: "Privacy Policy",
    section1Title: "1. Controller",
    controllerIntro:
      "KLYX is the service responsible for the processing described here. The public publisher indicated by the application configuration is",
    addressLabel: "Address:",
    companyNumberLabel: "Company number:",
    privacyContactLabel: "Privacy contact:",
    section2Title: "2. Data that may be processed",
    section2AccountText:
      "Depending on the features used, KLYX may process account and profile data, contact details, service information, availability and service areas, bookings, quotes, messages, reviews, preferences, notifications, and technical data necessary for service security.",
    section2PaymentText:
      "For payments, KLYX retains the identifiers and statuses necessary to track transactions. Card data is processed by the payment provider and is not intended to be stored directly by KLYX.",
    section2OptionalText:
      "Some optional features may process images, location information entered by the user, provider-verification items, or content sent to artificial-intelligence assistance features.",
    section3Title: "3. Purposes",
    section3Text:
      "This data is used in particular to create and secure accounts, connect clients and providers, provide search, quotes, booking and job tracking, process payments and refunds, prevent fraud, manage trust and reviews, provide support, and improve how KLYX operates.",
    section4Title: "4. Technical providers",
    section4Text:
      "KLYX may rely on technical providers necessary for its operation, notably for hosting, database and authentication, payments, identity verification when enabled, application delivery, and artificial-intelligence features. Access must be limited to what is necessary for their role.",
    section5Title: "5. Retention",
    section5Text:
      "KLYX retains data for as long as necessary for the service, security, dispute resolution, and applicable legal obligations. When an account is deleted, personal data that no longer needs to be retained must be deleted or anonymized. Certain information related to transactions, fraud, security, or a regulatory obligation may need to be retained for an additional period.",
    section6Title: "6. Deletion and rights",
    deletionIntro:
      "An authenticated user can initiate deletion in Settings. An independent web resource is also available at",
    deletionAfterLink:
      "Identity verification may be requested before processing an external request to prevent fraudulent deletion of an account.",
    rightsIntro:
      "To request access, rectification, erasure, or another action concerning your data, contact",
    section7Title: "7. Security",
    section7Text:
      "KLYX uses access controls, authentication mechanisms, and server-side protections. No system is completely free of risk; incidents must be analyzed and handled in accordance with applicable obligations.",
    section8Title: "8. Changes to this policy",
    section8Text:
      "This policy may evolve with KLYX. The date displayed at the top of this page identifies the published version.",
  },
  nl: {
    metadataTitle: "Privacybeleid",
    metadataDescription:
      "KLYX-privacybeleid en informatie over de verwerking van persoonsgegevens.",
    backLegal: "KLYX-informatie",
    lastUpdated: "Laatst bijgewerkt: 10 augustus 2026",
    title: "Privacybeleid",
    section1Title: "1. Verwerkingsverantwoordelijke",
    controllerIntro:
      "KLYX is de dienst die verantwoordelijk is voor de hier beschreven verwerkingen. De openbare uitgever die in de configuratie van de applicatie wordt vermeld is",
    addressLabel: "Adres:",
    companyNumberLabel: "Ondernemingsnummer:",
    privacyContactLabel: "Privacycontact:",
    section2Title: "2. Gegevens die kunnen worden verwerkt",
    section2AccountText:
      "Afhankelijk van de gebruikte functies kan KLYX account- en profielgegevens, contactgegevens, service-informatie, beschikbaarheid en werkgebieden, boekingen, offertes, berichten, beoordelingen, voorkeuren, meldingen en technische gegevens verwerken die nodig zijn voor de beveiliging van de dienst.",
    section2PaymentText:
      "Voor betalingen bewaart KLYX de identificatoren en statussen die nodig zijn om transacties te volgen. Betaalkaartgegevens worden verwerkt door de betalingsdienstaanbieder en zijn niet bedoeld om rechtstreeks door KLYX te worden opgeslagen.",
    section2OptionalText:
      "Sommige optionele functies kunnen afbeeldingen, door de gebruiker ingevoerde locatiegegevens, elementen voor verificatie van dienstverleners of inhoud die naar functies voor ondersteuning met artificiële intelligentie wordt gestuurd verwerken.",
    section3Title: "3. Doeleinden",
    section3Text:
      "Deze gegevens worden met name gebruikt om accounts aan te maken en te beveiligen, klanten en dienstverleners met elkaar in contact te brengen, zoeken, offertes, boekingen en het volgen van opdrachten mogelijk te maken, betalingen en terugbetalingen te verwerken, fraude te voorkomen, vertrouwen en beoordelingen te beheren, ondersteuning te bieden en de werking van KLYX te verbeteren.",
    section4Title: "4. Technische dienstverleners",
    section4Text:
      "KLYX kan gebruikmaken van technische dienstverleners die nodig zijn voor de werking, met name voor hosting, databank en authenticatie, betalingen, identiteitsverificatie wanneer die is geactiveerd, levering van de applicatie en functies met artificiële intelligentie. Toegang moet worden beperkt tot wat nodig is voor hun opdracht.",
    section5Title: "5. Bewaring",
    section5Text:
      "KLYX bewaart gegevens zolang dat nodig is voor de dienst, beveiliging, geschillenbeslechting en toepasselijke wettelijke verplichtingen. Bij verwijdering van een account moeten persoonsgegevens die niet langer hoeven te worden bewaard worden verwijderd of geanonimiseerd. Bepaalde informatie in verband met transacties, fraude, beveiliging of een reglementaire verplichting kan langer moeten worden bewaard.",
    section6Title: "6. Verwijdering en rechten",
    deletionIntro:
      "Een ingelogde gebruiker kan de verwijdering starten in Instellingen. Een onafhankelijke webpagina is ook beschikbaar op",
    deletionAfterLink:
      "Voordat een extern verzoek wordt verwerkt, kan identiteitsverificatie worden gevraagd om frauduleuze verwijdering van een account te voorkomen.",
    rightsIntro:
      "Om inzage, rectificatie, verwijdering of een andere actie met betrekking tot je gegevens te vragen, neem contact op met",
    section7Title: "7. Beveiliging",
    section7Text:
      "KLYX gebruikt toegangscontroles, authenticatiemechanismen en serverbeveiliging. Geen enkel systeem is echter vrij van risico; incidenten moeten worden geanalyseerd en behandeld overeenkomstig de toepasselijke verplichtingen.",
    section8Title: "8. Wijzigingen aan dit beleid",
    section8Text:
      "Dit beleid kan met KLYX evolueren. De datum bovenaan deze pagina identificeert de gepubliceerde versie.",
  },
  de: {
    metadataTitle: "Datenschutzerklärung",
    metadataDescription:
      "KLYX-Datenschutzerklärung und Informationen zur Datenverarbeitung.",
    backLegal: "KLYX-Informationen",
    lastUpdated: "Zuletzt aktualisiert: 10. August 2026",
    title: "Datenschutzerklärung",
    section1Title: "1. Verantwortlicher",
    controllerIntro:
      "KLYX ist der für die hier beschriebenen Verarbeitungen verantwortliche Dienst. Der in der Anwendungskonfiguration angegebene öffentliche Herausgeber ist",
    addressLabel: "Adresse:",
    companyNumberLabel: "Unternehmensnummer:",
    privacyContactLabel: "Datenschutzkontakt:",
    section2Title: "2. Daten, die verarbeitet werden können",
    section2AccountText:
      "Je nach verwendeten Funktionen kann KLYX Konto- und Profildaten, Kontaktdaten, Dienstleistungsinformationen, Verfügbarkeiten und Einsatzgebiete, Buchungen, Angebote, Nachrichten, Bewertungen, Präferenzen, Benachrichtigungen und technische Daten verarbeiten, die für die Sicherheit des Dienstes erforderlich sind.",
    section2PaymentText:
      "Für Zahlungen speichert KLYX die Kennungen und Statusangaben, die zur Nachverfolgung von Transaktionen erforderlich sind. Kartendaten werden vom Zahlungsdienstleister verarbeitet und sind nicht dafür bestimmt, direkt von KLYX gespeichert zu werden.",
    section2OptionalText:
      "Einige optionale Funktionen können Bilder, vom Nutzer eingegebene Standortinformationen, Elemente zur Dienstleisterverifizierung oder Inhalte verarbeiten, die an Unterstützungsfunktionen mit künstlicher Intelligenz gesendet werden.",
    section3Title: "3. Zwecke",
    section3Text:
      "Diese Daten werden insbesondere verwendet, um Konten zu erstellen und zu sichern, Kunden und Dienstleister zusammenzubringen, Suche, Angebote, Buchung und Auftragsverfolgung bereitzustellen, Zahlungen und Rückerstattungen zu verarbeiten, Betrug zu verhindern, Vertrauen und Bewertungen zu verwalten, Support zu leisten und die Funktionsweise von KLYX zu verbessern.",
    section4Title: "4. Technische Dienstleister",
    section4Text:
      "KLYX kann für seinen Betrieb erforderliche technische Dienstleister einsetzen, insbesondere für Hosting, Datenbank und Authentifizierung, Zahlungen, Identitätsprüfung, wenn diese aktiviert ist, Auslieferung der Anwendung und Funktionen mit künstlicher Intelligenz. Der Zugriff muss auf das für ihre Aufgabe Erforderliche beschränkt sein.",
    section5Title: "5. Aufbewahrung",
    section5Text:
      "KLYX bewahrt Daten so lange auf, wie dies für den Dienst, die Sicherheit, die Beilegung von Streitigkeiten und geltende gesetzliche Verpflichtungen erforderlich ist. Bei der Löschung eines Kontos müssen personenbezogene Daten, die nicht mehr aufbewahrt werden müssen, gelöscht oder anonymisiert werden. Bestimmte Informationen zu Transaktionen, Betrug, Sicherheit oder einer regulatorischen Verpflichtung müssen möglicherweise für einen zusätzlichen Zeitraum aufbewahrt werden.",
    section6Title: "6. Löschung und Rechte",
    deletionIntro:
      "Ein angemeldeter Nutzer kann die Löschung in den Einstellungen einleiten. Eine unabhängige Webressource ist ebenfalls verfügbar unter",
    deletionAfterLink:
      "Vor der Bearbeitung eines externen Antrags kann eine Identitätsprüfung verlangt werden, um die betrügerische Löschung eines Kontos zu verhindern.",
    rightsIntro:
      "Um Auskunft, Berichtigung, Löschung oder eine andere Maßnahme in Bezug auf deine Daten anzufordern, kontaktiere",
    section7Title: "7. Sicherheit",
    section7Text:
      "KLYX verwendet Zugriffskontrollen, Authentifizierungsmechanismen und serverseitige Schutzmaßnahmen. Kein System ist jedoch völlig risikofrei; Vorfälle müssen gemäß den geltenden Verpflichtungen analysiert und behandelt werden.",
    section8Title: "8. Änderungen dieser Erklärung",
    section8Text:
      "Diese Erklärung kann sich mit KLYX weiterentwickeln. Das oben auf dieser Seite angezeigte Datum kennzeichnet die veröffentlichte Version.",
  },
};

const PRIVACY_PAGE_LOCALE_SET = new Set<string>(
  KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxPrivacyPageTranslation(locale: KlyxLocale) {
  return PRIVACY_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxPrivacyPageLocale(
  locale: KlyxLocale
): KlyxPrivacyPageLocale {
  return hasKlyxPrivacyPageTranslation(locale)
    ? (locale as KlyxPrivacyPageLocale)
    : "fr";
}

export function getKlyxPrivacyPageDictionary(locale: KlyxLocale) {
  return PRIVACY_PAGE_MESSAGES[resolveKlyxPrivacyPageLocale(locale)];
}

export function translateKlyxPrivacyPage(
  locale: KlyxLocale,
  key: KlyxPrivacyPageMessageKey
) {
  return getKlyxPrivacyPageDictionary(locale)[key];
}
