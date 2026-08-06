export type BelgianLocality = {
  name: string;
  postalCodes: string[];
  region: "Bruxelles" | "Wallonie" | "Flandre";
};

export const BELGIAN_LOCALITIES: BelgianLocality[] = [
  {
    name: "Bruxelles",
    postalCodes: ["1000"],
    region: "Bruxelles",
  },
  {
    name: "Laeken",
    postalCodes: ["1020"],
    region: "Bruxelles",
  },
  {
    name: "Schaerbeek",
    postalCodes: ["1030"],
    region: "Bruxelles",
  },
  {
    name: "Etterbeek",
    postalCodes: ["1040"],
    region: "Bruxelles",
  },
  {
    name: "Ixelles",
    postalCodes: ["1050"],
    region: "Bruxelles",
  },
  {
    name: "Saint-Gilles",
    postalCodes: ["1060"],
    region: "Bruxelles",
  },
  {
    name: "Anderlecht",
    postalCodes: ["1070"],
    region: "Bruxelles",
  },
  {
    name: "Molenbeek-Saint-Jean",
    postalCodes: ["1080"],
    region: "Bruxelles",
  },
  {
    name: "Koekelberg",
    postalCodes: ["1081"],
    region: "Bruxelles",
  },
  {
    name: "Berchem-Sainte-Agathe",
    postalCodes: ["1082"],
    region: "Bruxelles",
  },
  {
    name: "Ganshoren",
    postalCodes: ["1083"],
    region: "Bruxelles",
  },
  {
    name: "Jette",
    postalCodes: ["1090"],
    region: "Bruxelles",
  },
  {
    name: "Evere",
    postalCodes: ["1140"],
    region: "Bruxelles",
  },
  {
    name: "Woluwe-Saint-Pierre",
    postalCodes: ["1150"],
    region: "Bruxelles",
  },
  {
    name: "Auderghem",
    postalCodes: ["1160"],
    region: "Bruxelles",
  },
  {
    name: "Watermael-Boitsfort",
    postalCodes: ["1170"],
    region: "Bruxelles",
  },
  {
    name: "Uccle",
    postalCodes: ["1180"],
    region: "Bruxelles",
  },
  {
    name: "Forest",
    postalCodes: ["1190"],
    region: "Bruxelles",
  },
  {
    name: "Woluwe-Saint-Lambert",
    postalCodes: ["1200"],
    region: "Bruxelles",
  },
  {
    name: "Liège",
    postalCodes: ["4000", "4020"],
    region: "Wallonie",
  },
  {
    name: "Namur",
    postalCodes: ["5000"],
    region: "Wallonie",
  },
  {
    name: "Charleroi",
    postalCodes: ["6000"],
    region: "Wallonie",
  },
  {
    name: "Mons",
    postalCodes: ["7000"],
    region: "Wallonie",
  },
  {
    name: "Tournai",
    postalCodes: ["7500"],
    region: "Wallonie",
  },
  {
    name: "Anvers",
    postalCodes: ["2000"],
    region: "Flandre",
  },
  {
    name: "Gand",
    postalCodes: ["9000"],
    region: "Flandre",
  },
  {
    name: "Louvain",
    postalCodes: ["3000"],
    region: "Flandre",
  },
  {
    name: "Bruges",
    postalCodes: ["8000"],
    region: "Flandre",
  },
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

export function findBelgianLocality(
  value: string
): BelgianLocality | null {
  const normalized = normalizeLocality(value);

  return (
    BELGIAN_LOCALITIES.find(
      (locality) =>
        normalizeLocality(locality.name) === normalized ||
        locality.postalCodes.includes(value.trim())
    ) ?? null
  );
}
