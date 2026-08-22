import { calculateQuote } from "@/lib/quote-calculator";

export type ProviderQuoteDraftConfidence = "high" | "medium" | "low";

export type ProviderQuoteDraft = {
  providerPrice: number | null;
  providerMessage: string;
  explanation: string;
  assumptions: string[];
  warnings: string[];
  confidence: ProviderQuoteDraftConfidence;
  riskLevel: "review_required";
  requiresConfirmation: true;
  source: "quote_snapshot";
};

export type ProviderQuoteDraftInput = {
  title: string;
  description: string;
  requestedDate: string | null;
  requestedTime: string | null;
  durationHours: number | null;
  pricingType: "hourly" | "fixed";
  unitPrice: number | null;
  estimatedTotal: number | null;
  currency: string;
};

function finiteMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || "EUR"}`;
  }
}

function scheduleAssumptions(input: ProviderQuoteDraftInput): string[] {
  const assumptions: string[] = [];

  if (input.requestedDate) {
    assumptions.push(`Date demandée : ${input.requestedDate}.`);
  }

  if (input.requestedTime) {
    assumptions.push(
      `Heure demandée : ${input.requestedTime.slice(0, 5)}.`
    );
  }

  if (input.durationHours !== null && input.durationHours > 0) {
    assumptions.push(`Durée indiquée : ${input.durationHours} h.`);
  }

  return assumptions;
}

export function buildProviderQuoteDraft(
  input: ProviderQuoteDraftInput
): ProviderQuoteDraft {
  const unitPrice = finiteMoney(input.unitPrice);
  const storedEstimate = finiteMoney(input.estimatedTotal);
  const calculation = calculateQuote({
    pricingType: input.pricingType,
    unitPrice,
    durationHours: input.durationHours,
  });
  const calculatedEstimate = finiteMoney(calculation.estimatedTotal);
  const assumptions = scheduleAssumptions(input);
  const warnings = [
    "Vérifie le périmètre exact, le déplacement, le matériel et les contraintes avant l’envoi.",
  ];

  let providerPrice: number | null = null;
  let confidence: ProviderQuoteDraftConfidence = "low";

  if (input.pricingType === "hourly") {
    if (
      unitPrice !== null &&
      input.durationHours !== null &&
      input.durationHours > 0 &&
      calculatedEstimate !== null
    ) {
      providerPrice = calculatedEstimate;
      confidence = "high";
    } else if (unitPrice !== null) {
      warnings.unshift(
        "La durée n’est pas suffisamment définie : KLYX ne propose pas de prix final automatique."
      );
    } else {
      warnings.unshift(
        "Aucun tarif horaire exploitable n’est disponible dans le snapshot de la demande."
      );
    }
  } else if (unitPrice !== null && calculatedEstimate !== null) {
    providerPrice = calculatedEstimate;
    confidence = "high";
  } else if (storedEstimate !== null) {
    providerPrice = storedEstimate;
    confidence = "medium";
    warnings.unshift(
      "Le tarif unitaire du snapshot est incomplet : vérifie le montant avant l’envoi."
    );
  } else {
    warnings.unshift(
      "KLYX ne dispose pas d’un tarif exploitable pour proposer un montant."
    );
  }

  if (
    providerPrice !== null &&
    storedEstimate !== null &&
    Math.abs(providerPrice - storedEstimate) > 0.01
  ) {
    warnings.unshift(
      "Le calcul actuel diffère de l’estimation enregistrée avec la demande : vérifie les paramètres."
    );
    confidence = "medium";
  }

  const priceText =
    providerPrice === null
      ? "Aucun prix final n’est proposé automatiquement."
      : `Montant suggéré : ${formatMoney(providerPrice, input.currency)}.`;
  const providerMessage =
    providerPrice === null
      ? "Bonjour, merci pour votre demande. Je vérifie encore la durée et les détails de la prestation avant de vous confirmer un prix."
      : `Bonjour, merci pour votre demande « ${input.title.trim().slice(0, 120)} ». Sur la base des informations reçues, je vous propose ${formatMoney(providerPrice, input.currency)}. Merci de vérifier avec moi les derniers détails avant confirmation.`;

  return {
    providerPrice,
    providerMessage,
    explanation: `${priceText} ${calculation.explanation}`,
    assumptions,
    warnings,
    confidence,
    riskLevel: "review_required",
    requiresConfirmation: true,
    source: "quote_snapshot",
  };
}
