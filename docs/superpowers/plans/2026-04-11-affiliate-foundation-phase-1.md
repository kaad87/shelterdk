# Affiliate Foundation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-11-affiliate-foundation-phase-1-design.md`

**Goal:** Ship a complete, credible affiliate integration: a nightly-synced product database, a `GearCard` component with three visual variants, inline markdown directives to embed products in articles, a `/tilbud` page and homepage widget, an `/admin/produkter` management UI, and an `/annoncer-og-partnere` disclosure page.

**Architecture:** Nightly cron (Netlify scheduled function) pulls three XML feeds, normalizes them, upserts to a Supabase `affiliate_products` table. A new `GearCard` server component fetches products via a request-cached data layer, rendered in three variants (`editorial`, `product`, `pill`). The existing `renderContent.tsx` markdown renderer is extended with `::gear[id]`, `::gear-inline[id]`, and `::gear-group[...]` directives, and converted to async to support DB fetches. Two public-facing surfaces (`/tilbud` and a homepage widget) consume the data via curated queries with category diversification. An admin UI lives under the existing `/admin/` module and uses the same `x-admin-secret` header pattern for API actions. A `/annoncer-og-partnere` page + footer link + on-card disclosure labels cover compliance.

**Tech Stack:** Next.js 14 (App Router, server components), Supabase Postgres, TypeScript, Tailwind CSS, Vitest + React Testing Library, Playwright, `fast-xml-parser`, Netlify scheduled functions.

---

## Scope Check

The spec is already the result of decomposition (Phase 1 of 3). Within Phase 1, the subsystems are tightly coupled: `/tilbud`, `GearCard`, and the admin UI all depend on the same `affiliate_products` table and sync pipeline. Building them in one plan is appropriate — but the plan is organized into six sub-phases (A-F) so progress is visible and each sub-phase could be paused between if needed.

---

## File Structure

### Files to create

**Database:**
- `migrations/034_affiliate_products.sql` — schema + indexes + RLS

**Server-side data layer:**
- `web/lib/affiliate-products.ts` — request-cached getters and query helpers
- `web/lib/parseAffiliateFeed.ts` — XML parsing and normalization utilities
- `web/lib/parseAffiliateFeed.test.ts` — unit tests for parser + stock/discount helpers

**Sync script:**
- `web/scripts/sync-affiliate-products.ts` — orchestrates the full sync
- `web/scripts/sync-affiliate-products.test.ts` — integration test with mocked Supabase

**Netlify scheduled function:**
- `web/netlify/functions/sync-affiliate-products.ts` — thin wrapper around the sync script, configured to run via cron

**GearCard:**
- `web/components/GearCard.tsx` — the component with three variants
- `web/components/GearCard.test.tsx` — variant tests with mock products

**renderContent extension:**
- `web/lib/renderContent.test.tsx` — new test file covering gear directives + regression coverage for existing behavior

**`/tilbud` page:**
- `web/app/(site)/tilbud/page.tsx` — server component hero + filters + grid + pagination
- `web/components/HomepageDealsWidget.tsx` — homepage widget
- `web/lib/affiliate-deals.ts` — `getTopDeals` + `diversify` helpers
- `web/lib/affiliate-deals.test.ts` — unit test for `diversify`

**Admin UI:**
- `web/app/(site)/admin/produkter/page.tsx` — main admin page (server)
- `web/components/AdminProducts.tsx` — client component for list + filters
- `web/components/AdminProductRow.tsx` — client component for a single row
- `web/components/AdminSyncStatusBar.tsx` — server component for sync status
- `web/app/(site)/admin/produkter/kategorier/page.tsx` — category mapping page
- `web/components/AdminCategoryMapping.tsx` — client component for mapping table
- `web/app/api/admin/affiliate-products/block/route.ts` — POST to block a product
- `web/app/api/admin/affiliate-products/category-mapping/route.ts` — PUT to update mapping
- `web/app/api/admin/affiliate-products/sync/route.ts` — POST to trigger manual sync

**Compliance:**
- `web/app/(site)/annoncer-og-partnere/page.tsx` — disclosure page

### Files to modify

- `web/lib/renderContent.tsx` — extend with gear directives; convert to async; add pre-fetch helper
- `web/app/(site)/blog/[slug]/page.tsx:86` — `await renderContent(post.content)`
- `web/app/(site)/guides/[slug]/page.tsx:62` — `await renderContent(guide.content)`
- `web/components/Navbar.tsx:12` — add "Tilbud" menu entry
- `web/components/Footer.tsx:14` — add "Annoncer og partnere" link
- `web/app/(site)/page.tsx` (or wherever homepage content lives) — add `<HomepageDealsWidget />`
- `web/package.json` — add `fast-xml-parser` and `iconv-lite` dependencies; add `sync-products` script
- `web/app/sitemap.ts` — add `/tilbud` and `/annoncer-og-partnere`
- `.env.local.example` (if exists) or create `.env.local.template` — document new env vars
- `netlify.toml` — add scheduled function config

### Environment variables (new)

- `PARTNER_ADS_BACKPACKERLIFE_URL`
- `PARTNER_ADS_OUTDOORTID_URL`
- `PARTNER_ADS_OUTMORE_URL`

Already present: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ADMIN_SECRET` (used by existing `/api/admin/*` routes — verify exact name).

---

## Pre-flight Checks

Before starting Task 1, verify a few assumptions that the spec depends on.

- [ ] **Step 0.1: Verify admin auth pattern**

Run: `grep -l "x-admin-secret" web/app/api/admin/ -r`
Expected: multiple route files found. Pattern is established.

- [ ] **Step 0.2: Verify the exact env var name for admin secret**

Run: `grep -n "process.env.ADMIN" web/app/api/admin/*/route.ts | head`
Expected: one env var name (likely `ADMIN_SECRET`). Use that same name for new admin routes.

- [ ] **Step 0.3: Verify `renderContent` has only two callers**

Run: `grep -rn "renderContent" web --include="*.tsx" --include="*.ts"`
Expected: three hits total (one in `renderContent.tsx`, one in `blog/[slug]/page.tsx`, one in `guides/[slug]/page.tsx`). If there are more, add them to the "Files to modify" list and update their call sites in Task 9.

- [ ] **Step 0.4: Confirm XML feed URLs are available**

Ask the human operator for the three XML feed URLs (they're personal to the partner-ads account) and add them to `.env.local`. The rest of the plan assumes these exist.

---

## Phase A — Data Foundation

### Task 1: Supabase schema migration

**Files:**
- Create: `migrations/034_affiliate_products.sql`

- [ ] **Step 1.1: Write the migration file**

Create `migrations/034_affiliate_products.sql` with the full schema:

```sql
-- Affiliate products — Phase 1 of affiliate foundation.
-- Stores normalized products from three partner-ads XML feeds:
-- Backpackerlife.dk, Outdoortid.dk, Outmore.dk.

