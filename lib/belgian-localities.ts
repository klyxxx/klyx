// Reference geographique regionale KLYX.
export const BELGIAN_LOCALITIES_COUNTRY_CODE =
  "BE";

export type BelgianLocality = {
  name: string;
  postalCodes: string[];
  region: "Bruxelles" | "Wallonie" | "Flandre";
  latitude: number;
  longitude: number;
};

export const BELGIAN_LOCALITIES: BelgianLocality[] = [
  { name: "Bruxelles", postalCodes: ["1000"], region: "Bruxelles", latitude: 50.8466, longitude: 4.3528 },
  { name: "Laeken", postalCodes: ["1020"], region: "Bruxelles", latitude: 50.8778, longitude: 4.3550 },
  { name: "Schaerbeek", postalCodes: ["1030"], region: "Bruxelles", latitude: 50.8676, longitude: 4.3736 },
  { name: "Etterbeek", postalCodes: ["1040"], region: "Bruxelles", latitude: 50.8369, longitude: 4.3895 },
  { name: "Ixelles", postalCodes: ["1050"], region: "Bruxelles", latitude: 50.8333, longitude: 4.3667 },
  { name: "Saint-Gilles", postalCodes: ["1060"], region: "Bruxelles", latitude: 50.8267, longitude: 4.3456 },
  { name: "Anderlecht", postalCodes: ["1070"], region: "Bruxelles", latitude: 50.8362, longitude: 4.3092 },
  { name: "Molenbeek-Saint-Jean", postalCodes: ["1080"], region: "Bruxelles", latitude: 50.8548, longitude: 4.3242 },
  { name: "Koekelberg", postalCodes: ["1081"], region: "Bruxelles", latitude: 50.8600, longitude: 4.3310 },
  { name: "Berchem-Sainte-Agathe", postalCodes: ["1082"], region: "Bruxelles", latitude: 50.8640, longitude: 4.2940 },
  { name: "Ganshoren", postalCodes: ["1083"], region: "Bruxelles", latitude: 50.8700, longitude: 4.3060 },
  { name: "Jette", postalCodes: ["1090"], region: "Bruxelles", latitude: 50.8740, longitude: 4.3270 },
  { name: "Evere", postalCodes: ["1140"], region: "Bruxelles", latitude: 50.8744, longitude: 4.4034 },
  { name: "Woluwe-Saint-Pierre", postalCodes: ["1150"], region: "Bruxelles", latitude: 50.8370, longitude: 4.4270 },
  { name: "Auderghem", postalCodes: ["1160"], region: "Bruxelles", latitude: 50.8150, longitude: 4.4330 },
  { name: "Watermael-Boitsfort", postalCodes: ["1170"], region: "Bruxelles", latitude: 50.7990, longitude: 4.4170 },
  { name: "Uccle", postalCodes: ["1180"], region: "Bruxelles", latitude: 50.8010, longitude: 4.3370 },
  { name: "Forest", postalCodes: ["1190"], region: "Bruxelles", latitude: 50.8110, longitude: 4.3170 },
  { name: "Woluwe-Saint-Lambert", postalCodes: ["1200"], region: "Bruxelles", latitude: 50.8430, longitude: 4.4260 },
  { name: "Liège", postalCodes: ["4000", "4020"], region: "Wallonie", latitude: 50.6326, longitude: 5.5797 },
  { name: "Namur", postalCodes: ["5000"], region: "Wallonie", latitude: 50.4674, longitude: 4.8718 },
  { name: "Charleroi", postalCodes: ["6000"], region: "Wallonie", latitude: 50.4108, longitude: 4.4446 },
  { name: "Mons", postalCodes: ["7000"], region: "Wallonie", latitude: 50.4542, longitude: 3.9523 },
  { name: "Tournai", postalCodes: ["7500"], region: "Wallonie", latitude: 50.6053, longitude: 3.3878 },
  { name: "Anvers", postalCodes: ["2000"], region: "Flandre", latitude: 51.2194, longitude: 4.4025 },
  { name: "Gand", postalCodes: ["9000"], region: "Flandre", latitude: 51.0543, longitude: 3.7174 },
  { name: "Louvain", postalCodes: ["3000"], region: "Flandre", latitude: 50.8798, longitude: 4.7005 },
  { name: "Bruges", postalCodes: ["8000"], region: "Flandre", latitude: 51.2093, longitude: 3.2247 },
];

export function normalizeLocality(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBelgianLocality(value: string): BelgianLocality | null {
  const normalized = normalizeLocality(value);

  return (
    BELGIAN_LOCALITIES.find(
      (locality) =>
        normalizeLocality(locality.name) === normalized ||
        locality.postalCodes.includes(value.trim())
    ) ?? null
  );
}
