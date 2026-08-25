import { describe, expect, it } from "vitest";

import { providerZonesCoverBelgianLocality } from "@/lib/provider-search-zone-coverage";

const brusselsZone = {
  countryCode: "BE",
  locality: "Bruxelles",
  postalCode: "1000",
  radiusKm: 15,
  isActive: true,
};

describe("provider search canonical zone coverage", () => {
  it("does not constrain search when no locality filter is provided", () => {
    expect(providerZonesCoverBelgianLocality([], "")).toBe(true);
  });

  it("covers the canonical locality and nearby Belgian localities inside the radius", () => {
    expect(providerZonesCoverBelgianLocality([brusselsZone], "Bruxelles")).toBe(true);
    expect(providerZonesCoverBelgianLocality([brusselsZone], "Schaerbeek")).toBe(true);
  });

  it("resolves a canonical zone by postal code when locality text is unavailable", () => {
    expect(
      providerZonesCoverBelgianLocality(
        [
          {
            countryCode: "BE",
            locality: "",
            postalCode: "1000",
            radiusKm: 5,
            isActive: true,
          },
        ],
        "Bruxelles"
      )
    ).toBe(true);
  });

  it("rejects Belgian localities outside every active zone radius", () => {
    expect(providerZonesCoverBelgianLocality([brusselsZone], "Liège")).toBe(false);
  });

  it("fails closed for unknown requested localities", () => {
    expect(providerZonesCoverBelgianLocality([brusselsZone], "Paris")).toBe(false);
    expect(providerZonesCoverBelgianLocality([brusselsZone], "Invented City")).toBe(false);
  });

  it("fails closed for non-BE, inactive, ungeocoded, and invalid-radius zones", () => {
    expect(
      providerZonesCoverBelgianLocality(
        [{ ...brusselsZone, countryCode: "FR" }],
        "Bruxelles"
      )
    ).toBe(false);
    expect(
      providerZonesCoverBelgianLocality(
        [{ ...brusselsZone, isActive: false }],
        "Bruxelles"
      )
    ).toBe(false);
    expect(
      providerZonesCoverBelgianLocality(
        [{ ...brusselsZone, locality: "Unknown", postalCode: null }],
        "Bruxelles"
      )
    ).toBe(false);
    expect(
      providerZonesCoverBelgianLocality(
        [{ ...brusselsZone, radiusKm: 0 }],
        "Bruxelles"
      )
    ).toBe(false);
    expect(
      providerZonesCoverBelgianLocality(
        [{ ...brusselsZone, radiusKm: 101 }],
        "Bruxelles"
      )
    ).toBe(false);
  });
});
