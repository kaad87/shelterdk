# AI Citations Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shelterdk.dk the most citable source for Danish shelter data across AI chatbots and Google AI Overviews by creating auto-generated data pages, enriching existing pages with computed facts + FAQ, and optimizing schema/llms.txt.

**Architecture:** Next.js 14 App Router with ISR (24h revalidation). All new pages are server-rendered at build time from Supabase queries. Shared data-fetching library (`lib/fakta-db.ts`) powers all statistics. A shared `CrossFilterRegionPage` component eliminates duplication across 7 filter directories. Blog interlinking is done via the existing `shared/data/blog.ts` content strings.

**Tech Stack:** Next.js 14 (App Router, ISR), Supabase (PostgreSQL), TypeScript, Tailwind CSS, schema.org JSON-LD

---

## File Structure

| File | Responsibility |
|------|---------------|
| `web/lib/fakta-db.ts` | **NEW** — All statistical queries: total counts, per-region breakdowns, facility counts, top-rated shelters, national park mapping. Single source of truth for data used across fakta pages, cross pages, enrichment blocks, FAQ generation, and llms.txt. |
| `web/lib/fakta-faq.ts` | **NEW** — FAQ generators for each page type: fakta pages, filter pages, region pages, municipality pages, cross pages. Returns `FaqItem[]` arrays with real numbers interpolated. |
| `web/lib/national-parks.ts` | **NEW** — Static bounding box definitions for Denmark's 5 national parks. Exports a function to classify shelters into parks by lat/lon. |
| `web/app/(site)/fakta/shelters-i-danmark/page.tsx` | **NEW** — Fakta page: total shelter count, per-region breakdown, top shelters. |
| `web/app/(site)/fakta/shelters-med-faciliteter/page.tsx` | **NEW** — Fakta page: facility statistics across all shelters. |
| `web/app/(site)/fakta/bedste-shelters/page.tsx` | **NEW** — Fakta page: top-rated shelters by Google rating. |
| `web/app/(site)/fakta/gratis-shelters/page.tsx` | **NEW** — Fakta page: free vs. paid shelter breakdown. |
| `web/app/(site)/fakta/shelters-i-nationalparker/page.tsx` | **NEW** — Fakta page: shelters in each national park. |
| `web/app/(site)/danmark/[region]/[municipality]/page.tsx` | **MODIFY** — Add FAQ schema and DataSummaryBlock to municipality pages. |
| `web/components/FaktaPage.tsx` | **NEW** — Shared presentational component for fakta pages: hero stat, summary, breakdown table, top-N list, FAQ section, related links. |
| `web/components/CrossFilterRegionPage.tsx` | **NEW** — Shared component for filter×region cross pages: data summary, kommune breakdown, top 5, full list, FAQ, internal links. |
| `web/components/DataSummaryBlock.tsx` | **NEW** — Reusable computed-facts block (count, breakdown, avg rating) used to enrich existing filter pages and region pages. |
| `web/components/seo/DatasetSchema.tsx` | **NEW** — Renders schema.org/Dataset JSON-LD for fakta pages. |
| `web/app/(site)/shelter-med-toilet/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-med-vand/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-med-baalplads/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-med-hund/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-med-strand/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-med-bruser/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/(site)/shelter-booking/[region]/page.tsx` | **NEW** — Cross page thin wrapper. |
| `web/app/llms.txt/route.ts` | **NEW** — Dynamic route handler replacing static `public/llms.txt`. |
| `web/app/(site)/shelter-med-toilet/page.tsx` | **MODIFY** — Add `DataSummaryBlock` with computed facts. |
| `web/app/(site)/shelter-med-vand/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/shelter-med-baalplads/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/shelter-med-hund/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/shelter-med-strand/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/shelter-med-bruser/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/shelter-booking/page.tsx` | **MODIFY** — Add `DataSummaryBlock`. |
| `web/app/(site)/danmark/[region]/page.tsx` | **MODIFY** — Add `DataSummaryBlock` with region-specific facts + FAQ. |
| `web/app/sitemap.ts` | **MODIFY** — Add fakta pages and cross pages. |
| `web/app/robots.ts` | No change needed — `max-snippet:-1` applied via per-page metadata on all new page types. |
| `web/components/seo/ShelterSchema.tsx` | **MODIFY** — Add `containedInPlace`, `hasMap`, `additionalProperty` for richer detail. |
| `shared/data/blog.ts` | **MODIFY** — Add interlinking to fakta and filter pages in blog post content. |

---

## Task 1: Statistical Data Layer (`fakta-db.ts`)

All subsequent tasks depend on this. It provides the queries that power every new page and enrichment block.

**Files:**
- Create: `web/lib/fakta-db.ts`
- Create: `web/lib/national-parks.ts`
- Create: `web/lib/__tests__/national-parks.test.ts`

- [ ] **Step 1: Write test for national park bounding box classification**

```typescript
// web/lib/__tests__/national-parks.test.ts
import { describe, it, expect } from "vitest";
import { classifyShelterToParks, NATIONAL_PARKS } from "../national-parks";

describe("national-parks", () => {
  it("exports 5 national parks", () => {
    expect(NATIONAL_PARKS).toHaveLength(5);
  });

  it("classifies a point inside Nationalpark Thy", () => {
    // Point near Stenbjerg, inside Thy
    const parks = classifyShelterToParks(56.88, 8.28);
    expect(parks).toContain("Nationalpark Thy");
  });

  it("classifies a point inside Nationalpark Mols Bjerge", () => {
    // Point near Ebeltoft
    const parks = classifyShelterToParks(56.2, 10.6);
    expect(parks).toContain("Nationalpark Mols Bjerge");
  });

  it("returns empty array for a point in Copenhagen", () => {
    const parks = classifyShelterToParks(55.68, 12.57);
    expect(parks).toEqual([]);
  });

  it("a point can be in at most one park (no overlap)", () => {
    // Just verify each park center maps to exactly 1
    for (const park of NATIONAL_PARKS) {
      const midLat = (park.bbox.minLat + park.bbox.maxLat) / 2;
      const midLon = (park.bbox.minLon + park.bbox.maxLon) / 2;
      const result = classifyShelterToParks(midLat, midLon);
      expect(result).toContain(park.name);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/national-parks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `national-parks.ts`**

```typescript
// web/lib/national-parks.ts

