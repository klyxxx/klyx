export type QuotePricingType = "hourly" | "fixed";

export type QuoteCalculationInput = {
  pricingType: QuotePricingType;
  unitPrice: number | null;
  durationHours: number | null;
};

export type QuoteCalculation = {
  quantity: number;
  estimatedTotal: number | null;
  explanation: string;
};

function money(value: number): string {
  return `${value.toFixed(2)} €`;
}

export function calculateQuote(
  input: QuoteCalculationInput
): QuoteCalculation {
  if (
    input.unitPrice === null ||
    !Number.isFinite(input.unitPrice) ||
    input.unitPrice < 0
  ) {
    return {
      quantity:
        input.pricingType === "hourly"
          ? Math.max(1, input.durationHours ?? 1)
          : 1,
      estimatedTotal: null,
      explanation:
        "Le prestataire doit encore confirmer son tarif.",
    };
  }

  if (input.pricingType === "fixed") {
    return {
      quantity: 1,
      estimatedTotal:
        Math.round(input.unitPrice * 100) / 100,
      explanation:
        `Estimation basée sur le forfait publié de ${money(
          input.unitPrice
        )}.`,
    };
  }

  const quantity = Math.max(
    1,
    input.durationHours ?? 1
  );

  const total =
    Math.round(
      input.unitPrice * quantity * 100
    ) / 100;

  return {
    quantity,
    estimatedTotal: total,
    explanation:
      `${quantity} h × ${money(
        input.unitPrice
      )}/h = ${money(total)}.`,
  };
}
