import { cache } from "react";
import {
  getShelterBySlugInSilo,
  getShelterBySlugIncludingDuplicates,
  getCanonicalShelterForRedirect,
} from "@/lib/danmark-silo";
import {
  resolveShelterSiloWith,
  type ShelterSiloLookups,
} from "@/lib/shelter-silo-resolve";

// Ligger adskilt fra shelter-silo-resolve.ts, fordi react/cache kun findes i
// server-runtime'en: beslutningslogikken skal kunne unit-testes i jsdom.
const supabaseLookups: ShelterSiloLookups = {
  inSilo: getShelterBySlugInSilo,
  includingDuplicates: getShelterBySlugIncludingDuplicates,
  canonicalFor: getCanonicalShelterForRedirect,
};

/**
 * cache() gør at layout.tsx, generateMetadata og page.tsx deler ét opslag pr.
 * request. Uden den ville hver af dem ramme Supabase forfra (egress).
 */
export const resolveShelterSilo = cache(
  (regionSlug: string, municipalitySlug: string, shelterSlug: string) =>
    resolveShelterSiloWith(supabaseLookups, regionSlug, municipalitySlug, shelterSlug)
);
