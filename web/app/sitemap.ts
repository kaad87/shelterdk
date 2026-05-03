import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";
import { getBlogCategories, getBlogPosts } from "@/data/blog";
import { getAllAreas } from "@/lib/area-db";
import { getFileModified, newestIsoDate } from "@/lib/content-dates";
import { FILTER_CONFIGS, REGION_NAMES, REGION_SLUGS } from "@/lib/cross-page-config";
import {
  getByLandingData,
  getDistinctByLandingPages,
  getDistinctRegions,
  getRegionKommunePairs,
  NO_KOMMUNE_SLUG,
  getSheltersByMunicipalityName,
  shouldRedirectMunicipalityToByPage,
} from "@/lib/danmark-silo";
import { getFilterRegionCount } from "@/lib/fakta-db";
import { getGuideCategories, getGuides } from "@/data/guides";
import { SEARCH_SYNONYMS } from "@/lib/search-synonyms";
import { slugifySegment } from "@/lib/slug";
import type { CuratedRouteIndex } from "@/types/curated-route";
import { createPublicClient } from "@/utils/supabase/server-public";

export const revalidate = 86400;

const BASE_URL = "https://shelterdk.dk";
const BATCH_SIZE = 1000;

type SitemapEntry = MetadataRoute.Sitemap[number];
type SitemapShelterMeta = {
  region: string | null;
  kommune: string | null;
  place: string | null;
  area_slug: string | null;
  updated_at?: string;
  created_at?: string;
};

const BY_LANDING_SEARCH_SYNONYM_KEYS: Partial<Record<string, string>> = {
  "København": "københavn",
};

async function getRedirectingMunicipalityNames(): Promise<Set<string>> {
  const pairs = await getRegionKommunePairs(2);
  const municipalityNames = [...new Set(pairs.map((pair) => pair.kommune).filter(Boolean))] as string[];
  const redirecting = new Set<string>();

  for (const municipalityName of municipalityNames) {
    const [municipalityShelters, byLanding] = await Promise.all([
      getSheltersByMunicipalityName(municipalityName),
      getByLandingData(municipalityName),
    ]);

    if (
      shouldRedirectMunicipalityToByPage(
        municipalityName,
        municipalityShelters,
        byLanding.shelters
      )
    ) {
      redirecting.add(municipalityName);
    }
  }

  return redirecting;
}

