# Affiliate Foundation — Phase 1 Design

**Status:** Draft
**Date:** 2026-04-11
**Scope:** Phase 1 of a 3-phase affiliate integration for shelterdk.dk

## Goal

Give shelterdk.dk a credible, low-friction way to embed affiliate product recommendations in editorial content (blog posts, guides) and to surface curated top deals on a dedicated `/tilbud` page and homepage widget. Feed data comes from three partner-ads XML feeds (Backpackerlife.dk, Outdoortid.dk, Outmore.dk — 10.774 products combined).

Success means: (1) the owner can embed a product in an article in under a minute; (2) the owner earns affiliate commissions without compromising the site's editorial, trustworthy tone; (3) the underlying data pipeline is reliable enough to run unattended nightly.

## Non-goals (deliberately out of scope)

Phase 1 is intentionally focused. The following are deferred to later phases or dropped entirely:

- Quiz/wizard for gear recommendations
- Interactive packing lists with checkboxes (deferred to Phase 3)
- Shelter-specific recommendations on shelter detail pages (deferred to Phase 3)
- Category landing pages with Budget/Best-value/Premium tiers (deferred to Phase 2)
- Cross-feed fuzzy price comparison (dropped — limited ROI given only Outmore exposes EAN)
- FOMO / low-stock urgency indicators (dropped)
- Auto-suggestion of products from article text (dropped)
- Price history and "lowest price ever" badges (no historical data available)
- Price-drop email notifications
- User accounts or cross-device saved products
- Faceted search on `/tilbud` (simple filters only in v1)

## High-level architecture

```
┌─────────────────────┐    nightly      ┌──────────────────────┐
│ Partner-ads XML     │ ──────────────▶ │ Supabase             │
│ (3 feeds, 10.774    │   sync script   │ affiliate_products   │
│  products)          │                 └──────────┬───────────┘
└─────────────────────┘                            │
                                                   │
                    ┌──────────────────────────────┼─────────────────────────────┐
                    ▼                              ▼                             ▼
          ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
          │ Blog/guides      │          │ /tilbud page     │          │ /admin/produkter │
          │ ::gear[id] in MD │          │ + homepage       │          │ search + filters │
          │  → GearCard      │          │   widget         │          │ + category map   │
          └──────────────────┘          └──────────────────┘          └──────────────────┘
```

Four moving parts: a nightly sync job, a Supabase table, a rendering layer (GearCard component + markdown syntax extension), and an admin UI.

## Data model

### Table: `affiliate_products`

Stores all normalized products from all feeds.

```sql
create table affiliate_products (
  id                  text primary key,             -- e.g. "outmore-3342540815643"
  retailer            text not null,                -- 'outmore' | 'backpackerlife' | 'outdoortid'
  retailer_product_id text not null,                -- original id from feed
  brand               text,
  product_name        text not null,
  description         text,
  category_raw        text,                         -- original category string from feed
  category_mapped     text,                         -- internal taxonomy slug, nullable
  price               numeric(10,2) not null,       -- nypris
  price_original      numeric(10,2),                -- glpris; null if equal to price
  discount_pct        integer,                      -- 0-100; null if no discount
  shipping_cost       numeric(10,2),
  in_stock            boolean not null default true,
  stock_count         integer,                      -- numeric (Outmore only); null for others
  image_url           text not null,
  affiliate_url       text not null,                -- partner-ads tracking URL
  ean                 text,                         -- Outmore only
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  is_blocked          boolean not null default false,
  blocked_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_products_retailer on affiliate_products(retailer);
create index idx_products_category on affiliate_products(category_mapped);
create index idx_products_discount on affiliate_products(discount_pct desc)
  where in_stock and not is_blocked;
create index idx_products_search on affiliate_products
  using gin(to_tsvector('danish', product_name || ' ' || coalesce(brand,'') || ' ' || coalesce(description,'')));
create index idx_products_last_seen on affiliate_products(last_seen_at);
```

### Table: `affiliate_category_mapping`

Maps raw feed category strings to our internal taxonomy and marks them as whitelisted for `/tilbud`.

