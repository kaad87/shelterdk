# AI Citations Strategy: Data Authority Design

## Goal

Be the single most data-rich, citable source for Danish shelter information across all AI platforms (ChatGPT, Perplexity, Gemini, Copilot, Google AI Overview) — without sacrificing existing SEO.

## Current State

- shelterdk.dk appears in only 2 out of 10 key shelter-related searches ("shelter regler danmark" and "sheltertur for begyndere")
- naturstyrelsen.dk (7/10) and backpackerlife.dk (7/10) dominate search results
- AI overviews exist for all 10 tested queries, mostly citing naturstyrelsen.dk and udinaturen.dk
- ShelterDK has 1600+ shelters with structured data (toilet, water, capacity, ratings, GPS, geofa_raw) — more than any competitor — but this data isn't surfaced as citable content
- Existing schema is good (Campground, BlogPosting, FAQPage, Breadcrumb, ItemList) but inconsistent across page types
- Blog interlinking is systematic (8/10) but blogs don't link to data pages, and data pages don't link back to blog/guides
- 15 blog posts, 9 guides, static llms.txt exists

### Competitive Landscape

| Domain | Search Visibility (out of 10 queries) | Strength |
|---|---|---|
| naturstyrelsen.dk | 7 | Government authority, rules/regulations |
| backpackerlife.dk | 7 | Comprehensive editorial guides |
| shelterture.dk | 6 | Niche practical content (pakkeliste, counts) |
| friluftsraadet.dk | 5 | Institutional authority |
| dds.dk | 4 | Curated "best of" lists |
| shelterdk.dk | 2 | Data-rich but not surfaced |

### Unsaturated Queries (Opportunities)

These queries lack a clear authoritative source:
- "shelter med toilet i [region]" — fragmented regional tourism pages
- "bedste shelters danmark" — subjective listicles, no data-backed ranking
- "hvor mange shelters er der i danmark" — no single definitive answer page
- "shelter vs teltplads" — only one semi-relevant result
- "shelters i [specific nationalpark]" — no comprehensive cross-park resource

## Design

### 1. New Auto-Generated Fakta Pages (~5 pages)

Definitive statistics pages that answer specific questions with real numbers from the database. These are the highest-value pages for AI citations because they provide unique, concrete facts no competitor has.

**Pages:**

| Page | URL | Primary Question Answered |
|---|---|---|
| Shelters i Danmark | `/fakta/shelters-i-danmark` | "Hvor mange shelters er der i Danmark?" |
| Faciliteter | `/fakta/shelters-med-faciliteter` | "Hvilke faciliteter har shelters i Danmark?" |
| Bedste shelters | `/fakta/bedste-shelters` | "Hvad er de bedste shelters i Danmark?" |
| Gratis shelters | `/fakta/gratis-shelters` | "Er shelters gratis i Danmark?" |
| Nationalparker | `/fakta/shelters-i-nationalparker` | "Hvor er der shelters i nationalparker?" |

**Content structure per fakta page:**

1. H1 with the definitive answer in the first sentence — e.g. "Der er 1.643 shelters i Danmark (opdateret marts 2026)"
2. Summary paragraph with 3-4 key facts (this is what AI bots extract)
3. Breakdown table (by region, by facility, etc.)
4. Top-N ranked list with shelter cards linking to detail pages
5. FAQ section with 5-6 auto-generated Q&As, all answered with real numbers
6. "Læs mere" section linking to related guides, blog posts, and filter pages

