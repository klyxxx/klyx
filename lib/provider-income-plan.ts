export type ProviderIncomePlanLocale = "fr" | "en" | "nl" | "de";

export type ProviderIncomePlanRequest = {
  locale: ProviderIncomePlanLocale;
  targetAmount: number;
  targetCurrency: string | null;
  dayOfWeek: number;
  dayLabel: string;
  startTime: string | null;
  endTime: string | null;
};

export type ProviderIncomeInterval = {
  date: string;
  startTime: string;
  endTime: string;
};

export type ProviderIncomeMissionCandidate = {
  requestId: string;
  title: string;
  serviceLabel: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string | null;
  currency: string;
  potentialAmount: number;
  amountSource: "provider_rate" | "client_budget_ceiling";
  amountLabel: string;
  reasons: string[];
  intervals: ProviderIncomeInterval[];
  intervalsComplete: boolean;
};

export type ProviderIncomePlanCombination = {
  id: string;
  potentialAmount: number;
  differenceToTarget: number;
  exactSchedule: boolean;
  explanation: string;
  missions: ProviderIncomeMissionCandidate[];
};

const DAYS = [
  {
    dayOfWeek: 1,
    labels: { fr: "lundi", en: "Monday", nl: "maandag", de: "Montag" },
    aliases: ["lundi", "monday", "maandag", "montag"],
  },
  {
    dayOfWeek: 2,
    labels: { fr: "mardi", en: "Tuesday", nl: "dinsdag", de: "Dienstag" },
    aliases: ["mardi", "tuesday", "dinsdag", "dienstag"],
  },
  {
    dayOfWeek: 3,
    labels: { fr: "mercredi", en: "Wednesday", nl: "woensdag", de: "Mittwoch" },
    aliases: ["mercredi", "wednesday", "woensdag", "mittwoch"],
  },
  {
    dayOfWeek: 4,
    labels: { fr: "jeudi", en: "Thursday", nl: "donderdag", de: "Donnerstag" },
    aliases: ["jeudi", "thursday", "donderdag", "donnerstag"],
  },
  {
    dayOfWeek: 5,
    labels: { fr: "vendredi", en: "Friday", nl: "vrijdag", de: "Freitag" },
    aliases: ["vendredi", "friday", "vrijdag", "freitag"],
  },
  {
    dayOfWeek: 6,
    labels: { fr: "samedi", en: "Saturday", nl: "zaterdag", de: "Samstag" },
    aliases: ["samedi", "saturday", "zaterdag", "samstag"],
  },
  {
    dayOfWeek: 0,
    labels: { fr: "dimanche", en: "Sunday", nl: "zondag", de: "Sonntag" },
    aliases: ["dimanche", "sunday", "zondag", "sonntag"],
  },
] as const;

const INCOME_WORDS: Record<ProviderIncomePlanLocale, readonly string[]> = {
  fr: ["gagner", "revenu", "objectif"],
  en: ["earn", "make", "income", "target"],
  nl: ["verdienen", "inkomen", "doel"],
  de: ["verdienen", "einkommen", "ziel"],
};

const MISSION_WORDS: Record<ProviderIncomePlanLocale, readonly string[]> = {
  fr: ["mission", "missions", "travail", "boulot", "trouve"],
  en: ["mission", "missions", "job", "jobs", "work", "find"],
  nl: ["opdracht", "opdrachten", "job", "jobs", "werk", "vind"],
  de: ["auftrag", "auftrage", "job", "jobs", "arbeit", "find"],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, words: readonly string[]): boolean {
  return words.some((word) => value.includes(word));
}

function detectLocale(value: string): ProviderIncomePlanLocale {
  const scores: Record<ProviderIncomePlanLocale, number> = {
    fr: 0,
    en: 0,
    nl: 0,
    de: 0,
  };

  for (const locale of Object.keys(scores) as ProviderIncomePlanLocale[]) {
    for (const word of [...INCOME_WORDS[locale], ...MISSION_WORDS[locale]]) {
      if (value.includes(word)) scores[locale] += 1;
    }
  }

  for (const day of DAYS) {
    for (const locale of Object.keys(scores) as ProviderIncomePlanLocale[]) {
      if (value.includes(normalize(day.labels[locale]))) scores[locale] += 3;
    }
  }

  return (Object.keys(scores) as ProviderIncomePlanLocale[]).reduce(
    (best, locale) => (scores[locale] > scores[best] ? locale : best),
    "fr"
  );
}

