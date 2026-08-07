import type { BelgianLocality } from "@/lib/belgian-localities";

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceBetweenLocalitiesKm(
  first: Pick<BelgianLocality, "latitude" | "longitude">,
  second: Pick<BelgianLocality, "latitude" | "longitude">
): number {
  const latitudeDifference = toRadians(second.latitude - first.latitude);
  const longitudeDifference = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

export function coverageStatus(
  distanceKm: number,
  radiusKm: number
): {
  covered: boolean;
  remainingKm: number;
} {
  const safeRadius = Math.max(1, radiusKm);

  return {
    covered: distanceKm <= safeRadius,
    remainingKm:
      Math.round(Math.max(0, safeRadius - distanceKm) * 10) / 10,
  };
}