const STATIC_PAGES: Array<{
  path: string;
  source: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}> = [
  { path: "", source: "app/(site)/page.tsx", changeFrequency: "daily", priority: 1 },
  { path: "/danmark", source: "app/(site)/danmark/page.tsx", changeFrequency: "weekly", priority: 0.82 },
  { path: "/fakta", source: "app/(site)/fakta/page.tsx", changeFrequency: "weekly", priority: 0.74 },
  { path: "/shelter-naer-mig", source: "app/(site)/shelter-naer-mig/page.tsx", changeFrequency: "weekly", priority: 0.88 },
  { path: "/shelter-med-toilet", source: "app/(site)/shelter-med-toilet/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-vand", source: "app/(site)/shelter-med-vand/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-hund", source: "app/(site)/shelter-med-hund/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-baalplads", source: "app/(site)/shelter-med-baalplads/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-strand", source: "app/(site)/shelter-med-strand/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-med-bruser", source: "app/(site)/shelter-med-bruser/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-booking", source: "app/(site)/shelter-booking/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/by", source: "app/(site)/by/page.tsx", changeFrequency: "weekly", priority: 0.78 },
  { path: "/omraade", source: "app/(site)/omraade/page.tsx", changeFrequency: "weekly", priority: 0.8 },
  { path: "/ruteplanner", source: "app/(site)/ruteplanner/page.tsx", changeFrequency: "monthly", priority: 0.7 },
  { path: "/handicapvenlige-shelters", source: "app/(site)/handicapvenlige-shelters/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-til-cykeltur", source: "app/(site)/shelter-til-cykeltur/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-naer-vand", source: "app/(site)/shelter-naer-vand/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/shelter-til-familier", source: "app/(site)/shelter-til-familier/page.tsx", changeFrequency: "weekly", priority: 0.85 },
  { path: "/guides", source: "app/(site)/guides/page.tsx", changeFrequency: "weekly", priority: 0.75 },
  { path: "/faq", source: "app/(site)/faq/page.tsx", changeFrequency: "monthly", priority: 0.8 },
  { path: "/privacy", source: "app/(site)/privacy/page.tsx", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", source: "app/(site)/blog/page.tsx", changeFrequency: "weekly", priority: 0.7 },
  { path: "/om-os", source: "app/(site)/om-os/page.tsx", changeFrequency: "monthly", priority: 0.7 },
  { path: "/kontakt", source: "app/(site)/kontakt/page.tsx", changeFrequency: "monthly", priority: 0.7 },
  { path: "/vilkaar", source: "app/(site)/vilkaar/page.tsx", changeFrequency: "monthly", priority: 0.5 },
  { path: "/turvenner", source: "app/(site)/turvenner/page.tsx", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tilbud", source: "app/(site)/tilbud/page.tsx", changeFrequency: "daily", priority: 0.7 },
  { path: "/annoncer-og-partnere", source: "app/(site)/annoncer-og-partnere/page.tsx", changeFrequency: "monthly", priority: 0.3 },
];

const FAKTA_PAGES: Array<{ path: string; source: string }> = [
  { path: "/fakta/shelters-i-danmark", source: "app/(site)/fakta/shelters-i-danmark/page.tsx" },
  { path: "/fakta/shelters-med-faciliteter", source: "app/(site)/fakta/shelters-med-faciliteter/page.tsx" },
  { path: "/fakta/bedste-shelters", source: "app/(site)/fakta/bedste-shelters/page.tsx" },
  { path: "/fakta/gratis-shelters", source: "app/(site)/fakta/gratis-shelters/page.tsx" },
  { path: "/fakta/shelters-i-nationalparker", source: "app/(site)/fakta/shelters-i-nationalparker/page.tsx" },
];

function entry(
  url: string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number,
  lastModified?: string
): SitemapEntry {
  return {
    url,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  };
}

async function getSheltersWithRegion(): Promise<
  { region: string; kommune: string | null; slug: string; updated_at?: string; created_at?: string }[]
> {
  const supabase = createPublicClient();
  const out: {
    region: string;
    kommune: string | null;
    slug: string;
    updated_at?: string;
    created_at?: string;
  }[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("region, kommune, slug, updated_at, created_at")
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

    const rows =
      (data as {
        region: string;
        kommune: string | null;
        slug: string;
        updated_at?: string;
        created_at?: string;
      }[]) ?? [];

    for (const row of rows) {
      const region = (row.region || "").trim();
      const kommune =
        row.kommune && String(row.kommune).trim() ? String(row.kommune).trim() : null;
      const slug = (row.slug || "").trim();
      if (!region || !slug) continue;
      out.push({
        region,
        kommune,
        slug,
        updated_at: row.updated_at,
        created_at: row.created_at,
      });
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return out;
}

async function getSheltersWithoutRegion(): Promise<
  { slug: string; updated_at?: string; created_at?: string }[]
> {
  const supabase = createPublicClient();
  const out: { slug: string; updated_at?: string; created_at?: string }[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("region, slug, updated_at, created_at")
      .is("duplicate_of_shelter_id", null)
      .or("region.is.null,region.eq.,region.eq.Danmark")
      .not("slug", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase error (sitemap shelters without region):", error);
      break;
    }

    const rows =
      (data as {
        region: string | null;
        slug: string;
        updated_at?: string;
        created_at?: string;
      }[]) ?? [];

    for (const row of rows) {
      const slug = (row.slug || "").trim();
      if (!slug) continue;
      out.push({
        slug,
        updated_at: row.updated_at,
        created_at: row.created_at,
      });
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return out;
}

async function getShelterMetadata(): Promise<SitemapShelterMeta[]> {
  const supabase = createPublicClient();
  const out: SitemapShelterMeta[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("shelters")
      .select("region, kommune, place, area_slug, updated_at, created_at")
      .is("duplicate_of_shelter_id", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Supabase error (sitemap shelter metadata):", error);
      break;
    }

    const rows =
      (data as Array<{
        region: string | null;
        kommune: string | null;
        place: string | null;
        area_slug: string | null;
        updated_at?: string;
        created_at?: string;
      }>) ?? [];

    for (const row of rows) {
      out.push({
        region: row.region?.trim() || null,
        kommune: row.kommune?.trim() || null,
        place: row.place?.trim() || null,
        area_slug: row.area_slug?.trim() || null,
        updated_at: row.updated_at,
        created_at: row.created_at,
      });
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: SitemapEntry[] = [];
  const regionTemplateModified = getFileModified("app", "(site)", "danmark", "[region]", "page.tsx");
  const municipalityTemplateModified = getFileModified(
    "app",
    "(site)",
    "danmark",
    "[region]",
    "[municipality]",
    "page.tsx"
  );
  const shelterTemplateModified = getFileModified(
    "app",
    "(site)",
    "danmark",
    "[region]",
    "[municipality]",
    "[shelter_slug]",
    "page.tsx"
  );
  const standaloneShelterTemplateModified = getFileModified(
    "app",
    "(site)",
    "shelter",
    "[slug]",
    "page.tsx"
  );
  const byTemplateModified = getFileModified("app", "(site)", "by", "[by_slug]", "page.tsx");
  const areaTemplateModified = getFileModified("app", "(site)", "omraade", "[slug]", "page.tsx");
  const routeRegionTemplateModified = getFileModified("app", "(site)", "ruteplanner", "region", "[region]", "page.tsx");
  const shelterMetadata = await getShelterMetadata();
  const regionLastModified = new Map<string, string>();
  const municipalityLastModified = new Map<string, string>();
  const byPlaceLastModified = new Map<string, string>();
  const byMunicipalityLastModified = new Map<string, string>();
  const areaLastModified = new Map<string, string>();

  for (const shelter of shelterMetadata) {
    const shelterModified = newestIsoDate(shelter.updated_at, shelter.created_at);
    if (!shelterModified) continue;

    if (shelter.region) {
      regionLastModified.set(
        shelter.region,
        newestIsoDate(regionLastModified.get(shelter.region), shelterModified) ?? shelterModified
      );

      const municipalityKey = `${shelter.region}\n${shelter.kommune ?? ""}`;
      municipalityLastModified.set(
        municipalityKey,
        newestIsoDate(municipalityLastModified.get(municipalityKey), shelterModified) ??
          shelterModified
      );
    }

    if (shelter.area_slug) {
      areaLastModified.set(
        shelter.area_slug,
        newestIsoDate(areaLastModified.get(shelter.area_slug), shelterModified) ?? shelterModified
      );
    }

    if (shelter.place) {
      byPlaceLastModified.set(
        shelter.place,
        newestIsoDate(byPlaceLastModified.get(shelter.place), shelterModified) ?? shelterModified
      );
    }

    if (shelter.kommune) {
      byMunicipalityLastModified.set(
        shelter.kommune,
        newestIsoDate(byMunicipalityLastModified.get(shelter.kommune), shelterModified) ??
          shelterModified
      );
    }
  }

  for (const { path, source, changeFrequency, priority } of STATIC_PAGES) {
    entries.push(
      entry(
        `${BASE_URL}${path || "/"}`,
        changeFrequency,
        priority,
        newestIsoDate(getFileModified(...source.split("/")))
      )
    );
  }

  for (const { path: faktaPath, source } of FAKTA_PAGES) {
    entries.push(
      entry(
        `${BASE_URL}${faktaPath}`,
        "weekly",
        0.85,
        newestIsoDate(getFileModified(...source.split("/")))
      )
    );
  }

  for (const config of Object.values(FILTER_CONFIGS)) {
    for (const regionSlug of REGION_SLUGS) {
      const regionName = REGION_NAMES[regionSlug];
      if (!regionName) continue;
      const count = await getFilterRegionCount(config.filterKey, regionName);
      if (count >= config.minSheltersForRegion) {
        entries.push(
          entry(
            `${BASE_URL}${config.parentHref}/${regionSlug}`,
            "weekly",
            0.7,
            newestIsoDate(
              getFileModified(
                "app",
                "(site)",
                config.parentHref.replace(/^\//, ""),
                "[region]",
                "page.tsx"
              )
            )
          )
        );
      }
    }
  }

  try {
    const routeIndexPath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    const routeIndex: CuratedRouteIndex[] = JSON.parse(fs.readFileSync(routeIndexPath, "utf-8"));
    const routesPageModified = getFileModified("app", "(site)", "ruteplanner", "[slug]", "page.tsx");
    const routeIndexModified = fs.statSync(routeIndexPath).mtime;
    const routeRegions = [...new Set(routeIndex.map((route) => route.region))];
    for (const region of routeRegions) {
      const regionSlug = slugifySegment(region);
      if (!regionSlug) continue;
      entries.push(
        entry(
          `${BASE_URL}/ruteplanner/region/${regionSlug}`,
          "monthly",
          0.62,
          newestIsoDate(routeRegionTemplateModified, routeIndexModified)
        )
      );
    }
    for (const route of routeIndex) {
      entries.push(
        entry(
          `${BASE_URL}/ruteplanner/${route.slug}`,
          "monthly",
          0.65,
          newestIsoDate(routesPageModified, routeIndexModified)
        )
      );
    }
  } catch {
    // curated-routes-index.json not available at build time
  }

  const regions = await getDistinctRegions();
  for (const region of regions) {
    if (!region?.trim()) continue;
    const regionSlug = slugifySegment(region.trim());
    if (!regionSlug) continue;
    entries.push(
      entry(
        `${BASE_URL}/danmark/${regionSlug}`,
        "weekly",
        0.8,
        newestIsoDate(regionLastModified.get(region.trim()), regionTemplateModified)
      )
    );
  }

  const blogPosts = getBlogPosts();
  for (const post of blogPosts) {
    entries.push(entry(`${BASE_URL}/blog/${post.slug}`, "monthly", 0.65, newestIsoDate(post.date)));
  }

  for (const category of getBlogCategories()) {
    const categoryPosts = blogPosts.filter((post) => post.category === category);
    entries.push(
      entry(
        `${BASE_URL}/blog/kategori/${slugifySegment(category)}`,
        "weekly",
        0.6,
        newestIsoDate(...categoryPosts.map((post) => post.date))
      )
    );
  }

  const guides = getGuides();
  for (const guide of guides) {
    entries.push(
      entry(`${BASE_URL}/guides/${guide.slug}`, "monthly", 0.7, newestIsoDate(guide.updatedAt))
    );
  }

  for (const category of getGuideCategories()) {
    const categoryGuides = guides.filter((guide) => guide.category === category);
    entries.push(
      entry(
        `${BASE_URL}/guides/kategori/${slugifySegment(category)}`,
        "weekly",
        0.65,
        newestIsoDate(...categoryGuides.map((guide) => guide.updatedAt))
      )
    );
  }

  const areas = await getAllAreas();
  for (const area of areas) {
    entries.push(
      entry(
        `${BASE_URL}/omraade/${area.slug}`,
        "weekly",
        0.72,
        newestIsoDate(areaLastModified.get(area.slug), areaTemplateModified)
      )
    );
  }

  const [pairs, redirectingMunicipalities] = await Promise.all([
    getRegionKommunePairs(2),
    getRedirectingMunicipalityNames(),
  ]);
  for (const { region, kommune } of pairs) {
    if (kommune && redirectingMunicipalities.has(kommune)) continue;
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug) continue;
    const municipalityKey = `${region}\n${kommune ?? ""}`;
    entries.push(
      entry(
        `${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}`,
        "weekly",
        0.75,
        newestIsoDate(
          municipalityLastModified.get(municipalityKey),
          municipalityTemplateModified
        )
      )
    );
  }

  const sheltersWithRegion = await getSheltersWithRegion();
  for (const { region, kommune, slug, updated_at, created_at } of sheltersWithRegion) {
    const regionSlug = slugifySegment(region);
    const municipalitySlug = kommune ? slugifySegment(kommune) : NO_KOMMUNE_SLUG;
    if (!regionSlug || !municipalitySlug || !slug) continue;
    entries.push(
      entry(
        `${BASE_URL}/danmark/${regionSlug}/${municipalitySlug}/${slug}`,
        "weekly",
        0.6,
        newestIsoDate(updated_at, created_at, shelterTemplateModified)
      )
    );
  }

  const slugsWithoutRegion = await getSheltersWithoutRegion();
  for (const { slug, updated_at, created_at } of slugsWithoutRegion) {
    entries.push(
      entry(
        `${BASE_URL}/shelter/${slug}`,
        "weekly",
        0.6,
        newestIsoDate(updated_at, created_at, standaloneShelterTemplateModified)
      )
    );
  }

  const places = await getDistinctByLandingPages(1);
  for (const { place } of places) {
    const bySlug = slugifySegment(place);
    if (!bySlug) continue;
    const synonymKey = BY_LANDING_SEARCH_SYNONYM_KEYS[place];
    const synonymDates = (synonymKey ? SEARCH_SYNONYMS[synonymKey] ?? [] : []).map((term) =>
      byMunicipalityLastModified.get(term)
    );
    const landingLastModified = newestIsoDate(
      byPlaceLastModified.get(place),
      byMunicipalityLastModified.get(place),
      ...synonymDates
    );
    entries.push(
      entry(
        `${BASE_URL}/by/${bySlug}`,
        "weekly",
        0.7,
        newestIsoDate(landingLastModified, byTemplateModified)
      )
    );
  }

  return entries;
}
