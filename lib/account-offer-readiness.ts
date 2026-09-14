export type AccountOfferRequirement =
  | "skills"
  | "zone"
  | "availability"
  | "pricing"
  | "payouts"
  | "trust_safety"
  | "legal";

export type AccountOfferReadinessStatus =
  | "ready"
  | "missing_requirements"
  | "human_review"
  | "blocked";

export type OfferPricingDraft = {
  amount: number;
  pricingType: "hourly" | "fixed" | null;
};

export type OfferAvailabilityDraft = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type OfferLegalPathwayIntent =
  | "occasional"
  | "employment_structure"
  | "independent"
  | "unknown";

export type OfferActivityFrequency =
  | "one_off"
  | "intermittent"
  | "recurring"
  | "unknown";

export type OfferLegalDraft = {
  pathwayIntent: OfferLegalPathwayIntent | null;
  activityFrequency: OfferActivityFrequency | null;
  explicitUncertainty: boolean;
};

const OFFER_INTENT_MARKERS = [
  "gagner de l argent",
  "gagner de l’argent",
  "gagner de l'argent",
  "je veux travailler",
  "je cherche du travail",
  "je cherche des missions",
  "trouver des missions",
  "proposer mes services",
  "offrir mes services",
  "devenir prestataire",
  "je sais faire",
  "je sais monter",
  "je peux faire",
  "earn money",
  "find work",
  "find jobs",
  "offer my services",
] as const;

const OFFER_DAYS = [
  { dayOfWeek: 1, aliases: ["lundi", "monday"] },
  { dayOfWeek: 2, aliases: ["mardi", "tuesday"] },
  { dayOfWeek: 3, aliases: ["mercredi", "wednesday"] },
  { dayOfWeek: 4, aliases: ["jeudi", "thursday"] },
  { dayOfWeek: 5, aliases: ["vendredi", "friday"] },
  { dayOfWeek: 6, aliases: ["samedi", "saturday"] },
  { dayOfWeek: 0, aliases: ["dimanche", "sunday"] },
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectOfferServicesIntent(
  message: string,
  previousOfferIntent = false
): boolean {
  if (previousOfferIntent) return true;
  const value = normalize(message);
  return OFFER_INTENT_MARKERS.some((marker) => value.includes(normalize(marker)));
}

export function parseOfferRadiusKm(message: string): number | null {
  const match = normalize(message).match(
    /\b(\d{1,3})\s*(?:km|kilometres?|kilometers?)\b/i
  );
  if (!match) return null;
  const radius = Number(match[1]);
  return Number.isInteger(radius) && radius >= 1 && radius <= 100
    ? radius
    : null;
}

function pricingMethod(value: string): "hourly" | "fixed" | null {
  const hourly =
    /(?:\/\s*h\b|par\s+heure\b|de\s+l\s+heure\b|horaire\b|hourly\b|per\s+hour\b)/i.test(
      value
    );
  const fixed =
    /\b(?:forfait|forfaitaire|prix\s+fixe|fixed)\b/i.test(value);

  if (hourly === fixed) return null;
  return hourly ? "hourly" : "fixed";
}

export function parseOfferPricing(message: string): OfferPricingDraft | null {
  const value = normalize(message);
  const amountMatch = value.match(
    /\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|(?:eur|euros?)\b)/i
  );
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return null;

  return {
    amount: Math.round(amount * 100) / 100,
    pricingType: pricingMethod(value),
  };
}

export function mergeOfferPricingDraft(
  message: string,
  previous: OfferPricingDraft | null
): OfferPricingDraft | null {
  const current = parseOfferPricing(message);
  const method = pricingMethod(normalize(message));

  if (current) {
    return {
      amount: current.amount,
      pricingType: current.pricingType ?? previous?.pricingType ?? null,
    };
  }

  if (previous && method) {
    return { ...previous, pricingType: method };
  }

  return previous;
}

