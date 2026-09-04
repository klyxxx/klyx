import {
  BELGIAN_LOCALITIES,
  normalizeLocality,
} from "./belgian-localities";

export type KlyxVisibleAiSafetyReason =
  | "money"
  | "date"
  | "time"
  | "number"
  | "location"
  | "transaction-state"
  | "readiness"
  | "locked-fact";

export type KlyxVisibleAiSafetyAssessment = {
  safe: boolean;
  reason: KlyxVisibleAiSafetyReason | null;
};

type SafetyInput = {
  candidate: string;
  deterministicReply: string;
  lockedFacts?: Record<string, unknown> | null;
};

type TransactionPattern = {
  signature: string;
  pattern: RegExp;
};

const MONTHS: Record<string, number> = {
  janvier: 1,
  january: 1,
  fevrier: 2,
  february: 2,
  mars: 3,
  march: 3,
  avril: 4,
  april: 4,
  mai: 5,
  may: 5,
  juin: 6,
  june: 6,
  juillet: 7,
  july: 7,
  aout: 8,
  august: 8,
  septembre: 9,
  september: 9,
  octobre: 10,
  october: 10,
  novembre: 11,
  november: 11,
  decembre: 12,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");
const SENSITIVE_FACT_KEY =
  /(city|ville|location|lieu|place|address|adresse|country|pays|status|statut|state|provider|prestataire|service)/i;
const LOCATION_FACT_KEY =
  /(city|ville|location|lieu|place|address|adresse|country|pays)/i;

const TRANSACTION_PATTERNS: readonly TransactionPattern[] = [
  {
    signature: "booking:confirmed",
    pattern:
      /\b(?:reservation|booking|rendez-vous|appointment)\b[\s\S]{0,45}\b(?:confirmee?|confirmed|reservee?|booked|validee?|validated)\b/g,
  },
  {
    signature: "booking:created",
    pattern:
      /\b(?:reservation|booking|rendez-vous|appointment)\b[\s\S]{0,45}\b(?:creee?|created|enregistree?|registered)\b/g,
  },
  {
    signature: "booking:cancelled",
    pattern:
      /\b(?:reservation|booking|rendez-vous|appointment)\b[\s\S]{0,45}\b(?:annulee?|cancelled|canceled)\b/g,
  },
  {
    signature: "payment:succeeded",
    pattern:
      /\b(?:paiement|payment|reglement)\b[\s\S]{0,45}\b(?:effectue|completed|recu|received|confirme|confirmed|valide|validated|paye|paid|encaisse|succeeded|successful)\b/g,
  },
  {
    signature: "payment:failed",
    pattern:
      /\b(?:paiement|payment|reglement)\b[\s\S]{0,45}\b(?:echoue|echec|failed|decline|declined|refuse|rejected)\b/g,
  },
  {
    signature: "payment:pending",
    pattern:
      /\b(?:paiement|payment|reglement)\b[\s\S]{0,45}\b(?:en attente|pending|processing|traitement)\b/g,
  },
  {
    signature: "payment:refunded",
    pattern:
      /\b(?:remboursement|refund|paiement|payment)\b[\s\S]{0,45}\b(?:rembourse|refunded)\b/g,
  },
  {
    signature: "provider:selected",
    pattern:
      /\b(?:prestataire|provider|professionnel|professional)\b[\s\S]{0,45}\b(?:selectionne|selected|attribue|assigned|choisi|chosen)\b/g,
  },
  {
    signature: "request:published",
    pattern:
      /\b(?:demande|request|mission)\b[\s\S]{0,45}\b(?:publiee?|published|envoyee?|sent|transmise?|submitted)\b/g,
  },
  {
    signature: "mission:accepted",
    pattern:
      /\b(?:mission|job)\b[\s\S]{0,45}\b(?:acceptee?|accepted)\b/g,
  },
  {
    signature: "mission:completed",
    pattern:
      /\b(?:mission|job|service)\b[\s\S]{0,45}\b(?:terminee?|completed|finalisee?|finished|realisee?)\b/g,
  },
  {
    signature: "mission:cancelled",
    pattern:
      /\b(?:mission|job)\b[\s\S]{0,45}\b(?:annulee?|cancelled|canceled)\b/g,
  },
  {
    signature: "availability:available",
    pattern:
      /\b(?:prestataire|provider|professionnel|professional|service|disponibilite|availability)\b[\s\S]{0,45}\b(?:disponible|available|confirmee?|confirmed)\b/g,
  },
  {
    signature: "availability:unavailable",
    pattern:
      /\b(?:prestataire|provider|professionnel|professional|service|disponibilite|availability)\b[\s\S]{0,45}\b(?:indisponible|unavailable)\b/g,
  },
  {
    signature: "execution:claimed",
    pattern:
      /\b(?:j[' ]?ai|nous avons|klyx a|i have|we have|klyx has)\b[\s\S]{0,32}\b(?:reserve|booked|paye|paid|selectionne|selected|choisi|chosen|confirme|confirmed|annule|cancelled|canceled|rembourse|refunded)\b/g,
  },
] as const;

const READY_CLAIM =
  /\b(?:tout est pret|la demande est prete|votre demande est prete|le dossier est pret|pret a confirmer|prete a confirmer|everything is ready|the request is ready|ready to confirm)\b/;
const MISSING_CLAIM =
  /\b(?:il (?:vous )?manque|informations? manquantes?|elements? manquants?|missing information|information is missing|still need(?:s)? information|still missing)\b/;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function collectFactValues(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(collectFactValues);
  if (typeof value === "object") {
    return Object.values(value).flatMap(collectFactValues);
  }
  return [];
}

function canonicalNumber(value: string): string | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function stripStructuredNumberExpressions(value: string): string {
  const normalized = normalizeText(value).replace(/\b([ap])\.m\.(?=\s|$)/g, "$1m");
  const patterns = [
    /(?:€|eur(?:os?)?|\$|usd|dollars?|£|gbp|pounds?|chf)\s*\d{1,9}(?:[.,]\d{1,2})?/giu,
    /\b\d{1,9}(?:[.,]\d{1,2})?\s*(?:€|eur(?:os?)?|\$|usd|dollars?|£|gbp|pounds?|chf)(?=\s|[.,;:!?)]|$)/giu,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
    new RegExp(
      `\\b\\d{1,2}(?:er|st|nd|rd|th)?\\s+(?:${MONTH_PATTERN})(?:\\s+\\d{4})?\\b`,
      "g"
    ),
    new RegExp(
      `\\b(?:${MONTH_PATTERN})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`,
      "g"
    ),
    /\b(?:0?[1-9]|1[0-2])(?::[0-5]\d)?\s*(?:am|pm)\b/g,
    /\b(?:[01]?\d|2[0-3])\s*(?:h|:|heures?|hours?)\s*(?:[0-5]\d)?\b/g,
  ];

  return patterns.reduce(
    (text, pattern) => text.replace(pattern, " "),
    normalized
  );
}

function extractNumbers(value: string): Set<string> {
  const numbers = new Set<string>();
  const unstructured = stripStructuredNumberExpressions(value);

  for (const match of unstructured.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) {
    const token = canonicalNumber(match[0]);
    if (token) numbers.add(token);
  }

  return numbers;
}

function currencyCode(value: string): string | null {
  const normalized = normalizeText(value);

  if (value === "€" || /^eur(?:os?)?$/.test(normalized)) return "EUR";
  if (value === "$" || /^(?:usd|dollars?)$/.test(normalized)) return "USD";
  if (value === "£" || /^(?:gbp|pounds?)$/.test(normalized)) return "GBP";
  if (normalized === "chf") return "CHF";

  return null;
}

function extractCurrencyAmounts(value: string): Set<string> {
  const amounts = new Set<string>();
  const amount = "(\\d{1,9}(?:[.,]\\d{1,2})?)";
  const currency = "(€|eur(?:os?)?|\\$|usd|dollars?|£|gbp|pounds?|chf)";
  const suffix = new RegExp(
    `\\b${amount}\\s*${currency}(?=\\s|[.,;:!?)]|$)`,
    "giu"
  );
  const prefix = new RegExp(`${currency}\\s*${amount}`, "giu");

  for (const match of value.matchAll(suffix)) {
    const number = canonicalNumber(match[1] ?? "");
    const code = currencyCode(match[2] ?? "");
    if (number && code) amounts.add(`${code}:${number}`);
  }

  for (const match of value.matchAll(prefix)) {
    const code = currencyCode(match[1] ?? "");
    const number = canonicalNumber(match[2] ?? "");
    if (number && code) amounts.add(`${code}:${number}`);
  }

  return amounts;
}

function validDateParts(day: number, month: number, year?: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year == null) return true;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dateToken(day: number, month: number, year?: number): string | null {
  if (!validDateParts(day, month, year)) return null;

  const dayPart = String(day).padStart(2, "0");
  const monthPart = String(month).padStart(2, "0");

  return year == null
    ? `--${monthPart}-${dayPart}`
    : `${String(year).padStart(4, "0")}-${monthPart}-${dayPart}`;
}

function extractDates(value: string, derivePartialFromFull: boolean): Set<string> {
  const tokens = new Set<string>();
  const normalized = normalizeText(value);

  const add = (day: number, month: number, year?: number) => {
    const token = dateToken(day, month, year);
    if (!token) return;
    tokens.add(token);

    if (year != null && derivePartialFromFull) {
      const partial = dateToken(day, month);
      if (partial) tokens.add(partial);
    }
  };

  for (const match of normalized.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    add(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  for (const match of normalized.matchAll(
    /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g
  )) {
    const rawYear = match[3];
    const year = rawYear
      ? rawYear.length === 2
        ? 2000 + Number(rawYear)
        : Number(rawYear)
      : undefined;
    add(Number(match[1]), Number(match[2]), year);
  }

  for (const match of normalized.matchAll(/\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/g)) {
    const rawYear = match[3];
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    add(Number(match[1]), Number(match[2]), year);
  }

  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`,
    "g"
  );
  for (const match of normalized.matchAll(dayFirst)) {
    add(
      Number(match[1]),
      MONTHS[match[2] ?? ""] ?? 0,
      match[3] ? Number(match[3]) : undefined
    );
  }

  const monthFirst = new RegExp(
    `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,
    "g"
  );
  for (const match of normalized.matchAll(monthFirst)) {
    add(
      Number(match[2]),
      MONTHS[match[1] ?? ""] ?? 0,
      match[3] ? Number(match[3]) : undefined
    );
  }

  return tokens;
}

function extractClockTimes(value: string): Set<string> {
  const times = new Set<string>();
  const normalized = normalizeText(value).replace(/\b([ap])\.m\.(?=\s|$)/g, "$1m");
  const twelveHourSpans: Array<[number, number]> = [];
  const twelveHour = /\b(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)\b/g;

  for (const match of normalized.matchAll(twelveHour)) {
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    const period = match[3];

    if (period === "am" && hour === 12) hour = 0;
    if (period === "pm" && hour !== 12) hour += 12;

    times.add(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    const start = match.index ?? 0;
    twelveHourSpans.push([start, start + match[0].length]);
  }

  const twentyFourHour =
    /\b([01]?\d|2[0-3])\s*(?:h|:|heures?|hours?)\s*([0-5]\d)?\b/g;

  for (const match of normalized.matchAll(twentyFourHour)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (twelveHourSpans.some(([spanStart, spanEnd]) => start >= spanStart && end <= spanEnd)) {
      continue;
    }

    const suffix = normalized.slice(end);
    if (/^\s*(?:am|pm)\b/.test(suffix)) continue;

    const hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    times.add(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return times;
}

function extractKnownLocations(value: string): Set<string> {
  const normalized = normalizeLocality(value);
  const padded = ` ${normalized} `;
  const locations = new Set<string>();

  for (const locality of BELGIAN_LOCALITIES) {
    const name = normalizeLocality(locality.name);
    if (name && padded.includes(` ${name} `)) locations.add(name);
  }

  return locations;
}

function extractNamedLocations(value: string): Set<string> {
  const locations = new Set<string>();
  const capitalizedWord = "[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*";
  const pattern = new RegExp(
    `(?:^|[\\s(,])(?:à|a|au|aux|en|dans|sur|vers|près de|pres de|in|at|near|around)\\s+(${capitalizedWord}(?:[\\s-]+(?:(?:de|du|des|la|le|les|of|the)\\s+)?${capitalizedWord}){0,2})`,
    "g"
  );

  for (const match of value.matchAll(pattern)) {
    const location = normalizeText(match[1] ?? "");
    if (
      location &&
      location !== "klyx" &&
      !Object.prototype.hasOwnProperty.call(MONTHS, location)
    ) {
      locations.add(location);
    }
  }

  const labelled = /\b(?:ville|city|localite|locality)\s*(?:de|of|:)?\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2})/giu;
  for (const match of value.matchAll(labelled)) {
    const location = normalizeText(match[1] ?? "");
    if (location && location !== "klyx") locations.add(location);
  }

  return locations;
}

function collectLockedLocations(
  value: unknown,
  key = "",
  inherited = false
): Set<string> {
  const locations = new Set<string>();
  const isLocation = inherited || LOCATION_FACT_KEY.test(key);

  if (typeof value === "string" && isLocation && value.trim()) {
    locations.add(normalizeText(value));
    return locations;
  }

  if (!value || typeof value !== "object") return locations;

  for (const [childKey, childValue] of Object.entries(value)) {
    for (const item of collectLockedLocations(childValue, childKey, isLocation)) {
      locations.add(item);
    }
  }

  return locations;
}

function collectProtectedFacts(
  value: unknown,
  key = "",
  inherited = false
): Set<string> {
  const facts = new Set<string>();
  const isSensitive = inherited || SENSITIVE_FACT_KEY.test(key);

  if (typeof value === "string" && isSensitive && value.trim()) {
    facts.add(normalizeText(value));
    return facts;
  }

  if (!value || typeof value !== "object") return facts;

  for (const [childKey, childValue] of Object.entries(value)) {
    for (const item of collectProtectedFacts(childValue, childKey, isSensitive)) {
      facts.add(item);
    }
  }

  return facts;
}

function containsUnexpectedToken(
  candidateTokens: Set<string>,
  allowedTokens: Set<string>
): boolean {
  for (const token of candidateTokens) {
    if (!allowedTokens.has(token)) return true;
  }
  return false;
}

function locationAllowed(candidate: string, allowedLocations: Set<string>): boolean {
  for (const allowed of allowedLocations) {
    if (
      candidate === allowed ||
      candidate.startsWith(`${allowed} `) ||
      allowed.startsWith(`${candidate} `)
    ) {
      return true;
    }
  }
  return false;
}

function transactionClaimSignatures(value: string): Set<string> {
  const normalized = normalizeText(value);
  const signatures = new Set<string>();

  for (const claim of TRANSACTION_PATTERNS) {
    for (const match of normalized.matchAll(claim.pattern)) {
      const matchedText = match[0];
      const negative =
        /\b(?:pas|jamais|not|never|without)\b/.test(matchedText) ||
        /\bn[' ]?(?:est|a|ont)[^.!?]{0,24}\bplus\b/.test(matchedText);

      signatures.add(`${claim.signature}:${negative ? "negative" : "positive"}`);
    }
  }

  return signatures;
}

function hasUnexpectedReadinessClaim(
  candidate: string,
  lockedFacts: Record<string, unknown> | null | undefined
): boolean {
  if (!lockedFacts) return false;

  const normalizedCandidate = normalizeText(candidate);
  const missing = Array.isArray(lockedFacts.missing)
    ? lockedFacts.missing.filter(
        (item) => typeof item === "string" && item.trim().length > 0
      )
    : [];
  const ready = lockedFacts.ready;

  if ((ready === false || missing.length > 0) && READY_CLAIM.test(normalizedCandidate)) {
    return true;
  }

  return ready === true && MISSING_CLAIM.test(normalizedCandidate);
}

/**
 * Post-generation guard for the visible AI layer. It accepts prose only when
 * every sensitive fact remains compatible with deterministic KLYX state.
 * Unsafe output is never repaired or re-prompted: callers fall back directly
 * to the already validated deterministic reply.
 */
export function assessKlyxVisibleAiCandidate(
  input: SafetyInput
): KlyxVisibleAiSafetyAssessment {
  const candidate = input.candidate.trim();
  const deterministicReply = input.deterministicReply.trim();
  const factText = collectFactValues(input.lockedFacts).join(" ");
  const authoritativeText = `${deterministicReply} ${factText}`.trim();

  if (
    containsUnexpectedToken(
      extractCurrencyAmounts(candidate),
      extractCurrencyAmounts(authoritativeText)
    )
  ) {
    return { safe: false, reason: "money" };
  }

  if (
    containsUnexpectedToken(
      extractDates(candidate, false),
      extractDates(authoritativeText, true)
    )
  ) {
    return { safe: false, reason: "date" };
  }

  if (
    containsUnexpectedToken(
      extractClockTimes(candidate),
      extractClockTimes(authoritativeText)
    )
  ) {
    return { safe: false, reason: "time" };
  }

  if (
    containsUnexpectedToken(
      extractNumbers(candidate),
      extractNumbers(authoritativeText)
    )
  ) {
    return { safe: false, reason: "number" };
  }

  const candidateLocations = new Set([
    ...extractKnownLocations(candidate),
    ...extractNamedLocations(candidate),
  ]);
  const allowedLocations = new Set([
    ...extractKnownLocations(authoritativeText),
    ...extractNamedLocations(deterministicReply),
    ...collectLockedLocations(input.lockedFacts),
  ]);

  for (const location of candidateLocations) {
    if (!locationAllowed(location, allowedLocations)) {
      return { safe: false, reason: "location" };
    }
  }

  const allowedClaims = transactionClaimSignatures(deterministicReply);
  for (const claim of transactionClaimSignatures(candidate)) {
    if (!allowedClaims.has(claim)) {
      return { safe: false, reason: "transaction-state" };
    }
  }

  if (hasUnexpectedReadinessClaim(candidate, input.lockedFacts)) {
    return { safe: false, reason: "readiness" };
  }

  const normalizedDeterministic = normalizeText(deterministicReply);
  const normalizedCandidate = normalizeText(candidate);

  for (const fact of collectProtectedFacts(input.lockedFacts)) {
    if (
      normalizedDeterministic.includes(fact) &&
      !normalizedCandidate.includes(fact)
    ) {
      return { safe: false, reason: "locked-fact" };
    }
  }

  return { safe: true, reason: null };
}
