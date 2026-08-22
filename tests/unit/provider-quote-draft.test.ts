import { describe, expect, it } from "vitest";

import { buildProviderQuoteDraft } from "@/lib/provider-quote-draft";

const BASE_INPUT = {
  title: "Ménage appartement",
  description: "Nettoyage complet de l'appartement.",
  requestedDate: "2026-09-10",
  requestedTime: "10:00:00",
  durationHours: 2,
  pricingType: "hourly" as const,
  unitPrice: 35,
  estimatedTotal: 70,
  currency: "EUR",
};

describe("provider smart quote draft", () => {
  it("uses the canonical hourly snapshot only when duration is known", () => {
    const draft = buildProviderQuoteDraft(BASE_INPUT);

    expect(draft.providerPrice).toBe(70);
    expect(draft.confidence).toBe("high");
    expect(draft.explanation).toContain("2 h");
    expect(draft.explanation).toContain("35.00 €");
    expect(draft.riskLevel).toBe("review_required");
    expect(draft.requiresConfirmation).toBe(true);
    expect(draft.source).toBe("quote_snapshot");
  });

  it("never invents a one-hour final price when hourly duration is unknown", () => {
    const draft = buildProviderQuoteDraft({
      ...BASE_INPUT,
      durationHours: null,
      estimatedTotal: 35,
    });

    expect(draft.providerPrice).toBeNull();
    expect(draft.confidence).toBe("low");
    expect(draft.warnings.join(" ")).toContain(
      "durée n’est pas suffisamment définie"
    );
    expect(draft.providerMessage).toContain(
      "avant de vous confirmer un prix"
    );
  });

  it("uses a fixed published price without multiplying by duration", () => {
    const draft = buildProviderQuoteDraft({
      ...BASE_INPUT,
      pricingType: "fixed",
      unitPrice: 89.5,
      estimatedTotal: 89.5,
      durationHours: 4,
    });

    expect(draft.providerPrice).toBe(89.5);
    expect(draft.confidence).toBe("high");
    expect(draft.explanation).toContain("forfait publié");
  });

  it("downgrades confidence when the recalculation differs from the stored snapshot", () => {
    const draft = buildProviderQuoteDraft({
      ...BASE_INPUT,
      estimatedTotal: 80,
    });

    expect(draft.providerPrice).toBe(70);
    expect(draft.confidence).toBe("medium");
    expect(draft.warnings.join(" ")).toContain(
      "diffère de l’estimation enregistrée"
    );
  });

  it("does not propose a final amount from invalid pricing data", () => {
    const draft = buildProviderQuoteDraft({
      ...BASE_INPUT,
      unitPrice: -10,
      estimatedTotal: null,
    });

    expect(draft.providerPrice).toBeNull();
    expect(draft.confidence).toBe("low");
    expect(draft.requiresConfirmation).toBe(true);
  });
});
