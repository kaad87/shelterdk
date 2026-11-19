import { slugifySegment } from "@/lib/slug";
import type { Shelter } from "@/types/shelter";

/** URL segment when kommune is null/empty in DB. */
export const NO_KOMMUNE_SLUG = "ukendt-kommune";

/**
 * Kanonisk detalje-URL for et shelter — den sti /shelter/[slug] selv 308'er til.
 * Region tom/"Danmark" → /shelter/[slug] (dér er den selv canonical), ellers
 * /danmark/[region]/[kommune]/[slug]. Skal følge getCanonicalShelterPath i
 * app/(site)/shelter/[slug]/page.tsx; ellers linker vi gennem en redirect.
 *
 * Ren funktion uden server-imports, så den også kan bruges i klient-
 * komponenter (ShelterCard).
 */
export function shelterHref(shelter: Pick<Shelter, "slug" | "region" | "kommune">): string {
  const region = (shelter.region ?? "").trim();
  if (!region || region.toLowerCase() === "danmark") return `/shelter/${shelter.slug}`;
  const kommune = shelter.kommune ? String(shelter.kommune).trim() : "";
  const m = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${slugifySegment(region)}/${m}/${shelter.slug}`;
}
