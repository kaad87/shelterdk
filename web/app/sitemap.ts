import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient } from "@/utils/supabase/server-public";
import {
  getDistinctRegions,
  getRegionKommunePairs,
  NO_KOMMUNE_SLUG,
} from "@/lib/danmark-silo";
import { slugifySegment } from "@/lib/slug";
import { getGuides } from "@/data/guides";
import { getBlogPosts } from "@/data/blog";
import { getFilterRegionCount } from "@/lib/fakta-db";
import { FILTER_CONFIGS, REGION_SLUGS, REGION_NAMES } from "@/lib/cross-page-config";
import type { CuratedRouteIndex } from "@/types/curated-route";

export const revalidate = 86400;

const BASE_URL = "https://shelterdk.dk";
const BATCH_SIZE = 1000;

type SitemapEntry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/soeg", changeFrequency: "daily", priority: 0.9 },
  { path: "/shelter-naer-mig", changeFrequency: "weekly", priority: 0.88 },
  { path: "/shelter-med-toilet", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-vand", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-hund", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-baalplads", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-strand", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-bruser", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-booking", changeFrequency: "weekly", priority: 0.85 },
  { path: "/omraade", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ruteplanner", changeFrequency: "monthly", priority: 0.7 },
  { path: "/handicapvenlige-shelters", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-til-cykeltur", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-naer-vand", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-til-familier", changeFrequency: "weekly", priority: 0.85 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.75 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.8 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/om-os", changeFrequency: "monthly", priority: 0.7 },
  { path: "/kontakt", changeFrequency: "monthly", priority: 0.7 },
  { path: "/vilkaar", changeFrequency: "monthly", priority: 0.5 },
  { path: "/turvenner", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tilbud", changeFrequency: "daily", priority: 0.7 },
  { path: "/annoncer-og-partnere", changeFrequency: "monthly", priority: 0.3 },
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

  // Fakta pages
  const FAKTA_PAGES = [
    "/fakta/shelters-i-danmark",
    "/fakta/shelters-med-faciliteter",
    "/fakta/bedste-shelters",
    "/fakta/gratis-shelters",
    "/fakta/shelters-i-nationalparker",
  ];
  for (const path of FAKTA_PAGES) {
    entries.push(entry(`${BASE_URL}${path}`, "weekly", 0.85));
  }

  // Cross pages (filter × region) — threshold per filter (matches generateStaticParams)
  for (const config of Object.values(FILTER_CONFIGS)) {
    for (const regionSlug of REGION_SLUGS) {
      const regionName = REGION_NAMES[regionSlug];
      if (!regionName) continue;
      const count = await getFilterRegionCount(config.filterKey, regionName);
      if (count >= config.minSheltersForRegion) {
        entries.push(entry(`${BASE_URL}${config.parentHref}/${regionSlug}`, "weekly", 0.7));
      }
    }
  }

  // Vandreruter: /ruteplanner/[slug]
  try {
    const routeIndexPath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    const routeIndex: CuratedRouteIndex[] = JSON.parse(fs.readFileSync(routeIndexPath, "utf-8"));
    for (const route of routeIndex) {
      entries.push(entry(`${BASE_URL}/ruteplanner/${route.slug}`, "monthly", 0.65));
    }
  } catch {
    // curated-routes-index.json not available at build time
  }

  // Regioner: dedikerede landingssider med kort
  const regions = await getDistinctRegions();
  for (const region of regions) {
    if (!region?.trim()) continue;
    const regionSlug = slugifySegment(region.trim());
    if (!regionSlug) continue;
    entries.push(entry(`${BASE_URL}/danmark/${regionSlug}`, "weekly", 0.8));
  }

  // Blog-posts (dynamisk fra data/blog.ts)
  const blogPosts = getBlogPosts();
  for (const post of blogPosts) {
    entries.push(entry(`${BASE_URL}/blog/${post.slug}`, "monthly", 0.65));
  }

  // Guide-sider
  const guides = getGuides();
  for (const guide of guides) {
    entries.push(entry(`${BASE_URL}/guides/${guide.slug}`, "monthly", 0.7));
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
