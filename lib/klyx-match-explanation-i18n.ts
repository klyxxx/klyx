import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_MATCH_EXPLANATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxMatchExplanationLocale =
  (typeof KLYX_MATCH_EXPLANATION_TRANSLATED_LOCALES)[number];

export const KLYX_MATCH_EXPLANATION_MESSAGE_KEYS = [
  "regulatedApprovedSummary",
  "approvedSummary",
  "qualificationTitle",
  "officialRequirementPrefix",
  "qualificationDisclaimer",
  "coverageLoading",
  "coverageCoveredTitle",
  "coverageOutsideTitle",
  "distanceLabel",
  "radiusLabel",
  "marginLabel",
  "scoreDisclaimer",
  "zoneRequested",
  "zoneKnown",
  "zoneUnconfirmed",
  "slotAvailable",
  "slotConfirm",
  "availabilityKnown",
  "budgetCompatible",
  "priceKnown",
  "budgetExceeded",
  "priceConfirm",
  "trustVeryGood",
  "trustGood",
  "profileRecent",
  "profileVerified",
  "completedJobSingle",
  "completedJobsPlural",
  "yearsExperience",
  "lowCancellation",
  "highCancellation",
  "pricingTypeMatched",
  "levelExcellent",
  "levelStrong",
  "levelPossible",
  "levelAlternative",
  "coverageDirect",
  "coverageInside",
  "coverageBeyond",
] as const;

