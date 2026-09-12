import type { KlyxIncomeGoal } from "@/lib/klyx-orchestration";

export type ProviderIncomeGoalLocale = "fr" | "en" | "nl" | "de";

export type ParsedProviderIncomeGoal = Omit<KlyxIncomeGoal, "currency"> & {
  locale: ProviderIncomeGoalLocale;
  dayLabel: string;
  currency: string | null;
};

const DAYS = [
  { dayOfWeek: 1, labels: { fr: "lundi", en: "Monday", nl: "maandag", de: "Montag" }, aliases: ["lundi", "monday", "maandag", "montag"] },
  { dayOfWeek: 2, labels: { fr: "mardi", en: "Tuesday", nl: "dinsdag", de: "Dienstag" }, aliases: ["mardi", "tuesday", "dinsdag", "dienstag"] },
  { dayOfWeek: 3, labels: { fr: "mercredi", en: "Wednesday", nl: "woensdag", de: "Mittwoch" }, aliases: ["mercredi", "wednesday", "woensdag", "mittwoch"] },
  { dayOfWeek: 4, labels: { fr: "jeudi", en: "Thursday", nl: "donderdag", de: "Donnerstag" }, aliases: ["jeudi", "thursday", "donderdag", "donnerstag"] },
  { dayOfWeek: 5, labels: { fr: "vendredi", en: "Friday", nl: "vrijdag", de: "Freitag" }, aliases: ["vendredi", "friday", "vrijdag", "freitag"] },
  { dayOfWeek: 6, labels: { fr: "samedi", en: "Saturday", nl: "zaterdag", de: "Samstag" }, aliases: ["samedi", "saturday", "zaterdag", "samstag"] },
  { dayOfWeek: 0, labels: { fr: "dimanche", en: "Sunday", nl: "zondag", de: "Sonntag" }, aliases: ["dimanche", "sunday", "zondag", "sonntag"] },
] as const;

const INCOME_MARKERS: Record<ProviderIncomeGoalLocale, readonly string[]> = {
  fr: ["gagner", "revenu", "objectif"],
  en: ["earn", "income", "target", "make"],
  nl: ["verdienen", "inkomen", "doel"],
  de: ["verdienen", "einkommen", "ziel"],
};

const JOB_MARKERS: Record<ProviderIncomeGoalLocale, readonly string[]> = {
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

function detectLocale(value: string): ProviderIncomeGoalLocale {
  const scores: Record<ProviderIncomeGoalLocale, number> = { fr: 0, en: 0, nl: 0, de: 0 };
  for (const locale of Object.keys(scores) as ProviderIncomeGoalLocale[]) {
    for (const marker of [...INCOME_MARKERS[locale], ...JOB_MARKERS[locale]]) {
      if (value.includes(marker)) scores[locale] += 1;
    }
  }
  for (const day of DAYS) {
    for (const locale of Object.keys(scores) as ProviderIncomeGoalLocale[]) {
      if (value.includes(normalize(day.labels[locale]))) scores[locale] += 3;
    }
  }
  return (Object.keys(scores) as ProviderIncomeGoalLocale[]).reduce(
    (best, locale) => (scores[locale] > scores[best] ? locale : best),
    "fr"
  );
}

function currency(marker: string | undefined): string | null {
  if (!marker) return null;
  const value = marker.toLowerCase();
  if (value === "€" || value.startsWith("eur")) return "EUR";
  if (value === "$" || value === "usd") return "USD";
  if (value === "£" || value === "gbp") return "GBP";
  return null;
}

function amount(value: string): { amount: number; currency: string | null } | null {
  const suffix = value.match(/(\d{1,6}(?:[.,]\d{1,2})?)\s*(€|eur|euros?|\$|usd|£|gbp)(?=\s|[.,!?;:]|$)/i);
  const prefix = value.match(/(€|\$|£)\s*(\d{1,6}(?:[.,]\d{1,2})?)/i);
  const numberText = suffix?.[1] ?? prefix?.[2];
  const marker = suffix?.[2] ?? prefix?.[1];

  if (numberText) {
    const parsed = Number(numberText.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000) {
      return { amount: parsed, currency: currency(marker) };
    }
  }

  const contextual = value.match(/(?:gagner|revenu|objectif|earn|income|target|make|verdienen|inkomen|doel|einkommen|ziel).{0,36}?(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (!contextual) return null;
  const parsed = Number(contextual[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000
    ? { amount: parsed, currency: null }
    : null;
}

function formatTime(hour: number, minute = 0, meridiem?: string): string | null {
  let resolvedHour = hour;
  const suffix = meridiem?.toLowerCase();
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "am") resolvedHour = hour === 12 ? 0 : hour;
    if (suffix === "pm") resolvedHour = hour === 12 ? 12 : hour + 12;
  }
  if (resolvedHour < 0 || resolvedHour > 23 || minute < 0 || minute > 59) return null;
  return `${String(resolvedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeWindow(value: string): { startTime: string; endTime: string } | null {
  const clock = "(\\d{1,2})(?:\\s*(?::|h|u|uur|uhr)\\s*(\\d{1,2})?)?\\s*(am|pm)?";
  const patterns = [
    new RegExp(`(?:de|entre)\\s+${clock}\\s+(?:a|et|-)\\s+${clock}`, "i"),
    new RegExp(`(?:from|between)\\s+${clock}\\s+(?:to|and|-)\\s+${clock}`, "i"),
    new RegExp(`(?:van|tussen)\\s+${clock}\\s+(?:tot|en|-)\\s+${clock}`, "i"),
    new RegExp(`(?:von|zwischen)\\s+${clock}\\s+(?:bis|und|-)\\s+${clock}`, "i"),
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const startTime = formatTime(Number(match[1]), Number(match[2] ?? 0), match[3]);
    const endTime = formatTime(Number(match[4]), Number(match[5] ?? 0), match[6]);
    if (startTime && endTime && endTime > startTime) return { startTime, endTime };
  }
  return null;
}

export function parseProviderIncomeGoal(message: string): ParsedProviderIncomeGoal | null {
  const value = normalize(message);
  const locale = detectLocale(value);
  const parsedAmount = amount(value);
  const day = DAYS.find((candidate) => candidate.aliases.some((alias) => value.includes(alias)));
  if (!parsedAmount || !day) return null;

  const hasIncomeIntent = Object.values(INCOME_MARKERS).some((markers) => markers.some((marker) => value.includes(marker)));
  const hasJobIntent = Object.values(JOB_MARKERS).some((markers) => markers.some((marker) => value.includes(marker)));
  if (!hasIncomeIntent || !hasJobIntent) return null;

  const window = timeWindow(value);
  return {
    locale,
    dayLabel: day.labels[locale],
    targetAmount: parsedAmount.amount,
    currency: parsedAmount.currency,
    dayOfWeek: day.dayOfWeek,
    date: null,
    startTime: window?.startTime ?? null,
    endTime: window?.endTime ?? null,
    maximumDistanceKm: null,
  };
}
