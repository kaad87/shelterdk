import type { Shelter } from "@/types/shelter";

/**
 * Filtrer shelters efter region.
 * Bruges i API og SoegContent for at sikre at kun shelters fra valgt region vises.
 */
export function filterSheltersByRegion(
  shelters: Shelter[],
  region: string | null | undefined
): Shelter[] {
  if (!region || !region.trim()) return shelters;
  const r = region.trim();
  return shelters.filter((s) => (s.region || "").trim() === r);
}
