import type { MetadataRoute } from "next";
import { createPublicClient } from "@/utils/supabase/server-public";
import {
  getDistinctRegions,
  getRegionKommunePairs,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { slugifySegment } from "@/lib/slug";

const BASE_URL = "https://shelterdk.dk";
const BATCH_SIZE = 1000;

type SitemapEntry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/soeg", changeFrequency: "weekly", priority: 0.9 },
  { path: "/shelter-naer-mig", changeFrequency: "weekly", priority: 0.88 },
  { path: "/shelter-med-toilet", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-vand", changeFrequency: "weekly", priority: 0.85 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.75 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.8 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/om-os", changeFrequency: "monthly", priority: 0.7 },
  { path: "/kontakt", changeFrequency: "monthly", priority: 0.7 },
];

function entry(
  url: string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number
): SitemapEntry {
  return { url, lastModified: new Date(), changeFrequency, priority };
}

/** Shelters med region (Jylland, Fyn, Sjælland) – bruger /danmark/[region]/[kommune]/[slug]. */
async function getSheltersWithRegion(): Promise<
  { region: string; kommune: string | null; slug: string }[]
> {
  const supabase = createPublicClient();
  const out: { region: string; kommune: string | null; slug: string }[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("region, kommune, slug")
      .is("duplicate_of_shelter_id", null)
      .not("region", "is", null)
      .neq("region", "")
      .neq("region", "Danmark")
      .not("slug", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase error (sitemap shelters with region):", error);
      break;
    }

    const rows = (data as { region: string; kommune: string | null; slug: string }[]) ?? [];
    for (const row of rows) {
      const region = (row.region || "").trim();
      const kommune =
        row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
      const slug = (row.slug || "").trim();
      if (!region || !slug) continue;
      out.push({ region, kommune, slug });
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return out;
}

/** Shelters uden region eller med region "Danmark" – bruger /shelter/[slug]. */
async function getSheltersWithoutRegion(): Promise<string[]> {
  const supabase = createPublicClient();
  const out: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("region, slug")
      .is("duplicate_of_shelter_id", null)
      .or("region.is.null,region.eq.,region.eq.Danmark")
      .not("slug", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase error (sitemap shelters without region):", error);
      break;
    }

    const rows = (data as { region: string | null; slug: string }[]) ?? [];
    for (const row of rows) {
      const slug = (row.slug || "").trim();
      if (!slug) continue;
      out.push(slug);
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = [];

  // Statiske sider
  for (const { path, changeFrequency, priority } of STATIC_PAGES) {
    entries.push(entry(`${BASE_URL}${path || "/"}`, changeFrequency, priority));
  }

  // Regioner: peger nu på søgesiden med kort (/danmark/X redirecter til /soeg?region=X)
  const regions = await getDistinctRegions();
  for (const region of regions) {
    if (!region?.trim()) continue;
    entries.push(
      entry(`${BASE_URL}/soeg?region=${encodeURIComponent(region.trim())}`, "weekly", 0.8)
    );
  }

  // Kommuner: /danmark/[region]/[municipality] – kun kommuner med 2+ shelters (matcher generateStaticParams)
  const pairs = await getRegionKommunePairs(2);
  for (const { region, kommune } of pairs) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug) continue;
    entries.push(
      entry(`${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}`, "weekly", 0.75)
    );
  }

  // Shelters i regioner: /danmark/[region]/[municipality]/[slug]
  const sheltersWithRegion = await getSheltersWithRegion();
  for (const { region, kommune, slug } of sheltersWithRegion) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug || !slug) continue;
    entries.push(
      entry(
        `${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}/${slug}`,
        "weekly",
        0.6
      )
    );
  }

  // Shelters uden region: /shelter/[slug]
  const slugsWithoutRegion = await getSheltersWithoutRegion();
  for (const slug of slugsWithoutRegion) {
    entries.push(entry(`${BASE_URL}/shelter/${slug}`, "weekly", 0.6));
  }

  return entries;
}
