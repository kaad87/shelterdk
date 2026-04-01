export interface NationalParkDef {
  name: string;
  slug: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

export const NATIONAL_PARKS: NationalParkDef[] = [
  {
    name: "Nationalpark Thy",
    slug: "nationalpark-thy",
    bbox: { minLat: 56.62, maxLat: 57.18, minLon: 8.10, maxLon: 8.65 },
  },
  {
    name: "Nationalpark Mols Bjerge",
    slug: "nationalpark-mols-bjerge",
    bbox: { minLat: 56.15, maxLat: 56.30, minLon: 10.40, maxLon: 10.70 },
  },
  {
    name: "Nationalpark Vadehavet",
    slug: "nationalpark-vadehavet",
    bbox: { minLat: 54.90, maxLat: 55.45, minLon: 8.20, maxLon: 9.00 },
  },
  {
    name: "Nationalpark Skjoldungernes Land",
    slug: "nationalpark-skjoldungernes-land",
    bbox: { minLat: 55.58, maxLat: 55.78, minLon: 11.85, maxLon: 12.15 },
  },
  {
    name: "Nationalpark Kongernes Nordsjælland",
    slug: "nationalpark-kongernes-nordsjaelland",
    bbox: { minLat: 55.85, maxLat: 56.10, minLon: 12.15, maxLon: 12.55 },
  },
];

export function classifyShelterToParks(lat: number, lon: number): string[] {
  return NATIONAL_PARKS.filter(
    (p) =>
      lat >= p.bbox.minLat &&
      lat <= p.bbox.maxLat &&
      lon >= p.bbox.minLon &&
      lon <= p.bbox.maxLon
  ).map((p) => p.name);
}
