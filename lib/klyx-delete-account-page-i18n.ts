import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_DELETE_ACCOUNT_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxDeleteAccountPageLocale =
  (typeof KLYX_DELETE_ACCOUNT_PAGE_TRANSLATED_LOCALES)[number];

export const KLYX_DELETE_ACCOUNT_PAGE_MESSAGE_KEYS = [
  "metadataTitle",
  "metadataDescription",
  "backLegal",
  "title",
  "description",
  "fromKlyxTitle",
  "fromKlyxDescription",
  "openSettings",
  "webRequestTitle",
  "webRequestDescription",
  "requestDeletion",
  "processingAddress",
  "retainedTitle",
  "retainedDescription",
  "emailSubject",
  "emailGreeting",
  "emailRequest",
  "emailAccountLabel",
  "emailIdentityAcknowledgement",
] as const;

export type KlyxDeleteAccountPageMessageKey =
  (typeof KLYX_DELETE_ACCOUNT_PAGE_MESSAGE_KEYS)[number];

type DeleteAccountPageDictionary = Record<
  KlyxDeleteAccountPageMessageKey,
  string
>;

const DELETE_ACCOUNT_PAGE_MESSAGES: Record<
  KlyxDeleteAccountPageLocale,
  DeleteAccountPageDictionary
