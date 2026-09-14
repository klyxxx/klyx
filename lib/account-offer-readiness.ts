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
      return "La situation juridique nécessite une revue humaine avant d’activer cette activité.";
  }
}
