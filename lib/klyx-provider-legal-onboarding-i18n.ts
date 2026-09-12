import type { KlyxLocale } from "./klyx-i18n";
import type {
  ProviderActivityFrequency,
  ProviderDeclarationState,
  ProviderLegalEligibility,
  ProviderLegalPath,
  ProviderSelfEmploymentCapacity,
  ProviderStudentContext,
} from "./provider-legal-authority";

export type ProviderLegalOnboardingMessageKey =
  | "eyebrow"
  | "title"
  | "intro"
  | "studentWarning"
  | "pathLabel"
  | "pathHelp"
  | "studentLabel"
  | "studentHelp"
  | "frequencyLabel"
  | "capacityLabel"
  | "enterpriseNumberLabel"
  | "enterpriseNumberPlaceholder"
  | "socialFundLabel"
  | "save"
  | "saving"
  | "saved"
  | "loadError"
  | "saveError"
  | "assessmentTitle"
  | "eligibilityLabel"
  | "missingTitle"
  | "reasonsTitle"
  | "reviewRequired"
  | "reviewNotRequired"
  | "backToOnboarding"
  | "progressTitle"
  | "progressDescription"
  | "progressButton"
  | "progressDone"
  | "progressReview"
  | "progressBlocked";

type SupportedLocale = "fr" | "en" | "nl" | "de";

