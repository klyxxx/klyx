const KNOWN_LOCATIONS = [
  "Bruxelles",
  "Anderlecht",
  "Schaerbeek",
  "Ixelles",
  "Uccle",
  "Etterbeek",
  "Forest",
  "Saint-Gilles",
  "Jette",
  "Evere",
  "Woluwe-Saint-Pierre",
  "Woluwe-Saint-Lambert",
  "Molenbeek-Saint-Jean",
  "Louvain",
  "Anvers",
  "Gand",
  "Liège",
  "Namur",
  "Charleroi",
  "Mons",
] as const;

const LOCATION_STOP_WORDS = new Set([
  "aujourd hui",
  "aujourdhui",
  "demain",
  "apres demain",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
  "matin",
  "midi",
  "apres midi",
  "soir",
  "soiree",
  "pour",
  "pendant",
  "budget",
  "maximum",
  "max",
  "urgent",
  "urgence",
]);

const NON_LOCATION_STARTS = new Set([
  "besoin",
  "faire",
  "nettoyer",
  "reparer",
  "réparer",
  "garder",
  "payer",
  "reserver",
  "réserver",
  "domicile",
  "maison",
  "appartement",
  "bureau",
  "matin",
  "midi",
  "soir",
  "soiree",
  "soirée",
  "un",
  "une",
]);

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseLocation(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            ? part[0].toLocaleUpperCase("fr") + part.slice(1).toLocaleLowerCase("fr")
            : part
        )
        .join("-")
    )
    .join(" ");
}

function cleanCandidate(raw: string): string | null {
  const sourceWords = raw
    .replace(/^[\s,:;-]+|[\s,:;.!?]+$/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];

  for (const sourceWord of sourceWords) {
    if (kept.length >= 4) break;

    const normalizedWord = normalizeLocationText(sourceWord);
    if (!normalizedWord) continue;

    if (/^\d/.test(normalizedWord)) {
      break;
    }

    const currentPhrase = normalizeLocationText(
      [...kept, sourceWord].join(" ")
    );

    if (
      LOCATION_STOP_WORDS.has(normalizedWord) ||
      LOCATION_STOP_WORDS.has(currentPhrase)
    ) {
      break;
    }

    if (
      kept.length === 0 &&
      NON_LOCATION_STARTS.has(normalizedWord)
    ) {
      return null;
    }

    if (
      kept.length > 0 &&
      ["a", "à", "vers", "pour", "pendant"].includes(normalizedWord)
    ) {
      break;
    }

    kept.push(sourceWord.replace(/[,:;.!?]+$/g, ""));
  }

  if (kept.length === 0) return null;

  const candidate = kept.join(" ").trim();
  const normalized = normalizeLocationText(candidate);

  if (
    normalized.length < 2 ||
    /^\d/.test(normalized) ||
    NON_LOCATION_STARTS.has(normalized)
  ) {
    return null;
  }

  return titleCaseLocation(candidate);
}

export function detectLocation(text: string): string | null {
  const normalizedText = normalizeLocationText(text);

  for (const location of KNOWN_LOCATIONS) {
    if (normalizedText.includes(normalizeLocationText(location))) {
      return location;
    }
  }

  const explicitPatterns = [
    /\b(?:ville|commune)\s+de\s+([^,;.!?]+)/iu,
    /\b(?:près|pres|proche)\s+de\s+([^,;.!?]+)/iu,
    /\b(?:à|a)\s+([^,;.!?]+)/iu,
    /\b(?:sur|vers)\s+([^,;.!?]+)/iu,
  ];

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]
      ? cleanCandidate(match[1])
      : null;

    if (candidate) return candidate;
  }

  return null;
}