create table if not exists public.affiliate_products (
  id                  text primary key,
  retailer            text not null check (retailer in ('outmore', 'backpackerlife', 'outdoortid')),
  retailer_product_id text not null,
  brand               text,
  product_name        text not null,
  description         text,
  category_raw        text,
  category_mapped     text,
  price               numeric(10,2) not null,
  price_original      numeric(10,2),
  discount_pct        integer check (discount_pct is null or (discount_pct >= 0 and discount_pct <= 100)),
  shipping_cost       numeric(10,2),
  in_stock            boolean not null default true,
  stock_count         integer,
  image_url           text not null,
  affiliate_url       text not null,
  ean                 text,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  is_blocked          boolean not null default false,
  blocked_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_products_retailer on public.affiliate_products(retailer);
create index if not exists idx_products_category on public.affiliate_products(category_mapped);
create index if not exists idx_products_discount on public.affiliate_products(discount_pct desc)
  where in_stock and not is_blocked;
create index if not exists idx_products_last_seen on public.affiliate_products(last_seen_at);
create index if not exists idx_products_search on public.affiliate_products
  using gin(to_tsvector('danish', coalesce(product_name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(description,'')));

-- Touch updated_at on any update
create or replace function public.affiliate_products_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_affiliate_products_touch on public.affiliate_products;
create trigger trg_affiliate_products_touch
  before update on public.affiliate_products
  for each row execute function public.affiliate_products_touch_updated_at();

-- Category mapping from raw feed strings to internal taxonomy.
create table if not exists public.affiliate_category_mapping (
  retailer        text not null,
  category_raw    text not null,
  category_mapped text,
  whitelisted     boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (retailer, category_raw)
);

-- Sync run history (optional but useful for debug).
create table if not exists public.affiliate_sync_runs (
  id               bigserial primary key,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null check (status in ('running', 'success', 'failed')),
  retailer         text,
  products_total   integer,
  products_new     integer,
  products_updated integer,
  products_removed integer,
  error_message    text
);

-- RLS: public can read non-blocked products; mapping is publicly readable;
-- sync_runs is service-role-only; all writes require service role.
alter table public.affiliate_products enable row level security;
alter table public.affiliate_category_mapping enable row level security;
alter table public.affiliate_sync_runs enable row level security;

create policy "Public read non-blocked products"
  on public.affiliate_products for select
  using (is_blocked = false);

create policy "Public read category mapping"
  on public.affiliate_category_mapping for select
  using (true);

-- No public policies on affiliate_sync_runs — service role only.
```

- [ ] **Step 1.2: Apply the migration to Supabase**

Run this in the Supabase SQL editor (or via `psql` against the Supabase connection string):

```bash
# Via psql — adjust connection string from Supabase dashboard
psql "$SUPABASE_DB_URL" < migrations/034_affiliate_products.sql
```

Expected: no errors. Three new tables created.

- [ ] **Step 1.3: Verify tables exist**

```sql
select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name like 'affiliate_%';
```

Expected: three rows — `affiliate_products`, `affiliate_category_mapping`, `affiliate_sync_runs`.

- [ ] **Step 1.4: Commit**

```bash
git add migrations/034_affiliate_products.sql
git commit -m "feat(db): add affiliate_products schema and RLS policies"
```

---

### Task 2: Feed parsing utilities (TDD)

Build the pure functions that convert raw XML into normalized product objects. Pure functions = easy to TDD.

**Files:**
- Create: `web/lib/parseAffiliateFeed.ts`
- Create: `web/lib/parseAffiliateFeed.test.ts`

- [ ] **Step 2.1: Install dependencies**

```bash
cd web && npm install fast-xml-parser iconv-lite
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2.2: Create the test file with `parseStockField` cases**

Create `web/lib/parseAffiliateFeed.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseStockField,
  calculateDiscountPct,
  normalizeProduct,
  parseFeedXml,
} from "./parseAffiliateFeed";

describe("parseStockField", () => {
  it("parses string 'in stock' as in stock with unknown count", () => {
    expect(parseStockField("in stock")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses 'in_stock' (Outdoortid format)", () => {
    expect(parseStockField("in_stock")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses 'på lager' (Danish)", () => {
    expect(parseStockField("på lager")).toEqual({ in_stock: true, stock_count: null });
  });
  it("parses numeric value as stock_count", () => {
    expect(parseStockField("5")).toEqual({ in_stock: true, stock_count: 5 });
    expect(parseStockField("1")).toEqual({ in_stock: true, stock_count: 1 });
  });
  it("parses zero as out of stock", () => {
    expect(parseStockField("0")).toEqual({ in_stock: false, stock_count: 0 });
  });
  it("parses 'udsolgt' as out of stock", () => {
    expect(parseStockField("udsolgt")).toEqual({ in_stock: false, stock_count: 0 });
  });
  it("treats null/empty as out of stock", () => {
    expect(parseStockField(null)).toEqual({ in_stock: false, stock_count: null });
    expect(parseStockField("")).toEqual({ in_stock: false, stock_count: null });
  });
  it("treats unknown format as out of stock to fail safe", () => {
    expect(parseStockField("coming soon")).toEqual({ in_stock: false, stock_count: null });
  });
});

describe("calculateDiscountPct", () => {
  it("returns null when no original price", () => {
    expect(calculateDiscountPct(299, null)).toBeNull();
    expect(calculateDiscountPct(299, undefined as any)).toBeNull();
  });
  it("returns null when original price equals current price", () => {
    expect(calculateDiscountPct(299, 299)).toBeNull();
  });
  it("returns null when current price is higher (not a discount)", () => {
    expect(calculateDiscountPct(399, 299)).toBeNull();
  });
  it("rounds to nearest integer", () => {
    expect(calculateDiscountPct(299, 549)).toBe(46); // (549-299)/549 = 0.4553 → 46
    expect(calculateDiscountPct(221.95, 241.03)).toBe(8); // 0.0792 → 8
  });
  it("handles 100% discount edge case", () => {
    expect(calculateDiscountPct(0, 100)).toBe(100);
  });
});
```

- [ ] **Step 2.3: Run tests to verify they fail**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: all tests fail with "Cannot find module './parseAffiliateFeed'".

- [ ] **Step 2.4: Write minimal implementation for `parseStockField` and `calculateDiscountPct`**

Create `web/lib/parseAffiliateFeed.ts`:

```typescript
/**
 * Parses the `lagerantal` field from an affiliate XML feed into a normalized
 * in_stock flag + optional count. Feeds use inconsistent formats:
 * - Backpackerlife: "in stock"
 * - Outdoortid: "in_stock"
 * - Outmore: numeric ("5", "14", "0")
 */
export function parseStockField(raw: string | null | undefined): {
  in_stock: boolean;
  stock_count: number | null;
} {
  if (raw == null) return { in_stock: false, stock_count: null };
  const t = String(raw).trim().toLowerCase();
  if (t === "") return { in_stock: false, stock_count: null };
  if (t === "in stock" || t === "in_stock" || t === "på lager" || t === "pa lager") {
    return { in_stock: true, stock_count: null };
  }
  if (t === "udsolgt" || t === "out of stock" || t === "out_of_stock") {
    return { in_stock: false, stock_count: 0 };
  }
  const n = parseInt(t, 10);
  if (!Number.isNaN(n)) return { in_stock: n > 0, stock_count: n };
  return { in_stock: false, stock_count: null }; // unknown → fail safe OOS
}

/**
 * Returns a rounded integer discount percentage, or null if there's no real
 * discount. Null inputs → null output.
 */
export function calculateDiscountPct(
  price: number,
  priceOriginal: number | null | undefined
): number | null {
  if (priceOriginal == null || priceOriginal <= 0) return null;
  if (price >= priceOriginal) return null;
  return Math.round(((priceOriginal - price) / priceOriginal) * 100);
}
```

- [ ] **Step 2.5: Run tests**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: `parseStockField` and `calculateDiscountPct` tests pass. `normalizeProduct` / `parseFeedXml` tests still fail (functions don't exist yet).

- [ ] **Step 2.6: Add `normalizeProduct` tests to test file**

Append to `web/lib/parseAffiliateFeed.test.ts`:

```typescript
describe("normalizeProduct", () => {
  it("builds the id as '{retailer}-{retailer_product_id}'", () => {
    const raw = {
      forhandler: "Outmore.dk",
      produktid: "3342540815643",
      produktnavn: "Test",
      nypris: "100.00",
      glpris: "100.00",
      billedurl: "https://example.com/img.jpg",
      vareurl: "https://example.com",
      lagerantal: "5",
    };
    const n = normalizeProduct(raw, "outmore");
    expect(n?.id).toBe("outmore-3342540815643");
  });
  it("returns null for missing required fields", () => {
    expect(normalizeProduct({} as any, "outmore")).toBeNull();
    expect(
      normalizeProduct(
        { produktid: "1", produktnavn: "Test", billedurl: "x", vareurl: "y" } as any,
        "outmore"
      )
    ).toBeNull(); // missing nypris
  });
  it("calculates discount correctly from glpris/nypris", () => {
    const n = normalizeProduct(
      {
        forhandler: "Outdoortid.dk",
        produktid: "1",
        produktnavn: "Tent",
        nypris: "299.00",
        glpris: "549.00",
        billedurl: "https://example.com/img.jpg",
        vareurl: "https://example.com",
        lagerantal: "in_stock",
        beskrivelse: "Nice tent",
      },
      "outdoortid"
    );
    expect(n?.discount_pct).toBe(46);
    expect(n?.price).toBe(299);
    expect(n?.price_original).toBe(549);
  });
  it("passes through brand and ean when present (Outmore)", () => {
    const n = normalizeProduct(
      {
        forhandler: "Outmore.dk",
        produktid: "1",
        produktnavn: "Headlamp",
        nypris: "221.95",
        glpris: "241.03",
        brand: "PETZL",
        ean: "3342540815643",
        billedurl: "x",
        vareurl: "y",
        lagerantal: "1",
      },
      "outmore"
    );
    expect(n?.brand).toBe("PETZL");
    expect(n?.ean).toBe("3342540815643");
    expect(n?.stock_count).toBe(1);
  });
  it("decodes hierarchical categories from Backpackerlife", () => {
    const n = normalizeProduct(
      {
        forhandler: "Backpackerlife.dk",
        produktid: "1",
        produktnavn: "Mug",
        nypris: "339.00",
        glpris: "339.00",
        kategorinavn: "Gaveideer > Kokken > Termoflasker",
        billedurl: "x",
        vareurl: "y",
        lagerantal: "in stock",
      },
      "backpackerlife"
    );
    expect(n?.category_raw).toBe("Gaveideer > Kokken > Termoflasker");
  });
});
```

- [ ] **Step 2.7: Run tests to see them fail**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: `normalizeProduct` tests fail (function doesn't exist).

- [ ] **Step 2.8: Implement `normalizeProduct`**

Append to `web/lib/parseAffiliateFeed.ts`:

```typescript
export type Retailer = "outmore" | "backpackerlife" | "outdoortid";

export interface NormalizedProduct {
  id: string;
  retailer: Retailer;
  retailer_product_id: string;
  brand: string | null;
  product_name: string;
  description: string | null;
  category_raw: string | null;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  shipping_cost: number | null;
  in_stock: boolean;
  stock_count: number | null;
  image_url: string;
  affiliate_url: string;
  ean: string | null;
}

/**
 * Normalizes a single product from a parsed XML feed entry.
 * Returns null if required fields are missing.
 */
export function normalizeProduct(raw: Record<string, any>, retailer: Retailer): NormalizedProduct | null {
  const retailer_product_id = raw.produktid != null ? String(raw.produktid).trim() : "";
  const product_name = raw.produktnavn != null ? String(raw.produktnavn).trim() : "";
  const image_url = raw.billedurl != null ? String(raw.billedurl).trim() : "";
  const affiliate_url = raw.vareurl != null ? String(raw.vareurl).trim() : "";
  const priceStr = raw.nypris != null ? String(raw.nypris).trim() : "";
  const price = parseFloat(priceStr);

  if (!retailer_product_id || !product_name || !image_url || !affiliate_url || Number.isNaN(price)) {
    return null;
  }

  const priceOriginalStr = raw.glpris != null ? String(raw.glpris).trim() : "";
  const priceOriginalParsed = parseFloat(priceOriginalStr);
  const price_original = Number.isNaN(priceOriginalParsed) ? null : priceOriginalParsed;

  const shippingStr = raw.fragtomk != null ? String(raw.fragtomk).trim() : "";
  const shippingParsed = parseFloat(shippingStr);
  const shipping_cost = Number.isNaN(shippingParsed) ? null : shippingParsed;

  const stock = parseStockField(raw.lagerantal != null ? String(raw.lagerantal) : null);

  return {
    id: `${retailer}-${retailer_product_id}`,
    retailer,
    retailer_product_id,
    brand: raw.brand != null ? String(raw.brand).trim() || null : null,
    product_name,
    description: raw.beskrivelse != null ? String(raw.beskrivelse).trim() || null : null,
    category_raw: raw.kategorinavn != null ? String(raw.kategorinavn).trim() || null : null,
    price,
    price_original,
    discount_pct: calculateDiscountPct(price, price_original),
    shipping_cost,
    in_stock: stock.in_stock,
    stock_count: stock.stock_count,
    image_url,
    affiliate_url,
    ean: raw.ean != null ? String(raw.ean).trim() || null : null,
  };
}
```

- [ ] **Step 2.9: Run tests to verify they pass**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: `parseStockField`, `calculateDiscountPct`, `normalizeProduct` all pass.

- [ ] **Step 2.10: Add `parseFeedXml` test using real sample**

Ensure a sample file exists at `web/test/fixtures/outmore-sample.xml` (copy from `~/Downloads/` for this setup step, or create a minimal test XML inline).

```bash
mkdir -p web/test/fixtures
head -60 ~/Downloads/produkter-partnerid19557-Outmore.dk.xml > web/test/fixtures/outmore-sample.xml
head -60 ~/Downloads/produkter-partnerid19557-Outdoortid.dk.xml > web/test/fixtures/outdoortid-sample.xml
head -60 ~/Downloads/produkter-partnerid19557-Backpackerlife.dk.xml > web/test/fixtures/backpackerlife-sample.xml
```

Append to `web/lib/parseAffiliateFeed.test.ts`:

```typescript
import fs from "fs";
import path from "path";

describe("parseFeedXml", () => {
  it("parses the Outmore sample fixture and produces at least 2 valid products", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/outmore-sample.xml"));
    const products = parseFeedXml(xml, "outmore");
    expect(products.length).toBeGreaterThanOrEqual(2);
    const first = products[0];
    expect(first.retailer).toBe("outmore");
    expect(first.id).toMatch(/^outmore-/);
    expect(first.price).toBeGreaterThan(0);
  });
  it("parses the Backpackerlife sample (handles iso-8859-1 æøå)", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/backpackerlife-sample.xml"));
    const products = parseFeedXml(xml, "backpackerlife");
    expect(products.length).toBeGreaterThanOrEqual(2);
    // At least one product should contain a non-ASCII Danish character
    // (ø, æ, å) in its name or description — confirms iso-8859-1 decoding worked
    const hasDanish = products.some((p) =>
      /[æøåÆØÅ]/.test((p.product_name ?? "") + (p.description ?? ""))
    );
    expect(hasDanish).toBe(true);
  });
  it("parses the Outdoortid sample", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "../test/fixtures/outdoortid-sample.xml"));
    const products = parseFeedXml(xml, "outdoortid");
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products[0].retailer).toBe("outdoortid");
  });
});
```

- [ ] **Step 2.11: Run to confirm failure**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: `parseFeedXml` tests fail (function doesn't exist).

- [ ] **Step 2.12: Implement `parseFeedXml`**

Append to `web/lib/parseAffiliateFeed.ts`:

```typescript
import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";

/**
 * Parses a raw XML buffer into an array of NormalizedProduct.
 * Handles iso-8859-1 decoding (all three feeds declare iso-8859-1 encoding).
 * Skips malformed products silently.
 */
export function parseFeedXml(buffer: Buffer, retailer: Retailer): NormalizedProduct[] {
  const xmlString = iconv.decode(buffer, "iso-8859-1");

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // keep everything as strings; we coerce manually
    trimValues: true,
    isArray: (name) => name === "produkt", // always treat <produkt> as array
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlString);
  } catch (err) {
    console.error(`[parseFeedXml] Failed to parse ${retailer} XML:`, err);
    return [];
  }

  const rawProducts: any[] = parsed?.produkter?.produkt ?? [];
  const normalized: NormalizedProduct[] = [];

  for (const raw of rawProducts) {
    const n = normalizeProduct(raw, retailer);
    if (n) normalized.push(n);
  }

  return normalized;
}
```

- [ ] **Step 2.13: Run all tests**

```bash
cd web && npx vitest run lib/parseAffiliateFeed.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.14: Commit**

```bash
git add web/lib/parseAffiliateFeed.ts web/lib/parseAffiliateFeed.test.ts web/test/fixtures/ web/package.json web/package-lock.json
git commit -m "feat(affiliate): add feed parsing + stock/discount normalization"
```

---

### Task 3: Sync script

The sync script orchestrates: fetch → parse → upsert → mark-stale. It runs locally via `npm run sync-products` and also gets wrapped for Netlify.

**Files:**
- Create: `web/scripts/sync-affiliate-products.ts`

- [ ] **Step 3.1: Add npm script entry**

Edit `web/package.json`. Add to `scripts`:

```json
"sync-products": "tsx scripts/sync-affiliate-products.ts"
```

Verify `tsx` is available as a dev dep (it's used by `prebuild` so it should be). If not, `npm install -D tsx`.

- [ ] **Step 3.2: Write the sync script**

Create `web/scripts/sync-affiliate-products.ts`:

```typescript
/**
 * Nightly sync of affiliate product feeds → Supabase.
 *
 * Runs via:
 *   - `npm run sync-products` (local)
 *   - Netlify scheduled function (nightly)
 *   - `POST /api/admin/affiliate-products/sync` (manual trigger from admin UI)
 *
 * Reads XML from three partner-ads URLs, normalizes, upserts, then marks
 * products not seen in the last 7 days as out-of-stock.
 */
import { createClient } from "@supabase/supabase-js";
import {
  parseFeedXml,
  type NormalizedProduct,
  type Retailer,
} from "../lib/parseAffiliateFeed";

const FEEDS: { retailer: Retailer; envVar: string }[] = [
  { retailer: "backpackerlife", envVar: "PARTNER_ADS_BACKPACKERLIFE_URL" },
  { retailer: "outdoortid", envVar: "PARTNER_ADS_OUTDOORTID_URL" },
  { retailer: "outmore", envVar: "PARTNER_ADS_OUTMORE_URL" },
];

interface SyncResult {
  retailer: Retailer;
  total: number;
  inserted: number;
  updated: number;
  error?: string;
}

async function fetchFeed(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ShelterDK/1.0 (+https://shelterdk.dk)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upsertCategoryMappings(
  supabase: ReturnType<typeof createClient>,
  products: NormalizedProduct[]
): Promise<Map<string, { mapped: string | null; whitelisted: boolean }>> {
  // Collect unique (retailer, category_raw) pairs
  const uniquePairs = new Map<string, { retailer: Retailer; category_raw: string }>();
  for (const p of products) {
    if (p.category_raw) {
      const key = `${p.retailer}::${p.category_raw}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, { retailer: p.retailer, category_raw: p.category_raw });
      }
    }
  }

  // Insert any new ones (ON CONFLICT DO NOTHING)
  if (uniquePairs.size > 0) {
    const rows = [...uniquePairs.values()].map((v) => ({
      retailer: v.retailer,
      category_raw: v.category_raw,
      category_mapped: null,
      whitelisted: false,
    }));
    await supabase.from("affiliate_category_mapping").upsert(rows, {
      onConflict: "retailer,category_raw",
      ignoreDuplicates: true,
    });
  }

  // Read all mappings back to get the current whitelist state
  const { data } = await supabase
    .from("affiliate_category_mapping")
    .select("retailer, category_raw, category_mapped, whitelisted");

  const map = new Map<string, { mapped: string | null; whitelisted: boolean }>();
  for (const row of data ?? []) {
    map.set(`${row.retailer}::${row.category_raw}`, {
      mapped: row.category_mapped,
      whitelisted: row.whitelisted,
    });
  }
  return map;
}

async function syncRetailer(
  supabase: ReturnType<typeof createClient>,
  retailer: Retailer,
  url: string
): Promise<SyncResult> {
  console.log(`[${retailer}] fetching ${url}`);
  const buffer = await fetchFeed(url);
  console.log(`[${retailer}] parsing ${buffer.length} bytes`);
  const products = parseFeedXml(buffer, retailer);
  console.log(`[${retailer}] parsed ${products.length} products`);

  const mappingLookup = await upsertCategoryMappings(supabase, products);

  const now = new Date().toISOString();
  const rows = products.map((p) => {
    const key = p.category_raw ? `${p.retailer}::${p.category_raw}` : null;
    const mapping = key ? mappingLookup.get(key) : null;
    return {
      id: p.id,
      retailer: p.retailer,
      retailer_product_id: p.retailer_product_id,
      brand: p.brand,
      product_name: p.product_name,
      description: p.description,
      category_raw: p.category_raw,
      category_mapped: mapping?.mapped ?? null,
      price: p.price,
      price_original: p.price_original,
      discount_pct: p.discount_pct,
      shipping_cost: p.shipping_cost,
      in_stock: p.in_stock,
      stock_count: p.stock_count,
      image_url: p.image_url,
      affiliate_url: p.affiliate_url,
      ean: p.ean,
      last_seen_at: now,
    };
  });

  // Upsert in batches of 500 to avoid payload limits
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("affiliate_products")
      .upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Upsert failed (batch ${i}): ${error.message}`);
    console.log(`[${retailer}] upserted ${i + batch.length}/${rows.length}`);
  }

  return {
    retailer,
    total: products.length,
    inserted: 0, // Supabase upsert doesn't distinguish; we could track via returning clause later
    updated: 0,
  };
}

async function markStaleProducts(supabase: ReturnType<typeof createClient>) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("affiliate_products")
    .update({ in_stock: false })
    .lt("last_seen_at", sevenDaysAgo)
    .eq("in_stock", true);
  if (error) throw new Error(`Mark-stale failed: ${error.message}`);
}

export async function runSync(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: run } = await supabase
    .from("affiliate_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = run?.id;

  let total = 0;
  try {
    for (const { retailer, envVar } of FEEDS) {
      const url = process.env[envVar];
      if (!url) {
        console.warn(`[${retailer}] skipping — ${envVar} not set`);
        continue;
      }
      const result = await syncRetailer(supabase, retailer, url);
      total += result.total;
    }

    await markStaleProducts(supabase);

    if (runId != null) {
      await supabase
        .from("affiliate_sync_runs")
        .update({ status: "success", finished_at: new Date().toISOString(), products_total: total })
        .eq("id", runId);
    }
    console.log(`✓ sync complete: ${total} products`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ sync failed: ${msg}`);
    if (runId != null) {
      await supabase
        .from("affiliate_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
        .eq("id", runId);
    }
    throw err;
  }
}

// When run directly via `tsx scripts/sync-affiliate-products.ts`
if (require.main === module) {
  // Load .env.local if present (for local runs)
  try {
    require("dotenv").config({ path: ".env.local" });
  } catch {}
  runSync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 3.3: Install dotenv if needed**

```bash
cd web && npm install -D dotenv
```

- [ ] **Step 3.4: Run the sync locally**

Ensure `.env.local` has all three `PARTNER_ADS_*_URL` vars and the Supabase keys.

```bash
cd web && npm run sync-products
```

Expected output:
```
[backpackerlife] fetching ...
[backpackerlife] parsed ~2124 products
[backpackerlife] upserted 500/2124
...
[outdoortid] parsed ~491 products
...
[outmore] parsed ~8159 products
...
✓ sync complete: ~10774 products
```

- [ ] **Step 3.5: Verify in Supabase**

```sql
select retailer, count(*) from affiliate_products group by retailer;
select count(*) from affiliate_category_mapping where category_mapped is null;
select * from affiliate_sync_runs order by started_at desc limit 3;
```

Expected: ~2k/491/~8k products, category mappings populated with nulls, one success sync run.

- [ ] **Step 3.6: Commit**

```bash
git add web/scripts/sync-affiliate-products.ts web/package.json web/package-lock.json
git commit -m "feat(affiliate): add sync script for nightly feed → Supabase upsert"
```

---

### Task 4: Netlify scheduled function

Wrap the sync script so Netlify can invoke it on a schedule.

**Files:**
- Create: `web/netlify/functions/sync-affiliate-products.ts`
- Modify: `web/netlify.toml`

- [ ] **Step 4.1: Create the scheduled function**

Create `web/netlify/functions/sync-affiliate-products.ts`:

```typescript
import type { Handler } from "@netlify/functions";
import { schedule } from "@netlify/functions";
import { runSync } from "../../scripts/sync-affiliate-products";

// Cron: 03:00 UTC daily (≈ 04:00 DK winter, 05:00 DK summer)
const handler: Handler = async () => {
  try {
    await runSync();
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync failed:", msg);
    return { statusCode: 500, body: msg };
  }
};

export default schedule("0 3 * * *", handler);
```

- [ ] **Step 4.2: Install `@netlify/functions`**

```bash
cd web && npm install -D @netlify/functions
```

- [ ] **Step 4.3: Update `netlify.toml` to enable functions**

Edit `web/netlify.toml`. Add under `[build]` (if not already present):

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

- [ ] **Step 4.4: Verify Netlify deploy picks up the function**

```bash
cd web && git status && git add netlify.toml web/netlify/functions/sync-affiliate-products.ts web/package.json web/package-lock.json
git commit -m "feat(affiliate): add Netlify scheduled function for nightly sync"
git push origin main  # or appropriate branch — ask user if unclear
```

After deploy, check Netlify dashboard → Functions → `sync-affiliate-products` should appear with schedule `0 3 * * *`.

---

## Phase B — Content Layer

### Task 5: Data access layer

**Files:**
- Create: `web/lib/affiliate-products.ts`

- [ ] **Step 5.1: Create cached product getters**

Create `web/lib/affiliate-products.ts`:

```typescript
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AffiliateProduct {
  id: string;
  retailer: "outmore" | "backpackerlife" | "outdoortid";
  brand: string | null;
  product_name: string;
  description: string | null;
  category_mapped: string | null;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  in_stock: boolean;
  stock_count: number | null;
  image_url: string;
  affiliate_url: string;
  is_blocked: boolean;
}

const SELECT_COLUMNS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked";

/**
 * Fetches a single product by id. Cached at the React request level to
 * dedupe within a single render pass. Returns null if not found.
 */
export const getProduct = cache(async (id: string): Promise<AffiliateProduct | null> => {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("affiliate_products")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as AffiliateProduct | null) ?? null;
});

/**
 * Batched fetch: pass a list of ids, get a Map<id, product>.
 * Missing ids are omitted from the map.
 */
export const getProducts = cache(
  async (ids: string[]): Promise<Map<string, AffiliateProduct>> => {
    if (ids.length === 0) return new Map();
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("affiliate_products")
      .select(SELECT_COLUMNS)
      .in("id", ids);
    const result = new Map<string, AffiliateProduct>();
    for (const row of (data as AffiliateProduct[]) ?? []) result.set(row.id, row);
    return result;
  }
);
```

- [ ] **Step 5.2: Commit**

```bash
git add web/lib/affiliate-products.ts
git commit -m "feat(affiliate): add cached product data access layer"
```

---

### Task 6: GearCard component — editorial variant (TDD)

**Files:**
- Create: `web/components/GearCard.tsx`
- Create: `web/components/GearCard.test.tsx`

- [ ] **Step 6.1: Write the editorial variant test**

Create `web/components/GearCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GearCardView } from "./GearCard";
import type { AffiliateProduct } from "@/lib/affiliate-products";

const mockProduct: AffiliateProduct = {
  id: "outdoortid-44032400916791",
  retailer: "outdoortid",
  brand: "Nordic Peak",
  product_name: "Nordic Peak Thera 2.0",
  description: "2-personers telt, 3500mm vandsøjle",
  category_mapped: "telt",
  price: 299,
  price_original: 549,
  discount_pct: 46,
  in_stock: true,
  stock_count: null,
  image_url: "https://example.com/image.jpg",
  affiliate_url: "https://example.com/buy",
  is_blocked: false,
};

describe("GearCard editorial variant", () => {
  it("renders product name, price, and discount", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/299/)).toBeInTheDocument();
    expect(screen.getByText(/549/)).toBeInTheDocument();
    expect(screen.getByText(/46/)).toBeInTheDocument();
  });

  it("uses rel='sponsored nofollow noopener' on the affiliate link", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("rel", "sponsored nofollow noopener");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("href", mockProduct.affiliate_url);
  });

  it("shows the 'Annonce · Sponsoreret link' disclosure", () => {
    render(<GearCardView product={mockProduct} variant="editorial" />);
    expect(screen.getByText(/Annonce.*Sponsoreret/i)).toBeInTheDocument();
  });

  it("shows out-of-stock state when in_stock is false", () => {
    render(<GearCardView product={{ ...mockProduct, in_stock: false }} variant="editorial" />);
    expect(screen.getByText(/udsolgt/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run and verify failure**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: fails with "Cannot find module './GearCard'".

- [ ] **Step 6.3: Create `GearCard.tsx` with `GearCardView` (editorial)**

Create `web/components/GearCard.tsx`:

```tsx
import Image from "next/image";
import { getProduct, type AffiliateProduct } from "@/lib/affiliate-products";
import { ExternalLink } from "lucide-react";

export type GearCardVariant = "editorial" | "product" | "pill";

export interface GearCardProps {
  id: string;
  variant?: GearCardVariant;
  className?: string;
  /** When provided, skips DB fetch (for pre-fetched bulk renders) */
  preloaded?: AffiliateProduct | null;
}

// -- Server component: fetches data, delegates to GearCardView --
export async function GearCard({ id, variant = "editorial", className, preloaded }: GearCardProps) {
  const product = preloaded ?? (await getProduct(id));
  if (!product) {
    // Fallback: render nothing, leave HTML comment for debug
    return (
      <>
        {/* eslint-disable-next-line react/no-danger */}
        <span dangerouslySetInnerHTML={{ __html: `<!-- GearCard ${id} not found -->` }} />
      </>
    );
  }
  if (product.is_blocked) return null;
  return <GearCardView product={product} variant={variant} className={className} />;
}

// -- Pure view component: easier to test with mock props --
export function GearCardView({
  product,
  variant,
  className,
}: {
  product: AffiliateProduct;
  variant: GearCardVariant;
  className?: string;
}) {
  if (variant === "editorial") return <EditorialVariant product={product} className={className} />;
  if (variant === "product") return <ProductVariant product={product} className={className} />;
  return <PillVariant product={product} className={className} />;
}

function RetailerLabel({ retailer }: { retailer: AffiliateProduct["retailer"] }) {
  const labels = {
    outmore: "Outmore.dk",
    backpackerlife: "Backpackerlife.dk",
    outdoortid: "Outdoortid.dk",
  };
  return <>{labels[retailer]}</>;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(n) + " kr";
}

function EditorialVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  return (
    <div
      className={`my-6 flex gap-4 rounded-lg border border-primary/10 border-l-[3px] border-l-accent bg-white p-4 ${className ?? ""}`}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-primary/5">
        <Image
          src={product.image_url}
          alt={product.product_name}
          fill
          className="object-contain"
          sizes="96px"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        {product.category_mapped && (
          <div className="text-[11px] uppercase tracking-wide text-primary/50">
            {product.category_mapped}
          </div>
        )}
        <h4 className="font-serif text-base font-bold text-primary leading-tight">
          {product.product_name}
        </h4>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && product.discount_pct != null && (
            <>
              <span className="text-xs text-primary/40 line-through">
                {formatPrice(product.price_original)}
              </span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                –{product.discount_pct}%
              </span>
            </>
          )}
        </div>
        {outOfStock ? (
          <div className="mt-2 text-sm text-primary/60">Udsolgt lige nu</div>
        ) : (
          <a
            href={product.affiliate_url}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="mt-2 inline-flex items-center gap-1 border-b border-primary pb-px text-sm font-medium text-primary hover:border-accent hover:text-accent"
          >
            Se tilbud hos <RetailerLabel retailer={product.retailer} />
            <ExternalLink size={12} />
          </a>
        )}
        <div className="mt-1 text-[11px] text-primary/40">
          <a href="/annoncer-og-partnere" className="hover:underline">
            Annonce · Sponsoreret link
          </a>
        </div>
      </div>
    </div>
  );
}

function ProductVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  return null; // implemented in Task 7
}

function PillVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  return null; // implemented in Task 8
}
```

- [ ] **Step 6.4: Run the test**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: editorial variant tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add web/components/GearCard.tsx web/components/GearCard.test.tsx
git commit -m "feat(affiliate): add GearCard editorial variant"
```

---

### Task 7: GearCard — product variant

**Files:**
- Modify: `web/components/GearCard.tsx`
- Modify: `web/components/GearCard.test.tsx`

- [ ] **Step 7.1: Add product variant tests**

Append to `web/components/GearCard.test.tsx`:

```typescript
describe("GearCard product variant", () => {
  it("renders product name, prominent discount badge, and Se tilbud button", () => {
    render(<GearCardView product={mockProduct} variant="product" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/46/)).toBeInTheDocument(); // badge
    expect(screen.getByRole("link")).toHaveTextContent(/Se tilbud/i);
  });
  it("has a rel='sponsored' link", () => {
    render(<GearCardView product={mockProduct} variant="product" />);
    expect(screen.getByRole("link")).toHaveAttribute("rel", "sponsored nofollow noopener");
  });
});
```

- [ ] **Step 7.2: Run to verify failure**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: product variant tests fail (ProductVariant returns null).

- [ ] **Step 7.3: Implement ProductVariant**

Replace the `ProductVariant` stub in `web/components/GearCard.tsx`:

```tsx
function ProductVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] ${className ?? ""}`}
    >
      {product.discount_pct != null && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white">
          –{product.discount_pct}%
        </div>
      )}
      <div className="relative aspect-square w-full bg-background">
        <Image
          src={product.image_url}
          alt={product.product_name}
          fill
          className="object-contain p-4"
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            {product.brand}
          </div>
        )}
        <h4 className="mt-1 font-serif text-lg font-bold text-primary leading-tight line-clamp-2">
          {product.product_name}
        </h4>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">{formatPrice(product.price)}</span>
          {product.price_original != null && (
            <span className="text-sm text-primary/40 line-through">
              {formatPrice(product.price_original)}
            </span>
          )}
        </div>
        <div className="mt-auto pt-4">
          {outOfStock ? (
            <div className="rounded-lg bg-primary/5 px-4 py-2.5 text-center text-sm font-medium text-primary/50">
              Udsolgt lige nu
            </div>
          ) : (
            <a
              href={product.affiliate_url}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-accent"
            >
              Se tilbud
            </a>
          )}
          <div className="mt-2 text-center text-[11px] text-primary/40">
            <a href="/annoncer-og-partnere" className="hover:underline">
              Hos <RetailerLabel retailer={product.retailer} /> · Annonce
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.4: Run tests**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: all variants pass.

- [ ] **Step 7.5: Commit**

```bash
git add web/components/GearCard.tsx web/components/GearCard.test.tsx
git commit -m "feat(affiliate): add GearCard product variant"
```

---

### Task 8: GearCard — pill variant

**Files:**
- Modify: `web/components/GearCard.tsx`
- Modify: `web/components/GearCard.test.tsx`

- [ ] **Step 8.1: Add pill variant tests**

Append to `web/components/GearCard.test.tsx`:

```typescript
describe("GearCard pill variant", () => {
  it("renders as an inline-flex element with product name and price", () => {
    render(<GearCardView product={mockProduct} variant="pill" />);
    expect(screen.getByText("Nordic Peak Thera 2.0")).toBeInTheDocument();
    expect(screen.getByText(/299/)).toBeInTheDocument();
  });
  it("uses rel='sponsored' on the link", () => {
    render(<GearCardView product={mockProduct} variant="pill" />);
    expect(screen.getByRole("link")).toHaveAttribute("rel", "sponsored nofollow noopener");
  });
});

describe("GearCard fallback states", () => {
  it("returns null for is_blocked products (via GearCard server wrapper)", () => {
    const blockedProduct = { ...mockProduct, is_blocked: true };
    // GearCardView does not filter; the server wrapper does.
    // This test documents that expectation.
    // Actual blocking is tested via the GearCard async server component separately.
    const { container } = render(<GearCardView product={blockedProduct} variant="pill" />);
    // The view renders; the blocking happens upstream.
    expect(container).not.toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 8.2: Run to verify failure**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: pill variant tests fail.

- [ ] **Step 8.3: Implement PillVariant**

Replace the `PillVariant` stub in `web/components/GearCard.tsx`:

```tsx
function PillVariant({ product, className }: { product: AffiliateProduct; className?: string }) {
  const outOfStock = !product.in_stock;
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="sponsored nofollow noopener"
      className={`inline-flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 py-1.5 pl-1.5 pr-3 align-middle text-sm no-underline transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${outOfStock ? "opacity-60" : ""} ${className ?? ""}`}
      aria-label={`Affiliate-link til ${product.product_name}`}
      title="Annonce · Sponsoreret link"
    >
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
        <Image
          src={product.image_url}
          alt=""
          fill
          className="object-contain"
          sizes="32px"
          unoptimized
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          Grej-tip
        </span>
        <span className="text-[13px] font-semibold text-primary">{product.product_name}</span>
      </span>
      <span className="text-[13px] font-bold text-primary">{formatPrice(product.price)}</span>
      {product.discount_pct != null && (
        <span className="text-[11px] font-bold text-amber-800">–{product.discount_pct}%</span>
      )}
      {outOfStock && <span className="text-[11px] text-primary/50">(udsolgt)</span>}
    </a>
  );
}
```

- [ ] **Step 8.4: Run tests**

```bash
cd web && npx vitest run components/GearCard.test.tsx
```

Expected: all pass.

- [ ] **Step 8.5: Commit**

```bash
git add web/components/GearCard.tsx web/components/GearCard.test.tsx
git commit -m "feat(affiliate): add GearCard pill variant for inline use"
```

---

### Task 9: Extend renderContent with `::gear` directives

The biggest surgical change. `renderContent` goes from sync to async, and we add directive parsing + batched pre-fetch.

**Files:**
- Modify: `web/lib/renderContent.tsx`
- Modify: `web/app/(site)/blog/[slug]/page.tsx:86`
- Modify: `web/app/(site)/guides/[slug]/page.tsx:62`
- Create: `web/lib/renderContent.test.tsx`

- [ ] **Step 9.1: Write tests for directive parsing first**

Create `web/lib/renderContent.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderContent, extractGearIds } from "./renderContent";
import type { AffiliateProduct } from "./affiliate-products";

// Mock the product data layer so tests don't hit the DB
vi.mock("./affiliate-products", () => ({
  getProducts: vi.fn(async (ids: string[]) => {
    const map = new Map<string, AffiliateProduct>();
    for (const id of ids) {
      map.set(id, {
        id,
        retailer: "outmore" as const,
        brand: "MockBrand",
        product_name: `Mock ${id}`,
        description: null,
        category_mapped: null,
        price: 100,
        price_original: 200,
        discount_pct: 50,
        in_stock: true,
        stock_count: null,
        image_url: "https://example.com/img.jpg",
        affiliate_url: "https://example.com",
        is_blocked: false,
      });
    }
    return map;
  }),
}));

describe("extractGearIds", () => {
  it("extracts block directive ids", () => {
    const content = "Some text\n\n::gear[outmore-123]\n\nMore text";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("extracts group directive ids", () => {
    const content = "Text\n\n::gear-group[outmore-1, backpacker-2, outdoortid-3]";
    expect(extractGearIds(content).sort()).toEqual(["backpacker-2", "outdoortid-3", "outmore-1"].sort());
  });
  it("extracts inline directive ids", () => {
    const content = "I use ::gear-inline[outmore-123] for my trips.";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("deduplicates ids across directives", () => {
    const content = "::gear[outmore-123]\n\n::gear-inline[outmore-123]";
    expect(extractGearIds(content)).toEqual(["outmore-123"]);
  });
  it("returns empty for content with no directives", () => {
    expect(extractGearIds("Just text.")).toEqual([]);
  });
});

describe("renderContent with gear directives", () => {
  it("renders a ::gear[id] block as a GearCard", async () => {
    const content = "Intro\n\n::gear[outmore-999]\n\nOutro";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/Mock outmore-999/);
  });
  it("renders ::gear-inline[id] inside a paragraph", async () => {
    const content = "I recommend ::gear-inline[outmore-999] for trips.";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/I recommend/);
    expect(container.textContent).toMatch(/Mock outmore-999/);
    expect(container.textContent).toMatch(/for trips\./);
  });
  it("renders ::gear-group[a,b,c] as multiple cards in a grid", async () => {
    const content = "::gear-group[outmore-1, outmore-2, outmore-3]";
    const blocks = await renderContent(content);
    const { container } = render(<>{blocks}</>);
    expect(container.textContent).toMatch(/Mock outmore-1/);
    expect(container.textContent).toMatch(/Mock outmore-2/);
    expect(container.textContent).toMatch(/Mock outmore-3/);
  });
});

describe("renderContent backwards compatibility", () => {
  it("still renders H2 headings", async () => {
    const blocks = await renderContent("## Heading\n\nSome paragraph");
    const { container } = render(<>{blocks}</>);
    expect(container.querySelector("h2")).toHaveTextContent("Heading");
  });
  it("still renders bullet lists", async () => {
    const blocks = await renderContent("- item 1\n- item 2");
    const { container } = render(<>{blocks}</>);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
  });
  it("still renders bold and links inline", async () => {
    const blocks = await renderContent("This is **bold** and [link](http://x)");
    const { container } = render(<>{blocks}</>);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("a")).toHaveTextContent("link");
  });
});
```

- [ ] **Step 9.2: Run to verify failure**

```bash
cd web && npx vitest run lib/renderContent.test.tsx
```

Expected: tests fail because `extractGearIds` is not exported and `renderContent` is still sync.

- [ ] **Step 9.3: Update `renderContent.tsx` — add extractGearIds, convert to async, handle directives**

Replace the contents of `web/lib/renderContent.tsx` with the updated version. Key changes:

1. Import `getProducts` and `GearCardView` from the new modules.
2. Add `extractGearIds(content)` helper.
3. Change signature: `export async function renderContent(content: string): Promise<JSX.Element[]>`.
4. Pre-fetch all gear ids in one batch at the top.
5. Add block matchers for `^::gear\[id\]$` and `^::gear-group\[ids\]$`.
6. Extend `renderInline` to parse `::gear-inline[id]` tokens.

```tsx
import Image from "next/image";
import Link from "next/link";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { getProducts, type AffiliateProduct } from "@/lib/affiliate-products";
import { GearCardView } from "@/components/GearCard";

// ---- Gear id extraction ----

const GEAR_BLOCK_RE = /^::(gear|gear-group)\[([^\]]+)\]$/;
const GEAR_INLINE_RE = /::gear-inline\[([^\]]+)\]/g;

export function extractGearIds(content: string): string[] {
  const ids = new Set<string>();
  // Block-level: each paragraph may be a gear directive
  for (const block of content.split(/\n\n+/)) {
    const m = block.trim().match(GEAR_BLOCK_RE);
    if (m) {
      for (const raw of m[2].split(",")) {
        const id = raw.trim();
        if (id) ids.add(id);
      }
    }
  }
  // Inline: scan the whole content for ::gear-inline[id]
  GEAR_INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GEAR_INLINE_RE.exec(content))) {
    const id = match[1].trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

// ---- Inline renderer (bold, links, gear-inline) ----

function renderBold(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={`b-${m.index}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderInline(
  text: string,
  products: Map<string, AffiliateProduct>
): (string | JSX.Element)[] {
  const segments: (string | JSX.Element)[] = [];
  // Combined regex: gear-inline OR link OR (fallback)
  // Simpler: two-pass. First split on gear-inline, then on links.
  const gearParts: (string | JSX.Element)[] = [];
  let lastIdx = 0;
  GEAR_INLINE_RE.lastIndex = 0;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = GEAR_INLINE_RE.exec(text))) {
    if (gMatch.index > lastIdx) {
      gearParts.push(text.slice(lastIdx, gMatch.index));
    }
    const id = gMatch[1].trim();
    const product = products.get(id);
    if (product && !product.is_blocked) {
      gearParts.push(
        <GearCardView key={`gp-${gMatch.index}`} product={product} variant="pill" />
      );
    }
    lastIdx = gMatch.index + gMatch[0].length;
  }
  if (lastIdx < text.length) gearParts.push(text.slice(lastIdx));

  // Now process strings (not gear elements) for links + bold
  for (const part of gearParts) {
    if (typeof part !== "string") {
      segments.push(part);
      continue;
    }
    // link parsing
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    let li = 0;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(part))) {
      if (lm.index > li) segments.push(...renderBold(part.slice(li, lm.index)));
      const label = lm[1];
      const href = lm[2];
      const isExternal = href.startsWith("http");
      segments.push(
        isExternal ? (
          <a
            key={`l-${segments.length}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-medium hover:underline inline-flex items-center gap-1"
          >
            {label}
            <ExternalLinkIcon size={12} className="inline" />
          </a>
        ) : (
          <Link
            key={`l-${segments.length}`}
            href={href}
            className="text-accent font-medium hover:underline"
          >
            {label}
          </Link>
        )
      );
      li = lm.index + lm[0].length;
    }
    if (li < part.length) segments.push(...renderBold(part.slice(li)));
  }
  return segments;
}

// ---- Block renderer ----

export async function renderContent(content: string): Promise<JSX.Element[]> {
  const ids = extractGearIds(content);
  const products = ids.length > 0 ? await getProducts(ids) : new Map<string, AffiliateProduct>();

  const blocks = content.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  return blocks.map((block, index) => {
    // Gear block: ::gear[id] or ::gear-group[a,b,c]
    const gm = block.match(GEAR_BLOCK_RE);
    if (gm) {
      const kind = gm[1];
      const rawIds = gm[2].split(",").map((s) => s.trim()).filter(Boolean);
      if (kind === "gear") {
        const product = products.get(rawIds[0]);
        if (!product || product.is_blocked) {
          return <span key={index} style={{ display: "none" }}>{`/* gear ${rawIds[0]} missing */`}</span>;
        }
        return <GearCardView key={index} product={product} variant="editorial" />;
      }
      // gear-group
      const found = rawIds
        .map((id) => products.get(id))
        .filter((p): p is AffiliateProduct => !!p && !p.is_blocked);
      if (found.length === 0) {
        return <span key={index} style={{ display: "none" }}>{`/* gear-group empty */`}</span>;
      }
      return (
        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {found.map((p) => (
            <GearCardView key={p.id} product={p} variant="editorial" />
          ))}
        </div>
      );
    }

    // Image: ![alt](url)
    const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      return (
        <figure key={index} className="my-8">
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
            <Image src={src} alt={alt || ""} fill className="object-cover" sizes="(max-width: 768px) 100vw, 720px" unoptimized />
          </div>
          {alt && <figcaption className="text-center text-sm text-primary/50 mt-2 italic">{alt}</figcaption>}
        </figure>
      );
    }

    // H2
    if (block.startsWith("## ")) {
      return (
        <h2 key={index} className="mt-10 mb-3 font-serif text-2xl font-bold text-primary">
          {block.slice(3).trim()}
        </h2>
      );
    }

    // H3
    if (block.startsWith("### ")) {
      return (
        <h3 key={index} className="mt-6 mb-2 font-serif text-lg font-bold text-primary">
          {block.slice(4).trim()}
        </h3>
      );
    }

    // Bullet list
    if (block.startsWith("- ") || block.startsWith("* ")) {
      const items = block.split(/\n/).map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
      return (
        <ul key={index} className="list-disc pl-6 space-y-2 my-4">
          {items.map((item, i) => (
            <li key={i} className="text-primary/90 leading-relaxed">
              {renderInline(item, products)}
            </li>
          ))}
        </ul>
      );
    }

    // Paragraph
    return (
      <p key={index} className="my-3 text-primary/90 leading-relaxed">
        {renderInline(block, products)}
      </p>
    );
  });
}
```

- [ ] **Step 9.4: Run renderContent tests**

```bash
cd web && npx vitest run lib/renderContent.test.tsx
```

Expected: all pass.

- [ ] **Step 9.5: Update call sites to `await`**

Edit `web/app/(site)/blog/[slug]/page.tsx`. Change line 86 from:

```typescript
const contentBlocks = renderContent(post.content);
```

to:

```typescript
const contentBlocks = await renderContent(post.content);
```

(The enclosing function is already async since it's `export default async function Page`.)

Edit `web/app/(site)/guides/[slug]/page.tsx` line 62 similarly.

- [ ] **Step 9.6: Check for any other callers missed in pre-flight**

```bash
cd web && grep -rn "renderContent(" --include="*.tsx" --include="*.ts" | grep -v "lib/renderContent"
```

Expected: only the two callers above. If more, update them.

- [ ] **Step 9.7: Build the site locally to catch type errors**

```bash
cd web && npm run build
```

Expected: build succeeds. If type errors, fix them.

- [ ] **Step 9.8: Commit**

```bash
git add web/lib/renderContent.tsx web/lib/renderContent.test.tsx web/app/\(site\)/blog/\[slug\]/page.tsx web/app/\(site\)/guides/\[slug\]/page.tsx
git commit -m "feat(affiliate): extend renderContent with gear directives (async)"
```

---

## Phase C — Deals Surfaces

### Task 10: `/tilbud` page with `diversify` helper

**Files:**
- Create: `web/lib/affiliate-deals.ts`
- Create: `web/lib/affiliate-deals.test.ts`
- Create: `web/app/(site)/tilbud/page.tsx`

- [ ] **Step 10.1: Write `diversify` tests**

Create `web/lib/affiliate-deals.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { diversify } from "./affiliate-deals";
import type { AffiliateProduct } from "./affiliate-products";

function mockP(id: string, category: string | null, discount = 50): AffiliateProduct {
  return {
    id,
    retailer: "outmore",
    brand: null,
    product_name: id,
    description: null,
    category_mapped: category,
    price: 100,
    price_original: 200,
    discount_pct: discount,
    in_stock: true,
    stock_count: null,
    image_url: "x",
    affiliate_url: "y",
    is_blocked: false,
  };
}

describe("diversify", () => {
  it("caps products per category", () => {
    const products = [
      mockP("1", "telt"),
      mockP("2", "telt"),
      mockP("3", "telt"),
      mockP("4", "telt"),
      mockP("5", "telt"),
      mockP("6", "sovepose"),
    ];
    const result = diversify(products, { maxPerCategory: 2, targetSize: 40 });
    expect(result.filter((p) => p.category_mapped === "telt")).toHaveLength(2);
    expect(result.filter((p) => p.category_mapped === "sovepose")).toHaveLength(1);
  });
  it("preserves input order when under caps", () => {
    const products = [mockP("1", "a"), mockP("2", "b"), mockP("3", "a")];
    const result = diversify(products, { maxPerCategory: 5, targetSize: 40 });
    expect(result.map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
  it("stops at targetSize", () => {
    const products = Array.from({ length: 100 }, (_, i) => mockP(`${i}`, `cat-${i % 10}`));
    const result = diversify(products, { maxPerCategory: 4, targetSize: 5 });
    expect(result).toHaveLength(5);
  });
  it("treats null categories as 'other' bucket", () => {
    const products = [mockP("1", null), mockP("2", null), mockP("3", null)];
    const result = diversify(products, { maxPerCategory: 2, targetSize: 40 });
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 10.2: Run to verify failure**

```bash
cd web && npx vitest run lib/affiliate-deals.test.ts
```

Expected: fails — module missing.

- [ ] **Step 10.3: Implement `affiliate-deals.ts`**

Create `web/lib/affiliate-deals.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { AffiliateProduct } from "./affiliate-products";

export interface DealsFilter {
  minDiscount?: number;    // default 25
  retailer?: string;
  category?: string;
}

export function diversify(
  products: AffiliateProduct[],
  opts: { maxPerCategory: number; targetSize: number }
): AffiliateProduct[] {
  const result: AffiliateProduct[] = [];
  const counts = new Map<string, number>();
  for (const p of products) {
    const cat = p.category_mapped ?? "other";
    const current = counts.get(cat) ?? 0;
    if (current < opts.maxPerCategory) {
      result.push(p);
      counts.set(cat, current + 1);
    }
    if (result.length >= opts.targetSize) break;
  }
  return result;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SELECT_COLUMNS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked";

/**
 * Fetches top deals, filtered by whitelisted categories and optional params.
 * Over-fetches and then diversifies.
 */
export async function getTopDeals(filter: DealsFilter = {}): Promise<AffiliateProduct[]> {
  const supabase = getSupabase();
  // Get whitelisted category slugs
  const { data: whitelisted } = await supabase
    .from("affiliate_category_mapping")
    .select("category_mapped")
    .eq("whitelisted", true)
    .not("category_mapped", "is", null);
  const allowedCats = [
    ...new Set((whitelisted ?? []).map((r: any) => r.category_mapped).filter(Boolean)),
  ] as string[];
  if (allowedCats.length === 0) return [];

  let q = supabase
    .from("affiliate_products")
    .select(SELECT_COLUMNS)
    .eq("in_stock", true)
    .eq("is_blocked", false)
    .gte("discount_pct", filter.minDiscount ?? 25)
    .in("category_mapped", filter.category ? [filter.category] : allowedCats)
    .order("discount_pct", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (filter.retailer) q = q.eq("retailer", filter.retailer);

  const { data } = await q;
  return diversify((data as AffiliateProduct[]) ?? [], { maxPerCategory: 4, targetSize: 40 });
}
```

- [ ] **Step 10.4: Run tests**

```bash
cd web && npx vitest run lib/affiliate-deals.test.ts
```

Expected: pass.

- [ ] **Step 10.5: Create `/tilbud` page**

Create `web/app/(site)/tilbud/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getTopDeals } from "@/lib/affiliate-deals";
import { GearCard } from "@/components/GearCard";

export const revalidate = 21600; // 6 hours

export const metadata: Metadata = {
  title: "Ugens bedste outdoor-tilbud",
  description:
    "De største prisfald på telte, soveposer, pandelamper og outdoor-grej — kurateret dagligt fra vores partnere.",
  alternates: { canonical: "/tilbud" },
};

interface PageProps {
  searchParams: Promise<{ retailer?: string; category?: string; minDiscount?: string }>;
}

export default async function TilbudPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const deals = await getTopDeals({
    retailer: params.retailer,
    category: params.category,
    minDiscount: params.minDiscount ? parseInt(params.minDiscount, 10) : undefined,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">Hjem</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Tilbud</span>
      </nav>
      <header className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
          Ugens bedste outdoor-tilbud
        </h1>
        <p className="mt-3 max-w-2xl text-primary/70">
          Vi har samlet de største prisfald på shelter- og outdoor-grej fra vores partnere.
          Opdateret dagligt.
        </p>
        <p className="mt-2 text-xs text-primary/50">
          Alle produkter her er affiliate-links.{" "}
          <Link href="/annoncer-og-partnere" className="underline">
            Læs om hvordan det virker →
          </Link>
        </p>
      </header>

      {/* Simple filter hint — real filter UI deferred */}
      {(params.retailer || params.category) && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-primary/60">Filter aktivt:</span>
          {params.retailer && (
            <span className="rounded-full bg-primary/5 px-3 py-1">Forhandler: {params.retailer}</span>
          )}
          {params.category && (
            <span className="rounded-full bg-primary/5 px-3 py-1">Kategori: {params.category}</span>
          )}
          <Link href="/tilbud" className="text-accent underline">Ryd filtre</Link>
        </div>
      )}

      {deals.length === 0 ? (
        <div className="rounded-xl bg-primary/5 py-16 text-center">
          <h2 className="font-serif text-xl text-primary">Ingen tilbud lige nu</h2>
          <p className="mt-2 text-primary/60">Kig tilbage snart — vi opdaterer dagligt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((p) => (
            <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10.6: Verify the page loads locally**

```bash
cd web && npm run dev
```

Visit http://localhost:3000/tilbud — expected: page renders. If no products match (because no categories are whitelisted yet), the empty state shows.

- [ ] **Step 10.7: Whitelist a few categories manually so the page is testable**

In the Supabase SQL editor, mark a handful of obvious mappings:

```sql
update affiliate_category_mapping
   set category_mapped = 'pandelampe', whitelisted = true
 where category_raw ilike '%pandelampe%';

update affiliate_category_mapping
   set category_mapped = 'sovepose', whitelisted = true
 where category_raw ilike '%sovepose%';

update affiliate_category_mapping
   set category_mapped = 'telt', whitelisted = true
 where category_raw ilike '%telt%';
```

Then re-run the sync so `category_mapped` gets populated on products:

```bash
cd web && npm run sync-products
```

Reload `/tilbud` — expected: products now show.

- [ ] **Step 10.8: Commit**

```bash
git add web/lib/affiliate-deals.ts web/lib/affiliate-deals.test.ts web/app/\(site\)/tilbud/page.tsx
git commit -m "feat(affiliate): add /tilbud page with diversified deals query"
```

---

### Task 11: Homepage deals widget + nav menu entry

**Files:**
- Create: `web/components/HomepageDealsWidget.tsx`
- Modify: `web/app/(site)/page.tsx` (or homepage file — verify path)
- Modify: `web/components/Navbar.tsx`
- Modify: `web/app/sitemap.ts`

- [ ] **Step 11.1: Find the homepage file**

```bash
cd web && ls app/\(site\)/page.tsx
```

Expected: file exists. Note its path for Step 11.3.

- [ ] **Step 11.2: Create `HomepageDealsWidget`**

Create `web/components/HomepageDealsWidget.tsx`:

```tsx
import Link from "next/link";
import { getTopDeals } from "@/lib/affiliate-deals";
import { GearCard } from "./GearCard";

export async function HomepageDealsWidget() {
  const deals = await getTopDeals({});
  if (deals.length === 0) return null;

  // Time-bucketed shuffle so SSR caching stays effective for ~1h
  const bucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const top = deals.slice(0, 20);
  const seed = (bucket * 9301 + 49297) % 233280;
  const shuffled = [...top].sort((_, __) => ((seed * 0.5) - 0.5));  // cheap deterministic shuffle
  const picks = shuffled.slice(0, 4);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary">
          Ugens outdoor-tilbud
        </h2>
        <Link href="/tilbud" className="text-sm font-medium text-accent hover:underline">
          Se alle →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((p) => (
          <GearCard key={p.id} id={p.id} variant="product" preloaded={p} />
        ))}
      </div>
      <div className="mt-6 text-center text-xs text-primary/40">
        <Link href="/annoncer-og-partnere" className="hover:underline">
          Annoncer · Sponsorerede links
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 11.3: Place the widget on the homepage**

Edit `web/app/(site)/page.tsx`. Import and render `<HomepageDealsWidget />` at an appropriate spot — typically below the main shelter grid but above the footer content. Because this is a homepage decision the user wants to verify, keep it simple: add a single import + component call. Exact placement can be tuned in PR review.

```tsx
import { HomepageDealsWidget } from "@/components/HomepageDealsWidget";
// ... inside the JSX, somewhere after existing content:
<HomepageDealsWidget />
```

- [ ] **Step 11.4: Add "Tilbud" to the nav**

Edit `web/components/Navbar.tsx` around line 12. Add a new entry:

```typescript
{ label: "Tilbud", href: "/tilbud" },
```

Suggested placement: between "Ruteplanner" and "Turvenner". Exact slot is a PR-review decision.

- [ ] **Step 11.5: Add `/tilbud` and `/annoncer-og-partnere` to the sitemap**

Edit `web/app/sitemap.ts`. Add two static entries to the generated URL list.

```typescript
// Add alongside other static URLs:
{ url: `${base}/tilbud`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
{ url: `${base}/annoncer-og-partnere`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
```

Verify the existing sitemap structure — use the same shape as the existing entries.

- [ ] **Step 11.6: Verify locally**

```bash
cd web && npm run dev
```

- Visit `/` → widget should appear
- Visit `/tilbud` from nav → deals page
- `/sitemap.xml` → two new entries

- [ ] **Step 11.7: Commit**

```bash
git add web/components/HomepageDealsWidget.tsx web/components/Navbar.tsx web/app/sitemap.ts web/app/\(site\)/page.tsx
git commit -m "feat(affiliate): add homepage deals widget + nav entry + sitemap"
```

---

## Phase D — Admin UI

### Task 12: `/admin/produkter` main list page

**Files:**
- Create: `web/app/(site)/admin/produkter/page.tsx`
- Create: `web/components/AdminProducts.tsx`
- Create: `web/components/AdminProductRow.tsx`
- Create: `web/components/AdminSyncStatusBar.tsx`

- [ ] **Step 12.1: Create the server page**

Create `web/app/(site)/admin/produkter/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AdminProducts } from "@/components/AdminProducts";
import { AdminSyncStatusBar } from "@/components/AdminSyncStatusBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Produkter | ShelterDK" },
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    retailer?: string;
    category?: string;
    minDiscount?: string;
    onlyInStock?: string;
    onlyBlocked?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

async function fetchFilteredProducts(params: Awaited<PageProps["searchParams"]>) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const page = parseInt(params.page ?? "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  let q = supabase
    .from("affiliate_products")
    .select(
      "id, retailer, brand, product_name, price, price_original, discount_pct, image_url, category_mapped, in_stock, is_blocked",
      { count: "exact" }
    );

  if (params.q) {
    q = q.textSearch(
      "product_name",
      params.q.split(/\s+/).join(" & "),
      { type: "websearch", config: "danish" }
    );
  }
  if (params.retailer) q = q.eq("retailer", params.retailer);
  if (params.category) q = q.eq("category_mapped", params.category);
  if (params.minDiscount) q = q.gte("discount_pct", parseInt(params.minDiscount, 10));
  if (params.onlyInStock === "1") q = q.eq("in_stock", true);
  if (params.onlyBlocked === "1") q = q.eq("is_blocked", true);

  q = q.order("discount_pct", { ascending: false, nullsFirst: false }).range(offset, offset + PAGE_SIZE - 1);

  const { data, count } = await q;
  return { rows: data ?? [], totalCount: count ?? 0, page };
}

export default async function AdminProduktPage(props: PageProps) {
  const params = await props.searchParams;
  const { rows, totalCount, page } = await fetchFilteredProducts(params);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">Hjem</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent">Admin</Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Produkter</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-primary">Produkter ({totalCount.toLocaleString("da-DK")})</h1>
        <AdminSyncStatusBar />
      </div>

      <AdminProducts
        initialRows={rows as any}
        totalCount={totalCount}
        currentPage={page}
        pageCount={pageCount}
      />

      <div className="mt-6">
        <Link href="/admin/produkter/kategorier" className="text-sm text-accent underline">
          → Kategori-mapping
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.2: Create the client-side `AdminProducts` component**

Create `web/components/AdminProducts.tsx`:

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AdminProductRow, type AdminProduct } from "./AdminProductRow";

interface Props {
  initialRows: AdminProduct[];
  totalCount: number;
  currentPage: number;
  pageCount: number;
}

const RETAILERS = ["outmore", "backpackerlife", "outdoortid"] as const;

export function AdminProducts({ initialRows, currentPage, pageCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites
  useEffect(() => {
    try {
      const raw = localStorage.getItem("affiliate-favorites");
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("affiliate-favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== (searchParams.get("q") ?? "")) updateParam("q", query || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = initialRows.filter((r) => {
    if (searchParams.get("onlyFavorites") === "1") return favorites.has(r.id);
    return true;
  });

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0 space-y-6 text-sm">
        <div>
          <label className="mb-2 block font-semibold text-primary">Forhandler</label>
          <select
            value={searchParams.get("retailer") ?? ""}
            onChange={(e) => updateParam("retailer", e.target.value || null)}
            className="w-full rounded border border-primary/20 px-2 py-1.5"
          >
            <option value="">Alle</option>
            {RETAILERS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-semibold text-primary">Min rabat %</label>
          <input
            type="number"
            min="0"
            max="100"
            defaultValue={searchParams.get("minDiscount") ?? ""}
            onBlur={(e) => updateParam("minDiscount", e.target.value || null)}
            className="w-full rounded border border-primary/20 px-2 py-1.5"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyInStock") === "1"}
            onChange={(e) => updateParam("onlyInStock", e.target.checked ? "1" : null)}
          />
          <span>Kun på lager</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyBlocked") === "1"}
            onChange={(e) => updateParam("onlyBlocked", e.target.checked ? "1" : null)}
          />
          <span>Kun blokeret</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={searchParams.get("onlyFavorites") === "1"}
            onChange={(e) => updateParam("onlyFavorites", e.target.checked ? "1" : null)}
          />
          <span>Kun favoritter</span>
        </label>
      </aside>

      <div className="flex-1 min-w-0">
        <input
          type="search"
          placeholder="Søg brand eller produktnavn…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-4 w-full rounded-lg border border-primary/20 px-4 py-2"
        />
        <div className="space-y-2">
          {filtered.map((p) => (
            <AdminProductRow
              key={p.id}
              product={p}
              isFavorite={favorites.has(p.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-lg bg-primary/5 py-8 text-center text-primary/60">
              Ingen produkter matcher filtrene
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-primary/60">
            Side {currentPage} af {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1 || isPending}
              onClick={() => updateParam("page", String(currentPage - 1))}
              className="rounded border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Forrige
            </button>
            <button
              disabled={currentPage >= pageCount || isPending}
              onClick={() => updateParam("page", String(currentPage + 1))}
              className="rounded border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
            >
              Næste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.3: Create `AdminProductRow`**

Create `web/components/AdminProductRow.tsx`:

```tsx
"use client";

import Image from "next/image";
import { Copy, Star, Ban, Check } from "lucide-react";
import { useState } from "react";

export interface AdminProduct {
  id: string;
  retailer: string;
  brand: string | null;
  product_name: string;
  price: number;
  price_original: number | null;
  discount_pct: number | null;
  image_url: string;
  category_mapped: string | null;
  in_stock: boolean;
  is_blocked: boolean;
}

interface Props {
  product: AdminProduct;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function AdminProductRow({ product, isFavorite, onToggleFavorite }: Props) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(product.is_blocked);
  const [blocking, setBlocking] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(`::gear[${product.id}]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleBlock = async () => {
    const secret = prompt("Admin secret:");
    if (!secret) return;
    setBlocking(true);
    try {
      const res = await fetch("/api/admin/affiliate-products/block", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ id: product.id, blocked: !blocked, reason: "manual" }),
      });
      if (res.ok) setBlocked(!blocked);
      else alert(`Failed: ${res.status}`);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border border-primary/10 bg-white p-3 ${blocked ? "opacity-50" : ""}`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-primary/5">
        <Image src={product.image_url} alt="" fill className="object-contain" sizes="56px" unoptimized />
      </div>
      <div className="flex-1 min-w-0">
        {product.brand && <div className="text-[11px] text-accent font-semibold">{product.brand}</div>}
        <div className="truncate font-medium text-primary">{product.product_name}</div>
        <div className="text-[11px] text-primary/50">
          {product.retailer} · {product.category_mapped ?? "ukategoriseret"} · {product.price} kr
          {product.discount_pct != null && ` · –${product.discount_pct}%`}
          {!product.in_stock && " · udsolgt"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={copyId}
          className="rounded border border-primary/20 px-2 py-1.5 text-xs hover:bg-primary/5"
          title="Kopi ::gear[id] til clipboard"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button
          onClick={() => onToggleFavorite(product.id)}
          className={`rounded border px-2 py-1.5 ${isFavorite ? "border-accent text-accent" : "border-primary/20 text-primary/50"}`}
          title="Favorit"
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          onClick={toggleBlock}
          disabled={blocking}
          className={`rounded border px-2 py-1.5 ${blocked ? "border-red-500 text-red-500" : "border-primary/20 text-primary/50"}`}
          title={blocked ? "Fjern blokering" : "Blokér"}
        >
          <Ban size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.4: Create `AdminSyncStatusBar`**

Create `web/components/AdminSyncStatusBar.tsx`:

```tsx
import { createClient } from "@supabase/supabase-js";

export async function AdminSyncStatusBar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from("affiliate_sync_runs")
    .select("status, started_at, finished_at, error_message, products_total")
    .order("started_at", { ascending: false })
    .limit(1);

  const run = data?.[0];
  if (!run) {
    return <span className="text-sm text-primary/50">Ingen sync-data</span>;
  }
  const ok = run.status === "success";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={ok ? "text-emerald-600" : "text-red-500"}>
        {ok ? "✓" : "✗"} {run.status}
      </span>
      <span className="text-primary/60">
        {run.finished_at ? new Date(run.finished_at).toLocaleString("da-DK") : "kører…"}
        {run.products_total != null && ` · ${run.products_total} produkter`}
      </span>
    </div>
  );
}
```

- [ ] **Step 12.5: Verify the page loads**

```bash
cd web && npm run dev
```

Visit http://localhost:3000/admin/produkter. Expected: page renders. Products list populated. Filters work (URL updates on change).

- [ ] **Step 12.6: Commit**

```bash
git add web/app/\(site\)/admin/produkter/page.tsx web/components/AdminProducts.tsx web/components/AdminProductRow.tsx web/components/AdminSyncStatusBar.tsx
git commit -m "feat(affiliate): add /admin/produkter list with filters + favorites"
```

---

### Task 13: Admin API routes (block + sync trigger)

**Files:**
- Create: `web/app/api/admin/affiliate-products/block/route.ts`
- Create: `web/app/api/admin/affiliate-products/sync/route.ts`

- [ ] **Step 13.1: Block route**

Create `web/app/api/admin/affiliate-products/block/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, blocked, reason } = await request.json();
  if (typeof id !== "string" || typeof blocked !== "boolean") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase
    .from("affiliate_products")
    .update({
      is_blocked: blocked,
      blocked_reason: blocked ? (reason ?? null) : null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 13.2: Sync trigger route**

Create `web/app/api/admin/affiliate-products/sync/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/scripts/sync-affiliate-products";

export const maxDuration = 300; // 5 minutes — this job may take a while

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runSync();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 13.3: Verify the env var name matches**

From pre-flight step 0.2, we know the admin secret env var. If it's not `ADMIN_SECRET`, replace it in both routes.

- [ ] **Step 13.4: Test the block route manually**

```bash
curl -X POST http://localhost:3000/api/admin/affiliate-products/block \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"id":"outmore-3342540815643","blocked":true,"reason":"test"}'
```

Expected: `{"ok":true}`. Verify in Supabase: product has `is_blocked=true`.

Undo: same command with `"blocked":false`.

- [ ] **Step 13.5: Commit**

```bash
git add web/app/api/admin/affiliate-products
git commit -m "feat(affiliate): add admin API routes for block + sync trigger"
```

---

### Task 14: Category mapping admin page

**Files:**
- Create: `web/app/(site)/admin/produkter/kategorier/page.tsx`
- Create: `web/components/AdminCategoryMapping.tsx`
- Create: `web/app/api/admin/affiliate-products/category-mapping/route.ts`

- [ ] **Step 14.1: Category mapping API route**

Create `web/app/api/admin/affiliate-products/category-mapping/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PUT(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { retailer, category_raw, category_mapped, whitelisted } = await request.json();
  if (typeof retailer !== "string" || typeof category_raw !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase
    .from("affiliate_category_mapping")
    .update({
      category_mapped: category_mapped || null,
      whitelisted: !!whitelisted,
      updated_at: new Date().toISOString(),
    })
    .eq("retailer", retailer)
    .eq("category_raw", category_raw);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 14.2: Server page**

Create `web/app/(site)/admin/produkter/kategorier/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AdminCategoryMapping } from "@/components/AdminCategoryMapping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminKategorierPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from("affiliate_category_mapping")
    .select("retailer, category_raw, category_mapped, whitelisted")
    .order("category_mapped", { ascending: true, nullsFirst: true })
    .order("retailer")
    .order("category_raw");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-sm text-primary/60">
        <Link href="/admin" className="hover:text-accent">Admin</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/produkter" className="hover:text-accent">Produkter</Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Kategorier</span>
      </nav>
      <h1 className="mb-6 font-serif text-2xl font-bold text-primary">Kategori-mapping</h1>
      <AdminCategoryMapping rows={(data ?? []) as any} />
    </div>
  );
}
```

- [ ] **Step 14.3: Client component**

Create `web/components/AdminCategoryMapping.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Row {
  retailer: string;
  category_raw: string;
  category_mapped: string | null;
  whitelisted: boolean;
}

export function AdminCategoryMapping({ rows }: { rows: Row[] }) {
  const [local, setLocal] = useState(rows);
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (row: Row) => {
    const secret = prompt("Admin secret:");
    if (!secret) return;
    const key = `${row.retailer}::${row.category_raw}`;
    setSaving(key);
    try {
      const res = await fetch("/api/admin/affiliate-products/category-mapping", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify(row),
      });
      if (!res.ok) alert(`Failed: ${res.status}`);
    } finally {
      setSaving(null);
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setLocal((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-primary/10 text-left text-primary/60">
          <th className="py-2 pr-4">Retailer</th>
          <th className="pr-4">Raw</th>
          <th className="pr-4">Mapped</th>
          <th className="pr-4">Whitelist</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {local.map((row, i) => {
          const key = `${row.retailer}::${row.category_raw}`;
          const isUnknown = row.category_mapped == null;
          return (
            <tr key={key} className={`border-b border-primary/5 ${isUnknown ? "bg-yellow-50/50" : ""}`}>
              <td className="py-2 pr-4 align-top text-primary/70">{row.retailer}</td>
              <td className="pr-4 align-top text-primary/90">{row.category_raw}</td>
              <td className="pr-4 align-top">
                <input
                  type="text"
                  value={row.category_mapped ?? ""}
                  onChange={(e) => updateRow(i, { category_mapped: e.target.value })}
                  placeholder="slug…"
                  className="w-32 rounded border border-primary/20 px-2 py-1"
                />
              </td>
              <td className="pr-4 align-top">
                <input
                  type="checkbox"
                  checked={row.whitelisted}
                  onChange={(e) => updateRow(i, { whitelisted: e.target.checked })}
                />
              </td>
              <td className="pr-4 align-top">
                <button
                  onClick={() => save(row)}
                  disabled={saving === key}
                  className="rounded border border-primary/20 px-3 py-1 text-xs hover:bg-primary/5"
                >
                  {saving === key ? "…" : "Gem"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 14.4: Verify the page loads**

Visit http://localhost:3000/admin/produkter/kategorier. Should show unknown mappings at the top with yellow highlight.

- [ ] **Step 14.5: Commit**

```bash
git add web/app/\(site\)/admin/produkter/kategorier web/components/AdminCategoryMapping.tsx web/app/api/admin/affiliate-products/category-mapping
git commit -m "feat(affiliate): add admin category mapping page + API"
```

---

## Phase E — Compliance

### Task 15: `/annoncer-og-partnere` disclosure page

**Files:**
- Create: `web/app/(site)/annoncer-og-partnere/page.tsx`

- [ ] **Step 15.1: Create the page**

Create `web/app/(site)/annoncer-og-partnere/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Annoncer og partnere — sådan finansieres ShelterDK",
  description:
    "ShelterDK.dk er gratis at bruge. Læs om vores affiliate-partnere, hvordan vi finansieres, og vores løfte om kurateret grej-anbefaling.",
  alternates: { canonical: "/annoncer-og-partnere" },
};

export default function AnnoncerOgPartnerePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-6 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent">Hjem</Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-primary">Annoncer og partnere</span>
      </nav>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">
        Annoncer, partnere og hvordan ShelterDK finansieres
      </h1>
      <div className="prose prose-primary mt-6 max-w-none">
        <p>
          ShelterDK.dk er gratis at bruge. Vi holder projektet kørende ved at samarbejde med
          udvalgte danske outdoor-forhandlere som affiliate-partnere. Når du klikker på et af
          vores produkt-anbefalinger og køber noget, modtager ShelterDK en lille kompensation
          — uden at det koster dig ekstra.
        </p>

        <h2>Vores partnere</h2>
        <ul>
          <li>
            <strong>Backpackerlife.dk</strong> — Dansk online outdoor- og prepping-butik
          </li>
          <li>
            <strong>Outdoortid.dk</strong> — Dansk specialist i outdoor- og camping-grej
          </li>
          <li>
            <strong>Outmore.dk</strong> — Dansk online outdoor-forhandler med bredt sortiment
          </li>
        </ul>

        <h2>Vores løfte</h2>
        <ul>
          <li>Vi anbefaler kun grej, vi selv ville bruge.</li>
          <li>
            Priser og lagerstatus opdateres dagligt direkte fra forhandlerne — du ser altid
            den seneste pris.
          </li>
          <li>
            Vi viser altid rabatprocenten klart, så du kan se hvor meget du sparer.
          </li>
          <li>
            Vi modtager ikke betaling for at placere specifikke produkter. Alle produkter vi
            fremhæver er valgt ud fra relevans og kvalitet.
          </li>
        </ul>

        <h2>Hvad hvis du ser en forkert pris eller et dårligt match?</h2>
        <p>
          Skriv til os på <Link href="/kontakt">kontaktsiden</Link>, så retter vi det hurtigst
          muligt.
        </p>

        <h2>Det juridiske</h2>
        <p>
          Alle affiliate-links er markeret med "Annonce · Sponsoreret link" på produktkortene
          og benytter <code>rel="sponsored"</code>-attributten i linket, i overensstemmelse
          med markedsføringsloven §6 og Google's retningslinjer.
        </p>
        <p>
          Når du klikker videre til en af vores partnere, kan forhandlerens side sætte cookies
          til sporing af dit køb. Disse cookies er under den pågældende forhandlers kontrol og
          dækkes af deres privatlivspolitik.
        </p>
      </div>
    </article>
  );
}
```

- [ ] **Step 15.2: Verify locally**

Visit http://localhost:3000/annoncer-og-partnere. Expected: page renders.

- [ ] **Step 15.3: Commit**

```bash
git add web/app/\(site\)/annoncer-og-partnere/page.tsx
git commit -m "feat(affiliate): add /annoncer-og-partnere disclosure page"
```

---

### Task 16: Footer link to the disclosure page

**Files:**
- Modify: `web/components/Footer.tsx`

- [ ] **Step 16.1: Add the footer link**

Edit `web/components/Footer.tsx` around line 14. Add a new entry next to existing footer links:

```typescript
{ label: "Annoncer og partnere", href: "/annoncer-og-partnere" },
```

Use the same array the existing links live in (Privatliv og cookies, Vilkår).

- [ ] **Step 16.2: Verify locally**

Refresh any page and scroll to the footer. Expected: new link appears.

- [ ] **Step 16.3: Commit**

```bash
git add web/components/Footer.tsx
git commit -m "feat(affiliate): link /annoncer-og-partnere from footer"
```

---

## Phase F — Verification

### Task 17: E2E smoke test + manual walkthrough

**Files:**
- Create: `web/e2e/affiliate.spec.ts`

- [ ] **Step 17.1: Write a Playwright smoke test**

Create `web/e2e/affiliate.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("/tilbud page renders with at least one product card", async ({ page }) => {
  await page.goto("/tilbud");
  await expect(page.locator("h1")).toContainText("Ugens bedste outdoor-tilbud");
  // Grid should have at least one GearCard (product variant).
  // If no whitelisted categories exist yet, empty state will show instead.
  const emptyState = page.locator("text=Ingen tilbud lige nu");
  const cards = page.locator('a[rel="sponsored nofollow noopener"]');
  const empty = await emptyState.isVisible().catch(() => false);
  if (!empty) {
    await expect(cards.first()).toBeVisible();
  }
});

test("/annoncer-og-partnere loads and is linked from footer", async ({ page }) => {
  await page.goto("/");
  await page.locator('footer a[href="/annoncer-og-partnere"]').click();
  await expect(page.locator("h1")).toContainText("Annoncer");
});
```

- [ ] **Step 17.2: Run the smoke test**

```bash
cd web && npm run test:e2e -- affiliate.spec.ts
```

Expected: both tests pass. If `/tilbud` is empty because no categories are whitelisted, that's OK — the test accepts the empty state.

- [ ] **Step 17.3: Run the full manual smoke checklist**

Work through each item, checking off as you go:

- [ ] `npm run sync-products` → ~10k products in DB
- [ ] `/admin/produkter` → search, filter, copy ID, favorite, block (and undo)
- [ ] Create a test blog post locally with `::gear[some-id]` and verify the card renders
- [ ] Create a test with `::gear-inline[some-id]` mid-sentence and verify the pill renders
- [ ] Create a test with `::gear-group[a, b, c]` and verify the grid renders
- [ ] Reference a non-existent id in a blog post → page still renders, no crash
- [ ] `/tilbud` → grid renders, filters work, empty state works when filters exclude everything
- [ ] `/` → homepage widget renders with 4 products
- [ ] Click any affiliate link → partner-ads tracking URL opens in new tab
- [ ] `/annoncer-og-partnere` → page loads, linked from footer
- [ ] Nav shows "Tilbud" menu item
- [ ] Sitemap includes `/tilbud` and `/annoncer-og-partnere`

- [ ] **Step 17.4: Run the full unit test suite**

```bash
cd web && npm run test
```

Expected: all tests pass.

- [ ] **Step 17.5: Build**

```bash
cd web && npm run build
```

Expected: clean build, no type or lint errors.

- [ ] **Step 17.6: Commit + push**

```bash
git add web/e2e/affiliate.spec.ts
git commit -m "test(affiliate): add Playwright smoke tests for /tilbud and /annoncer-og-partnere"
git push origin <branch>
```

---

## Follow-up (post-deploy)

These don't block Phase 1 but should be done shortly after shipping:

1. **Watch `affiliate_sync_runs` for a week** to confirm nightly cron runs successfully.
2. **Whitelist more categories** — use `/admin/produkter/kategorier` to triage the unknown mappings from the first sync.
3. **Measure** — add basic click tracking to `GearCard` links so you know what converts (can be as simple as a `/api/collect?gear_id=...` endpoint).
4. **Write first blog post** that embeds gear cards, to exercise the full author workflow end-to-end.

---

## Notes for the implementing agent

- **Always run tests after each implementation step** — this plan is TDD-heavy on purpose.
- **Commit frequently** — the plan shows commit points, but if a step is large, split commits further.
- **If a test pattern here doesn't match the existing codebase** (e.g. different import syntax, different mock approach), follow the existing codebase style rather than the pattern here.
- **If admin secret env var is named differently** (`ADMIN_SECRET` vs `ADMIN_SECRET_KEY` vs something else), replace globally in the admin routes from Task 13 onwards.
- **If `renderContent` is called from more than 2 places**, update all call sites in Task 9.5.
- **The homepage widget's shuffle** is a deliberate simplification — it's not a true shuffle, it's a time-bucket rotation that keeps SSR caching effective. If you want a real random pick per render, remove the bucket and accept no caching for that widget.
- **Reference the spec doc** at `docs/superpowers/specs/2026-04-11-affiliate-foundation-phase-1-design.md` for any design question not covered here.
