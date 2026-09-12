import { describe, expect, it } from "vitest";

import { parseProviderIncomeGoal } from "@/lib/provider-income-goal";

describe("provider income goal parser", () => {
  it("does not invent a currency when the provider did not specify one", () => {
    const parsed = parseProviderIncomeGoal(
      "Trouve-moi des missions samedi pour gagner 100"
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.targetAmount).toBe(100);
    expect(parsed?.currency).toBeNull();
    expect(parsed?.dayOfWeek).toBe(6);
  });

  it("keeps an explicitly stated currency", () => {
    const parsed = parseProviderIncomeGoal(
      "Je veux trouver des missions samedi et gagner environ 100 €"
    );

    expect(parsed?.currency).toBe("EUR");
  });

  it("keeps a stated working window as a constraint", () => {
    const parsed = parseProviderIncomeGoal(
      "Je veux trouver des missions samedi de 9h à 15h pour gagner 120 €"
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        startTime: "09:00",
        endTime: "15:00",
      })
    );
  });
});
