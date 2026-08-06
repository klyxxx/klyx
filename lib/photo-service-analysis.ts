export type PhotoServiceCandidate = {
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

export type PhotoServiceAnalysis = {
  serviceSlug: string | null;
  serviceLabel: string | null;
  candidates: PhotoServiceCandidate[];
  summary: string;
  limitations: string;
};

const RULES = [
  {
    slug: "handyman",
    label: "Bricolage",
    words: [
      "cassé",
      "casse",
      "réparer",
      "reparer",
      "fuite",
      "robinet",
      "mur",
      "porte",
      "meuble",
      "armoire",
      "étagère",
      "etagere",
      "lampe",
      "prise",
      "installer",
      "montage",
    ],
  },
  {
    slug: "cleaning",
    label: "Ménage",
    words: [
      "sale",
      "tache",
      "nettoyer",
      "nettoyage",
      "ménage",
      "menage",
      "poussière",
      "poussiere",
      "vitre",
      "cuisine",
      "sol",
    ],
  },
  {
    slug: "moving",
    label: "Déménagement",
    words: [
      "déménagement",
      "demenagement",
      "carton",
      "cartons",
      "meuble",
      "meubles",
      "camion",
      "porter",
      "transport",
      "déplacer",
      "deplacer",
    ],
  },
  {
    slug: "babysitting",
    label: "Baby-sitting",
    words: [
      "enfant",
      "enfants",
      "bébé",
      "bebe",
      "garde",
      "nounou",
      "baby sitter",
      "babysitter",
    ],
  },
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzePhotoDescription(
  description: string
): PhotoServiceAnalysis {
  const normalized = normalize(description);

  const candidates = RULES.map((rule) => {
    const matches = rule.words.filter((word) =>
      normalized.includes(normalize(word))
    );

    return {
      slug: rule.slug,
      label: rule.label,
      confidence: Math.min(95, matches.length * 35),
      reason:
        matches.length > 0
          ? `Indices décrits : ${matches.slice(0, 3).join(", ")}.`
          : "Aucun indice direct dans la description.",
    };
  })
    .filter((candidate) => candidate.confidence > 0)
    .sort(
      (first, second) =>
        second.confidence - first.confidence
    )
    .slice(0, 3);

  const best =
    candidates[0]?.confidence >= 35
      ? candidates[0]
      : null;

  return {
    serviceSlug: best?.slug ?? null,
    serviceLabel: best?.label ?? null,
    candidates,
    summary: best
      ? `La description semble correspondre à un service de ${best.label.toLowerCase()}.`
      : "KLYX a besoin d’une description plus précise pour proposer un service.",
    limitations:
      "Cette version analyse la description écrite, pas le contenu visuel réel de la photo.",
  };
}