function currencyFromMarker(marker: string): string {
  const normalized = marker.toLowerCase();
  if (normalized === "€" || normalized.startsWith("eur")) return "EUR";
  if (normalized === "$" || normalized === "usd") return "USD";
  return "GBP";
}

function parseAmount(value: string): {
  amount: number;
  currency: string | null;
} | null {
  const suffix = value.match(
    /(\d{1,6}(?:[.,]\d{1,2})?)\s*(€|eur|euros?|\$|usd|£|gbp)(?=\s|[.,!?;:]|$)/i
  );
  const prefix = value.match(
    /(€|\$|£)\s*(\d{1,6}(?:[.,]\d{1,2})?)/i
  );

  const amountText = suffix?.[1] ?? prefix?.[2];
  const marker = suffix?.[2] ?? prefix?.[1];

  if (amountText && marker) {
    const amount = Number(amountText.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return null;
    }

    return {
      amount,
      currency: currencyFromMarker(marker),
    };
  }

  const contextual = value.match(
    /(?:gagner|revenu|objectif|earn|make|income|target|verdienen|inkomen|doel|einkommen|ziel).{0,36}?(\d{1,6}(?:[.,]\d{1,2})?)/i
  );

  if (!contextual) return null;

  const amount = Number(contextual[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000
    ? { amount, currency: null }
    : null;
}

function formatTime(
  hour: number,
  minute = 0,
  meridiem?: string
): string | null {
  let resolvedHour = hour;
  const suffix = meridiem?.toLowerCase();

  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "am") resolvedHour = hour === 12 ? 0 : hour;
    if (suffix === "pm") resolvedHour = hour === 12 ? 12 : hour + 12;
  }

  if (
    resolvedHour < 0 ||
    resolvedHour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(resolvedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectTimeWindow(value: string): {
  startTime: string;
  endTime: string;
} | null {
  const clock =
    "(\\d{1,2})(?:\\s*(?::|h|u|uur|uhr)\\s*(\\d{1,2})?)?\\s*(am|pm)?";
  const patterns = [
    new RegExp(`(?:de|entre)\\s+${clock}\\s+(?:a|et|-)\\s+${clock}`, "i"),
    new RegExp(`(?:from|between)\\s+${clock}\\s+(?:to|and|-)\\s+${clock}`, "i"),
    new RegExp(`(?:van|tussen)\\s+${clock}\\s+(?:tot|en|-)\\s+${clock}`, "i"),
    new RegExp(`(?:von|zwischen)\\s+${clock}\\s+(?:bis|und|-)\\s+${clock}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const startTime = formatTime(
      Number(match[1]),
      Number(match[2] ?? 0),
      match[3]
    );
    const endTime = formatTime(
      Number(match[4]),
      Number(match[5] ?? 0),
      match[6]
    );

    if (startTime && endTime && endTime > startTime) {
      return { startTime, endTime };
    }
  }

  return null;
}

export function parseProviderIncomePlanRequest(
  message: string
): ProviderIncomePlanRequest | null {
  const value = normalize(message);
  const locale = detectLocale(value);
  const amount = parseAmount(value);
  const day = DAYS.find((candidate) =>
    candidate.aliases.some((alias) => value.includes(alias))
  );

  if (!amount || !day) return null;

  const hasIncomeIntent = Object.values(INCOME_WORDS).some((words) =>
    includesAny(value, words)
  );
  const hasMissionIntent = Object.values(MISSION_WORDS).some((words) =>
    includesAny(value, words)
  );

  if (!hasIncomeIntent || !hasMissionIntent) return null;

  const window = detectTimeWindow(value);

  return {
    locale,
    targetAmount: amount.amount,
    targetCurrency: amount.currency,
    dayOfWeek: day.dayOfWeek,
    dayLabel: day.labels[locale],
    startTime: window?.startTime ?? null,
    endTime: window?.endTime ?? null,
  };
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function intervalsOverlap(
  left: ProviderIncomeInterval,
  right: ProviderIncomeInterval
): boolean {
  if (left.date !== right.date) return false;

  return (
    minutes(left.startTime) < minutes(right.endTime) &&
    minutes(right.startTime) < minutes(left.endTime)
  );
}

function canCombine(missions: ProviderIncomeMissionCandidate[]): boolean {
  if (missions.length <= 1) return true;
  if (missions.some((mission) => !mission.intervalsComplete)) return false;

  for (let first = 0; first < missions.length; first += 1) {
    for (let second = first + 1; second < missions.length; second += 1) {
      for (const left of missions[first].intervals) {
        for (const right of missions[second].intervals) {
          if (intervalsOverlap(left, right)) return false;
        }
      }
    }
  }

  return true;
}

function combinationExplanation(
  locale: ProviderIncomePlanLocale,
  total: number,
  target: number
): string {
  const difference = total - target;
  const tolerance = Math.max(10, target * 0.15);
  const roundedTarget = Math.round(target * 100) / 100;

  if (Math.abs(difference) <= tolerance) {
    const texts = {
      fr: `Proche de ton objectif de ${roundedTarget} €.`,
      en: `Close to your target of ${roundedTarget}.`,
      nl: `Dicht bij je doel van ${roundedTarget}.`,
      de: `Nahe an deinem Ziel von ${roundedTarget}.`,
    };
    return texts[locale];
  }

  if (difference < 0) {
    const texts = {
      fr: `Sous ton objectif de ${roundedTarget} €, mais parmi les options compatibles les plus proches.`,
      en: `Below your target of ${roundedTarget}, but among the closest compatible options.`,
      nl: `Onder je doel van ${roundedTarget}, maar een van de dichtstbijzijnde compatibele opties.`,
      de: `Unter deinem Ziel von ${roundedTarget}, aber eine der nächsten kompatiblen Optionen.`,
    };
    return texts[locale];
  }

  const texts = {
    fr: `Au-dessus de ton objectif de ${roundedTarget} €, tout en restant compatible avec les créneaux vérifiés.`,
    en: `Above your target of ${roundedTarget}, while remaining compatible with the verified schedule.`,
    nl: `Boven je doel van ${roundedTarget}, met behoud van compatibele geverifieerde tijdstippen.`,
    de: `Über deinem Ziel von ${roundedTarget}, bei weiterhin kompatiblen geprüften Zeiten.`,
  };
  return texts[locale];
}

export function rankProviderIncomeCombinations(
  candidates: ProviderIncomeMissionCandidate[],
  targetAmount: number,
  locale: ProviderIncomePlanLocale,
  limit = 3
): ProviderIncomePlanCombination[] {
  const bounded = candidates.slice(0, 12);
  const sets: ProviderIncomeMissionCandidate[][] = [];

  for (let first = 0; first < bounded.length; first += 1) {
    sets.push([bounded[first]]);

    for (let second = first + 1; second < bounded.length; second += 1) {
      const pair = [bounded[first], bounded[second]];
      if (canCombine(pair)) sets.push(pair);

      for (let third = second + 1; third < bounded.length; third += 1) {
        const trio = [bounded[first], bounded[second], bounded[third]];
        if (canCombine(trio)) sets.push(trio);
      }
    }
  }

  return sets
    .map((missions) => {
      const potentialAmount =
        Math.round(
          missions.reduce((sum, mission) => sum + mission.potentialAmount, 0) *
            100
        ) / 100;
      const differenceToTarget =
        Math.round((potentialAmount - targetAmount) * 100) / 100;

      return {
        id: "",
        potentialAmount,
        differenceToTarget,
        exactSchedule: missions.every((mission) => mission.intervalsComplete),
        explanation: combinationExplanation(
          locale,
          potentialAmount,
          targetAmount
        ),
        missions,
      } satisfies ProviderIncomePlanCombination;
    })
    .sort((left, right) => {
      const leftGap = Math.abs(left.differenceToTarget);
      const rightGap = Math.abs(right.differenceToTarget);
      if (leftGap !== rightGap) return leftGap - rightGap;

      if (left.missions.length !== right.missions.length) {
        return left.missions.length - right.missions.length;
      }

      return right.potentialAmount - left.potentialAmount;
    })
    .slice(0, Math.max(1, Math.min(3, limit)))
    .map((combination, index) => ({
      ...combination,
      id: `income-plan-${index + 1}`,
    }));
}