```sql
create table affiliate_category_mapping (
  retailer        text not null,
  category_raw    text not null,
  category_mapped text,                       -- e.g. 'sovepose', 'telt', 'pandelampe'
  whitelisted     boolean not null default false,  -- eligible for /tilbud auto-curation
  updated_at      timestamptz not null default now(),
  primary key (retailer, category_raw)
);
```

New raw categories discovered during sync are inserted with `category_mapped = null` and `whitelisted = false`, so the admin can triage them later.

### Table: `affiliate_sync_runs` (optional, for debug)

```sql
create table affiliate_sync_runs (
  id              bigserial primary key,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null,              -- 'running' | 'success' | 'failed'
  retailer        text,                       -- null means 'all'
  products_total  integer,
  products_new    integer,
  products_updated integer,
  products_removed integer,
  error_message   text
);
```

### Favorites

Stored in `localStorage` under key `affiliate-favorites` as a JSON array of product IDs. No database table — the admin is the only user.

### Row-Level Security

- `affiliate_products`: public read where `is_blocked = false`; writes restricted to service role (used by the sync script and admin server actions).
- `affiliate_category_mapping`: public read; writes restricted to service role.
- `affiliate_sync_runs`: no public access; service role only. The admin UI reads it via a server component that uses the service role key.

## Sync pipeline

**Script:** `web/scripts/sync-affiliate-products.ts`

**Responsibilities:**

1. Fetch three XML URLs (stored in environment variables). Retry with exponential backoff on network errors.
2. Parse each feed with `fast-xml-parser` (add as dependency if not already present).
3. Decode from `iso-8859-1` to UTF-8 (all three feeds use iso-8859-1).
4. Normalize each product to the common shape:
   - `id = ${retailer}-${retailer_product_id}`
   - `discount_pct = round((glpris - nypris) / glpris * 100)`, `null` if `≤ 0`
   - `in_stock` = `parseStockField(lagerantal)` — a small utility that handles `"in stock"` / `"in_stock"` / numeric / `"udsolgt"` / missing
   - `stock_count` = `parseInt` of `lagerantal` if numeric, else `null`
   - Look up `(retailer, category_raw)` in `affiliate_category_mapping` to fill `category_mapped` and the whitelist flag
   - Insert unknown `(retailer, category_raw)` pairs into the mapping table with null/false defaults
5. Upsert into `affiliate_products` with `onConflict: 'id'`. Set `last_seen_at = now()`.
6. After upsert, mark products not seen in the last 7 days as `in_stock = false`. This prevents stale "in-stock" state if a product disappears from the feed.
7. Record stats to `affiliate_sync_runs`.

**Orchestration:**

- **Nightly cron:** Netlify scheduled function at `0 3 * * *` (03:00 Europe/Copenhagen).
- **Manual trigger:** `npm run sync-products` locally; and a button in `/admin/produkter` that invokes the same entry point via a server action.

**Environment variables:**

- `PARTNER_ADS_BACKPACKERLIFE_URL`
- `PARTNER_ADS_OUTDOORTID_URL`
- `PARTNER_ADS_OUTMORE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (already present)

### Stock field parser

```typescript
function parseStockField(raw: string | null): { in_stock: boolean; stock_count: number | null } {
  if (!raw) return { in_stock: false, stock_count: null };
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'in stock' || trimmed === 'in_stock' || trimmed === 'på lager') {
    return { in_stock: true, stock_count: null };
  }
  if (trimmed === 'udsolgt' || trimmed === 'out of stock' || trimmed === '0') {
    return { in_stock: false, stock_count: 0 };
  }
  const n = parseInt(trimmed, 10);
  if (!isNaN(n)) return { in_stock: n > 0, stock_count: n };
  return { in_stock: false, stock_count: null };  // unknown format → treat as OOS
}
```

## GearCard component

**File:** `web/components/GearCard.tsx`

**API:**

```tsx
interface GearCardProps {
  id: string;                                        // e.g. "outmore-3342540815643"
  variant?: 'editorial' | 'product' | 'pill';       // default: 'editorial'
  className?: string;
}
```

### Variants

- **`editorial`** — Used in articles (via markdown) and inside `::gear-group[...]`. Flex layout, 96px product image on the left, accent-colored left border (`#C5A059`), serif product title (Playfair Display), compact price display, text-link CTA ("Se tilbud hos {retailer} →"). No shadow, no badge. Matches site's editorial tone.