function clock(hourText: string, minuteText?: string): string | null {
  const hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseOfferDayOfWeek(message: string): number | null {
  const value = normalize(message);
  return (
    OFFER_DAYS.find((day) =>
      day.aliases.some((alias) => value.includes(normalize(alias)))
    )?.dayOfWeek ?? null
  );
}

export function parseOfferAvailability(
  message: string,
  fallbackDayOfWeek: number | null = null
): OfferAvailabilityDraft | null {
  const value = normalize(message);
  const dayOfWeek = parseOfferDayOfWeek(message) ?? fallbackDayOfWeek;
  if (dayOfWeek === null || dayOfWeek === undefined) return null;

  const range = value.match(
    /\b(\d{1,2})(?:\s*(?:h|:|heure)\s*(\d{1,2})?)?\s*(?:-|a|à|jusqu a|jusqua)\s*(\d{1,2})(?:\s*(?:h|:|heure)\s*(\d{1,2})?)?\b/i
  );
  if (!range) return null;

  const startTime = clock(range[1], range[2]);
  const endTime = clock(range[3], range[4]);
  if (!startTime || !endTime || endTime <= startTime) return null;

  return { dayOfWeek, startTime, endTime };
}

function explicitPathwayIntent(value: string): OfferLegalPathwayIntent | null {
  if (
    /\b(?:independant|independante|a mon compte|via mon entreprise|self employed|self employment)\b/i.test(
      value
    )
  ) {
    return "independent";
  }

  if (
    /\b(?:salarie|salariee|contrat de travail|structure d emploi|employe par|employee by|employment structure)\b/i.test(
      value
    )
  ) {
    return "employment_structure";
  }

  if (/\b(?:activite occasionnelle|occasionnel|occasionnelle)\b/i.test(value)) {
    return "occasional";
  }

  return null;
}

function explicitActivityFrequency(value: string): OfferActivityFrequency | null {
  if (
    /\b(?:regulier|reguliere|chaque semaine|toutes les semaines|tous les week ends|recurring)\b/i.test(
      value
    )
  ) {
    return "recurring";
  }

  if (/\b(?:ponctuel|ponctuelle|une seule fois|one off)\b/i.test(value)) {
    return "one_off";
  }

  if (/\b(?:de temps en temps|intermittent|intermittente|occasionnellement)\b/i.test(value)) {
    return "intermittent";
  }

  return null;
}

export function mergeOfferLegalDraft(
  message: string,
  previous: OfferLegalDraft | null
): OfferLegalDraft | null {
  const value = normalize(message);
  const explicitUncertainty =
    /\b(?:je ne sais pas|je sais pas|pas sur|pas sure|aucune idee|i don t know|not sure)\b/i.test(
      value
    );
  const pathwayIntent = explicitPathwayIntent(value);
  const activityFrequency = explicitActivityFrequency(value);

  if (!explicitUncertainty && !pathwayIntent && !activityFrequency) {
    return previous;
  }

  if (explicitUncertainty) {
    return {
      pathwayIntent: previous?.pathwayIntent ?? "unknown",
      activityFrequency: previous?.activityFrequency ?? "unknown",
      explicitUncertainty: true,
    };
  }

  return {
    pathwayIntent: pathwayIntent ?? previous?.pathwayIntent ?? null,
    activityFrequency:
      activityFrequency ?? previous?.activityFrequency ?? null,
    explicitUncertainty: false,
  };
}

export function offerRequirementQuestion(
  requirement: AccountOfferRequirement
): string {
  switch (requirement) {
    case "skills":
      return "Quel service veux-tu proposer ? Décris simplement ce que tu sais faire.";
    case "zone":
      return "Dans quelle commune veux-tu travailler, et jusqu’à quel rayon ? Par exemple : Bruxelles, 20 km.";
    case "availability":
      return "Quelle plage horaire veux-tu ouvrir ? Par exemple : samedi de 9h à 18h.";
    case "pricing":
      return "Quel tarif veux-tu utiliser, et est-ce un prix horaire ou fixe ? Par exemple : 35 €/h ou 80 € forfaitaire.";
    case "payouts":
      return "Il manque la configuration de paiement. Termine l’onboarding Stripe sécurisé ; ne saisis pas tes coordonnées bancaires dans le chat.";
    case "trust_safety":
      return "Il reste une vérification Trust & Safety à compléter avant l’activation de l’offre.";
    case "legal":
      return "Pour l’évaluation légale, indique seulement comment tu comptes exercer cette activité : occasionnellement, comme indépendant, via une structure d’emploi, ou dis que tu ne sais pas.";
  }
}