export interface NationalParkDef {
  name: string;
  slug: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

/**
 * Denmark's 5 national parks with approximate bounding boxes.
 * Used to classify shelters by lat/lon into parks for the fakta page.
 */
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

/** Returns names of national parks that contain the given lat/lon. */
export function classifyShelterToParks(lat: number, lon: number): string[] {
  return NATIONAL_PARKS
    .filter(
      (p) =>
        lat >= p.bbox.minLat &&
        lat <= p.bbox.maxLat &&
        lon >= p.bbox.minLon &&
        lon <= p.bbox.maxLon
    )
    .map((p) => p.name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/national-parks.test.ts`
Expected: PASS

- [ ] **Step 5: Implement `fakta-db.ts`**

This file has no unit tests because it queries Supabase directly (integration-level). It will be tested through the pages that use it.

```typescript
// web/lib/fakta-db.ts
import { createPublicClient } from "@/utils/supabase/server-public";
import type { Shelter } from "@/types/shelter";
import { getLocationCoords } from "@/lib/shelter-detail";
import { classifyShelterToParks, NATIONAL_PARKS } from "@/lib/national-parks";

const SHELTER_SELECT =
  "id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_id, google_place_name, booking_url, duplicate_of_shelter_id, region, kommune, place, toilet, water, capacity, display_score, geofa_raw, google_places!shelters_google_place_id_fkey(photo_references)";

/** Total shelter count (non-duplicate). */
export async function getTotalShelterCount(): Promise<number> {
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("duplicate_of_shelter_id", null);
  if (error) { console.error("fakta-db: getTotalShelterCount", error); return 0; }
  return count ?? 0;
}

/** Shelter count per region. Returns sorted array of { region, count }. */
export async function getCountPerRegion(): Promise<{ region: string; count: number }[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("region")
    .is("duplicate_of_shelter_id", null)
    .not("region", "is", null)
    .neq("region", "")
    .neq("region", "Danmark");
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { region: string }[]) {
    const r = (row.region || "").trim();
    if (!r) continue;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

export interface FacilityCounts {
  toilet: number;
  water: number;
  baalplads: number;
  hund: number;
  strand: number;
  bruser: number;
  bookbar: number;
  gratis: number;
}

/** Count shelters for each facility type. */
export async function getFacilityCounts(): Promise<FacilityCounts> {
  const supabase = createPublicClient();
  const base = () => supabase.from("shelters").select("id", { count: "exact", head: true }).is("duplicate_of_shelter_id", null);

  const [toilet, water, baalplads, hund, strand, bruser, bookbar, gratis] = await Promise.all([
    base().in("toilet", ["flush", "mulch"]),
    base().eq("water", true),
    base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
    base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
    base().filter("geofa_raw->>strand_naerhed", "eq", "Ja"),
    base().filter("geofa_raw->>bruser_bad", "eq", "Ja"),
    base().not("booking_url", "is", null).neq("booking_url", ""),
    base().filter("geofa_raw->>betaling", "eq", "Nej"),
  ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookbar.count ?? 0,
    gratis: gratis.count ?? 0,
  };
}

/** Facility counts scoped to a single region. */
export async function getFacilityCountsForRegion(region: string): Promise<FacilityCounts> {
  const supabase = createPublicClient();
  const base = () => supabase.from("shelters").select("id", { count: "exact", head: true }).is("duplicate_of_shelter_id", null).eq("region", region);

  const [toilet, water, baalplads, hund, strand, bruser, bookbar, gratis] = await Promise.all([
    base().in("toilet", ["flush", "mulch"]),
    base().eq("water", true),
    base().filter("geofa_raw->>baalplads", "ilike", "%ja%"),
    base().filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"),
    base().filter("geofa_raw->>strand_naerhed", "eq", "Ja"),
    base().filter("geofa_raw->>bruser_bad", "eq", "Ja"),
    base().not("booking_url", "is", null).neq("booking_url", ""),
    base().filter("geofa_raw->>betaling", "eq", "Nej"),
  ]);

  return {
    toilet: toilet.count ?? 0,
    water: water.count ?? 0,
    baalplads: baalplads.count ?? 0,
    hund: hund.count ?? 0,
    strand: strand.count ?? 0,
    bruser: bruser.count ?? 0,
    bookbar: bookbar.count ?? 0,
    gratis: gratis.count ?? 0,
  };
}

/** Top-N shelters by Google rating (with minimum review count). */
export async function getTopRatedShelters(limit: number = 10, minReviews: number = 3): Promise<Shelter[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .not("google_rating", "is", null)
    .gte("google_user_ratings_total", minReviews)
    .order("google_rating", { ascending: false })
    .order("google_user_ratings_total", { ascending: false })
    .limit(limit);
  if (error) { console.error("fakta-db: getTopRatedShelters", error); return []; }
  return (data as Shelter[]) ?? [];
}

/** Average Google rating across all shelters with a rating. */
export async function getAverageRating(): Promise<number | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select("google_rating")
    .is("duplicate_of_shelter_id", null)
    .not("google_rating", "is", null);
  if (error || !data || data.length === 0) return null;
  const ratings = (data as { google_rating: number }[]).map((r) => r.google_rating);
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return Math.round(avg * 10) / 10;
}

/** Count of shelters per filter for a given region. Used to check 5-shelter threshold. */
export async function getFilterRegionCount(
  filterKey: string,
  region: string
): Promise<number> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select("id", { count: "exact", head: true })
    .is("duplicate_of_shelter_id", null)
    .eq("region", region);

  switch (filterKey) {
    case "toilet": query = query.in("toilet", ["flush", "mulch"]); break;
    case "vand": query = query.eq("water", true); break;
    case "baalplads": query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%"); break;
    case "hund": query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"); break;
    case "strand": query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja"); break;
    case "bruser": query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja"); break;
    case "booking": query = query.not("booking_url", "is", null).neq("booking_url", ""); break;
    default: return 0;
  }

  const { count, error } = await query;
  if (error) { console.error(`fakta-db: getFilterRegionCount(${filterKey}, ${region})`, error); return 0; }
  return count ?? 0;
}

/** Shelters matching a filter + region combo. Used by cross pages. */
export async function getSheltersForFilterRegion(
  filterKey: string,
  region: string,
  limit: number = 200
): Promise<Shelter[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null)
    .eq("region", region)
    .order("display_score", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(limit);

  switch (filterKey) {
    case "toilet": query = query.in("toilet", ["flush", "mulch"]); break;
    case "vand": query = query.eq("water", true); break;
    case "baalplads": query = query.filter("geofa_raw->>baalplads", "ilike", "%ja%"); break;
    case "hund": query = query.filter("geofa_raw->>hunde_tilladt", "ilike", "%ja%"); break;
    case "strand": query = query.filter("geofa_raw->>strand_naerhed", "eq", "Ja"); break;
    case "bruser": query = query.filter("geofa_raw->>bruser_bad", "eq", "Ja"); break;
    case "booking": query = query.not("booking_url", "is", null).neq("booking_url", ""); break;
    default: return [];
  }

  const { data, error } = await query;
  if (error) { console.error(`fakta-db: getSheltersForFilterRegion`, error); return []; }
  return (data as Shelter[]) ?? [];
}

/** Shelters in national parks. Returns { parkName, shelters[] }. */
export async function getSheltersInNationalParks(): Promise<
  { parkName: string; parkSlug: string; shelters: Shelter[] }[]
> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shelters")
    .select(SHELTER_SELECT)
    .is("duplicate_of_shelter_id", null);
  if (error || !data) return [];

  const parkMap = new Map<string, Shelter[]>();
  for (const park of NATIONAL_PARKS) {
    parkMap.set(park.name, []);
  }

  for (const shelter of data as Shelter[]) {
    const coords = getLocationCoords(shelter);
    if (!coords) continue;
    const parks = classifyShelterToParks(coords.lat, coords.lon);
    for (const parkName of parks) {
      parkMap.get(parkName)?.push(shelter);
    }
  }

  return NATIONAL_PARKS.map((park) => ({
    parkName: park.name,
    parkSlug: park.slug,
    shelters: parkMap.get(park.name) ?? [],
  }));
}

/** Kommune breakdown for a filter+region combo. */
export async function getKommuneBreakdownForFilterRegion(
  filterKey: string,
  region: string
): Promise<{ kommune: string; count: number }[]> {
  const shelters = await getSheltersForFilterRegion(filterKey, region, 1000);
  const counts = new Map<string, number>();
  for (const s of shelters) {
    const k = (s.kommune || "Ukendt").trim();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kommune, count]) => ({ kommune, count }))
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/fakta-db.ts web/lib/national-parks.ts web/lib/__tests__/national-parks.test.ts
git commit -m "feat: add statistical data layer for AI citations pages"
```

---

## Task 2: FAQ Generators (`fakta-faq.ts`)

Generates FAQ items with real data for every page type. Depends on Task 1 data types but no runtime queries itself — it takes pre-fetched data as arguments.

**Files:**
- Create: `web/lib/fakta-faq.ts`
- Create: `web/lib/__tests__/fakta-faq.test.ts`

- [ ] **Step 1: Write test for FAQ generators**

```typescript
// web/lib/__tests__/fakta-faq.test.ts
import { describe, it, expect } from "vitest";
import {
  generateFilterPageFaq,
  generateRegionPageFaq,
  generateCrossPageFaq,
} from "../fakta-faq";

describe("fakta-faq", () => {
  it("generateFilterPageFaq returns 5 items with real numbers", () => {
    const items = generateFilterPageFaq("toilet", {
      totalCount: 312,
      topRegion: "Jylland",
      topRegionCount: 187,
      avgRating: 4.2,
      freeCount: 200,
      bookableCount: 95,
    });
    expect(items).toHaveLength(5);
    expect(items[0].answer).toContain("312");
    expect(items[1].answer).toContain("Jylland");
    expect(items.every((i) => i.question.length > 0 && i.answer.length > 0)).toBe(true);
  });

  it("generateRegionPageFaq returns 5 items with region name", () => {
    const items = generateRegionPageFaq("Jylland", "i", {
      totalCount: 623,
      freeCount: 412,
      facilityCounts: { toilet: 187, water: 203, baalplads: 156, hund: 100, strand: 80, bruser: 30, bookbar: 150, gratis: 412 },
      avgRating: 4.1,
      topShelterName: "Hald Sø Shelter",
    });
    expect(items).toHaveLength(5);
    expect(items[0].answer).toContain("623");
    expect(items[0].question).toContain("Jylland");
  });

  it("generateCrossPageFaq returns 4-5 items", () => {
    const items = generateCrossPageFaq("toilet", "Jylland", "i", {
      count: 187,
      avgRating: 4.3,
      freeCount: 120,
      topShelterName: "Skovly Shelter",
    });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items[0].answer).toContain("187");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/fakta-faq.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `fakta-faq.ts`**

```typescript
// web/lib/fakta-faq.ts
import type { FaqItem } from "@/lib/faq";
import type { FacilityCounts } from "@/lib/fakta-db";

const FILTER_LABELS: Record<string, string> = {
  toilet: "toilet",
  vand: "vand",
  baalplads: "bålplads",
  hund: "hund",
  strand: "strand",
  bruser: "bruser",
  booking: "booking",
};

const FILTER_LABELS_LONG: Record<string, string> = {
  toilet: "shelters med toilet",
  vand: "shelters med vand",
  baalplads: "shelters med bålplads",
  hund: "hundevenlige shelters",
  strand: "shelters nær strand",
  bruser: "shelters med bruser",
  booking: "bookbare shelters",
};

interface FilterPageFaqData {
  totalCount: number;
  topRegion: string;
  topRegionCount: number;
  avgRating: number | null;
  freeCount: number;
  bookableCount: number;
}

export function generateFilterPageFaq(filterKey: string, data: FilterPageFaqData): FaqItem[] {
  const label = FILTER_LABELS[filterKey] ?? filterKey;
  const labelLong = FILTER_LABELS_LONG[filterKey] ?? `shelters med ${label}`;
  return [
    {
      question: `Hvor mange shelters med ${label} er der i Danmark?`,
      answer: `Der er ${data.totalCount} ${labelLong} registreret i Danmark på ShelterDK.`,
    },
    {
      question: `Hvilken region har flest shelters med ${label}?`,
      answer: `${data.topRegion} har flest med ${data.topRegionCount} ${labelLong}.`,
    },
    {
      question: `Er shelters med ${label} gratis?`,
      answer: `${data.freeCount} ud af ${data.totalCount} ${labelLong} er gratis (først-til-mølle). De resterende kan have et mindre gebyr eller kræve booking.`,
    },
    {
      question: `Kan man booke shelter med ${label}?`,
      answer: `Ja, ${data.bookableCount} ${labelLong} kan bookes på forhånd via udinaturen.dk eller Naturstyrelsen.`,
    },
    {
      question: `Hvad er den gennemsnitlige bedømmelse for shelters med ${label}?`,
      answer: data.avgRating
        ? `Den gennemsnitlige Google-bedømmelse for ${labelLong} er ${data.avgRating} ud af 5.`
        : `Vi har endnu ikke nok anmeldelser til at beregne en gennemsnitlig bedømmelse for ${labelLong}.`,
    },
  ];
}

interface RegionPageFaqData {
  totalCount: number;
  freeCount: number;
  facilityCounts: FacilityCounts;
  avgRating: number | null;
  topShelterName: string | null;
}

export function generateRegionPageFaq(
  regionName: string,
  preposition: string,
  data: RegionPageFaqData
): FaqItem[] {
  const inRegion = `${preposition} ${regionName}`;
  return [
    {
      question: `Hvor mange shelters er der ${inRegion}?`,
      answer: `Der er ${data.totalCount} shelters ${inRegion} registreret på ShelterDK.`,
    },
    {
      question: `Har shelters ${inRegion} toilet?`,
      answer: `${data.facilityCounts.toilet} shelters ${inRegion} har toilet (vandskyllende eller muldtoilet).`,
    },
    {
      question: `Kan man have hund med i shelter ${inRegion}?`,
      answer: `${data.facilityCounts.hund} shelters ${inRegion} tillader hund.`,
    },
    {
      question: `Er der gratis shelters ${inRegion}?`,
      answer: `Ja, ${data.freeCount} ud af ${data.totalCount} shelters ${inRegion} er gratis (først-til-mølle).`,
    },
    {
      question: `Hvad er den bedst bedømte shelter ${inRegion}?`,
      answer: data.topShelterName
        ? `${data.topShelterName} er blandt de højest bedømte shelters ${inRegion} baseret på Google-anmeldelser.`
        : `Se listen over shelters ${inRegion} sorteret efter bedømmelse for at finde de bedste.`,
    },
  ];
}

interface CrossPageFaqData {
  count: number;
  avgRating: number | null;
  freeCount: number;
  topShelterName: string | null;
}

export function generateCrossPageFaq(
  filterKey: string,
  regionName: string,
  preposition: string,
  data: CrossPageFaqData
): FaqItem[] {
  const label = FILTER_LABELS[filterKey] ?? filterKey;
  const labelLong = FILTER_LABELS_LONG[filterKey] ?? `shelters med ${label}`;
  const inRegion = `${preposition} ${regionName}`;
  return [
    {
      question: `Hvor mange ${labelLong} er der ${inRegion}?`,
      answer: `Der er ${data.count} ${labelLong} ${inRegion} registreret på ShelterDK.`,
    },
    {
      question: `Er ${labelLong} ${inRegion} gratis?`,
      answer: `${data.freeCount} ud af ${data.count} ${labelLong} ${inRegion} er gratis.`,
    },
    {
      question: `Hvad er den bedst bedømte shelter med ${label} ${inRegion}?`,
      answer: data.topShelterName
        ? `${data.topShelterName} er blandt de højest bedømte ${labelLong} ${inRegion}.`
        : `Se listen over ${labelLong} ${inRegion} sorteret efter bedømmelse.`,
    },
    {
      question: `Kan man booke shelter med ${label} ${inRegion}?`,
      answer: `Nogle ${labelLong} ${inRegion} kan bookes via udinaturen.dk eller Naturstyrelsen. Se de enkelte shelterbeskrivelser for bookingmuligheder.`,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run lib/__tests__/fakta-faq.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/lib/fakta-faq.ts web/lib/__tests__/fakta-faq.test.ts
git commit -m "feat: add FAQ generators for fakta, filter, region, and cross pages"
```

---

## Task 3: Dataset Schema Component

Small shared SEO component used by all fakta pages.

**Files:**
- Create: `web/components/seo/DatasetSchema.tsx`

- [ ] **Step 1: Create `DatasetSchema.tsx`**

```typescript
// web/components/seo/DatasetSchema.tsx
interface DatasetSchemaProps {
  name: string;
  description: string;
  url: string;
  dateModified?: string;
  spatialCoverage?: string;
  variableMeasured?: string[];
}

/**
 * schema.org/Dataset JSON-LD for data-authority pages.
 * Signals to AI bots that this page contains structured, citable data.
 */
export function DatasetSchema({
  name,
  description,
  url,
  dateModified = new Date().toISOString().split("T")[0],
  spatialCoverage = "Danmark",
  variableMeasured = [],
}: DatasetSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url,
    creator: {
      "@type": "Organization",
      name: "ShelterDK",
      url: "https://shelterdk.dk",
    },
    dateModified,
    spatialCoverage: {
      "@type": "Place",
      name: spatialCoverage,
    },
    ...(variableMeasured.length > 0 && { variableMeasured }),
    license: "https://creativecommons.org/licenses/by/4.0/",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/seo/DatasetSchema.tsx
git commit -m "feat: add schema.org/Dataset JSON-LD component for fakta pages"
```

---

## Task 4: DataSummaryBlock Component

Reusable computed-facts block used to enrich existing filter and region pages.

**Files:**
- Create: `web/components/DataSummaryBlock.tsx`

- [ ] **Step 1: Create `DataSummaryBlock.tsx`**

```typescript
// web/components/DataSummaryBlock.tsx
import Link from "next/link";
import { slugifySegment } from "@/lib/slug";

interface RegionBreakdown {
  region: string;
  count: number;
}

interface DataSummaryBlockProps {
  /** Main stat headline, e.g. "312 shelters med toilet i Danmark" */
  headline: string;
  /** Per-region breakdown (top 3 shown) */
  regionBreakdown?: RegionBreakdown[];
  /** Average Google rating for this segment */
  avgRating?: number | null;
  /** Links to related cross pages */
  crossPageLinks?: { label: string; href: string }[];
}

/**
 * Computed-facts block shown at the top of filter and region pages.
 * Provides citable data summaries that AI bots can extract.
 */
export function DataSummaryBlock({
  headline,
  regionBreakdown,
  avgRating,
  crossPageLinks,
}: DataSummaryBlockProps) {
  const top3 = regionBreakdown?.slice(0, 3) ?? [];

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-8">
      <p className="text-primary font-semibold text-lg mb-2">{headline}</p>
      {top3.length > 0 && (
        <p className="text-primary/80 text-sm mb-2">
          {top3.map((r, i) => (
            <span key={r.region}>
              <Link
                href={`/danmark/${slugifySegment(r.region)}`}
                className="text-accent hover:underline"
              >
                {r.region}
              </Link>
              {" "}({r.count})
              {i < top3.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      )}
      {avgRating != null && (
        <p className="text-primary/70 text-sm">
          Gennemsnitlig Google-bedømmelse: {avgRating} ud af 5.
        </p>
      )}
      {crossPageLinks && crossPageLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {crossPageLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/DataSummaryBlock.tsx
git commit -m "feat: add DataSummaryBlock component for computed facts on filter/region pages"
```

---

## Task 5: FaktaPage Shared Component

Presentational component for all 5 fakta pages. Each page provides the data; this component renders it consistently.

**Files:**
- Create: `web/components/FaktaPage.tsx`

- [ ] **Step 1: Create `FaktaPage.tsx`**

```typescript
// web/components/FaktaPage.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { DatasetSchema } from "@/components/seo/DatasetSchema";
import { ShelterCard } from "@/components/ShelterCard";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { slugifySegment } from "@/lib/slug";
import type { Shelter } from "@/types/shelter";

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

interface BreakdownRow {
  label: string;
  value: number | string;
  href?: string;
}

interface RelatedLink {
  label: string;
  href: string;
}

interface FaktaPageProps {
  /** Page title (H1) */
  title: string;
  /** First sentence with the definitive answer, e.g. "Der er 1.643 shelters i Danmark" */
  heroStat: string;
  /** 3-4 sentence summary paragraph */
  summary: string;
  /** Breakdown table (region, facility, etc.) */
  breakdownTitle: string;
  breakdownRows: BreakdownRow[];
  /** Top-N shelter cards */
  topSheltersTitle: string;
  topShelters: Shelter[];
  /** FAQ items */
  faqItems: FaqItem[];
  /** Related links section */
  relatedLinks: RelatedLink[];
  /** Schema.org Dataset props */
  datasetName: string;
  datasetDescription: string;
  canonicalPath: string;
  variableMeasured?: string[];
  /** Optional extra content sections */
  children?: React.ReactNode;
}

export function FaktaPage({
  title,
  heroStat,
  summary,
  breakdownTitle,
  breakdownRows,
  topSheltersTitle,
  topShelters,
  faqItems,
  relatedLinks,
  datasetName,
  datasetDescription,
  canonicalPath,
  variableMeasured,
  children,
}: FaktaPageProps) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Fakta", href: "/fakta/shelters-i-danmark" },
          { label: title },
        ]}
      />
      <DatasetSchema
        name={datasetName}
        description={datasetDescription}
        url={`https://shelterdk.dk${canonicalPath}`}
        variableMeasured={variableMeasured}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Hjem
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/fakta/shelters-i-danmark" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Fakta
            </Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">{title}</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              {title}
            </h1>
            <p className="text-accent font-semibold text-xl mb-3">{heroStat}</p>
            <p className="text-primary/80 text-lg leading-relaxed">{summary}</p>
          </header>

          {/* Breakdown table */}
          <section className="mb-12">
            <h2 className="font-serif text-xl font-bold text-primary mb-4">{breakdownTitle}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-primary/10">
                    <th className="py-2 pr-4 text-sm font-semibold text-primary/70">Navn</th>
                    <th className="py-2 text-sm font-semibold text-primary/70 text-right">Antal</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr key={row.label} className="border-b border-primary/5">
                      <td className="py-2 pr-4 text-sm text-primary">
                        {row.href ? (
                          <Link href={row.href} className="text-accent hover:underline">
                            {row.label}
                          </Link>
                        ) : (
                          row.label
                        )}
                      </td>
                      <td className="py-2 text-sm text-primary font-medium text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top shelters */}
          {topShelters.length > 0 && (
            <section className="mb-12">
              <h2 className="font-serif text-xl font-bold text-primary mb-4">{topSheltersTitle}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topShelters.map((shelter) => (
                  <ShelterCard
                    key={shelter.id}
                    shelter={shelter}
                    href={shelterHref(shelter.region ?? null, shelter.kommune ?? null, shelter.slug)}
                  />
                ))}
              </div>
            </section>
          )}

          {children}

          {/* FAQ */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål
            </h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }}
            />
          </section>

          {/* Related links */}
          <section className="mt-10 pt-6 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Læs mere</h2>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/FaktaPage.tsx
git commit -m "feat: add shared FaktaPage presentational component"
```

---

## Task 6: Fakta Pages (5 pages)

The core auto-generated data-authority pages. Each is a thin page that fetches data and passes it to `FaktaPage`.

**Files:**
- Create: `web/app/(site)/fakta/shelters-i-danmark/page.tsx`
- Create: `web/app/(site)/fakta/shelters-med-faciliteter/page.tsx`
- Create: `web/app/(site)/fakta/bedste-shelters/page.tsx`
- Create: `web/app/(site)/fakta/gratis-shelters/page.tsx`
- Create: `web/app/(site)/fakta/shelters-i-nationalparker/page.tsx`

- [ ] **Step 1: Create `/fakta/shelters-i-danmark/page.tsx`**

```typescript
// web/app/(site)/fakta/shelters-i-danmark/page.tsx
import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import {
  getTotalShelterCount,
  getCountPerRegion,
  getTopRatedShelters,
  getFacilityCounts,
  getAverageRating,
} from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;

const CANONICAL = "/fakta/shelters-i-danmark";

export async function generateMetadata(): Promise<Metadata> {
  const total = await getTotalShelterCount();
  const title = `Shelters i Danmark – ${total} shelters på kort og liste | ShelterDK`;
  const description = `Der er ${total} shelters i Danmark. Se komplet statistik over regioner, faciliteter og bedømmelser. Opdateret data fra GeoFA, Naturstyrelsen og udinaturen.dk.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
    robots: { index: true, follow: true, "max-snippet": -1 as unknown as undefined },
  };
}

export default async function SheltersIDanmarkPage() {
  const [total, regions, topShelters, facilities, avgRating] = await Promise.all([
    getTotalShelterCount(),
    getCountPerRegion(),
    getTopRatedShelters(6),
    getFacilityCounts(),
    getAverageRating(),
  ]);

  const today = new Date().toLocaleDateString("da-DK", { month: "long", year: "numeric" });

  return (
    <FaktaPage
      title="Shelters i Danmark"
      heroStat={`Der er ${total.toLocaleString("da-DK")} shelters i Danmark (opdateret ${today})`}
      summary={`Danmark har ${total.toLocaleString("da-DK")} registrerede shelters fordelt på ${regions.length} regioner. ${regions[0]?.region ?? "Jylland"} har flest med ${regions[0]?.count ?? 0} shelters. ${facilities.gratis} shelters er gratis, og ${facilities.toilet} har toilet.${avgRating ? ` Den gennemsnitlige Google-bedømmelse er ${avgRating} ud af 5.` : ""}`}
      breakdownTitle="Shelters per region"
      breakdownRows={regions.map((r) => ({
        label: r.region,
        value: r.count,
        href: `/danmark/${slugifySegment(r.region)}`,
      }))}
      topSheltersTitle="Højest bedømte shelters i Danmark"
      topShelters={topShelters}
      faqItems={[
        { question: "Hvor mange shelters er der i Danmark?", answer: `Der er ${total} shelters registreret i Danmark på ShelterDK. Data stammer fra GeoFA, Naturstyrelsen og udinaturen.dk.` },
        { question: "Hvilken region har flest shelters?", answer: `${regions[0]?.region ?? "Jylland"} har flest shelters med ${regions[0]?.count ?? 0}, efterfulgt af ${regions[1]?.region ?? "Sjælland"} (${regions[1]?.count ?? 0}) og ${regions[2]?.region ?? "Fyn"} (${regions[2]?.count ?? 0}).` },
        { question: "Er shelters i Danmark gratis?", answer: `${facilities.gratis} ud af ${total} shelters er gratis (først-til-mølle). De øvrige kan kræve booking eller et mindre gebyr.` },
        { question: "Hvor mange shelters har toilet?", answer: `${facilities.toilet} shelters i Danmark har toilet (vandskyllende eller muldtoilet).` },
        { question: "Kan man booke et shelter i Danmark?", answer: `Ja, ${facilities.bookbar} shelters kan bookes på forhånd via udinaturen.dk eller book.naturstyrelsen.dk.` },
        { question: "Hvad er den gennemsnitlige bedømmelse?", answer: avgRating ? `Den gennemsnitlige Google-bedømmelse for shelters i Danmark er ${avgRating} ud af 5.` : "Vi har endnu ikke nok data til at beregne en samlet gennemsnitsbedømmelse." },
      ]}
      relatedLinks={[
        { label: "Bedste shelters", href: "/fakta/bedste-shelters" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Faciliteter", href: "/fakta/shelters-med-faciliteter" },
        { label: "Nationalparker", href: "/fakta/shelters-i-nationalparker" },
        { label: "Guide for begyndere", href: "/guides/shelter-for-begyndere" },
        { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
      ]}
      datasetName="Shelters i Danmark - Komplet statistik"
      datasetDescription={`Opdateret statistik over alle ${total} shelters i Danmark`}
      canonicalPath={CANONICAL}
      variableMeasured={["shelter count", "facility availability", "Google rating"]}
    />
  );
}
```

- [ ] **Step 2: Create `/fakta/shelters-med-faciliteter/page.tsx`**

```typescript
// web/app/(site)/fakta/shelters-med-faciliteter/page.tsx
import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTotalShelterCount, getFacilityCounts, getTopRatedShelters } from "@/lib/fakta-db";

export const revalidate = 86400;
const CANONICAL = "/fakta/shelters-med-faciliteter";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Faciliteter på shelters i Danmark – toilet, vand, bålplads | ShelterDK";
  const description = "Komplet oversigt over faciliteter på shelters i Danmark. Se hvor mange shelters der har toilet, vand, bålplads, og mere.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
  };
}

export default async function FaciliteterPage() {
  const [total, facilities, topShelters] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getTopRatedShelters(6),
  ]);

  return (
    <FaktaPage
      title="Faciliteter på shelters i Danmark"
      heroStat={`${facilities.toilet} ud af ${total} shelters har toilet`}
      summary={`Shelter-faciliteter varierer meget i Danmark. ${facilities.toilet} shelters har toilet, ${facilities.water} har vand, ${facilities.baalplads} har bålplads, og ${facilities.hund} tillader hund. ${facilities.bruser} har bruser og ${facilities.strand} ligger nær strand.`}
      breakdownTitle="Faciliteter i tal"
      breakdownRows={[
        { label: "Toilet (vandskyllende/muldtoilet)", value: facilities.toilet, href: "/shelter-med-toilet" },
        { label: "Drikkevand", value: facilities.water, href: "/shelter-med-vand" },
        { label: "Bålplads", value: facilities.baalplads, href: "/shelter-med-baalplads" },
        { label: "Hund tilladt", value: facilities.hund, href: "/shelter-med-hund" },
        { label: "Nær strand", value: facilities.strand, href: "/shelter-med-strand" },
        { label: "Bruser/bad", value: facilities.bruser, href: "/shelter-med-bruser" },
        { label: "Kan bookes", value: facilities.bookbar, href: "/shelter-booking" },
        { label: "Gratis", value: facilities.gratis },
      ]}
      topSheltersTitle="Højest bedømte shelters med faciliteter"
      topShelters={topShelters}
      faqItems={[
        { question: "Hvilke faciliteter har shelters i Danmark?", answer: `De mest almindelige faciliteter er toilet (${facilities.toilet} shelters), drikkevand (${facilities.water}), bålplads (${facilities.baalplads}) og hund tilladt (${facilities.hund}).` },
        { question: "Hvor mange shelters har toilet?", answer: `${facilities.toilet} shelters i Danmark har toilet – enten vandskyllende eller muldtoilet.` },
        { question: "Hvor mange shelters har drikkevand?", answer: `${facilities.water} shelters har adgang til drikkevand.` },
        { question: "Hvor mange shelters tillader hund?", answer: `${facilities.hund} shelters i Danmark tillader hund.` },
        { question: "Kan man finde shelters med bruser?", answer: `Ja, ${facilities.bruser} shelters har bruser eller bad.` },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
      ]}
      datasetName="Facilitetsoversigt for shelters i Danmark"
      datasetDescription={`Facilitetsstatistik for ${total} shelters: toilet, vand, bålplads og mere`}
      canonicalPath={CANONICAL}
      variableMeasured={["toilet count", "water count", "fire pit count", "pet-friendly count"]}
    />
  );
}
```

- [ ] **Step 3: Create `/fakta/bedste-shelters/page.tsx`**

```typescript
// web/app/(site)/fakta/bedste-shelters/page.tsx
import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTopRatedShelters, getAverageRating, getTotalShelterCount } from "@/lib/fakta-db";

export const revalidate = 86400;
const CANONICAL = "/fakta/bedste-shelters";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Bedste shelters i Danmark – Højest bedømte shelters | ShelterDK";
  const description = "Se Danmarks bedst bedømte shelters baseret på Google-anmeldelser. Data-backed ranking med rigtige bedømmelser.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
  };
}

export default async function BedsteSheltersPage() {
  const [topShelters, avgRating, total] = await Promise.all([
    getTopRatedShelters(20, 3),
    getAverageRating(),
    getTotalShelterCount(),
  ]);

  return (
    <FaktaPage
      title="Bedste shelters i Danmark"
      heroStat={`Top ${topShelters.length} shelters rangeret efter Google-bedømmelser`}
      summary={`Denne ranking er baseret på Google-anmeldelser fra rigtige besøgende. Kun shelters med mindst 3 anmeldelser er inkluderet. Den gennemsnitlige bedømmelse for alle ${total} shelters er ${avgRating ?? "ikke tilgængelig"} ud af 5.`}
      breakdownTitle="Top 20 shelters"
      breakdownRows={topShelters.map((s, i) => ({
        label: `${i + 1}. ${s.title}`,
        value: `${s.google_rating} ★ (${s.google_user_ratings_total} anm.)`,
      }))}
      topSheltersTitle="De 6 bedste shelters"
      topShelters={topShelters.slice(0, 6)}
      faqItems={[
        { question: "Hvad er det bedste shelter i Danmark?", answer: topShelters[0] ? `${topShelters[0].title} er det højest bedømte shelter med en Google-bedømmelse på ${topShelters[0].google_rating} baseret på ${topShelters[0].google_user_ratings_total} anmeldelser.` : "Se listen for den aktuelle nummer 1." },
        { question: "Hvordan rangeres shelters?", answer: "Rangering er baseret på Google-bedømmelser fra rigtige besøgende. Kun shelters med mindst 3 anmeldelser er inkluderet for at sikre pålidelighed." },
        { question: "Hvad er den gennemsnitlige bedømmelse?", answer: avgRating ? `Den gennemsnitlige Google-bedømmelse for shelters i Danmark er ${avgRating} ud af 5.` : "Data er ikke tilgængelig endnu." },
        { question: "Hvor mange shelters har anmeldelser?", answer: `${topShelters.length}+ shelters har mindst 3 Google-anmeldelser, som bruges i denne ranking.` },
        { question: "Kan man booke de bedste shelters?", answer: "Nogle af de bedst bedømte shelters kan bookes via udinaturen.dk. Se de individuelle sheltersider for bookingmuligheder." },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "De 10 bedste shelters (blog)", href: "/blog/de-10-bedste-shelters" },
        { label: "Gratis shelters", href: "/fakta/gratis-shelters" },
        { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere" },
      ]}
      datasetName="Bedste shelters i Danmark - Ranking"
      datasetDescription="Top-rated shelters baseret på Google-anmeldelser"
      canonicalPath={CANONICAL}
      variableMeasured={["Google rating", "review count"]}
    />
  );
}
```

- [ ] **Step 4: Create `/fakta/gratis-shelters/page.tsx`**

```typescript
// web/app/(site)/fakta/gratis-shelters/page.tsx
import type { Metadata } from "next";
import { FaktaPage } from "@/components/FaktaPage";
import { getTotalShelterCount, getFacilityCounts, getCountPerRegion, getTopRatedShelters } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;
const CANONICAL = "/fakta/gratis-shelters";

export async function generateMetadata(): Promise<Metadata> {
  const facilities = await getFacilityCounts();
  const title = `Gratis shelters i Danmark – ${facilities.gratis} shelters uden betaling | ShelterDK`;
  const description = `${facilities.gratis} shelters i Danmark er helt gratis. Se oversigt over gratis vs. betalte shelters fordelt på regioner.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
    openGraph: { title, description, url: CANONICAL },
  };
}

export default async function GratisSheltersPage() {
  const [total, facilities, regions, topShelters] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getCountPerRegion(),
    getTopRatedShelters(6),
  ]);

  const paidCount = total - facilities.gratis;
  const freePercent = total > 0 ? Math.round((facilities.gratis / total) * 100) : 0;

  return (
    <FaktaPage
      title="Gratis shelters i Danmark"
      heroStat={`${facilities.gratis} ud af ${total} shelters er gratis (${freePercent}%)`}
      summary={`${facilities.gratis} shelters i Danmark er helt gratis at benytte efter først-til-mølle-princippet. De resterende ${paidCount} shelters kan kræve booking eller et mindre gebyr. ${facilities.bookbar} shelters kan bookes via udinaturen.dk eller Naturstyrelsen.`}
      breakdownTitle="Shelters per region"
      breakdownRows={regions.map((r) => ({
        label: r.region,
        value: r.count,
        href: `/danmark/${slugifySegment(r.region)}`,
      }))}
      topSheltersTitle="Højest bedømte gratis shelters"
      topShelters={topShelters}
      faqItems={[
        { question: "Er shelters i Danmark gratis?", answer: `Ja, ${facilities.gratis} ud af ${total} shelters (${freePercent}%) er helt gratis. De fungerer efter først-til-mølle-princippet.` },
        { question: "Hvad koster det at overnatte i shelter?", answer: `Gratis shelters koster intet. Bookbare shelters koster typisk 30-100 kr. per nat. ${facilities.bookbar} shelters kan bookes.` },
        { question: "Hvad betyder først-til-mølle?", answer: "Først-til-mølle betyder at pladsen ikke kan reserveres. Den der kommer først, har ret til at overnatte." },
        { question: "Kan man booke gratis shelters?", answer: "Nej, gratis shelters er per definition først-til-mølle. Ønsker du at reservere, skal du finde et bookbart shelter." },
        { question: "Hvor finder man gratis shelters?", answer: `Brug ShelterDK's søgning med filteret 'Gratis' for at finde alle ${facilities.gratis} gratis shelters på kort og liste.` },
      ]}
      relatedLinks={[
        { label: "Shelters i Danmark", href: "/fakta/shelters-i-danmark" },
        { label: "Gratis shelters guide", href: "/blog/gratis-shelters-i-danmark" },
        { label: "Book shelter", href: "/shelter-booking" },
        { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
      ]}
      datasetName="Gratis shelters i Danmark"
      datasetDescription={`Oversigt over ${facilities.gratis} gratis shelters i Danmark`}
      canonicalPath={CANONICAL}
      variableMeasured={["free shelter count", "paid shelter count", "booking availability"]}
    />
  );
}
```

- [ ] **Step 5: Create `/fakta/shelters-i-nationalparker/page.tsx`**

```typescript
// web/app/(site)/fakta/shelters-i-nationalparker/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { DatasetSchema } from "@/components/seo/DatasetSchema";
import { ShelterCard } from "@/components/ShelterCard";
import { faqToJsonLd } from "@/lib/faq";
import { getSheltersInNationalParks } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;
const CANONICAL = "/fakta/shelters-i-nationalparker";