- **`product`** — Used on `/tilbud` grid and the homepage widget. Taller card with drop shadow, 140px image, prominent discount badge in accent color, solid button CTA ("Se tilbud"). A more commercial look — appropriate where users expect product listings.

- **`pill`** — Used inline in article prose via `::gear-inline[id]`. A compact rounded chip that `display: inline-flex`, meant to sit in the middle of a sentence without breaking flow. Shows a small circular image, product name, price, and discount.

### Data fetching

The component is an async server component. To avoid N+1 queries when multiple cards appear on one page, data is pre-fetched in a batch by the caller (see "Pre-fetching in renderContent" below).

**Cache layer:**

```typescript
// web/lib/affiliate-products.ts
import { cache } from 'react';

export const getProduct = cache(async (id: string): Promise<Product | null> => { ... });
export const getProducts = cache(async (ids: string[]): Promise<Map<string, Product>> => { ... });
```

`cache()` gives us request-level deduplication. If two GearCards on the same page both call `getProduct('x')`, only one Supabase query fires.

### Fallback states

| State | Behavior |
|---|---|
| Product not found | Render nothing. Insert `<!-- GearCard {id} not found -->` comment. Log `console.warn` on the server. |
| `is_blocked = true` | Render nothing (same as "not found"). |
| `in_stock = false` | Render the card with a grey "Udsolgt lige nu" overlay badge. CTA still clickable as a fallback in case it comes back. |
| Image 404 | `onError` swaps to a retailer-logo or category-icon fallback. |

### Image handling

- `next/image` with `unoptimized` prop (external images under retailers' control; we don't want Next.js to proxy and cache them).
- No LQIP blur generation for affiliate products (unlike shelter images). Fallback: `bg-primary/5` while loading.

### Link compliance

All `<a>` elements with affiliate URLs must include:

```html
<a href="{affiliate_url}" rel="sponsored nofollow noopener" target="_blank">
```

The `rel="sponsored"` attribute is Google's official method for marking affiliate links, important for SEO.

### Visual disclosure

- `editorial` and `product` variants: a small grey line at the bottom: `Annonce · Sponsoreret link`, clickable to `/annoncer-og-partnere`.
- `pill` variant: an info icon with a tooltip showing the disclosure.

## Markdown directive syntax

**File:** `web/lib/renderContent.tsx` (extended)

Three new directives, each living as its own paragraph or inline:

```markdown
::gear[outmore-3342540815643]
::gear-inline[outmore-3342540815643]
::gear-group[outmore-123, backpackerlife-456, outdoortid-789]
```

### Parsing strategy

- **Block directives** (`::gear[id]`, `::gear-group[...]`): match on a per-paragraph regex `^::(gear|gear-group)\[([^\]]+)\]$` applied during the existing `\n\n+` block split. Matched blocks render as `<GearCard>` (editorial variant) or a grid of `<GearCard>`s.
- **Inline directive** (`::gear-inline[id]`): extends the existing `renderInline()` function (which already handles `[label](url)` and `**bold**`) with a new regex: `::gear-inline\[([^\]]+)\]`. The matched id renders as a `<GearCard variant="pill">` inlined into the text flow.

### Async migration

`renderContent` is currently synchronous. Since GearCards need to fetch from Supabase, `renderContent` becomes async:

```typescript
export async function renderContent(content: string): Promise<JSX.Element[]>
```

**Callers:** `blog/[slug]/page.tsx` and `guides/[slug]/page.tsx` — both already async server components. Update call sites to `await renderContent(post.content)`. No other consumers.

### Pre-fetch optimization

Before rendering, scan `content` for all gear ids:

```typescript
function extractGearIds(content: string): string[] {
  const ids = new Set<string>();
  const blockRegex = /^::(gear|gear-group)\[([^\]]+)\]$/gm;
  const inlineRegex = /::gear-inline\[([^\]]+)\]/g;
  // ... collect all ids
  return [...ids];
}
```