export type KlyxMatchExplanationMessageKey =
  (typeof KLYX_MATCH_EXPLANATION_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxMatchExplanationMessageKey, string>;

const MESSAGES: Record<KlyxMatchExplanationLocale, Dictionary> = {
  fr: {
    regulatedApprovedSummary: "Dossier métier réglementé approuvé · Voir les contrôles",
    approvedSummary: "Dossier métier approuvé · Voir les contrôles",
    qualificationTitle: "Contrôle de qualification métier",
    officialRequirementPrefix: "Exigence réglementaire configurée :",
    qualificationDisclaimer:
      "KLYX a approuvé le dossier transmis pour cette compétence. Ce contrôle KLYX ne remplace pas une autorisation, un agrément ou un registre officiel lorsqu’un organisme public en exige un.",
    coverageLoading: "Vérification du rayon professionnel...",
    coverageCoveredTitle: "Zone couverte",
    coverageOutsideTitle: "Hors rayon déclaré",
    distanceLabel: "Distance",
    radiusLabel: "Rayon",
    marginLabel: "Marge",
    scoreDisclaimer:
      "Le score explique une compatibilité avec cette recherche. La distance est estimée entre centres de communes et ne révèle aucune adresse privée.",
    zoneRequested: "Intervient dans la zone demandée",
    zoneKnown: "Zone de déplacement renseignée",
    zoneUnconfirmed: "La zone demandée n’est pas confirmée",
    slotAvailable: "Disponible au créneau recherché",
    slotConfirm: "Le créneau exact reste à confirmer",
    availabilityKnown: "Disponibilités professionnelles renseignées",
    budgetCompatible: "Estimation compatible avec le budget ({amount} €)",
    priceKnown: "Tarif clairement renseigné",
    budgetExceeded: "Estimation supérieure au budget ({amount} €)",
    priceConfirm: "Tarif encore à confirmer",
    trustVeryGood: "Très bon score de confiance",
    trustGood: "Score de confiance correct",
    profileRecent: "Profil encore récent ou peu évalué",
    profileVerified: "Profil vérifié",
    completedJobSingle: "{count} prestation réalisée",
    completedJobsPlural: "{count} prestations réalisées",
    yearsExperience: "{count} ans d’expérience",
    lowCancellation: "Faible taux d’annulation",
    highCancellation: "Taux d’annulation plus élevé",
    pricingTypeMatched: "Type de tarif souhaité",
    levelExcellent: "Excellente compatibilité",
    levelStrong: "Très bonne compatibilité",
    levelPossible: "Compatibilité possible",
    levelAlternative: "Alternative à vérifier",
    coverageDirect: "Ce prestataire intervient directement à {locality}.",
    coverageInside:
      "{locality} est à environ {distance} km de sa zone {zone}, dans son rayon de {radius} km.",
    coverageBeyond:
      "{locality} est à environ {distance} km de sa zone {zone}, au-delà de son rayon de {radius} km.",
  },
  en: {
    regulatedApprovedSummary: "Approved regulated-profession file · View checks",
    approvedSummary: "Approved professional file · View checks",
    qualificationTitle: "Professional qualification check",
    officialRequirementPrefix: "Configured regulatory requirement:",
    qualificationDisclaimer:
      "KLYX approved the file submitted for this skill. This KLYX check does not replace an official authorization, accreditation or register when a public authority requires one.",
    coverageLoading: "Checking professional coverage radius...",
    coverageCoveredTitle: "Area covered",
    coverageOutsideTitle: "Outside declared radius",
    distanceLabel: "Distance",
    radiusLabel: "Radius",
    marginLabel: "Margin",
    scoreDisclaimer:
      "The score explains compatibility with this search. Distance is estimated between municipality centres and does not reveal any private address.",
    zoneRequested: "Serves the requested area",
    zoneKnown: "Service area provided",
    zoneUnconfirmed: "The requested area is not confirmed",
    slotAvailable: "Available for the requested time slot",
    slotConfirm: "The exact time slot still needs confirmation",
    availabilityKnown: "Professional availability provided",
    budgetCompatible: "Estimate fits the budget ({amount} €)",
    priceKnown: "Price clearly provided",
    budgetExceeded: "Estimate exceeds the budget ({amount} €)",
    priceConfirm: "Price still needs confirmation",
    trustVeryGood: "Very good trust score",
    trustGood: "Good trust score",
    profileRecent: "Profile is still recent or lightly reviewed",
    profileVerified: "Verified profile",
    completedJobSingle: "{count} completed job",
    completedJobsPlural: "{count} completed jobs",
    yearsExperience: "{count} years of experience",
    lowCancellation: "Low cancellation rate",
    highCancellation: "Higher cancellation rate",
    pricingTypeMatched: "Requested pricing type",
    levelExcellent: "Excellent match",
    levelStrong: "Very good match",
    levelPossible: "Possible match",
    levelAlternative: "Alternative to review",
    coverageDirect: "This provider serves {locality} directly.",
    coverageInside:
      "{locality} is about {distance} km from their {zone} area, within their {radius} km radius.",
    coverageBeyond:
      "{locality} is about {distance} km from their {zone} area, beyond their {radius} km radius.",
  },
  nl: {
    regulatedApprovedSummary: "Goedgekeurd dossier voor gereglementeerd beroep · Controles bekijken",
    approvedSummary: "Goedgekeurd beroepsdossier · Controles bekijken",
    qualificationTitle: "Controle van beroepskwalificatie",
    officialRequirementPrefix: "Geconfigureerde wettelijke vereiste:",
    qualificationDisclaimer:
      "KLYX heeft het ingediende dossier voor deze vaardigheid goedgekeurd. Deze KLYX-controle vervangt geen officiële toelating, erkenning of registratie wanneer een overheidsinstantie die vereist.",
    coverageLoading: "Professionele actieradius controleren...",
    coverageCoveredTitle: "Zone gedekt",
    coverageOutsideTitle: "Buiten de opgegeven straal",
    distanceLabel: "Afstand",
    radiusLabel: "Straal",
    marginLabel: "Marge",
    scoreDisclaimer:
      "De score verklaart de compatibiliteit met deze zoekopdracht. De afstand wordt geschat tussen gemeentecentra en onthult geen privéadres.",
    zoneRequested: "Actief in de gevraagde zone",
    zoneKnown: "Werkgebied opgegeven",
    zoneUnconfirmed: "De gevraagde zone is niet bevestigd",
    slotAvailable: "Beschikbaar voor het gevraagde tijdslot",
    slotConfirm: "Het exacte tijdslot moet nog worden bevestigd",
    availabilityKnown: "Professionele beschikbaarheid opgegeven",
    budgetCompatible: "Raming past binnen het budget ({amount} €)",
    priceKnown: "Tarief duidelijk opgegeven",
    budgetExceeded: "Raming ligt boven het budget ({amount} €)",
    priceConfirm: "Tarief moet nog worden bevestigd",
    trustVeryGood: "Zeer goede betrouwbaarheidsscore",
    trustGood: "Goede betrouwbaarheidsscore",
    profileRecent: "Profiel is nog recent of weinig beoordeeld",
    profileVerified: "Geverifieerd profiel",
    completedJobSingle: "{count} uitgevoerde opdracht",
    completedJobsPlural: "{count} uitgevoerde opdrachten",
    yearsExperience: "{count} jaar ervaring",
    lowCancellation: "Laag annuleringspercentage",
    highCancellation: "Hoger annuleringspercentage",
    pricingTypeMatched: "Gewenst tarieftype",
    levelExcellent: "Uitstekende match",
    levelStrong: "Zeer goede match",
    levelPossible: "Mogelijke match",
    levelAlternative: "Alternatief om te controleren",
    coverageDirect: "Deze dienstverlener werkt rechtstreeks in {locality}.",
    coverageInside:
      "{locality} ligt ongeveer {distance} km van de zone {zone}, binnen de straal van {radius} km.",
    coverageBeyond:
      "{locality} ligt ongeveer {distance} km van de zone {zone}, buiten de straal van {radius} km.",
  },
  de: {
    regulatedApprovedSummary: "Genehmigte Unterlagen für reglementierten Beruf · Prüfungen ansehen",
    approvedSummary: "Genehmigte Berufsunterlagen · Prüfungen ansehen",
    qualificationTitle: "Prüfung der Berufsqualifikation",
    officialRequirementPrefix: "Konfigurierte behördliche Anforderung:",
    qualificationDisclaimer:
      "KLYX hat die für diese Fähigkeit eingereichten Unterlagen geprüft und genehmigt. Diese KLYX-Prüfung ersetzt keine offizielle Genehmigung, Zulassung oder Registrierung, wenn eine Behörde diese verlangt.",
    coverageLoading: "Professionellen Einsatzradius prüfen...",
    coverageCoveredTitle: "Gebiet abgedeckt",
    coverageOutsideTitle: "Außerhalb des angegebenen Radius",
    distanceLabel: "Entfernung",
    radiusLabel: "Radius",
    marginLabel: "Spielraum",
    scoreDisclaimer:
      "Der Score erklärt die Übereinstimmung mit dieser Suche. Die Entfernung wird zwischen Gemeindezentren geschätzt und gibt keine private Adresse preis.",
    zoneRequested: "Im gewünschten Gebiet tätig",
    zoneKnown: "Einsatzgebiet angegeben",
    zoneUnconfirmed: "Das gewünschte Gebiet ist nicht bestätigt",
    slotAvailable: "Zum gewünschten Zeitfenster verfügbar",
    slotConfirm: "Das genaue Zeitfenster muss noch bestätigt werden",
    availabilityKnown: "Professionelle Verfügbarkeit angegeben",
    budgetCompatible: "Schätzung passt zum Budget ({amount} €)",
    priceKnown: "Preis klar angegeben",
    budgetExceeded: "Schätzung liegt über dem Budget ({amount} €)",
    priceConfirm: "Preis muss noch bestätigt werden",
    trustVeryGood: "Sehr guter Vertrauenswert",
    trustGood: "Guter Vertrauenswert",
    profileRecent: "Profil ist noch neu oder wenig bewertet",
    profileVerified: "Verifiziertes Profil",
    completedJobSingle: "{count} abgeschlossener Auftrag",
    completedJobsPlural: "{count} abgeschlossene Aufträge",
    yearsExperience: "{count} Jahre Erfahrung",
    lowCancellation: "Niedrige Stornierungsrate",
    highCancellation: "Höhere Stornierungsrate",
    pricingTypeMatched: "Gewünschte Preisart",
    levelExcellent: "Ausgezeichnete Übereinstimmung",
    levelStrong: "Sehr gute Übereinstimmung",
    levelPossible: "Mögliche Übereinstimmung",
    levelAlternative: "Zu prüfende Alternative",
    coverageDirect: "Dieser Dienstleister ist direkt in {locality} tätig.",
    coverageInside:
      "{locality} liegt etwa {distance} km von seinem Gebiet {zone} entfernt und innerhalb seines Radius von {radius} km.",
    coverageBeyond:
      "{locality} liegt etwa {distance} km von seinem Gebiet {zone} entfernt und außerhalb seines Radius von {radius} km.",
  },
};

const LOCALES = new Set<string>(KLYX_MATCH_EXPLANATION_TRANSLATED_LOCALES);

export function resolveKlyxMatchExplanationLocale(
  locale: KlyxLocale
): KlyxMatchExplanationLocale {
  return LOCALES.has(locale) ? (locale as KlyxMatchExplanationLocale) : "fr";
}

export function getKlyxMatchExplanationDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxMatchExplanationLocale(locale)];
}

export function translateKlyxMatchExplanation(
  locale: KlyxLocale,
  key: KlyxMatchExplanationMessageKey
) {
  return getKlyxMatchExplanationDictionary(locale)[key];
}

export function formatKlyxMatchExplanation(
  locale: KlyxLocale,
  key: KlyxMatchExplanationMessageKey,
  values: Record<string, string | number>
) {
  let message = translateKlyxMatchExplanation(locale, key);
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

export function formatKlyxCoverageMessage(
  locale: KlyxLocale,
  input: {
    covered: boolean;
    requestedLocality: string;
    zoneLocality: string;
    distanceKm: number;
    radiusKm: number;
  }
) {
  if (input.covered && input.distanceKm === 0) {
    return formatKlyxMatchExplanation(locale, "coverageDirect", {
      locality: input.requestedLocality,
    });
  }

  return formatKlyxMatchExplanation(
    locale,
    input.covered ? "coverageInside" : "coverageBeyond",
    {
      locality: input.requestedLocality,
      distance: input.distanceKm,
      zone: input.zoneLocality,
      radius: input.radiusKm,
    }
  );
}