**Implementation:**
- ISR pages querying Supabase at build/revalidation time
- `export const revalidate = 86400` (24h) — ISR stale-while-revalidate serves cached page if Supabase is down
- Statically generated at build time via `generateStaticParams()` (fixed URLs, no dynamic params needed)
- Shared `generateFaktaMetadata()` helper for consistent SEO metadata (title, description, canonical, OG image)
- FAQPage JSON-LD with data-backed answers
- ItemList JSON-LD for ranked shelter lists
- Dataset schema (schema.org/Dataset) on each fakta page:

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Shelters i Danmark - Komplet statistik",
  "description": "Opdateret statistik over alle 1.643 shelters i Danmark",
  "url": "https://shelterdk.dk/fakta/shelters-i-danmark",
  "creator": { "@type": "Organization", "name": "ShelterDK", "url": "https://shelterdk.dk" },
  "dateModified": "[auto-date]",
  "spatialCoverage": { "@type": "Place", "name": "Danmark" },
  "variableMeasured": ["shelter count", "facility availability", "Google rating"],
  "license": "https://creativecommons.org/licenses/by/4.0/"
}
```

**Nationalpark data source:**

The `geofa_raw` JSON field on shelters contains geographic metadata from GeoFA. To map shelters to national parks, use a static mapping of national park bounding boxes (5 parks: Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land, Kongernes Nordsjælland). At query time, filter shelters by `lat`/`lon` within each park's bounding box. This is a geographic lookup, not a database column. The mapping is defined once in a shared constant and used by the fakta page query.

### 2. New Filter × Region Cross Pages (~20 pages)

Crossing the 7 facility filters with 4 regions. Only generated where the segment has 5+ shelters.

**URL pattern:** `/shelter-med-[facility]/[region]`

**Examples:**
- `/shelter-med-toilet/jylland` — "47 shelters med toilet i Jylland"
- `/shelter-med-toilet/sjaelland` — "82 shelters med toilet på Sjælland"
- `/shelter-med-baalplads/jylland` — "Shelters med bålplads i Jylland"
- `/shelter-med-hund/sjaelland` — "Hundevenlige shelters på Sjælland"

**Potential matrix (7 filters × 4 regions = 28 max, ~20 after threshold):**

| Filter | Jylland | Sjælland | Fyn | Bornholm |
|---|---|---|---|---|
| Toilet | ✅ | ✅ | ✅ | ? |
| Vand | ✅ | ✅ | ✅ | ? |
| Bålplads | ✅ | ✅ | ? | ? |
| Hund | ✅ | ✅ | ? | ? |
| Strand | ✅ | ✅ | ? | ? |
| Bruser | ✅ | ? | ? | ? |
| Booking | ✅ | ✅ | ? | ? |

(✅ = likely above 5-shelter threshold, ? = check at build time)

**Content structure per cross page:**

1. H1: "Shelters med toilet i Jylland"
2. Data summary: exact count, average rating, free vs. paid breakdown
3. Breakdown by kommune (table with counts)
4. Top 5 highest-rated in this segment with shelter cards
5. Full shelter list
6. FAQ schema with 4-5 Q&As using real data
7. Internal links: parent filter page, region page, related cross pages, relevant blog/guide content

**Routing implementation:**

The existing filter pages are static directories (`web/app/(site)/shelter-med-toilet/page.tsx`, etc.). To add region sub-pages, add a `[region]/page.tsx` inside each existing filter directory:

```
web/app/(site)/shelter-med-toilet/page.tsx          (existing — unchanged)
web/app/(site)/shelter-med-toilet/[region]/page.tsx  (new)
web/app/(site)/shelter-med-vand/page.tsx             (existing — unchanged)
web/app/(site)/shelter-med-vand/[region]/page.tsx    (new)
... etc for each filter
```

For `/shelter-booking`, the same pattern applies: `web/app/(site)/shelter-booking/[region]/page.tsx`. The URL becomes `/shelter-booking/jylland` (not `/shelter-med-booking/jylland`), consistent with the parent page's existing URL.

To reduce duplication across 7+ filter directories, extract a shared `CrossFilterRegionPage` component that takes the filter config as a prop. Each `[region]/page.tsx` is a thin wrapper calling this shared component.

**Region slug mapping:**

The `[region]` parameter uses the same slugs as `/danmark/[region]`: `jylland`, `sjaelland`, `fyn`, `bornholm`. These are matched against the `region` column in the shelters table. Use `generateStaticParams()` to enumerate only valid region slugs, with `dynamicParams = false` so unknown regions return 404.

**Threshold handling:**

The 5-shelter minimum is enforced at build time via `generateStaticParams()`. Query Supabase for each filter × region combination, and only include combinations with 5+ shelters in the returned params array. Combinations below threshold simply don't get a page generated — they 404. This avoids redirect complexity and is safe because the pages can be added later if shelter counts grow. Re-evaluated on each rebuild/revalidation.

**ISR and error handling:**

Use `export const revalidate = 86400` (24h), matching existing region pages. ISR's stale-while-revalidate behavior means if Supabase is down during revalidation, the previously generated page is served. This prevents serving empty/zero data.

**Sitemap:**

Add cross pages to `web/app/sitemap.ts` with priority 0.7, weekly change frequency. Query the same threshold check used by `generateStaticParams` to keep the sitemap in sync.

**Canonical URLs and OG metadata:**

Each cross page gets its own canonical URL (e.g. `https://shelterdk.dk/shelter-med-toilet/jylland`) — not pointing to a parent. OG metadata follows the existing pattern: `generateMetadata()` returns title, description, canonical, and OG image.