Fetch all ids in one batched `getProducts(ids)` call, then pass the resulting `Map<string, Product>` into `renderContent` so each directive looks up its product from the map instead of hitting the DB per directive.

### Backwards compatibility

All existing blog posts and guides contain no `::gear` directives. The new regex matches nothing in existing content; behavior for non-gear content is unchanged.

### Where directives can be used

- Blog posts (`BlogPost.content`)
- Guides (`Guide.content`)
- **Not** in category pages, shelter detail pages, etc. — those use `<GearCard>` directly in JSX.

## Admin UI: `/admin/produkter`

Lives under the existing `/admin` module and inherits its auth. Two pages:

### Main page (`/admin/produkter/page.tsx`)

A two-column layout: filters sidebar on the left, product list on the right.

**Top bar:**
- Title: "Produkter"
- "Sync nu" button + last sync timestamp and status indicator (green check / red cross)

**Filters sidebar:**
- Retailer multi-select (checkboxes, all checked by default)
- Category multi-select (grouped by count)
- Discount range slider (0-80%, default 0)
- Toggle: "Kun på lager"
- Toggle: "Kun blokeret"
- Toggle: "Kun favoritter" (reads from localStorage)
- "Ryd filtre" button

**Main column:**
- Search field (full-text search on brand + product_name + description)
- 300ms debounce, minimum 2 characters
- Product rows: 60px image, brand + name + retailer + category + price + discount, three action buttons (Copy ID, Favorite toggle, Block)
- Pagination: 25 per page, server-side range query
- URL-synced filter state so back/forward navigation works

**Actions:**

- **Copy ID:** Copies `outmore-3342540815643` to clipboard. Toast: "ID kopieret — indsæt `::gear[id]` i din artikel".
- **Favorite:** Toggles the product ID in `localStorage.affiliate-favorites`.
- **Block:** Server action that sets `is_blocked = true`. Opens a small modal or prompt for reason. Optimistic UI update.

**Sync button:**

Server action triggers the sync script as a foreground job. Button becomes a spinner; query-invalidates after completion. For initial deployment, this will block for ~30-60 seconds — acceptable for an admin-only page. Can be improved later with a background queue if it becomes annoying.

### Category mapping page (`/admin/produkter/kategorier`)

Separate page for managing `affiliate_category_mapping`.

- Table: retailer, category_raw, product count, category_mapped (editable), whitelisted (checkbox)
- Unknown categories (`category_mapped IS NULL`) sorted to the top with a yellow indicator
- Inline editing via server actions

### Components

- `AdminProductsPage` — server component, loads initial state from URL params
- `AdminProductsClient` — client component, holds live search state, uses `useTransition` for smooth filter updates
- `AdminProductRow` — client component with action buttons
- `AdminSyncStatusBar` — server component, reads from `affiliate_sync_runs`
- `AdminCategoryMappingTable` — client component for the mapping page

### Data query

For the main list, only fetch columns needed:

```typescript
supabase
  .from('affiliate_products')
  .select('id, retailer, brand, product_name, price, price_original, discount_pct, image_url, category_mapped, in_stock, is_blocked')
  .range(offset, offset + 24)
```

Full product details are fetched on demand if needed.

## `/tilbud` page + homepage widget

### `/tilbud` page

**Route:** `web/app/(site)/tilbud/page.tsx` — server component, ISR with 6-hour revalidation.

**Layout:**

1. Hero section: title, subtitle, inline disclaimer with link to `/annoncer-og-partnere`
2. Filter bar: category dropdown, retailer dropdown, minimum discount slider
3. Product grid: `GearCard variant="product"`, 3 columns desktop, 2 tablet, 1 mobile
4. Pagination (40 products per "page" of results after diversification)

**Query:**

```typescript
async function getTopDeals(params: FilterParams): Promise<Product[]> {
  const rawList = await supabase
    .from('affiliate_products')
    .select('*')
    .eq('in_stock', true)
    .eq('is_blocked', false)
    .gte('discount_pct', params.minDiscount ?? 25)
    .in('category_mapped', /* whitelisted categories */)
    .order('discount_pct', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(200);

  return diversify(rawList, { maxPerCategory: 4, targetSize: 40 });
}
```