const MESSAGES: Record<SupportedLocale, Record<ProviderLegalOnboardingMessageKey, string>> = {
  fr: {
    eyebrow: "Parcours légal belge",
    title: "Cadre de ton activité",
    intro:
      "KLYX enregistre ton parcours déclaré et les éléments à vérifier. Ce choix n’est pas une décision juridique automatique sur ton statut.",
    studentWarning:
      "Être étudiant est un contexte, pas un statut juridique suffisant. Un étudiant peut notamment relever d’un contrat étudiant ou d’un statut d’étudiant-indépendant selon sa situation réelle.",
    pathLabel: "Quel parcours correspond le mieux à ton activité actuelle ?",
    pathHelp:
      "Choisis le parcours opérationnel le plus proche. KLYX demandera une revue humaine lorsqu’une qualification dépend des faits réels.",
    studentLabel: "Es-tu actuellement étudiant ?",
    studentHelp: "Cette information reste un contexte et ne détermine jamais seule ton parcours légal.",
    frequencyLabel: "Fréquence prévue de l’activité",
    capacityLabel: "Cadre indépendant déclaré",
    enterpriseNumberLabel: "Numéro d’entreprise",
    enterpriseNumberPlaceholder: "Ex. 0123.456.789",
    socialFundLabel: "Affiliation à une caisse d’assurances sociales",
    save: "Enregistrer mes déclarations",
    saving: "Enregistrement…",
    saved: "Déclarations enregistrées. L’évaluation KLYX a été recalculée.",
    loadError: "Impossible de charger le parcours légal.",
    saveError: "Impossible d’enregistrer les déclarations.",
    assessmentTitle: "Évaluation KLYX",
    eligibilityLabel: "Éligibilité opérationnelle",
    missingTitle: "Données ou vérifications manquantes",
    reasonsTitle: "Pourquoi KLYX affiche ce résultat",
    reviewRequired: "Revue humaine nécessaire",
    reviewNotRequired: "Aucune revue humaine supplémentaire requise actuellement",
    backToOnboarding: "Retour au parcours prestataire",
    progressTitle: "Cadre légal de l’activité",
    progressDescription: "Déclare ton parcours et consulte les vérifications ou la revue humaine encore nécessaires.",
    progressButton: "Vérifier mon parcours",
    progressDone: "Validé",
    progressReview: "Revue requise",
    progressBlocked: "À compléter",
  },
  en: {
    eyebrow: "Belgian legal journey",
    title: "Your activity framework",
    intro:
      "KLYX records your declared path and the items that still need verification. This is not an automatic legal determination of your worker status.",
    studentWarning:
      "Being a student is context, not a sufficient legal status. Depending on the real situation, a student may work under a student employment contract or as a student self-employed person, among other possibilities.",
    pathLabel: "Which path best matches your current activity?",
    pathHelp:
      "Choose the closest operational path. KLYX requires human review whenever classification depends on the real facts.",
    studentLabel: "Are you currently a student?",
    studentHelp: "This information remains context and never determines your legal path on its own.",
    frequencyLabel: "Expected activity frequency",
    capacityLabel: "Declared self-employed capacity",
    enterpriseNumberLabel: "Enterprise number",
    enterpriseNumberPlaceholder: "E.g. 0123.456.789",
    socialFundLabel: "Affiliation with a social insurance fund",
    save: "Save my declarations",
    saving: "Saving…",
    saved: "Declarations saved. The KLYX assessment has been recalculated.",
    loadError: "Unable to load the legal journey.",
    saveError: "Unable to save the declarations.",
    assessmentTitle: "KLYX assessment",
    eligibilityLabel: "Operational eligibility",
    missingTitle: "Missing data or checks",
    reasonsTitle: "Why KLYX shows this result",
    reviewRequired: "Human review required",
    reviewNotRequired: "No additional human review currently required",
    backToOnboarding: "Back to provider journey",
    progressTitle: "Legal activity framework",
    progressDescription: "Declare your path and see which checks or human review are still required.",
    progressButton: "Check my path",
    progressDone: "Approved",
    progressReview: "Review required",
    progressBlocked: "To complete",
  },
  nl: {
    eyebrow: "Belgisch juridisch traject",
    title: "Kader van je activiteit",
    intro:
      "KLYX registreert je aangegeven traject en wat nog gecontroleerd moet worden. Dit is geen automatische juridische beslissing over je arbeidsstatuut.",
    studentWarning:
      "Student zijn is context, geen voldoende juridisch statuut. Naargelang de werkelijke situatie kan een student onder meer werken met een studentenovereenkomst of als student-zelfstandige.",
    pathLabel: "Welk traject past het best bij je huidige activiteit?",
    pathHelp:
      "Kies het dichtstbijzijnde operationele traject. KLYX vraagt menselijke controle wanneer de kwalificatie van de werkelijke feiten afhangt.",
    studentLabel: "Ben je momenteel student?",
    studentHelp: "Deze informatie blijft context en bepaalt nooit op zichzelf je juridisch traject.",
    frequencyLabel: "Verwachte frequentie van de activiteit",
    capacityLabel: "Aangegeven zelfstandige hoedanigheid",
    enterpriseNumberLabel: "Ondernemingsnummer",
    enterpriseNumberPlaceholder: "Bijv. 0123.456.789",
    socialFundLabel: "Aansluiting bij een sociaal verzekeringsfonds",
    save: "Mijn verklaringen opslaan",
    saving: "Opslaan…",
    saved: "Verklaringen opgeslagen. De KLYX-beoordeling is opnieuw berekend.",
    loadError: "Kan het juridische traject niet laden.",
    saveError: "Kan de verklaringen niet opslaan.",
    assessmentTitle: "KLYX-beoordeling",
    eligibilityLabel: "Operationele geschiktheid",
    missingTitle: "Ontbrekende gegevens of controles",
    reasonsTitle: "Waarom KLYX dit resultaat toont",
    reviewRequired: "Menselijke controle vereist",
    reviewNotRequired: "Momenteel geen extra menselijke controle vereist",
    backToOnboarding: "Terug naar het dienstverlenerstraject",
    progressTitle: "Juridisch kader van de activiteit",
    progressDescription: "Geef je traject aan en bekijk welke controles of menselijke beoordeling nog nodig zijn.",
    progressButton: "Mijn traject controleren",
    progressDone: "Goedgekeurd",
    progressReview: "Controle vereist",
    progressBlocked: "Aan te vullen",
  },
  de: {
    eyebrow: "Belgischer Rechtsweg",
    title: "Rahmen deiner Tätigkeit",
    intro:
      "KLYX speichert deinen angegebenen Weg und die noch zu prüfenden Punkte. Dies ist keine automatische rechtliche Einstufung deines Erwerbsstatus.",
    studentWarning:
      "Student zu sein ist ein Kontext, kein ausreichender Rechtsstatus. Je nach tatsächlicher Situation kann ein Student unter anderem mit Studentenvertrag oder als studentischer Selbständiger tätig sein.",
    pathLabel: "Welcher Weg passt am besten zu deiner aktuellen Tätigkeit?",
    pathHelp:
      "Wähle den nächstliegenden operativen Weg. KLYX verlangt eine menschliche Prüfung, wenn die Einstufung von den tatsächlichen Umständen abhängt.",
    studentLabel: "Bist du derzeit Student?",
    studentHelp: "Diese Angabe bleibt Kontext und bestimmt deinen rechtlichen Weg niemals allein.",
    frequencyLabel: "Voraussichtliche Häufigkeit der Tätigkeit",
    capacityLabel: "Angegebene selbständige Eigenschaft",
    enterpriseNumberLabel: "Unternehmensnummer",
    enterpriseNumberPlaceholder: "Z. B. 0123.456.789",
    socialFundLabel: "Anschluss an eine Sozialversicherungskasse",
    save: "Meine Angaben speichern",
    saving: "Speichern…",
    saved: "Angaben gespeichert. Die KLYX-Bewertung wurde neu berechnet.",
    loadError: "Der rechtliche Weg konnte nicht geladen werden.",
    saveError: "Die Angaben konnten nicht gespeichert werden.",
    assessmentTitle: "KLYX-Bewertung",
    eligibilityLabel: "Operative Berechtigung",
    missingTitle: "Fehlende Angaben oder Prüfungen",
    reasonsTitle: "Warum KLYX dieses Ergebnis anzeigt",
    reviewRequired: "Menschliche Prüfung erforderlich",
    reviewNotRequired: "Derzeit keine zusätzliche menschliche Prüfung erforderlich",
    backToOnboarding: "Zurück zum Anbieterweg",
    progressTitle: "Rechtlicher Rahmen der Tätigkeit",
    progressDescription: "Gib deinen Weg an und sieh, welche Prüfungen oder menschliche Kontrolle noch nötig sind.",
    progressButton: "Meinen Weg prüfen",
    progressDone: "Freigegeben",
    progressReview: "Prüfung erforderlich",
    progressBlocked: "Zu ergänzen",
  },
};

