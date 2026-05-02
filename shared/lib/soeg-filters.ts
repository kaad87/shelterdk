import type { Shelter } from "../types/shelter";

const REGION_ALIASES: Record<string, string> = {
  jylland: "Jylland",
  fyn: "Fyn",
  bornholm: "Bornholm",
  sjælland: "Sjælland og Øerne",
  sjaelland: "Sjælland og Øerne",
  "sjælland og øerne": "Sjælland og Øerne",
  "sjaelland og oeerne": "Sjælland og Øerne",
};

export function normalizeRegionFilter(
  region: string | null | undefined
): string | null {
  if (!region || !region.trim()) return null;
  const trimmed = region.trim();
  return REGION_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Filtrer shelters efter region.
 * Bruges i API og SoegContent for at sikre at kun shelters fra valgt region vises.
 */
export function filterSheltersByRegion(
  shelters: Shelter[],
  region: string | null | undefined
): Shelter[] {
  const normalizedRegion = normalizeRegionFilter(region);
  if (!normalizedRegion) return shelters;
  return shelters.filter(
    (s) => normalizeRegionFilter(s.region) === normalizedRegion
  );
}
