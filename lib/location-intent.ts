type KnownLocationRule = {
  location: string;
  aliases: string[];
};

const KNOWN_LOCATION_RULES: KnownLocationRule[] = [
  {
    location: "Bruxelles",
    aliases: ["bruxelles", "brussel", "bxl", "bx", "bruxel"],
  },
  {
    location: "Anderlecht",
    aliases: ["anderlecht"],
  },
  {
    location: "Schaerbeek",
    aliases: ["schaerbeek", "schaarbeek"],
  },
  {
    location: "Ixelles",
    aliases: ["ixelles", "elsene"],
  },
  {
    location: "Uccle",
    aliases: ["uccle", "ukkel"],
  },
  {
    location: "Etterbeek",
    aliases: ["etterbeek"],
  },
  {
    location: "Forest",
    aliases: ["forest", "vorst"],
  },
  {
    location: "Saint-Gilles",
    aliases: ["saint gilles", "sint gillis"],
  },
  {
    location: "Jette",
    aliases: ["jette"],
  },
  {
    location: "Evere",
    aliases: ["evere"],
  },
  {
    location: "Woluwe-Saint-Pierre",
    aliases: ["woluwe saint pierre", "sint pieters woluwe"],
  },
  {
    location: "Woluwe-Saint-Lambert",
    aliases: ["woluwe saint lambert", "sint lambrechts woluwe"],
  },
  {
    location: "Molenbeek-Saint-Jean",
    aliases: [
      "molenbeek",
      "molenbeek saint jean",
      "sint jans molenbeek",
    ],
  },
  {
    location: "Louvain",
    aliases: ["louvain", "leuven"],
  },
  {
    location: "Anvers",
    aliases: ["anvers", "antwerpen"],
  },
  {
    location: "Gand",
    aliases: ["gand", "gent"],
  },
  {
    location: "Liège",
    aliases: ["liege"],
  },
  {
    location: "Namur",
    aliases: ["namur"],
  },
  {
    location: "Charleroi",
    aliases: ["charleroi"],
  },
  {
    location: "Mons",
    aliases: ["mons", "bergen"],
  },
];

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
  "garder",
  "payer",
  "reserver",
  "domicile",
  "maison",
  "appartement",
  "bureau",
  "matin",
  "midi",
  "soir",
  "soiree",
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

function normalizedPhrase(value: string): string {
  return normalizeLocationText(value)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholePhrase(
  text: string,
  phrase: string
): boolean {
  const haystack = ` ${normalizedPhrase(text)} `;
  const needle = normalizedPhrase(phrase);

  return Boolean(
    needle && haystack.includes(` ${needle} `)
  );
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
            ? part[0].toLocaleUpperCase("fr") +
              part.slice(1).toLocaleLowerCase("fr")
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
      ["a", "vers", "pour", "pendant"].includes(
        normalizedWord
      )
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
  for (const rule of KNOWN_LOCATION_RULES) {
    if (
      rule.aliases.some((alias) =>
        containsWholePhrase(text, alias)
      )
    ) {
      return rule.location;
    }
  }

  const explicitPatterns = [
    /\b(?:ville|commune)\s+de\s+([^,;.!?]+)/iu,
    /\b(?:près|pres|proche)\s+de\s+([^,;.!?]+)/iu,
    /(?:^|[\s,(])(?:à|a)\s+c[oô]té\s+de\s+([^,;.!?]+)/iu,
    /(?:^|[\s,(])(?:à|a)\s+([^,;.!?]+)/iu,
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
