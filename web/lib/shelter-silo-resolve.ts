import {
  getShelterBySlugInSilo,
  getShelterBySlugIncludingDuplicates,
  getCanonicalShelterForRedirect,
  slugifySegment,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import type { Shelter } from "@/types/shelter";

/**
 * Hvad en shelter-URL under /danmark/<region>/<kommune>/<slug> skal ende som.
 *
 * HVORFOR EN SELVSTÆNDIG RESOLVER: beslutningen (vis / redirect / 404) skal
 * træffes UDEN FOR enhver Suspense-grænse. Kaldes notFound() eller redirect()
 * inde i en grænse, bliver fejlen fanget som en "errored suspense boundary"
 * (<template data-dgst="NEXT_NOT_FOUND">), skallen er allerede flushet, og
 * Next kan ikke længere sætte status: svaret bliver 200 med kun layoutet. Det
 * er præcis den soft-404 Google ser. Derfor bor beslutningen i segmentets
 * layout.tsx, som ikke længere har en loading.tsx over sig (se kommentaren
 * dér), og layout, generateMetadata og page.tsx læser det samme
 * cache()-delte resultat.
 */
export type ShelterSiloResolution =
  | { kind: "found"; shelter: Shelter; region: string | null; kommune: string | null }
  | { kind: "redirect"; destination: string }
  | { kind: "not-found" };

type SiloLookup = {
  shelter: Shelter | null;
  region: string | null;
  kommune: string | null;
};

export type ShelterSiloLookups = {
  inSilo(slug: string): Promise<SiloLookup>;
  includingDuplicates(slug: string): Promise<SiloLookup>;
  canonicalFor(
    duplicateOfId: string
  ): Promise<{ region: string; kommune: string | null; slug: string } | null>;
};

/** Kanonisk silo-path for et shelter. Kommune-less shelters bor på NO_KOMMUNE_SLUG. */
export function shelterSiloPath(
  region: string,
  kommune: string | null,
  slug: string
): string {
  const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${slugifySegment(region)}/${municipalitySlug}/${slug}`;
}

/** Ren beslutningslogik — tager opslagene ind, så den kan testes uden Supabase. */
export async function resolveShelterSiloWith(
  lookups: ShelterSiloLookups,
  regionSlug: string,
  municipalitySlug: string,
  shelterSlug: string
): Promise<ShelterSiloResolution> {
  const result = await lookups.inSilo(shelterSlug);

  if (!result.shelter) {
    // Slug'en kan være en dublet (duplicate_of_shelter_id sat af
    // dedupe_shelters_by_google_place.py). De URL'er var engang rigtige,
    // indekserede shelter-sider, så de skal 308'e til det kanoniske shelter —
    // ikke soft-404'e.
    const fallback = await lookups.includingDuplicates(shelterSlug);
    if (!fallback.shelter) return { kind: "not-found" };

    const dupId = (fallback.shelter as { duplicate_of_shelter_id?: string | null })
      .duplicate_of_shelter_id;
    if (dupId) {
      const canonical = await lookups.canonicalFor(dupId);
      if (canonical) {
        return {
          kind: "redirect",
          destination: shelterSiloPath(canonical.region, canonical.kommune, canonical.slug),
        };
      }
      // Dublet uden funden kanonisk – undgå loop, svar ærligt 404.
      return { kind: "not-found" };
    }

    // Ikke-dublet men uden for siloen: vis på /shelter/<slug> (har evt. ingen region).
    return { kind: "redirect", destination: `/shelter/${shelterSlug}` };
  }

  const { shelter, region, kommune } = result;
  const expectedRegionSlug = region ? slugifySegment(region) : null;
  const expectedMunicipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;

  if (
    expectedRegionSlug &&
    (regionSlug !== expectedRegionSlug || municipalitySlug !== expectedMunicipalitySlug)
  ) {
    return {
      kind: "redirect",
      destination: `/danmark/${expectedRegionSlug}/${expectedMunicipalitySlug}/${shelterSlug}`,
    };
  }

  return { kind: "found", shelter, region, kommune };
}
