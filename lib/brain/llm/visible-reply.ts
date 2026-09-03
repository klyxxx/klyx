export type KlyxVisibleReplyMode = "openai" | "fallback";

export type KlyxVisibleReplySelection = {
  text: string;
  lead: string | null;
  usedLlm: boolean;
  deterministicCorePreserved: true;
  automaticExecutionAllowed: false;
};

const MAX_VISIBLE_LEAD_CHARACTERS = 180;

const SAFE_GENERIC_WORDS = new Set([
  "again",
  "already",
  "avancer",
  "avec",
  "besoin",
  "bien",
  "begrepen",
  "clarifier",
  "clarify",
  "compris",
  "continue",
  "continuer",
  "daccord",
  "demande",
  "ensemble",
  "etape",
  "further",
  "goed",
  "here",
  "hier",
  "information",
  "informations",
  "lets",
  "maintenant",
  "next",
  "nodig",
  "nous",
  "okay",
  "parfait",
  "peut",
  "peux",
  "preciser",
  "prochaine",
  "request",
  "reste",
  "samen",
  "simple",
  "simplement",
  "staan",
  "stap",
  "suite",
  "thanks",
  "utile",
  "verder",
  "verduidelijken",
  "volgende",
  "voici",
  "where",
]);

const FORBIDDEN_VISIBLE_MARKERS = [
  "accept",
  "booking",
  "charge",
  "confirm",
  "disponib",
  "factur",
  "mission",
  "paiement",
  "payer",
  "payment",
  "prestataire",
  "provider",
  "publi",
  "refund",
  "rembours",
  "reserv",
  "select",
];

function normalizeForVisibleReply(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(value: string): string[] {
  return normalizeForVisibleReply(value)
    .split(" ")
    .filter((word) => word.length >= 4);
}

function hasUnsupportedContentWords(
  candidate: string,
  groundingText: string,
): boolean {
  const groundedWords = new Set(contentWords(groundingText));

  return contentWords(candidate).some(
    (word) =>
      !groundedWords.has(word) &&
      !SAFE_GENERIC_WORDS.has(word),
  );
}

export function isSafeKlyxVisibleLead(params: {
  candidate: string;
  groundingText: string;
}): boolean {
  const candidate = params.candidate.trim();

  if (
    !candidate ||
    candidate.length > MAX_VISIBLE_LEAD_CHARACTERS
  ) {
    return false;
  }

  if (/[0-9€$£¥]/u.test(candidate)) {
    return false;
  }

  if (/https?:\/\/|www\.|@/iu.test(candidate)) {
    return false;
  }

  const normalized = normalizeForVisibleReply(candidate);

  if (
    FORBIDDEN_VISIBLE_MARKERS.some((marker) =>
      normalized.includes(marker),
    )
  ) {
    return false;
  }

  if (
    normalized.includes("c est fait") ||
    normalized.includes("je m en occupe") ||
    normalized.includes("j ai trouve") ||
    normalized.includes("tout est pret")
  ) {
    return false;
  }

  if (
    hasUnsupportedContentWords(
      candidate,
      params.groundingText,
    )
  ) {
    return false;
  }

  return true;
}

export function buildKlyxVisibleReplyPrompt(params: {
  userMessage: string;
  deterministicReply: string;
}): string {
  return [
    "Ajoute uniquement une courte phrase naturelle d’accompagnement avant la réponse KLYX vérifiée.",
    "Maximum 140 caractères et une seule idée.",
    "N’ajoute aucun fait, nombre, prix, lieu, date, heure, service, prestataire, disponibilité ou résultat système.",
    "N’annonce jamais qu’une publication, sélection, réservation, mission, confirmation ou opération de paiement a été exécutée.",
    "Utilise seulement des faits déjà présents ci-dessous. Si aucun ajout utile n’est possible, réponds simplement par une phrase neutre de transition.",
    "",
    `Message utilisateur : ${params.userMessage}`,
    "",
    `Réponse KLYX vérifiée : ${params.deterministicReply}`,
  ].join("\n");
}

export function selectKlyxVisibleReply(params: {
  deterministicReply: string;
  candidateText: string;
  candidateMode: KlyxVisibleReplyMode;
  groundingText: string;
}): KlyxVisibleReplySelection {
  const deterministicReply = params.deterministicReply.trim();
  const candidate = params.candidateText.trim();
  const accepted =
    params.candidateMode === "openai" &&
    isSafeKlyxVisibleLead({
      candidate,
      groundingText: params.groundingText,
    });

  if (!accepted) {
    return {
      text: deterministicReply,
      lead: null,
      usedLlm: false,
      deterministicCorePreserved: true,
      automaticExecutionAllowed: false,
    };
  }

  return {
    text: `${candidate}\n\n${deterministicReply}`,
    lead: candidate,
    usedLlm: true,
    deterministicCorePreserved: true,
    automaticExecutionAllowed: false,
  };
}
