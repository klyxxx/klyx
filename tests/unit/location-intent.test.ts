import { describe, expect, it } from "vitest";

import { detectLocation } from "@/lib/location-intent";

describe("KLYX shared location extraction", () => {
  it("keeps canonical Belgian localities", () => {
    expect(
      detectLocation("J'ai besoin d'aide demain à Bruxelles.")
    ).toBe("Bruxelles");

    expect(
      detectLocation("Prestation à Schaerbeek samedi matin.")
    ).toBe("Schaerbeek");
  });

  it("extracts explicit cities beyond Belgium", () => {
    expect(
      detectLocation("Je cherche un plombier à Paris demain.")
    ).toBe("Paris");

    expect(
      detectLocation("Besoin d'un électricien à douala vendredi.")
    ).toBe("Douala");

    expect(
      detectLocation("Je veux un photographe à Yaoundé samedi.")
    ).toBe("Yaoundé");
  });

  it("supports multi-word international cities", () => {
    expect(
      detectLocation("Je cherche une aide à New York demain matin.")
    ).toBe("New York");

    expect(
      detectLocation("Prestation à los angeles vendredi soir.")
    ).toBe("Los Angeles");
  });

  it("understands explicit nearby and city wording", () => {
    expect(
      detectLocation("Je cherche quelqu'un près de Yaoundé demain.")
    ).toBe("Yaoundé");

    expect(
      detectLocation("Intervention dans la ville de Paris mardi.")
    ).toBe("Paris");
  });

  it("stops before time, date and budget qualifiers", () => {
    expect(
      detectLocation("Besoin d'aide à paris demain à 10h pour 80 €.")
    ).toBe("Paris");

    expect(
      detectLocation("Prestation à Douala vendredi soir budget 50 €.")
    ).toBe("Douala");
  });

  it("does not confuse times or generic places with a city", () => {
    expect(detectLocation("Je veux venir à 10h demain.")).toBeNull();
    expect(detectLocation("Je veux une prestation à domicile.")).toBeNull();
    expect(detectLocation("Il a besoin d'un plombier demain.")).toBeNull();
  });
});