function supported(locale: KlyxLocale): SupportedLocale {
  return locale === "en" || locale === "nl" || locale === "de" ? locale : "fr";
}

export function translateProviderLegalOnboarding(
  locale: KlyxLocale,
  key: ProviderLegalOnboardingMessageKey
): string {
  return MESSAGES[supported(locale)][key];
}

const PATHS: Record<SupportedLocale, Record<ProviderLegalPath, string>> = {
  fr: {
    unknown: "Je ne sais pas encore",
    occasional: "Prestation occasionnelle",
    employee_compatible: "Parcours salarié-compatible",
    professional_independent: "Indépendant professionnel",
  },
  en: {
    unknown: "I am not sure yet",
    occasional: "Occasional service",
    employee_compatible: "Employee-compatible path",
    professional_independent: "Professional self-employed",
  },
  nl: {
    unknown: "Ik weet het nog niet",
    occasional: "Occasionele prestatie",
    employee_compatible: "Werknemer-compatibel traject",
    professional_independent: "Professioneel zelfstandige",
  },
  de: {
    unknown: "Ich weiß es noch nicht",
    occasional: "Gelegentliche Leistung",
    employee_compatible: "Arbeitnehmer-kompatibler Weg",
    professional_independent: "Professionell selbständig",
  },
};

