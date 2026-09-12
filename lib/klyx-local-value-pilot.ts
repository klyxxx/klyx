import { getKlyxCategory } from "@/lib/klyx-service-catalog";

export const KLYX_LOCAL_VALUE_PILOT = {
  key: "brussels-anneessens-furniture-assembly-v1",
  status: "prepared" as const,
  countryCode: "BE",
  city: "Bruxelles",
  zoneLabel: "Anneessens",
  categorySlug: "bricolage-reparation",
  serviceName: "Montage de meubles",
  serviceSlug: "montage-de-meubles",
  currency: "EUR",
  maxActiveProviders: 5,
  maxRealRequests: 20,
  minimumCompletedPaidMissionsForEconomicRead: 10,
  syntheticTransactionsAllowed: false,
  paidAcquisitionEnabled: false,
} as const;

export type KlyxLocalValuePilot = typeof KLYX_LOCAL_VALUE_PILOT;

export function getKlyxLocalPilotCategoryName(): string {
  return (
    getKlyxCategory(KLYX_LOCAL_VALUE_PILOT.categorySlug)?.name ??
    KLYX_LOCAL_VALUE_PILOT.categorySlug
  );
}