> = {
  fr: {
    metadataTitle: "Suppression du compte",
    metadataDescription:
      "Demander la suppression d’un compte KLYX et des données associées.",
    backLegal: "Informations KLYX",
    title: "Supprimer un compte KLYX",
    description:
      "Cette page est accessible même sans l’application et permet d’initier une demande de suppression du compte et des données personnelles associées.",
    fromKlyxTitle: "Depuis KLYX",
    fromKlyxDescription:
      "Si tu peux encore te connecter, ouvre Paramètres → Supprimer mon compte. Cette voie permet à KLYX de vérifier directement le compte.",
    openSettings: "Ouvrir les paramètres",
    webRequestTitle: "Demande depuis le web",
    webRequestDescription:
      "Si tu n’as plus accès à l’application, envoie une demande à l’assistance. Utilise si possible l’adresse e-mail du compte. KLYX peut demander une vérification raisonnable afin d’éviter qu’une autre personne supprime ton compte.",
    requestDeletion: "Demander la suppression",
    processingAddress: "Adresse de traitement :",
    retainedTitle: "Données conservées si nécessaire",
    retainedDescription:
      "Les données personnelles qui ne sont plus nécessaires doivent être supprimées ou anonymisées. Certaines informations peuvent être conservées lorsqu’une obligation légale, la prévention de la fraude, la sécurité ou la gestion d’un litige l’exige.",
    emailSubject: "Demande de suppression de compte KLYX",
    emailGreeting: "Bonjour KLYX,",
    emailRequest:
      "Je souhaite demander la suppression de mon compte KLYX et des données associées.",
    emailAccountLabel: "Adresse e-mail du compte :",
    emailIdentityAcknowledgement:
      "Je comprends qu'une vérification de mon identité peut être nécessaire avant traitement.",
  },
  en: {
    metadataTitle: "Account deletion",
    metadataDescription:
      "Request deletion of a KLYX account and associated data.",
    backLegal: "KLYX information",
    title: "Delete a KLYX account",
    description:
      "This page is accessible even without the application and allows you to initiate a request to delete the account and associated personal data.",
    fromKlyxTitle: "From KLYX",
    fromKlyxDescription:
      "If you can still sign in, open Settings → Delete my account. This route allows KLYX to verify the account directly.",
    openSettings: "Open settings",
    webRequestTitle: "Request from the web",
    webRequestDescription:
      "If you no longer have access to the application, send a request to support. If possible, use the email address of the account. KLYX may request reasonable verification to prevent another person from deleting your account.",
    requestDeletion: "Request deletion",
    processingAddress: "Processing address:",
    retainedTitle: "Data retained when necessary",
    retainedDescription:
      "Personal data that is no longer necessary must be deleted or anonymized. Certain information may be retained when required by a legal obligation, fraud prevention, security, or the management of a dispute.",
    emailSubject: "KLYX account deletion request",
    emailGreeting: "Hello KLYX,",
    emailRequest:
      "I would like to request the deletion of my KLYX account and associated data.",
    emailAccountLabel: "Account email address:",
    emailIdentityAcknowledgement:
      "I understand that verification of my identity may be necessary before processing.",
  },
  nl: {
    metadataTitle: "Account verwijderen",
    metadataDescription:
      "De verwijdering van een KLYX-account en de bijbehorende gegevens aanvragen.",
    backLegal: "KLYX-informatie",
    title: "Een KLYX-account verwijderen",
    description:
      "Deze pagina is ook zonder de applicatie toegankelijk en laat je een verzoek starten om het account en de bijbehorende persoonsgegevens te verwijderen.",
    fromKlyxTitle: "Vanuit KLYX",
    fromKlyxDescription:
      "Als je nog kunt inloggen, open Instellingen → Mijn account verwijderen. Via deze weg kan KLYX het account rechtstreeks verifiëren.",
    openSettings: "Instellingen openen",
    webRequestTitle: "Verzoek via het web",
    webRequestDescription:
      "Als je geen toegang meer hebt tot de applicatie, stuur dan een verzoek naar de ondersteuning. Gebruik indien mogelijk het e-mailadres van het account. KLYX kan een redelijke verificatie vragen om te voorkomen dat iemand anders je account verwijdert.",
    requestDeletion: "Verwijdering aanvragen",
    processingAddress: "Adres voor behandeling:",
    retainedTitle: "Gegevens die indien nodig worden bewaard",
    retainedDescription:
      "Persoonsgegevens die niet langer nodig zijn, moeten worden verwijderd of geanonimiseerd. Bepaalde informatie kan worden bewaard wanneer een wettelijke verplichting, fraudepreventie, beveiliging of de behandeling van een geschil dit vereist.",
    emailSubject: "Verzoek tot verwijdering van KLYX-account",
    emailGreeting: "Hallo KLYX,",
    emailRequest:
      "Ik wil de verwijdering van mijn KLYX-account en de bijbehorende gegevens aanvragen.",
    emailAccountLabel: "E-mailadres van het account:",
    emailIdentityAcknowledgement:
      "Ik begrijp dat verificatie van mijn identiteit nodig kan zijn vóór de behandeling.",
  },
  de: {
    metadataTitle: "Konto löschen",
    metadataDescription:
      "Die Löschung eines KLYX-Kontos und der zugehörigen Daten beantragen.",
    backLegal: "KLYX-Informationen",
    title: "Ein KLYX-Konto löschen",
    description:
      "Diese Seite ist auch ohne die Anwendung zugänglich und ermöglicht es, einen Antrag auf Löschung des Kontos und der zugehörigen personenbezogenen Daten einzuleiten.",
    fromKlyxTitle: "In KLYX",
    fromKlyxDescription:
      "Wenn du dich noch anmelden kannst, öffne Einstellungen → Mein Konto löschen. Auf diesem Weg kann KLYX das Konto direkt verifizieren.",
    openSettings: "Einstellungen öffnen",
    webRequestTitle: "Anfrage über das Web",
    webRequestDescription:
      "Wenn du keinen Zugriff mehr auf die Anwendung hast, sende eine Anfrage an den Support. Verwende nach Möglichkeit die E-Mail-Adresse des Kontos. KLYX kann eine angemessene Überprüfung verlangen, um zu verhindern, dass eine andere Person dein Konto löscht.",
    requestDeletion: "Löschung beantragen",
    processingAddress: "Bearbeitungsadresse:",
    retainedTitle: "Daten, die bei Bedarf aufbewahrt werden",
    retainedDescription:
      "Personenbezogene Daten, die nicht mehr erforderlich sind, müssen gelöscht oder anonymisiert werden. Bestimmte Informationen können aufbewahrt werden, wenn eine gesetzliche Verpflichtung, Betrugsprävention, Sicherheit oder die Bearbeitung einer Streitigkeit dies erfordert.",
    emailSubject: "Antrag auf Löschung eines KLYX-Kontos",
    emailGreeting: "Hallo KLYX,",
    emailRequest:
      "Ich möchte die Löschung meines KLYX-Kontos und der zugehörigen Daten beantragen.",
    emailAccountLabel: "E-Mail-Adresse des Kontos:",
    emailIdentityAcknowledgement:
      "Ich verstehe, dass vor der Bearbeitung eine Überprüfung meiner Identität erforderlich sein kann.",
  },
};

const DELETE_ACCOUNT_PAGE_LOCALE_SET = new Set<string>(
  KLYX_DELETE_ACCOUNT_PAGE_TRANSLATED_LOCALES
);

export function hasKlyxDeleteAccountPageTranslation(locale: KlyxLocale) {
  return DELETE_ACCOUNT_PAGE_LOCALE_SET.has(locale);
}

export function resolveKlyxDeleteAccountPageLocale(
  locale: KlyxLocale
): KlyxDeleteAccountPageLocale {
  return hasKlyxDeleteAccountPageTranslation(locale)
    ? (locale as KlyxDeleteAccountPageLocale)
    : "fr";
}

export function getKlyxDeleteAccountPageDictionary(locale: KlyxLocale) {
  return DELETE_ACCOUNT_PAGE_MESSAGES[
    resolveKlyxDeleteAccountPageLocale(locale)
  ];
}

export function translateKlyxDeleteAccountPage(
  locale: KlyxLocale,
  key: KlyxDeleteAccountPageMessageKey
) {
  return getKlyxDeleteAccountPageDictionary(locale)[key];
}