const YES_NO_UNKNOWN: Record<SupportedLocale, Record<"unknown" | "no" | "yes", string>> = {
  fr: { unknown: "Je ne sais pas", no: "Non", yes: "Oui" },
  en: { unknown: "Not sure", no: "No", yes: "Yes" },
  nl: { unknown: "Ik weet het niet", no: "Nee", yes: "Ja" },
  de: { unknown: "Unsicher", no: "Nein", yes: "Ja" },
};

const FREQUENCIES: Record<SupportedLocale, Record<ProviderActivityFrequency, string>> = {
  fr: {
    unknown: "Je ne sais pas encore",
    one_off: "Une seule prestation prévue",
    intermittent: "De temps en temps",
    recurring: "Activité récurrente",
  },
  en: {
    unknown: "Not sure yet",
    one_off: "One service planned",
    intermittent: "From time to time",
    recurring: "Recurring activity",
  },
  nl: {
    unknown: "Ik weet het nog niet",
    one_off: "Eén prestatie gepland",
    intermittent: "Af en toe",
    recurring: "Terugkerende activiteit",
  },
  de: {
    unknown: "Noch unsicher",
    one_off: "Eine Leistung geplant",
    intermittent: "Gelegentlich",
    recurring: "Wiederkehrende Tätigkeit",
  },
};

const CAPACITIES: Record<SupportedLocale, Record<ProviderSelfEmploymentCapacity, string>> = {
  fr: {
    unknown: "Je ne sais pas encore",
    main: "Indépendant à titre principal",
    complementary: "Indépendant à titre complémentaire",
    student_independent: "Étudiant-indépendant",
    other: "Autre / à vérifier",
  },
  en: {
    unknown: "Not sure yet",
    main: "Self-employed as main activity",
    complementary: "Self-employed as complementary activity",
    student_independent: "Student self-employed",
    other: "Other / to verify",
  },
  nl: {
    unknown: "Ik weet het nog niet",
    main: "Zelfstandige in hoofdberoep",
    complementary: "Zelfstandige in bijberoep",
    student_independent: "Student-zelfstandige",
    other: "Andere / te controleren",
  },
  de: {
    unknown: "Noch unsicher",
    main: "Selbständig im Hauptberuf",
    complementary: "Selbständig im Nebenberuf",
    student_independent: "Studentisch selbständig",
    other: "Andere / zu prüfen",
  },
};

const ELIGIBILITY: Record<SupportedLocale, Record<ProviderLegalEligibility, string>> = {
  fr: {
    unknown: "Indéterminée",
    conditionally_eligible: "Possible sous conditions",
    eligible: "Éligible après vérifications",
    ineligible: "Non éligible dans l’état actuel",
  },
  en: {
    unknown: "Undetermined",
    conditionally_eligible: "Potentially eligible with conditions",
    eligible: "Eligible after checks",
    ineligible: "Not eligible in the current state",
  },
  nl: {
    unknown: "Onbepaald",
    conditionally_eligible: "Mogelijk geschikt onder voorwaarden",
    eligible: "Geschikt na controles",
    ineligible: "Niet geschikt in de huidige toestand",
  },
  de: {
    unknown: "Unbestimmt",
    conditionally_eligible: "Unter Bedingungen möglicherweise berechtigt",
    eligible: "Nach Prüfungen berechtigt",
    ineligible: "Im aktuellen Zustand nicht berechtigt",
  },
};

export function providerLegalPathLabel(locale: KlyxLocale, value: ProviderLegalPath) {
  return PATHS[supported(locale)][value];
}

export function providerStudentContextLabel(locale: KlyxLocale, value: ProviderStudentContext) {
  return YES_NO_UNKNOWN[supported(locale)][value];
}

export function providerDeclarationStateLabel(locale: KlyxLocale, value: ProviderDeclarationState) {
  return YES_NO_UNKNOWN[supported(locale)][value];
}

export function providerActivityFrequencyLabel(locale: KlyxLocale, value: ProviderActivityFrequency) {
  return FREQUENCIES[supported(locale)][value];
}

