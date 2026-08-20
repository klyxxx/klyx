import { detectLocation } from "@/lib/location-intent";

export type ServiceCandidate = {
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

export type UniversalRequestResult = {
  serviceSlug: string | null;
  serviceLabel: string | null;
  serviceCandidates: ServiceCandidate[];
  city: string | null;
  requestedDay: string | null;
  requestedTime: string | null;
  durationHours: number | null;
  budgetMax: number | null;
  peopleCount: number | null;
  urgency: "normal" | "today" | "urgent";
  memoryUsed: boolean;
  memoryMessage: string | null;
  missingFields: string[];
  readyForSearch: boolean;
};

type ServiceRule = {
  slug: string;
  label: string;
  words: string[];
  contexts: string[];
};

const SERVICE_RULES: ServiceRule[] = [
  {
    slug: "babysitting",
    label: "Baby-sitting",
    words: [
      "baby sitter",
      "babysitter",
      "garde enfant",
      "garder enfant",
      "garder enfants",
      "nounou",
    ],
    contexts: [
      "enfant",
      "enfants",
      "ecole",
      "crèche",
      "soiree",
    ],
  },
  {
    slug: "cleaning",
    label: "Ménage",
    words: [
      "menage",
      "nettoyage",
      "nettoyer",
      "propre",
      "ranger",
    ],
    contexts: [
      "appartement",
      "maison",
      "bureau",
      "vitres",
      "cuisine",
    ],
  },
  {
    slug: "moving",
    label: "Déménagement",
    words: [
      "demenagement",
      "demenager",
      "demenageur",
      "transport meubles",
      "porter meubles",
    ],
    contexts: [
      "cartons",
      "meubles",
      "camion",
      "adresse",
      "etage",
    ],
  },
  {
    slug: "handyman",
    label: "Bricolage",
    words: [
      "bricolage",
      "bricoleur",
      "reparation",
      "reparer",
      "installer",
      "monter",
      "fixer",
    ],
    contexts: [
      "meuble",
      "mur",
      "robinet",
      "porte",
      "etagere",
      "lampe",
    ],
  },
];

const WEEKDAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9€]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function nextWeekday(
  current: Date,
  targetDay: number
): Date {
  const result = new Date(current);
  let difference =
    (targetDay - result.getDay() + 7) % 7;

  if (difference === 0) difference = 7;

  result.setDate(result.getDate() + difference);
  return result;
}

export function detectServiceCandidates(
  text: string
): ServiceCandidate[] {
  const normalized = normalize(text);

  return SERVICE_RULES.map((rule) => {
    const directMatches = rule.words.filter((word) =>
      normalized.includes(normalize(word))
    ).length;
    const contextMatches = rule.contexts.filter((word) =>
      normalized.includes(normalize(word))
    ).length;

    const confidence = Math.min(
      100,
      directMatches * 65 + contextMatches * 18
    );

    return {
      slug: rule.slug,
      label: rule.label,
      confidence,
      reason:
        directMatches > 0
          ? "Le besoin correspond directement à ce service."
          : "Le contexte semble correspondre à ce service.",
    };
  })
    .filter((candidate) => candidate.confidence > 0)
    .sort(
      (first, second) =>
        second.confidence - first.confidence
    )
    .slice(0, 3);
}

export function detectCity(text: string): string | null {
  return detectLocation(text);
}

export function detectRequestedDay(
  text: string,
  now = new Date()
): string | null {
  const normalized = normalize(text);

  if (normalized.includes("aujourd hui")) {
    return isoDateLocal(now);
  }

  if (normalized.includes("apres demain")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 2);
    return isoDateLocal(date);
  }

  if (normalized.includes("demain")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return isoDateLocal(date);
  }

  for (
    let dayIndex = 0;
    dayIndex < WEEKDAYS.length;
    dayIndex += 1
  ) {
    if (
      normalized.includes(normalize(WEEKDAYS[dayIndex]))
    ) {
      return isoDateLocal(nextWeekday(now, dayIndex));
    }
  }

  const numericDate = text.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/
  );

  if (!numericDate) return null;

  let year = numericDate[3]
    ? Number(numericDate[3])
    : now.getFullYear();

  if (year < 100) year += 2000;

  const date = new Date(
    year,
    Number(numericDate[2]) - 1,
    Number(numericDate[1])
  );

  if (Number.isNaN(date.getTime())) return null;

  return isoDateLocal(date);
}

export function detectRequestedTime(
  text: string
): string | null {
  const normalized = normalize(text);

  if (normalized.includes("matin")) return "09:00:00";
  if (normalized.includes("midi")) return "12:00:00";
  if (normalized.includes("apres midi")) {
    return "14:00:00";
  }
  if (
    normalized.includes("soir") ||
    normalized.includes("soiree")
  ) {
    return "18:00:00";
  }

  const explicitTime = text.match(
    /\b(?:vers\s*)?(\d{1,2})(?:[:h](\d{1,2}))?\s*(?:heures?|h)?\b/i
  );

  if (!explicitTime) return null;

  const hours = Number(explicitTime[1]);
  const minutes = Number(explicitTime[2] ?? 0);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:00`;
}

export function detectDurationHours(
  text: string
): number | null {
  const match = normalize(text).match(
    /(?:pendant|pour|environ)?\s*(\d+(?:[.,]\d+)?)\s*(?:h|heure|heures)\b/
  );

  if (!match) return null;

  const value = Number(match[1].replace(",", "."));

  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 24
  ) {
    return null;
  }

  return value;
}

export function detectBudget(
  text: string
): number | null {
  const match = text.match(
    /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i
  );

  if (!match) return null;

  const value = Number(match[1].replace(",", "."));

  return Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function detectChildren(
  text: string
): number | null {
  const numeric = normalize(text).match(
    /\b(\d+)\s*enfants?\b/
  );

  if (numeric) return Number(numeric[1]);

  const words: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
  };

  const normalized = normalize(text);

  for (const [word, value] of Object.entries(words)) {
    if (normalized.includes(`${word} enfant`)) {
      return value;
    }
  }

  return null;
}

export function wantsMemory(text: string): boolean {
  const normalized = normalize(text);

  return [
    "comme d habitude",
    "pareil que la derniere fois",
    "la meme chose",
    "comme avant",
  ].some((phrase) =>
    normalized.includes(normalize(phrase))
  );
}

export function urgencyFromText(
  text: string
): UniversalRequestResult["urgency"] {
  const normalized = normalize(text);

  if (
    normalized.includes("urgent") ||
    normalized.includes("urgence") ||
    normalized.includes("tout de suite")
  ) {
    return "urgent";
  }

  if (
    normalized.includes("aujourd hui") ||
    normalized.includes("ce soir")
  ) {
    return "today";
  }

  return "normal";
}

export function missingFieldsForRequest(
  request: Pick<
    UniversalRequestResult,
    | "serviceSlug"
    | "city"
    | "requestedDay"
    | "requestedTime"
  >
): string[] {
  const missing: string[] = [];

  if (!request.serviceSlug) {
    missing.push("le type de service");
  }

  if (!request.city) {
    missing.push("la ville");
  }

  if (!request.requestedDay) {
    missing.push("la date");
  }

  if (!request.requestedTime) {
    missing.push("l’heure ou le moment de la journée");
  }

  return missing;
}
