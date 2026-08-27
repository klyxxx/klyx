export const MEMORY_PREFERENCE_LIMITS = {
  maxBudget: 1_000_000,
  maxServiceSlugs: 50,
  maxServiceSlugLength: 120,
  maxNoteLength: 4_000,
} as const;

export type MemoryPreferencesInput = {
  defaultCity?: unknown;
  defaultBudget?: unknown;
  preferredServiceSlugs?: unknown;
  householdNotes?: unknown;
  schedulingNotes?: unknown;
  aiMemoryEnabled?: unknown;
};

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`Champ ${field} invalide.`);

  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error(`Champ ${field} trop long.`);
  return cleaned;
}

function optionalBudget(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Budget invalide.");
  }
  if (value < 0 || value > MEMORY_PREFERENCE_LIMITS.maxBudget) {
    throw new Error("Budget hors limites.");
  }
  return Math.round(value * 100) / 100;
}

function serviceSlugs(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Services préférés invalides.");
  if (value.length > MEMORY_PREFERENCE_LIMITS.maxServiceSlugs) {
    throw new Error("Trop de services préférés.");
  }

  const normalized = value.map((item) => {
    if (typeof item !== "string") throw new Error("Service préféré invalide.");
    const slug = item.trim();
    if (!slug || slug.length > MEMORY_PREFERENCE_LIMITS.maxServiceSlugLength) {
      throw new Error("Service préféré invalide.");
    }
    return slug;
  });

  return [...new Set(normalized)];
}

export function parseMemoryPreferencesInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Préférences invalides.");
  }

  const body = input as MemoryPreferencesInput;
  if (body.aiMemoryEnabled != null && typeof body.aiMemoryEnabled !== "boolean") {
    throw new Error("Option mémoire invalide.");
  }

  return {
    defaultCity: optionalText(body.defaultCity, "defaultCity", 200),
    defaultBudget: optionalBudget(body.defaultBudget),
    preferredServiceSlugs: serviceSlugs(body.preferredServiceSlugs),
    householdNotes: optionalText(body.householdNotes, "householdNotes", MEMORY_PREFERENCE_LIMITS.maxNoteLength),
    schedulingNotes: optionalText(body.schedulingNotes, "schedulingNotes", MEMORY_PREFERENCE_LIMITS.maxNoteLength),
    aiMemoryEnabled: body.aiMemoryEnabled ?? true,
  };
}