### Category diversification

Without this, the top 40 would likely be 40 identical-category products (e.g. 40 headlamps all on 60%+ discount). We pull the top 200 and run a simple round-robin cap:

```typescript
function diversify(products: Product[], opts: { maxPerCategory: number; targetSize: number }): Product[] {
  const result: Product[] = [];
  const countByCategory: Record<string, number> = {};
  for (const p of products) {
    const cat = p.category_mapped ?? 'other';
    if ((countByCategory[cat] ?? 0) < opts.maxPerCategory) {
      result.push(p);
      countByCategory[cat] = (countByCategory[cat] ?? 0) + 1;
    }
    if (result.length >= opts.targetSize) break;
  }
  return result;
}
```

### Filters

Filters change URL search params → server re-queries. On mobile, filters open in a bottom sheet; on desktop, they're a dropdown row above the grid.

### Empty state

If zero products match: show a calm message, a "reset filters" button, and the 3-4 largest discounts site-wide as suggestions.

### SEO

- `<title>`: "Ugens bedste outdoor-tilbud | ShelterDK"
- Meta description: "De største prisfald på telte, soveposer, pandelamper og outdoor-grej — kurateret dagligt fra vores partnere."
- `/tilbud` added to sitemap
- `robots`: indexable

### Navigation

New "Tilbud" menu item in the main nav. Exact placement TBD in PR review.

### Homepage widget

**File:** `web/components/HomepageDealsWidget.tsx`

- Section heading: "Ugens outdoor-tilbud" in serif, with "Se alle →" link on the right
- 4 products in `product` variant on desktop, 2 on tablet, horizontal scroll-snap on mobile (reuses the existing ImageCarousel scroll technique)
- Rotation: shuffles the top 20 diversified deals and picks 4. The shuffle uses a 1-hour time-bucket seed so SSR caching still works for a reasonable window.
- CTA button: "Se alle tilbud →" linking to `/tilbud`
- Placement on homepage: TBD in PR review (likely below the existing shelter grid)

## Disclaimer & compliance

### `/annoncer-og-partnere` page

**Route:** `web/app/(site)/annoncer-og-partnere/page.tsx`

Content sections:

1. Headline: "Annoncer, partnere & hvordan ShelterDK finansieres"
2. Short explanation: the site is free, financed in part through affiliate links, and clicking costs users nothing extra
3. Partner list: Backpackerlife.dk, Outdoortid.dk, Outmore.dk with short descriptions
4. "Vores løfte": we only recommend gear we'd use ourselves; prices and stock are updated daily; we always show the discount percentage clearly; we're not paid to place specific products
5. "Hvad hvis du ser en forkert pris?" with a contact link
6. Legal baseline: Markedsføringsloven §6 compliance note, GDPR note that clicking partner links may set retailer-side tracking cookies

### Footer

New link "Annoncer & partnere" in the footer, grouped with "Privatlivspolitik" and "Vilkår".

### On-card disclosure

- `editorial` and `product` variants: "Annonce · Sponsoreret link" in small grey text at the bottom of each card, linking to `/annoncer-og-partnere`
- `pill` variant: info icon with tooltip
- On `/tilbud`: a brief disclosure box at the top of the page

### HTML `rel` attribute

All affiliate links use `rel="sponsored nofollow noopener"` per Google's affiliate link guidelines.

## Error handling

| Scenario | Behavior |
|---|---|
| Sync: XML URL fetch fails / timeout | Log, record in `affiliate_sync_runs` as failed, retry next schedule, no alarm |
| Sync: XML parser error on a single product | Log the offending data, skip that product, continue |
| Sync: Supabase upsert fails | Retry 3x with backoff, then exit non-zero (Netlify marks job as failed) |
| Article references non-existent gear id | `renderContent` skips the block, inserts HTML comment, logs to server console |
| Product is out of stock | Render the card in grey "Udsolgt" state, link still clickable |
| Product image 404s | `onError` swaps to retailer-logo or category-icon fallback |
| `/tilbud` returns zero results (sync failed for days) | Calm empty state, "Kig tilbage snart" message, still show "Se alle"-button |
| Netlify scheduled function fails | Netlify sends owner email notification; manual fallback via `npm run sync-products` or admin sync button |