export function providerSelfEmploymentCapacityLabel(
  locale: KlyxLocale,
  value: ProviderSelfEmploymentCapacity
) {
  return CAPACITIES[supported(locale)][value];
}

export function providerLegalEligibilityLabel(locale: KlyxLocale, value: ProviderLegalEligibility) {
  return ELIGIBILITY[supported(locale)][value];
}

const MISSING_FR: Record<string, string> = {
  jurisdiction_country_code: "Pays de rattachement",
  declared_path: "Parcours déclaré",
  activity_frequency: "Fréquence de l’activité",
  verified_employment_arrangement: "Vérification du cadre salarié-compatible",
  self_employment_capacity: "Cadre indépendant déclaré",
  enterprise_number: "Numéro d’entreprise",
  social_insurance_fund_affiliation: "Affiliation à une caisse d’assurances sociales",
  verified_enterprise_registration: "Vérification de l’inscription d’entreprise",
  verified_social_insurance_fund: "Vérification de la caisse d’assurances sociales",
};

export function providerLegalMissingDataLabel(locale: KlyxLocale, value: string): string {
  if (supported(locale) !== "fr") return value.replaceAll("_", " ");
  return MISSING_FR[value] ?? value.replaceAll("_", " ");
}

const REASONS_FR: Record<string, string> = {
  LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC:
    "KLYX ne transforme jamais automatiquement une déclaration en qualification juridique définitive.",
  JURISDICTION_MISSING: "Le pays de rattachement manque.",
  BELGIAN_RULESET_NOT_APPLICABLE: "Le référentiel belge ne peut pas être appliqué à ce pays.",
  BELGIAN_RULESET_APPLIED: "Le référentiel belge KLYX est utilisé.",
  PLATFORM_WORK_CLASSIFICATION_REQUIRES_FACTUAL_REVIEW:
    "La qualification du travail via plateforme dépend des faits réels et nécessite une vérification adaptée.",
  PROVIDER_PATH_NOT_DECLARED: "Aucun parcours opérationnel n’a encore été déclaré.",
  STUDENT_IS_CONTEXT_NOT_LEGAL_PATH:
    "Le fait d’être étudiant est traité comme un contexte et non comme un statut juridique autonome.",
  HUMAN_REVIEW_REJECTED: "La dernière revue humaine a rejeté ce parcours.",
  OCCASIONAL_PATH_CONFLICTS_WITH_RECURRING_ACTIVITY:
    "Une activité déclarée récurrente est incohérente avec un parcours occasionnel.",
  OCCASIONAL_PATH_IS_NOT_AUTOMATIC_LEGAL_EXEMPTION:
    "Une prestation occasionnelle ne crée pas automatiquement une exemption juridique.",
  EMPLOYEE_COMPATIBLE_IS_OPERATIONAL_PATH_NOT_EMPLOYEE_STATUS:
    "Le parcours salarié-compatible n’établit pas à lui seul l’existence d’un contrat de travail.",
  EMPLOYMENT_ARRANGEMENT_NOT_VERIFIED:
    "Le cadre salarié-compatible doit encore être vérifié.",
  PROFESSIONAL_INDEPENDENT_PATH_DOES_NOT_OVERRIDE_WORKER_CLASSIFICATION:
    "Le parcours indépendant déclaré ne neutralise pas les règles de qualification de la relation de travail.",
  HUMAN_REVIEW_DOES_NOT_MATCH_CURRENT_PATH:
    "Une ancienne revue ne correspond plus au parcours actuellement déclaré.",
  HUMAN_REVIEW_REQUIRED: "Une revue humaine est encore nécessaire.",
  HUMAN_REVIEW_APPROVED_FOR_CURRENT_PATH:
    "Une revue humaine a approuvé le parcours actuellement déclaré.",
};

export function providerLegalReasonLabel(locale: KlyxLocale, value: string): string {
  if (supported(locale) !== "fr") return value.replaceAll("_", " ").toLowerCase();
  return REASONS_FR[value] ?? value.replaceAll("_", " ").toLowerCase();
}
