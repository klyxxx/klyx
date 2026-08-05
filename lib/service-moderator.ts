export type ModerationDecision = "approved" | "rejected" | "pending";

export type ServiceModerationResult = {
  decision: ModerationDecision;
  reason: string;
  confidence: number;
};

type ModerationInput = {
  proposedName: string;
  category: string;
  description: string;
  experienceDetails: string;
};

const BLOCKED_TERMS = [
  "arme",
  "armes",
  "munitions",
  "explosif",
  "explosifs",
  "drogue",
  "drogues",
  "cannabis",
  "cocaine",
  "héroïne",
  "piratage",
  "hacker",
  "espionnage",
  "surveillance secrète",
  "faux document",
  "fausse identité",
  "prostitution",
  "escort",
  "tueur",
  "assassinat",
  "poison",
  "blanchiment",
  "contrefaçon",
];

const REGULATED_TERMS = [
  "médecin",
  "docteur",
  "infirmier",
  "infirmière",
  "dentiste",
  "psychologue",
  "psychothérapeute",
  "pharmacien",
  "avocat",
  "notaire",
  "expert-comptable",
  "architecte",
  "électricien certifié",
  "chauffagiste",
  "agent de sécurité",
  "taxi",
  "transport de personnes",
  "soins médicaux",
  "injection",
  "médicament",
  "diagnostic",
  "conseil juridique",
  "placement financier",
  "investissement",
  "crédit",
  "assurance",
];

const SAFE_PROFESSIONS = [
  "photographe",
  "vidéaste",
  "graphiste",
  "designer",
  "développeur",
  "développeur web",
  "créateur de site",
  "monteur vidéo",
  "community manager",
  "rédacteur",
  "traducteur",
  "professeur particulier",
  "soutien scolaire",
  "coach scolaire",
  "jardinier",
  "tonte de pelouse",
  "nettoyeur",
  "aide ménagère",
  "homme à tout faire",
  "bricoleur",
  "peintre",
  "monteur de meubles",
  "déménageur",
  "baby-sitter",
  "garde d'enfants",
  "promeneur de chiens",
  "pet-sitter",
  "garde d'animaux",
  "cuisinier à domicile",
  "serveur événementiel",
  "décorateur événementiel",
  "coiffeur",
  "maquilleur",
  "esthéticien",
  "couturier",
  "retoucheur",
  "laveur de vitres",
  "nettoyage automobile",
  "assistant administratif",
  "secrétaire indépendant",
];

const SAFE_CATEGORIES = new Set([
  "Maison et entretien",
  "Famille et garde",
  "Transport et déménagement",
  "Beauté et bien-être",
  "Cours et accompagnement",
  "Événementiel",
  "Animaux",
  "Numérique et création",
  "Réparation et technique",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]): string | null {
  const normalizedText = normalize(text);

  for (const term of terms) {
    const normalizedTerm = normalize(term);

    if (normalizedText.includes(normalizedTerm)) {
      return term;
    }
  }

  return null;
}

export function moderateServiceProposal(
  input: ModerationInput
): ServiceModerationResult {
  const completeText = [
    input.proposedName,
    input.category,
    input.description,
    input.experienceDetails,
  ].join(" ");

  const blockedMatch = includesAny(completeText, BLOCKED_TERMS);

  if (blockedMatch) {
    return {
      decision: "rejected",
      reason:
        "Cette activité ne peut pas être proposée sur KLYX pour des raisons de sécurité ou de conformité.",
      confidence: 1,
    };
  }

  const regulatedMatch = includesAny(completeText, REGULATED_TERMS);

  if (regulatedMatch) {
    return {
      decision: "pending",
      reason:
        "Cette activité peut être réglementée. Elle reste masquée tant que les vérifications nécessaires ne sont pas automatisées.",
      confidence: 0.95,
    };
  }

  const professionMatch = includesAny(
    input.proposedName,
    SAFE_PROFESSIONS
  );

  const descriptionLooksComplete =
    input.description.trim().length >= 60 &&
    input.description.trim().split(/\s+/).length >= 10;

  if (
    professionMatch &&
    SAFE_CATEGORIES.has(input.category) &&
    descriptionLooksComplete
  ) {
    return {
      decision: "approved",
      reason:
        "Métier courant, catégorie autorisée et description suffisamment précise.",
      confidence: 0.92,
    };
  }

  return {
    decision: "pending",
    reason:
      "Le modérateur automatique n’est pas assez certain. Le métier reste invisible et ne rejoint pas le catalogue.",
    confidence: 0.45,
  };
}

export function createServiceSlug(value: string): string {
  return normalize(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