### 3. Enrich Existing Pages

#### 3a. Computed facts on filter pages

Add auto-generated data summary block at top of each existing filter page (`/shelter-med-toilet`, `/shelter-med-vand`, etc.):

```
"Der er 312 shelters med toilet i Danmark.
Jylland har flest (187), efterfulgt af Sjælland (82) og Fyn (43).
Den gennemsnitlige Google-bedømmelse er 4.2 ud af 5."
```

Data points per filter page:
- Total count for this filter
- Per-region breakdown (top 3)
- Average Google rating for this segment
- Booking availability percentage
- Links to filter × region sub-pages

#### 3b. Computed facts on region pages

Add data summary block at top of each region page (`/danmark/jylland`, etc.):

```
"Jylland har 623 shelters. 412 er gratis, 187 har toilet,
203 har vand, og 156 tillader hund."
```

Data points per region page:
- Total shelter count
- Free vs. paid breakdown
- Per-facility counts (toilet, water, bålplads, hund, strand, bruser)
- Booking availability count
- Links to filter × region sub-pages for this region

#### 3c. Expanded FAQ schema on existing pages

Add auto-generated FAQ to page types that currently lack it:

**Filter pages** (5-6 Q&As each):
- "Hvor mange shelters med [facility] er der i Danmark?"
- "Hvilken region har flest shelters med [facility]?"
- "Er shelters med [facility] gratis?"
- "Kan man booke shelter med [facility]?"
- "Hvad er den bedst bedømte shelter med [facility]?"

**Region pages** (5-6 Q&As each):
- "Hvor mange shelters er der i [region]?"
- "Har shelters i [region] toilet?"
- "Kan man have hund med i shelter i [region]?"
- "Hvad koster det at overnatte i shelter i [region]?"
- "Hvad er den bedst bedømte shelter i [region]?"

**Municipality pages** (3-4 Q&As each):
- "Hvor mange shelters er der i [kommune]?"
- "Hvilke faciliteter har shelters i [kommune]?"
- "Er der gratis shelters i [kommune]?"

All FAQ answers populated with real numbers from database. All wrapped in FAQPage JSON-LD.

#### 3d. Richer shelter detail schema

Extend existing Campground/LodgingBusiness JSON-LD. The existing `ShelterSchema.tsx` already supports a `useLodgingBusiness` prop. For shelters with capacity data, use `LodgingBusiness` type which supports `numberOfRooms`. For shelters without capacity, keep `Campground`.

New properties:
- `numberOfRooms` — capacity as integer (only on `LodgingBusiness` type, not valid on `Campground`)
- `amenityFeature` — expand existing array with more structured LocationFeatureSpecification items
- `containedInPlace` — linking to region/municipality with `@type: "AdministrativeArea"`
- `hasMap` — URL pointing to map view with this shelter centered
- `additionalProperty` — for non-standard facilities (bålplads, hund) using PropertyValue with `name`/`value` pairs

### 4. Interlinking Strategy

#### 4a. Blog posts → data pages (biggest current gap)

Blog posts currently link to `/soeg` and guides but almost never to filter pages, region pages, or shelter details. Add 2-3 contextual links per post:

| Blog Post | New Links To |
|---|---|
| `gratis-shelters-i-danmark` | `/fakta/gratis-shelters`, `/fakta/shelters-i-danmark` |
| `de-10-bedste-shelters` | `/fakta/bedste-shelters`, individual shelter detail pages |
| `shelter-med-boern` | `/shelter-med-toilet`, `/shelter-med-vand` |
| `de-bedste-regioner` | `/danmark/jylland`, `/danmark/sjaelland`, `/danmark/fyn`, `/danmark/bornholm` |
| `shelter-i-efteraaret` | `/shelter-med-baalplads`, relevant region pages |
| `shelter-regler-overnatning` | `/fakta/gratis-shelters`, `/shelter-booking` |
| `shelter-vs-teltplads` | `/fakta/shelters-i-danmark` |
| `shelter-i-nationalparker` (guide) | `/fakta/shelters-i-nationalparker` |
| `shelter-for-begyndere` (guide) | `/fakta/shelters-med-faciliteter` |
| `pakkeliste-til-sheltertur` (guide) | `/shelter-med-toilet`, `/shelter-med-vand` |

#### 4b. Data pages → blog/guide content (reverse links)

Add "Læs mere" section at bottom of every data page with 2-3 relevant content links:

| Data Page | Links To |
|---|---|
| `/shelter-med-toilet` | "Regler for shelter" guide, "Hvordan vælge shelter" blog |
| `/shelter-med-hund` | "Shelter etiquette" blog, "Begynder" guide |
| `/danmark/jylland` | "De bedste regioner" blog, "Nationalparker" guide |
| `/fakta/shelters-i-danmark` | beginner guide, rules guide |
| `/fakta/bedste-shelters` | "De 10 bedste shelters" blog, "Hvordan vælge shelter" blog |
| `/fakta/gratis-shelters` | "Gratis shelters" blog, rules guide |

#### 4c. New fakta pages fully interlinked

Each fakta page links to:
- Related filter/region pages
- Other fakta pages (e.g. `/fakta/bedste-shelters` ↔ `/fakta/shelters-med-faciliteter`)
- 2-3 relevant blog posts or guides
- Individual shelter detail pages in top-N lists

#### 4d. Cross pages interlinked

Each filter × region page links to:
- Parent filter page (e.g. `/shelter-med-toilet`)
- Parent region page (e.g. `/danmark/jylland`)
- Other regions for same filter ("Se også: Shelters med toilet på Sjælland")
- Other filters for same region ("Andre faciliteter i Jylland: Vand, Bålplads")
- 1-2 relevant blog/guide links

### 5. Schema & llms.txt Optimization

#### 5a. Schema consistency audit

Standardize across all page types:

| Page Type | BreadcrumbList | ItemList | FAQPage | Dataset |
|---|---|---|---|---|
| Shelter detail | ✅ (exists) | — | ✅ (exists) | — |
| Filter pages | ✅ (add) | ✅ (add) | ✅ (add) | — |
| Region pages | ✅ (exists) | ✅ (exists) | ✅ (add) | — |
| Municipality pages | ✅ (add) | ✅ (add) | ✅ (add) | — |
| Fakta pages | ✅ (new) | ✅ (new) | ✅ (new) | ✅ (new) |
| Cross pages | ✅ (new) | ✅ (new) | ✅ (new) | — |
| Blog posts | ✅ (exists) | — | ✅ (exists on some) | — |
| Guides | ✅ (exists) | — | ✅ (exists on some) | — |

#### 5b. Dynamic llms.txt

Replace static `/public/llms.txt` with a Next.js route handler at `/app/llms.txt/route.ts`:

- Queries Supabase for live shelter counts and facility statistics
- Caches response for 24h (same ISR cadence as data pages)
- Returns structured, machine-readable content with real numbers

**Structure:**