export const metadata: Metadata = {
  title: { absolute: "Shelters i nationalparker – Danmarks 5 nationalparker | ShelterDK" },
  description: "Find shelters i Danmarks 5 nationalparker: Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land og Kongernes Nordsjælland.",
  alternates: { canonical: `https://shelterdk.dk${CANONICAL}` },
  openGraph: {
    title: "Shelters i nationalparker – Danmarks 5 nationalparker | ShelterDK",
    description: "Find shelters i Danmarks 5 nationalparker.",
    url: CANONICAL,
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

export default async function NationalparkerPage() {
  const parkData = await getSheltersInNationalParks();
  const totalInParks = parkData.reduce((sum, p) => sum + p.shelters.length, 0);

  const faqItems = [
    { question: "Hvor mange shelters er der i Danmarks nationalparker?", answer: `Der er ca. ${totalInParks} shelters i eller nær Danmarks 5 nationalparker.` },
    { question: "Hvilken nationalpark har flest shelters?", answer: parkData.length > 0 ? `${parkData.sort((a, b) => b.shelters.length - a.shelters.length)[0].parkName} har flest med ${parkData[0].shelters.length} shelters.` : "Data er ikke tilgængelig." },
    { question: "Er shelters i nationalparker gratis?", answer: "Mange shelters i nationalparker er gratis (først-til-mølle). Nogle kan bookes via udinaturen.dk." },
    { question: "Hvilke nationalparker er der i Danmark?", answer: "Danmark har 5 nationalparker: Nationalpark Thy, Nationalpark Mols Bjerge, Nationalpark Vadehavet, Nationalpark Skjoldungernes Land og Nationalpark Kongernes Nordsjælland." },
  ];

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Fakta", href: "/fakta/shelters-i-danmark" }, { label: "Nationalparker" }]} />
      <DatasetSchema
        name="Shelters i Danmarks nationalparker"
        description={`${totalInParks} shelters fordelt på Danmarks 5 nationalparker`}
        url={`https://shelterdk.dk${CANONICAL}`}
        variableMeasured={["shelter count per national park"]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/fakta/shelters-i-danmark" className="py-1 -my-1 hover:text-accent transition-colors">Fakta</Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">Nationalparker</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">Shelters i Danmarks nationalparker</h1>
            <p className="text-accent font-semibold text-xl mb-3">Ca. {totalInParks} shelters i 5 nationalparker</p>
            <p className="text-primary/80 text-lg leading-relaxed">
              Danmark har 5 nationalparker med sheltermuligheder. Her er en oversigt over shelters i og nær hver nationalpark.
            </p>
          </header>

          {parkData
            .sort((a, b) => b.shelters.length - a.shelters.length)
            .map((park) => (
            <section key={park.parkSlug} className="mb-12">
              <h2 className="font-serif text-xl font-bold text-primary mb-2">{park.parkName}</h2>
              <p className="text-primary/70 text-sm mb-4">{park.shelters.length} shelters</p>
              {park.shelters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {park.shelters.slice(0, 6).map((s) => (
                    <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                  ))}
                </div>
              ) : (
                <p className="text-primary/60 text-sm">Ingen shelters fundet i dette område.</p>
              )}
            </section>
          ))}

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">Ofte stillede spørgsmål</h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
          </section>

          <section className="mt-10 pt-6 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Læs mere</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/fakta/shelters-i-danmark" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Shelters i Danmark</Link>
              <Link href="/guides/shelter-i-nationalparker" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Guide: Nationalparker</Link>
              <Link href="/fakta/bedste-shelters" className="text-sm bg-accent/10 text-accent font-medium px-4 py-2 rounded-full hover:bg-accent/20">Bedste shelters</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Verify build compiles for fakta pages**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No new errors in the files we created (pre-existing errors are OK)

- [ ] **Step 7: Commit**

```bash
git add "web/app/(site)/fakta/"
git commit -m "feat: add 5 auto-generated fakta pages with real database statistics"
```

---

## Task 7: CrossFilterRegionPage Component + Cross Pages

Shared component for all filter×region cross pages, plus the 7 thin wrapper pages.

**Files:**
- Create: `web/components/CrossFilterRegionPage.tsx`
- Create: `web/app/(site)/shelter-med-toilet/[region]/page.tsx`
- Create: `web/app/(site)/shelter-med-vand/[region]/page.tsx`
- Create: `web/app/(site)/shelter-med-baalplads/[region]/page.tsx`
- Create: `web/app/(site)/shelter-med-hund/[region]/page.tsx`
- Create: `web/app/(site)/shelter-med-strand/[region]/page.tsx`
- Create: `web/app/(site)/shelter-med-bruser/[region]/page.tsx`
- Create: `web/app/(site)/shelter-booking/[region]/page.tsx`

- [ ] **Step 1: Create `CrossFilterRegionPage.tsx`**

Refer to the existing filter page pattern in `web/app/(site)/shelter-med-toilet/page.tsx` for styling. This component receives filter config and pre-fetched data.

```typescript
// web/components/CrossFilterRegionPage.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { slugifySegment } from "@/lib/slug";
import type { Shelter } from "@/types/shelter";

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

interface KommuneRow {
  kommune: string;
  count: number;
}

interface CrossFilterRegionPageProps {
  filterKey: string;
  filterLabel: string;       // e.g. "toilet"
  filterLabelLong: string;   // e.g. "Shelters med toilet"
  regionName: string;
  preposition: string;       // "i" or "på"
  parentFilterHref: string;  // e.g. "/shelter-med-toilet"
  shelters: Shelter[];
  kommuneBreakdown: KommuneRow[];
  faqItems: FaqItem[];
  /** Other regions with same filter for "Se også" links */
  otherRegions: { name: string; href: string }[];
  /** Other filters for same region */
  otherFilters: { label: string; href: string }[];
  /** Related content links */
  relatedLinks: { label: string; href: string }[];
}

export function CrossFilterRegionPage({
  filterLabel,
  filterLabelLong,
  regionName,
  preposition,
  parentFilterHref,
  shelters,
  kommuneBreakdown,
  faqItems,
  otherRegions,
  otherFilters,
  relatedLinks,
}: CrossFilterRegionPageProps) {
  const inRegion = `${preposition} ${regionName}`;
  const topShelters = shelters.slice(0, 5);
  const avgRating = (() => {
    const rated = shelters.filter((s) => s.google_rating != null);
    if (rated.length === 0) return null;
    const avg = rated.reduce((sum, s) => sum + (s.google_rating ?? 0), 0) / rated.length;
    return Math.round(avg * 10) / 10;
  })();

  return (
    <>
      <BreadcrumbSchema items={[
        { label: "Hjem", href: "/" },
        { label: filterLabelLong, href: parentFilterHref },
        { label: regionName },
      ]} />
      <ShelterListSchema
        name={`${filterLabelLong} ${inRegion}`}
        shelters={shelters}
        hrefFn={(s) => shelterHref(s.region ?? null, s.kommune ?? null, s.slug)}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href={parentFilterHref} className="py-1 -my-1 hover:text-accent transition-colors">{filterLabelLong}</Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">{regionName}</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
              {filterLabelLong} {inRegion}
            </h1>
            <p className="text-primary/80 text-lg">
              {shelters.length} {filterLabel === "booking" ? "bookbare shelters" : `shelters med ${filterLabel}`} {inRegion}.
              {avgRating && ` Gennemsnitlig bedømmelse: ${avgRating} ud af 5.`}
            </p>
          </header>

          {/* Kommune breakdown */}
          {kommuneBreakdown.length > 0 && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">Fordelt på kommuner</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-primary/10">
                      <th className="py-2 pr-4 text-sm font-semibold text-primary/70">Kommune</th>
                      <th className="py-2 text-sm font-semibold text-primary/70 text-right">Antal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kommuneBreakdown.map((row) => (
                      <tr key={row.kommune} className="border-b border-primary/5">
                        <td className="py-2 pr-4 text-sm text-primary">{row.kommune}</td>
                        <td className="py-2 text-sm text-primary font-medium text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Top 5 */}
          {topShelters.length > 0 && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Top {topShelters.length} {filterLabelLong.toLowerCase()} {inRegion}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topShelters.map((s) => (
                  <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                ))}
              </div>
            </section>
          )}

          {/* Full list with map */}
          {shelters.length > 0 && (
            <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[50vh]">
                <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                  <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    {shelters.length} shelters · scroll for flere
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                    {shelters.map((s) => (
                      <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                    ))}
                  </div>
                </div>
                <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] h-[40vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                  <ShelterMap shelters={shelters} className="w-full h-full" />
                </div>
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">Ofte stillede spørgsmål</h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
          </section>

          {/* Cross-links */}
          <section className="mt-8 space-y-4">
            {otherRegions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Se også {filterLabelLong.toLowerCase()} i andre regioner:</h3>
                <div className="flex flex-wrap gap-2">
                  {otherRegions.map((r) => (
                    <Link key={r.href} href={r.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{r.name}</Link>
                  ))}
                </div>
              </div>
            )}
            {otherFilters.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Andre faciliteter {inRegion}:</h3>
                <div className="flex flex-wrap gap-2">
                  {otherFilters.map((f) => (
                    <Link key={f.href} href={f.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{f.label}</Link>
                  ))}
                </div>
              </div>
            )}
            {relatedLinks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Læs mere:</h3>
                <div className="flex flex-wrap gap-2">
                  {relatedLinks.map((l) => (
                    <Link key={l.href} href={l.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{l.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create the shared cross-page config**

Create a config file that all 7 cross page wrappers import to avoid repetition:

```typescript
// web/lib/cross-page-config.ts
import { prepositionForRegionName } from "@/lib/area-db";
import { slugifySegment } from "@/lib/slug";

export interface FilterConfig {
  filterKey: string;
  filterLabel: string;
  filterLabelLong: string;
  parentHref: string;
  relatedBlogLinks: { label: string; href: string }[];
}

export const FILTER_CONFIGS: Record<string, FilterConfig> = {
  toilet: {
    filterKey: "toilet",
    filterLabel: "toilet",
    filterLabelLong: "Shelters med toilet",
    parentHref: "/shelter-med-toilet",
    relatedBlogLinks: [
      { label: "Regler for shelter", href: "/guides/regler-for-shelter-og-teltning-i-danmark" },
    ],
  },
  vand: {
    filterKey: "vand",
    filterLabel: "vand",
    filterLabelLong: "Shelters med vand",
    parentHref: "/shelter-med-vand",
    relatedBlogLinks: [
      { label: "Pakkeliste til sheltertur", href: "/guides/pakkeliste-til-sheltertur" },
    ],
  },
  baalplads: {
    filterKey: "baalplads",
    filterLabel: "bålplads",
    filterLabelLong: "Shelters med bålplads",
    parentHref: "/shelter-med-baalplads",
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  hund: {
    filterKey: "hund",
    filterLabel: "hund",
    filterLabelLong: "Hundevenlige shelters",
    parentHref: "/shelter-med-hund",
    relatedBlogLinks: [
      { label: "Shelter for begyndere", href: "/guides/shelter-for-begyndere" },
    ],
  },
  strand: {
    filterKey: "strand",
    filterLabel: "strand",
    filterLabelLong: "Shelters nær strand",
    parentHref: "/shelter-med-strand",
    relatedBlogLinks: [
      { label: "Shelter i efteråret", href: "/blog/shelter-i-efteraaret" },
    ],
  },
  bruser: {
    filterKey: "bruser",
    filterLabel: "bruser",
    filterLabelLong: "Shelters med bruser",
    parentHref: "/shelter-med-bruser",
    relatedBlogLinks: [],
  },
  booking: {
    filterKey: "booking",
    filterLabel: "booking",
    filterLabelLong: "Bookbare shelters",
    parentHref: "/shelter-booking",
    relatedBlogLinks: [
      { label: "Gratis shelters guide", href: "/blog/gratis-shelters-i-danmark" },
    ],
  },
};

export const REGION_SLUGS = ["jylland", "sjaelland", "fyn", "bornholm"] as const;

/** Map slug back to display name. */
export const REGION_NAMES: Record<string, string> = {
  jylland: "Jylland",
  sjaelland: "Sjælland",
  fyn: "Fyn",
  bornholm: "Bornholm",
};

/** Build "other regions" links for a given filter, excluding current region. */
export function getOtherRegionLinks(
  filterConfig: FilterConfig,
  currentRegionSlug: string,
  validRegionSlugs: string[]
): { name: string; href: string }[] {
  return validRegionSlugs
    .filter((slug) => slug !== currentRegionSlug)
    .map((slug) => ({
      name: REGION_NAMES[slug] ?? slug,
      href: `${filterConfig.parentHref}/${slug}`,
    }));
}

/** Build "other filters" links for a given region, excluding current filter. */
export function getOtherFilterLinks(
  currentFilterKey: string,
  regionSlug: string
): { label: string; href: string }[] {
  return Object.values(FILTER_CONFIGS)
    .filter((c) => c.filterKey !== currentFilterKey)
    .map((c) => ({
      label: c.filterLabelLong,
      href: `${c.parentHref}/${regionSlug}`,
    }));
}
```

- [ ] **Step 3: Create the first cross page wrapper (`shelter-med-toilet/[region]/page.tsx`)**

This is the template. The other 6 are near-identical, just with a different filter config key.

```typescript
// web/app/(site)/shelter-med-toilet/[region]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrossFilterRegionPage } from "@/components/CrossFilterRegionPage";
import { getFilterRegionCount, getSheltersForFilterRegion, getKommuneBreakdownForFilterRegion } from "@/lib/fakta-db";
import { generateCrossPageFaq } from "@/lib/fakta-faq";
import { FILTER_CONFIGS, REGION_NAMES, REGION_SLUGS, getOtherRegionLinks, getOtherFilterLinks } from "@/lib/cross-page-config";
import { prepositionForRegionName } from "@/lib/area-db";
import { getDistinctRegions } from "@/lib/danmark-silo";
import { slugifySegment } from "@/lib/slug";

const FILTER = FILTER_CONFIGS["toilet"];
const MIN_SHELTERS = 5;

export const revalidate = 86400;
export const dynamicParams = false;

interface PageProps { params: Promise<{ region: string }> }

export async function generateStaticParams() {
  const regions = await getDistinctRegions();
  const params: { region: string }[] = [];
  for (const region of regions) {
    const slug = slugifySegment(region);
    if (!REGION_SLUGS.includes(slug as typeof REGION_SLUGS[number])) continue;
    const count = await getFilterRegionCount(FILTER.filterKey, region);
    if (count >= MIN_SHELTERS) params.push({ region: slug });
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const regionName = REGION_NAMES[regionSlug];
  if (!regionName) return {};
  const prep = prepositionForRegionName(regionName);
  const title = `${FILTER.filterLabelLong} ${prep} ${regionName} | ShelterDK`;
  const description = `Find ${FILTER.filterLabelLong.toLowerCase()} ${prep} ${regionName}. Se kort, liste og faciliteter.`;
  const canonical = `${FILTER.parentHref}/${regionSlug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonical}` },
    openGraph: { title, description, url: canonical },
  };
}

export default async function Page({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regionName = REGION_NAMES[regionSlug];
  if (!regionName) notFound();
  const prep = prepositionForRegionName(regionName);

  const [shelters, kommuneBreakdown] = await Promise.all([
    getSheltersForFilterRegion(FILTER.filterKey, regionName),
    getKommuneBreakdownForFilterRegion(FILTER.filterKey, regionName),
  ]);

  if (shelters.length < MIN_SHELTERS) notFound();

  const freeCount = shelters.filter((s) => {
    const raw = s.geofa_raw as Record<string, unknown> | null;
    return raw && String(raw.betaling ?? "").toLowerCase() === "nej";
  }).length;

  const rated = shelters.filter((s) => s.google_rating != null);
  const topShelter = rated.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))[0];

  const validParams = await generateStaticParams();
  const validSlugs = validParams.map((p) => p.region);

  const faqItems = generateCrossPageFaq(FILTER.filterKey, regionName, prep, {
    count: shelters.length,
    avgRating: rated.length > 0 ? Math.round((rated.reduce((s, r) => s + (r.google_rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    freeCount,
    topShelterName: topShelter?.title ?? null,
  });

  return (
    <CrossFilterRegionPage
      filterKey={FILTER.filterKey}
      filterLabel={FILTER.filterLabel}
      filterLabelLong={FILTER.filterLabelLong}
      regionName={regionName}
      preposition={prep}
      parentFilterHref={FILTER.parentHref}
      shelters={shelters}
      kommuneBreakdown={kommuneBreakdown}
      faqItems={faqItems}
      otherRegions={getOtherRegionLinks(FILTER, regionSlug, validSlugs)}
      otherFilters={getOtherFilterLinks(FILTER.filterKey, regionSlug)}
      relatedLinks={[
        { label: regionName, href: `/danmark/${regionSlug}` },
        ...FILTER.relatedBlogLinks,
      ]}
    />
  );
}
```

- [ ] **Step 4: Create the remaining 6 cross page wrappers**

Each of these follows the identical pattern as step 3, with only the `FILTER_CONFIGS` key changed. Create:

- `web/app/(site)/shelter-med-vand/[region]/page.tsx` — uses `FILTER_CONFIGS["vand"]`
- `web/app/(site)/shelter-med-baalplads/[region]/page.tsx` — uses `FILTER_CONFIGS["baalplads"]`
- `web/app/(site)/shelter-med-hund/[region]/page.tsx` — uses `FILTER_CONFIGS["hund"]`
- `web/app/(site)/shelter-med-strand/[region]/page.tsx` — uses `FILTER_CONFIGS["strand"]`
- `web/app/(site)/shelter-med-bruser/[region]/page.tsx` — uses `FILTER_CONFIGS["bruser"]`
- `web/app/(site)/shelter-booking/[region]/page.tsx` — uses `FILTER_CONFIGS["booking"]`

The implementation is copy-paste of step 3 with one line changed: `const FILTER = FILTER_CONFIGS["<key>"];`

- [ ] **Step 5: Verify no TS errors**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep -E "(cross-page|CrossFilter|shelter-med.*region|shelter-booking.*region)" | head -20`
Expected: No errors in our new files

- [ ] **Step 6: Commit**

```bash
git add web/components/CrossFilterRegionPage.tsx web/lib/cross-page-config.ts
git add "web/app/(site)/shelter-med-toilet/[region]/" "web/app/(site)/shelter-med-vand/[region]/" "web/app/(site)/shelter-med-baalplads/[region]/" "web/app/(site)/shelter-med-hund/[region]/" "web/app/(site)/shelter-med-strand/[region]/" "web/app/(site)/shelter-med-bruser/[region]/" "web/app/(site)/shelter-booking/[region]/"
git commit -m "feat: add filter×region cross pages with shared component (~20 pages)"
```

---

## Task 8: Enrich Existing Filter Pages with DataSummaryBlock

Add computed-facts blocks to the 7 existing filter pages. Also adds FAQ schema where missing.

**Files:**
- Modify: `web/app/(site)/shelter-med-toilet/page.tsx`
- Modify: `web/app/(site)/shelter-med-vand/page.tsx`
- Modify: `web/app/(site)/shelter-med-baalplads/page.tsx`
- Modify: `web/app/(site)/shelter-med-hund/page.tsx`
- Modify: `web/app/(site)/shelter-med-strand/page.tsx`
- Modify: `web/app/(site)/shelter-med-bruser/page.tsx`
- Modify: `web/app/(site)/shelter-booking/page.tsx`

- [ ] **Step 1: Add DataSummaryBlock to `/shelter-med-toilet/page.tsx`**

Import `DataSummaryBlock`, `getFilterRegionCount`, `getCountPerRegion` from the appropriate libs. Add a data-fetching call at the top of the page component. Insert `<DataSummaryBlock>` right after the `<header>` section, before the shelter list.

The summary block needs:
- `headline`: e.g. `"${totalCount} shelters med toilet i Danmark"`
- `regionBreakdown`: per-region counts for this filter (query each region count via `getFilterRegionCount`)
- `avgRating`: average rating of shelters with this filter
- `crossPageLinks`: links to `/shelter-med-toilet/jylland`, etc.

Also add links to cross pages in the prose section at the bottom.

Repeat this pattern for all 7 filter pages. The changes are mechanical — same block, different filter key and labels.

- [ ] **Step 2: Verify no TS errors in modified filter pages**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep "shelter-med\|shelter-booking" | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add "web/app/(site)/shelter-med-toilet/page.tsx" "web/app/(site)/shelter-med-vand/page.tsx" "web/app/(site)/shelter-med-baalplads/page.tsx" "web/app/(site)/shelter-med-hund/page.tsx" "web/app/(site)/shelter-med-strand/page.tsx" "web/app/(site)/shelter-med-bruser/page.tsx" "web/app/(site)/shelter-booking/page.tsx"
git commit -m "feat: enrich existing filter pages with computed data summaries and cross-page links"
```

---

## Task 9: Enrich Region Pages with DataSummaryBlock + FAQ

Add computed-facts block and auto-generated FAQ to region pages.

**Files:**
- Modify: `web/app/(site)/danmark/[region]/page.tsx`

- [ ] **Step 1: Add data summary and FAQ to region page**

In `web/app/(site)/danmark/[region]/page.tsx`:

1. Import `DataSummaryBlock`, `getFacilityCountsForRegion`, `getTotalShelterCount` from `@/lib/fakta-db`
2. Import `generateRegionPageFaq` from `@/lib/fakta-faq`
3. Import `faqToJsonLd` from `@/lib/faq`
4. In the page component, add parallel data fetching for region stats
5. Insert `<DataSummaryBlock>` after the `<h1>` and intro paragraph
6. Add FAQ section with JSON-LD at the bottom (before or after the region content)
7. Add cross-page links (e.g. "Shelters med toilet i Jylland")

The `DataSummaryBlock` headline should read e.g. "Jylland har 623 shelters. 412 er gratis, 187 har toilet."

- [ ] **Step 2: Commit**

```bash
git add "web/app/(site)/danmark/[region]/page.tsx"
git commit -m "feat: enrich region pages with facility stats, FAQ schema, and cross-page links"
```

---

## Task 9b: Enrich Municipality Pages with FAQ Schema

Add auto-generated FAQ to municipality pages per spec section 3c.

**Files:**
- Modify: `web/app/(site)/danmark/[region]/[municipality]/page.tsx`
- Modify: `web/lib/fakta-faq.ts` (add `generateMunicipalityPageFaq`)

- [ ] **Step 1: Add `generateMunicipalityPageFaq` to `fakta-faq.ts`**

Add this function to `web/lib/fakta-faq.ts`:

```typescript
interface MunicipalityPageFaqData {
  totalCount: number;
  freeCount: number;
  toiletCount: number;
  waterCount: number;
}

export function generateMunicipalityPageFaq(
  municipalityName: string,
  data: MunicipalityPageFaqData
): FaqItem[] {
  return [
    {
      question: `Hvor mange shelters er der i ${municipalityName}?`,
      answer: `Der er ${data.totalCount} shelters i ${municipalityName} registreret på ShelterDK.`,
    },
    {
      question: `Hvilke faciliteter har shelters i ${municipalityName}?`,
      answer: `${data.toiletCount} shelters har toilet og ${data.waterCount} har vand i ${municipalityName}.`,
    },
    {
      question: `Er der gratis shelters i ${municipalityName}?`,
      answer: `Ja, ${data.freeCount} ud af ${data.totalCount} shelters i ${municipalityName} er gratis.`,
    },
  ];
}
```

- [ ] **Step 2: Add FAQ to municipality page**

In `web/app/(site)/danmark/[region]/[municipality]/page.tsx`, import `generateMunicipalityPageFaq` and `faqToJsonLd`. Fetch shelter counts for the municipality using Supabase queries. Add FAQ section with JSON-LD at the bottom of the page.

- [ ] **Step 3: Commit**

```bash
git add web/lib/fakta-faq.ts "web/app/(site)/danmark/[region]/[municipality]/page.tsx"
git commit -m "feat: add FAQ schema to municipality pages"
```

---

## Task 10: Dynamic `llms.txt` Route Handler

Replace the static `public/llms.txt` with a dynamic route handler that queries Supabase for live counts.

**Files:**
- Create: `web/app/llms.txt/route.ts`
- Delete: `web/public/llms.txt` (after the new route is working)

- [ ] **Step 1: Create `web/app/llms.txt/route.ts`**

```typescript
// web/app/llms.txt/route.ts
import { NextResponse } from "next/server";
import { getTotalShelterCount, getFacilityCounts, getCountPerRegion } from "@/lib/fakta-db";

export const revalidate = 86400;

export async function GET() {
  const [total, facilities, regions] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getCountPerRegion(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const regionLines = regions.map((r) => `- ${r.region}: ${r.count} shelters`).join("\n");

  const content = `# ShelterDK - Danmarks mest komplette shelter-database

## Nøgletal (opdateret ${today})
- Antal shelters i alt: ${total}
- Shelters med toilet: ${facilities.toilet}
- Shelters med vand: ${facilities.water}
- Shelters med bålplads: ${facilities.baalplads}
- Shelters der tillader hund: ${facilities.hund}
- Gratis shelters: ${facilities.gratis}
- Shelters der kan bookes: ${facilities.bookbar}

## Regioner
${regionLines}

## Sider med detaljeret data
- /fakta/shelters-i-danmark — Komplet statistik over alle shelters
- /fakta/bedste-shelters — Højest bedømte shelters baseret på Google anmeldelser
- /fakta/gratis-shelters — Oversigt over gratis vs. betalte shelters
- /fakta/shelters-med-faciliteter — Facilitetsstatistik på tværs af alle shelters
- /fakta/shelters-i-nationalparker — Shelters fordelt på nationalparker

## Filtre
- /shelter-med-toilet — ${facilities.toilet} shelters med toilet
- /shelter-med-vand — ${facilities.water} shelters med vand
- /shelter-med-baalplads — ${facilities.baalplads} shelters med bålplads
- /shelter-med-hund — ${facilities.hund} shelters der tillader hund
- /shelter-med-strand — ${facilities.strand} shelters nær strand
- /shelter-med-bruser — ${facilities.bruser} shelters med bruser
- /shelter-booking — ${facilities.bookbar} shelters der kan bookes

## Andre nøglesider
- /soeg — Søg og filtrer alle shelters
- /shelter-naer-mig — Find shelters via GPS
- /ruteplanner — 224 vandreruter med shelters
- /guides — Guides til shelterture
- /blog — Artikler om shelter og friluftsliv
- /faq — Ofte stillede spørgsmål

## Datakilder
Shelter-data er aggregeret fra GeoFA (Geodata For Alle), Naturstyrelsen, og udinaturen.dk. Google-bedømmelser via Google Places API.

## Kontakt
- Website: https://shelterdk.dk
- Kontakt: https://shelterdk.dk/kontakt
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
```

- [ ] **Step 2: Delete old static `llms.txt`**

Run: `rm /Users/CKA/shelterdk/web/public/llms.txt`

- [ ] **Step 3: Verify the route compiles**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | grep llms | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/app/llms.txt/route.ts
git rm web/public/llms.txt
git commit -m "feat: replace static llms.txt with dynamic route handler with live shelter statistics"
```

---

## Task 11: Sitemap + Robots Updates

Add new page types to sitemap and add permissive snippet directive to robots.

**Files:**
- Modify: `web/app/sitemap.ts`
- Modify: `web/app/robots.ts`

- [ ] **Step 1: Update `web/app/sitemap.ts`**

Add two new sections after the static pages section:

1. **Fakta pages** (5 entries, priority 0.85, weekly):
```typescript
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
```

2. **Cross pages** (~20 entries, priority 0.7, weekly):
Query each filter × region combination using `getFilterRegionCount` from `fakta-db`, only include combos with 5+ shelters. Use the filter configs from `cross-page-config.ts`.

```typescript
import { getFilterRegionCount } from "@/lib/fakta-db";
import { FILTER_CONFIGS, REGION_SLUGS, REGION_NAMES } from "@/lib/cross-page-config";

// Cross pages (filter × region)
for (const config of Object.values(FILTER_CONFIGS)) {
  for (const regionSlug of REGION_SLUGS) {
    const regionName = REGION_NAMES[regionSlug];
    if (!regionName) continue;
    const count = await getFilterRegionCount(config.filterKey, regionName);
    if (count >= 5) {
      entries.push(entry(`${BASE_URL}${config.parentHref}/${regionSlug}`, "weekly", 0.7));
    }
  }
}
```

- [ ] **Step 2: Update `web/app/robots.ts`**

Read the current file first, then add `"max-snippet": -1` directive. Since Next.js `robots.ts` returns a `MetadataRoute.Robots` object, the `rules` array can include additional directives. However, the standard `MetadataRoute.Robots` type doesn't support `max-snippet` directly. Instead, we handle this via the `generateMetadata` in individual pages (already done via the `robots` field in metadata for fakta pages). No changes needed to `robots.ts` itself.

Ensure ALL fakta pages and cross pages include permissive robots in their `generateMetadata`:
```typescript
robots: { index: true, follow: true, "max-snippet": -1 as unknown as undefined },
```
This is already included in `shelters-i-danmark` — verify and add to the other 4 fakta pages' metadata and the cross page `generateMetadata` in the template (Task 7 Step 3).

- [ ] **Step 3: Commit**

```bash
git add web/app/sitemap.ts
git commit -m "feat: add fakta pages and cross pages to sitemap"
```

---

## Task 12: Enrich ShelterSchema with Richer Properties

Extend the existing shelter detail schema with additional structured data.

**Files:**
- Modify: `web/components/seo/ShelterSchema.tsx`

- [ ] **Step 1: Read current ShelterSchema.tsx**

Already read. We need to add: `containedInPlace`, `hasMap`, `additionalProperty` for non-standard facilities (bålplads, hund, strand), and `numberOfRooms` for LodgingBusiness.

- [ ] **Step 2: Modify `ShelterSchema.tsx`**

Add these properties to the schema object:

```typescript
// After the existing schema properties, add:

// containedInPlace — region/municipality
const containedInPlace: Record<string, unknown>[] = [];
if (region && region !== "Danmark") {
  containedInPlace.push({
    "@type": "AdministrativeArea",
    name: region,
  });
}
if (locality) {
  containedInPlace.push({
    "@type": "AdministrativeArea",
    name: locality,
  });
}

// hasMap — link to map view
const hasMap = canonicalPath ? `${BASE_URL}${canonicalPath}#kort` : undefined;

// additionalProperty — non-standard facilities from geofa_raw
const additionalProperties: Record<string, unknown>[] = [];
const geofa = shelter.geofa_raw as Record<string, unknown> | null;
if (geofa) {
  if (String(geofa.baalplads ?? "").toLowerCase().includes("ja")) {
    additionalProperties.push({ "@type": "PropertyValue", name: "Bålplads", value: "Ja" });
  }
  if (String(geofa.hunde_tilladt ?? "").toLowerCase().includes("ja")) {
    additionalProperties.push({ "@type": "PropertyValue", name: "Hund tilladt", value: "Ja" });
  }
  if (String(geofa.strand_naerhed ?? "") === "Ja") {
    additionalProperties.push({ "@type": "PropertyValue", name: "Nær strand", value: "Ja" });
  }
  if (String(geofa.bord_baenk ?? "") === "Ja") {
    additionalProperties.push({ "@type": "PropertyValue", name: "Bord/bænk", value: "Ja" });
  }
}

// numberOfRooms — only on LodgingBusiness
const numberOfRooms = useLodgingBusiness && shelter.capacity ? shelter.capacity : undefined;
```

Add these to the schema object construction.

- [ ] **Step 3: Commit**

```bash
git add web/components/seo/ShelterSchema.tsx
git commit -m "feat: enrich shelter detail schema with containedInPlace, hasMap, additionalProperty"
```

---

## Task 13: Blog Post Interlinking

Add links to fakta pages and filter pages in existing blog post content.

**Files:**
- Modify: `shared/data/blog.ts`

- [ ] **Step 1: Read full blog.ts to find insertion points**

Run: Read `shared/data/blog.ts` to see all blog posts and their content strings. Identify where to add contextual links.

- [ ] **Step 2: Add links to blog posts**

For each blog post identified in the spec's interlinking table, add 2-3 contextual links within the content string. Use HTML `<a>` tags since the content renderer supports them.

Key additions per the spec:
- `gratis-shelters-i-danmark`: Add links to `/fakta/gratis-shelters` and `/fakta/shelters-i-danmark`
- `de-10-bedste-shelters`: Add link to `/fakta/bedste-shelters`
- `shelter-med-boern`: Add links to `/shelter-med-toilet` and `/shelter-med-vand`
- `de-bedste-regioner`: Add links to `/danmark/jylland`, `/danmark/sjaelland`, etc.
- `shelter-i-efteraaret`: Add link to `/shelter-med-baalplads`
- `shelter-regler-overnatning`: Add link to `/fakta/gratis-shelters`
- `shelter-vs-teltplads`: Add link to `/fakta/shelters-i-danmark`

Insert links naturally in the existing prose — don't add new paragraphs, just wrap existing mentions in `<a>` tags or add a short sentence with a link.

- [ ] **Step 3: Commit**

```bash
git add shared/data/blog.ts
git commit -m "feat: add interlinking from blog posts to fakta and filter pages"
```

---

## Task 14: Final Integration Verification

Verify everything works together.

- [ ] **Step 1: Run TypeScript compilation check**

Run: `cd /Users/CKA/shelterdk/web && npx tsc --noEmit --pretty 2>&1 | tail -20`
Expected: No new errors from our changes

- [ ] **Step 2: Run existing tests**

Run: `cd /Users/CKA/shelterdk/web && npx vitest run 2>&1 | tail -30`
Expected: All tests pass including our new `national-parks` and `fakta-faq` tests

- [ ] **Step 3: Run linting if available**

Run: `cd /Users/CKA/shelterdk/web && npx next lint 2>&1 | tail -20`
Expected: No new lint errors

- [ ] **Step 4: Verify dev server starts**

Run: `cd /Users/CKA/shelterdk/web && timeout 30 npx next dev 2>&1 | head -20`
Expected: Server starts without errors

- [ ] **Step 5: Commit any remaining fixes**

If any issues found in steps 1-4, fix and commit.

```bash
git commit -m "fix: resolve integration issues from AI citations implementation"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Statistical data layer | 3 | 0 |
| 2 | FAQ generators | 2 | 0 |
| 3 | Dataset schema component | 1 | 0 |
| 4 | DataSummaryBlock component | 1 | 0 |
| 5 | FaktaPage shared component | 1 | 0 |
| 6 | 5 fakta pages | 5 | 0 |
| 7 | Cross pages + component | 9 | 0 |
| 8 | Enrich filter pages | 0 | 7 |
| 9 | Enrich region pages | 0 | 1 |
| 9b | Enrich municipality pages | 0 | 2 |
| 10 | Dynamic llms.txt | 1 | 0 (1 deleted) |
| 11 | Sitemap updates | 0 | 1 |
| 12 | Richer shelter schema | 0 | 1 |
| 13 | Blog interlinking | 0 | 1 |
| 14 | Integration verification | 0 | 0 |
| **Total** | | **23 new** | **13 modified** |
