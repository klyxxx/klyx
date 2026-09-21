import {
  BELGIAN_LOCALITIES_COUNTRY_CODE,
  findBelgianLocality,
  normalizeLocality,
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

export type ProviderSearchLocationInput = {
  locality: string;
  countryCode?: string | null;
  postalCode?: string | null;
};

function validRadiusKm(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 100;
}

function normalizeCountryCode(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function exactTextCoverage(
  zone: ProviderSearchZoneCoverageInput,
  requested: ProviderSearchLocationInput
): boolean {
  const requestedLocality = normalizeLocality(requested.locality);
  const requestedPostalCode = (requested.postalCode ?? "").trim();
  const zoneLocality = normalizeLocality(zone.locality);
  const zonePostalCode = (zone.postalCode ?? "").trim();

  return Boolean(
    (requestedLocality && zoneLocality === requestedLocality) ||
      (requestedPostalCode && zonePostalCode === requestedPostalCode) ||
      (requestedLocality && zonePostalCode === requested.locality.trim())
  );
}

function belgianRadiusCoverage(
  zone: ProviderSearchZoneCoverageInput,
  requested: ProviderSearchLocationInput
): boolean {
  const zoneCountry = normalizeCountryCode(zone.countryCode);
  const requestedCountry = normalizeCountryCode(requested.countryCode);

  if (zoneCountry !== BELGIAN_LOCALITIES_COUNTRY_CODE) return false;
  if (
    requestedCountry &&
    requestedCountry !== BELGIAN_LOCALITIES_COUNTRY_CODE
  ) {
    return false;
  }

  const requestedLocality =
    findBelgianLocality(requested.locality) ??
    findBelgianLocality(requested.postalCode ?? "");
  if (!requestedLocality) return false;

  const zoneLocality =
    findBelgianLocality(zone.locality) ??
    findBelgianLocality(zone.postalCode ?? "");
  if (!zoneLocality) return false;

  const distanceKm = distanceBetweenLocalitiesKm(
    requestedLocality,
    zoneLocality
  );

  return coverageStatus(distanceKm, zone.radiusKm).covered;
}

/**
 * Universal provider-zone boundary.
 *
 * Any country can match exact canonical locality/postal data. Country-specific
 * geospatial resolvers may extend radius semantics, but they are adapters and
 * never permanent market allow-lists. Today Belgium has a coordinate adapter;
 * unknown geographies fail closed instead of being guessed.
 */
export function providerZonesCoverLocation(
  zones: readonly ProviderSearchZoneCoverageInput[],
  requested: ProviderSearchLocationInput
): boolean {
  if (!requested.locality.trim() && !(requested.postalCode ?? "").trim()) {
    return true;
  }

  const requestedCountry = normalizeCountryCode(requested.countryCode);

  return zones.some((zone) => {
    if (zone.isActive === false) return false;
    if (!validRadiusKm(zone.radiusKm)) return false;

    const zoneCountry = normalizeCountryCode(zone.countryCode);
    if (!zoneCountry) return false;
    if (requestedCountry && zoneCountry !== requestedCountry) return false;

    if (exactTextCoverage(zone, requested)) return true;
    return belgianRadiusCoverage(zone, requested);
  });
}

/**
 * Compatibility wrapper for older call sites/tests. It is not the universal
 * search authority.
 */
export function providerZonesCoverBelgianLocality(
  zones: readonly ProviderSearchZoneCoverageInput[],
  requestedLocalityInput: string
): boolean {
  return providerZonesCoverLocation(zones, {
    locality: requestedLocalityInput,
    countryCode: BELGIAN_LOCALITIES_COUNTRY_CODE,
  });
}
