import {
  BELGIAN_LOCALITIES_COUNTRY_CODE,
  findBelgianLocality,
} from "@/lib/belgian-localities";
import {
  coverageStatus,
  distanceBetweenLocalitiesKm,
} from "@/lib/service-zone-distance";

export type ProviderSearchZoneCoverageInput = {
  countryCode: string;
  locality: string;
  postalCode: string | null;
  radiusKm: number;
  isActive?: boolean;
};

function validRadiusKm(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 100;
}

export function providerZonesCoverBelgianLocality(
  zones: readonly ProviderSearchZoneCoverageInput[],
  requestedLocalityInput: string
): boolean {
  if (!requestedLocalityInput.trim()) return true;

  const requestedLocality = findBelgianLocality(requestedLocalityInput);
  if (!requestedLocality) return false;

  return zones.some((zone) => {
    if (zone.isActive === false) return false;
    if (
      zone.countryCode.trim().toUpperCase() !==
      BELGIAN_LOCALITIES_COUNTRY_CODE
    ) {
      return false;
    }
    if (!validRadiusKm(zone.radiusKm)) return false;

    const zoneLocality =
      findBelgianLocality(zone.locality) ??
      findBelgianLocality(zone.postalCode ?? "");

    if (!zoneLocality) return false;

    const distanceKm = distanceBetweenLocalitiesKm(
      requestedLocality,
      zoneLocality
    );

    return coverageStatus(distanceKm, zone.radiusKm).covered;
  });
}
