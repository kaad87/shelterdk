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

/** Hent alle shelters (region, kommune, slug) med paginering – understøtter 2000+. */
async function getAllSheltersForSitemap(): Promise<
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
      .not("slug", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase error (sitemap shelters):", error);
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = [];

  // Static pages
  entries.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 1,
  });
  entries.push({
    url: `${BASE_URL}/om-os`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  });
  entries.push({
    url: `${BASE_URL}/kontakt`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  });
  entries.push({
    url: `${BASE_URL}/soeg`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  });
  entries.push({
    url: `${BASE_URL}/faq`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  });
  entries.push({
    url: `${BASE_URL}/blog`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  });
  entries.push({
    url: `${BASE_URL}/shelter-med-toilet`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  });
  entries.push({
    url: `${BASE_URL}/shelter-med-vand`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  });

  // Region pages: /danmark/[region]
  const regions = await getDistinctRegions();
  for (const region of regions) {
    const regionSlug = slugifySegment(region);
    if (!regionSlug) continue;
    entries.push({
      url: `${BASE_URL}/danmark/${regionSlug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    });
  }

  // Municipality pages: /danmark/[region]/[municipality]
  const pairs = await getRegionKommunePairs();
  for (const { region, kommune } of pairs) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug) continue;
    entries.push({
      url: `${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    });
  }

  // Shelter pages: /danmark/[region]/[municipality]/[slug]
  const shelters = await getAllSheltersForSitemap();
  for (const { region, kommune, slug } of shelters) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug || !slug) continue;
    entries.push({
      url: `${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    });
  }

  return entries;
}