## Testing

### Unit tests (Vitest)

- **`parseAffiliateFeed.test.ts`** — one test per feed format, using real sample XML files. Verifies:
  - Discount calculation is correct
  - iso-8859-1 characters (æøå) are decoded properly
  - Stock field parser handles all known formats
  - Empty/malformed products are skipped, not crashed on
- **`renderContent.test.ts`** — extend existing tests (if any) with:
  - `::gear[id]` directive renders a `<GearCard variant="editorial">`
  - `::gear-group[a,b,c]` renders a grid of cards
  - `::gear-inline[id]` renders a pill inline inside a paragraph
  - Non-existent id renders nothing + inserts HTML comment
  - Backwards compatibility: all existing blog content renders identically to before
- **`diversify.test.ts`** — verifies category diversification caps

### Component tests (React Testing Library)

- `GearCard.test.tsx` — mock product data, verify each variant renders correctly and shows the right disclosure text
- `GearCard` with non-existent id returns null

### E2E smoke tests (Playwright)

Extend existing e2e suite with one smoke test:
- Visit `/tilbud`, verify at least one product card is visible
- Visit `/annoncer-og-partnere`, verify the page loads

### Manual smoke test checklist (pre-merge)

1. `npm run sync-products` → ~10.774 products in `affiliate_products`
2. Visit `/admin/produkter` → search, filter, copy a product id
3. Add `::gear[{id}]` to a blog post, render locally → verify card appears
4. Visit `/tilbud` → verify products shown, filters work, pagination works
5. Visit `/` → verify homepage widget renders 4 products
6. Click an affiliate link → verify the partner-ads tracking URL opens in a new tab
7. Visit `/annoncer-og-partnere` → verify the page exists and is linked from the footer

## Phase 1 deliverables checklist

- [ ] Supabase: `affiliate_products`, `affiliate_category_mapping`, `affiliate_sync_runs` tables + indexes + RLS
- [ ] `web/scripts/sync-affiliate-products.ts` with fast-xml-parser, iso-8859-1 decoding, upsert pipeline
- [ ] Netlify scheduled function wiring
- [ ] `npm run sync-products` script
- [ ] `web/components/GearCard.tsx` with three variants
- [ ] `web/lib/affiliate-products.ts` with `cache()`-wrapped getters
- [ ] Extension of `web/lib/renderContent.tsx` for `::gear`, `::gear-group`, `::gear-inline` directives
- [ ] Async migration of `renderContent` + updates to `blog/[slug]/page.tsx` and `guides/[slug]/page.tsx`
- [ ] `/admin/produkter` main page (server + client components)
- [ ] `/admin/produkter/kategorier` category mapping page
- [ ] `/tilbud` page (hero, filters, grid, pagination, SEO)
- [ ] `HomepageDealsWidget` component + placement on `/`
- [ ] "Tilbud" menu item in main nav
- [ ] `/annoncer-og-partnere` page
- [ ] Footer link to `/annoncer-og-partnere`
- [ ] Unit tests: parseAffiliateFeed, renderContent extensions, diversify
- [ ] Component tests: GearCard variants
- [ ] E2E smoke test: `/tilbud` renders
- [ ] Manual smoke test checklist walked through

## Open questions to resolve during implementation

These are small-enough that they can be decided in the implementation PR rather than here:

1. Exact placement of `HomepageDealsWidget` on the homepage — below shelter grid, or somewhere else?
2. Exact placement of "Tilbud" menu item in the main nav
3. Whether `/admin/produkter` should use server actions or API routes for sync/block (consistency with the rest of `/admin` should decide)
4. Whether the category-mapping seed file should ship with a pre-populated set of common mappings (e.g. Outmore's "Pandelampe" → `pandelampe`), or whether we start with an empty mapping and build it from real sync data
5. Whether to show the `price_original` when `discount_pct` is null (currently: no, only show current price)