```
# ShelterDK - Danmarks mest komplette shelter-database

## Nøgletal (opdateret [auto-date])
- Antal shelters i alt: [live count]
- Shelters med toilet: [count]
- Shelters med vand: [count]
- Shelters med bålplads: [count]
- Shelters der tillader hund: [count]
- Gratis shelters: [count]
- Shelters der kan bookes: [count]

## Regioner
- Jylland: [count] shelters
- Sjælland: [count] shelters
- Fyn: [count] shelters
- Bornholm: [count] shelters

## Sider med detaljeret data
- /fakta/shelters-i-danmark — Komplet statistik over alle shelters
- /fakta/bedste-shelters — Højest bedømte shelters baseret på Google anmeldelser
- /fakta/gratis-shelters — Oversigt over gratis vs. betalte shelters
- /fakta/shelters-med-faciliteter — Facilitetsstatistik på tværs af alle shelters
- /fakta/shelters-i-nationalparker — Shelters fordelt på nationalparker

## Filtre
- /shelter-med-toilet — [count] shelters med toilet
- /shelter-med-vand — [count] shelters med vand
- /shelter-med-baalplads — [count] shelters med bålplads
- /shelter-med-hund — [count] shelters der tillader hund
- /shelter-med-strand — [count] shelters nær strand
- /shelter-med-bruser — [count] shelters med bruser
- /shelter-booking — [count] shelters der kan bookes

## Datakilder
Shelter-data er aggregeret fra GeoFA (Geodata For Alle),
Naturstyrelsen, og udinaturen.dk.
Google-bedømmelser via Google Places API.
```

#### 5c. Sitemap updates

Add all new page types to `web/app/sitemap.ts`:

| Page Type | Priority | Change Frequency |
|---|---|---|
| Fakta pages (5) | 0.85 | weekly |
| Cross pages (~20) | 0.7 | weekly |
| Dynamic `llms.txt` | not included | — |

#### 5d. Meta robots

Ensure no restrictive snippet directives exist. Add `max-snippet:-1` to allow AI bots to extract longer snippets from fakta and cross pages. The existing `robots.ts` does not restrict snippets, but explicitly setting permissive values signals intent.

### 6. Blog Post Enrichment for Unsaturated Queries

Light updates to existing blog post content (in `shared/data/blog.ts`) to target queries where no authority exists:

- **`shelter-vs-teltplads`** — Add real data: "Der er X shelters vs Y teltpladser i Danmark. Shelters har gennemsnitligt..." Consider adding HowTo schema.
- **`de-10-bedste-shelters`** — Replace editorial picks with data-backed ranking referencing `/fakta/bedste-shelters`.
- **`gratis-shelters-i-danmark`** — Add exact counts from database, link to `/fakta/gratis-shelters`.

### 7. Measurement

Track AI citation progress:
- Google Search Console for AI Overview appearances and click-through rates
- Manual periodic checks: ask ChatGPT, Perplexity, Gemini about Danish shelters and log whether shelterdk.dk is cited
- Monitor referral traffic from AI chatbot domains (chatgpt.com, perplexity.ai) in analytics
- Track impressions and clicks on new fakta pages in Search Console
- Re-run the 10-query benchmark monthly to measure visibility improvement

## Summary

| What | Count | Effort Level |
|---|---|---|
| New fakta pages | ~5 | Auto-generated from DB |
| New filter × region cross pages | ~20 | Auto-generated from DB |
| Enriched existing pages (facts + FAQ) | ~50+ | Template-driven, auto-generated |
| Interlinking updates | ~30 pages touched | Systematic, mostly in data files |
| Schema improvements | All page types | Template changes |
| Dynamic llms.txt | 1 route handler | New Next.js route |
| Blog post enrichment | ~10 posts | Manual link additions in data files |

**Total new pages: ~25-30. Total pages enriched: ~80+. Manual writing: near zero.**

## Constraints

- Must not break existing SEO rankings — all changes are additive
- Auto-generated content must read naturally in Danish
- Thin pages (under 5 shelters in a segment) must not be created — redirect to parent page instead
- All new pages follow existing design patterns and component library
- ISR revalidation ensures data freshness without full rebuilds
- No duplicate content: each page answers a distinct question with unique data combinations

## Out of Scope

- Writing new blog posts or guides from scratch (existing content is enriched, not expanded)
- Paid advertising or link building
- Changes to the Android app (separate project)
- User-generated content features
- Multi-language support
