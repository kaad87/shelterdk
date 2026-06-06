# Buyer-intent købsguider — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg et genbrugeligt buying-guide-system på shelterdk der fanger købsintent via Google ("bedste sovepose") og konverterer til affiliate-klik — troværdigt.

**Architecture:** Tre lag oven på det eksisterende `affiliate_products`-feed: (1) datamodel der adskiller live produktdata fra redaktionel rangering, (2) en genbrugelig ISR-side `/bedste/[slug]` med rangerede produktkort + lang købsguide-brødtekst + schema, (3) admin til at bygge guider og berige produkt-specs. Genbruger `GearCardView`, `renderContent`, `faqToJsonLd`, `/api/track`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Vitest (TDD), Tailwind. Følg eksisterende mønstre i `web/`.

**Spec:** `docs/superpowers/specs/2026-06-06-buyer-intent-buying-guides-design.md`

**Konventioner (vigtigt):**
- Migrations: `web/migrations/YYYYMMDD_*.sql`, anvendes manuelt mod Supabase (ingen runner). Brug `create table if not exists`.
- Admin-auth: header `x-admin-secret` === `process.env.ADMIN_SECRET` (se `app/api/admin/affiliate-products/block/route.ts`).
- Service-role Supabase-klient til admin/writes; offentlig læsning af publicerede guider.
- Tests: kun rene funktioner unit-testes (mock data). Sider/admin verificeres via `tsc` + build + curl. Baseline `tsc`-fejl: 12 (præeksisterende i `app/api/experiences/__tests__/`). Ingen NYE fejl tilladt.

---

## File Structure

**Opret:**
- `web/migrations/20260606_buying_guides.sql` — schema + RLS
- `web/lib/buying-guides.ts` — typer, rene helpers (`rankGuideEntries`), data-fetch (`getGuideBySlug`, `getPublishedGuides`)
- `web/lib/buying-guides-schema.ts` — rene JSON-LD-buildere (`buildItemListSchema`, `buildProductSchema`)
- `web/lib/__tests__/buying-guides.test.ts` — tests for `rankGuideEntries` + spec-helpers
- `web/lib/__tests__/buying-guides-schema.test.ts` — tests for schema-buildere
- `web/components/buying-guide/BuyingGuideEntry.tsx` — ét rangeret produktkort
- `web/components/buying-guide/BuyingGuideSources.tsx` — kilder-blok
- `web/app/(site)/bedste/[slug]/page.tsx` — guide-template (ISR)
- `web/app/(site)/bedste/page.tsx` — guide-index (hub)
- `web/app/(site)/saadan-vurderer-vi/page.tsx` — metode + disclosure
- `web/app/api/admin/buying-guides/route.ts` — CRUD for guider
- `web/app/api/admin/buying-guides/entries/route.ts` — entries (add/edit/reorder/remove)
- `web/app/api/admin/affiliate-products/specs/route.ts` — sæt produkt-specs/editor_score
- `web/components/AdminBuyingGuides.tsx` — admin-UI
- `web/app/(site)/admin/koebsguider/page.tsx` — admin-route

**Modificér:**
- `web/app/sitemap.ts` — tilføj `/bedste`, `/saadan-vurderer-vi` + publicerede guider
- `web/app/(site)/admin/page.tsx` — link til ny admin-side

---

## Task 1: Datamodel (migration)

**Files:**
- Create: `web/migrations/20260606_buying_guides.sql`

- [ ] **Step 1: Skriv migrationen**

```sql
-- Buyer-intent købsguider (affiliate).
-- Adskiller live produktdata (affiliate_products) fra redaktionel rangering.

-- 1) Strukturerede specs + redaktionel score på produkter.
alter table public.affiliate_products
  add column if not exists specs jsonb,
  add column if not exists editor_score numeric;

-- 2) Selve guiden.
create table if not exists public.buying_guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,                 -- matcher affiliate_products.category_mapped
  intro text,                             -- kort ingress
  body_md text,                           -- lang købsguide-brødtekst (markdown, renderes via renderContent)
  sources jsonb,                          -- [{title, url}] eksterne tests/kilder
  faq jsonb,                              -- [{q, a}] synlig FAQ + FAQPage-schema
  seo_title text,
  seo_description text,
  hero_image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Rangerede produkter i guiden.
create table if not exists public.buying_guide_entries (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.buying_guides(id) on delete cascade,
  affiliate_product_id uuid not null references public.affiliate_products(id) on delete cascade,
  rank int not null default 0,
  award_label text,                       -- 'Bedst i test'|'Bedste budget'|'Bedste letvægt'|'Bedste til vinter'...
  editorial_note text,                    -- "derfor anbefaler vi"
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (guide_id, affiliate_product_id)
);

create index if not exists idx_bge_guide on public.buying_guide_entries(guide_id, rank);
create index if not exists idx_bg_status on public.buying_guides(status);

-- RLS: offentlig læsning af publicerede guider + deres entries. Skrivning kun service-role.
alter table public.buying_guides enable row level security;
alter table public.buying_guide_entries enable row level security;

drop policy if exists "public read published guides" on public.buying_guides;
create policy "public read published guides" on public.buying_guides
  for select using (status = 'published');

drop policy if exists "public read entries of published guides" on public.buying_guide_entries;
create policy "public read entries of published guides" on public.buying_guide_entries
  for select using (
    exists (select 1 from public.buying_guides g
            where g.id = guide_id and g.status = 'published')
  );

-- updated_at trigger (genbrug mønster hvis findes; ellers simpel).
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_bg_touch on public.buying_guides;
create trigger trg_bg_touch before update on public.buying_guides
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 2: Anvend mod Supabase**

Kør SQL'en i Supabase SQL-editor (eller via psql). Verificér: `select * from public.buying_guides limit 1;` returnerer 0 rækker uden fejl, og `\d affiliate_products` viser `specs`, `editor_score`.

> Bemærk: `touch_updated_at` kan allerede findes i en tidligere migration — tjek først; hvis den findes, fjern create-function-blokken for at undgå at overskrive.

- [ ] **Step 3: Commit**

```bash
git add web/migrations/20260606_buying_guides.sql
git commit -m "feat(guides): datamodel for buying guides (specs, buying_guides, entries, RLS)"
```

---

## Task 2: Typer + ren rangerings-logik (TDD)

`rankGuideEntries` sorterer entries efter `rank` og **demoterer udsolgte/blokerede** produkter til bunden (anbefal aldrig noget der ikke kan købes), men fjerner dem ikke (redaktøren ser dem stadig). Ren funktion → fuld TDD.

**Files:**
- Create: `web/lib/buying-guides.ts`
- Test: `web/lib/__tests__/buying-guides.test.ts`

- [ ] **Step 1: Skriv den fejlende test**

```typescript
import { describe, it, expect } from "vitest";
import { rankGuideEntries, type GuideEntryWithProduct } from "@/lib/buying-guides";

function entry(id: string, rank: number, inStock: boolean, blocked = false): GuideEntryWithProduct {
  return {
    id, rank, award_label: null, editorial_note: "", pros: [], cons: [],
    product: { id: `p${id}`, in_stock: inStock, is_blocked: blocked, price: 500 } as GuideEntryWithProduct["product"],
  };
}

describe("rankGuideEntries", () => {
  it("sorterer efter rank stigende", () => {
    const out = rankGuideEntries([entry("b", 2, true), entry("a", 1, true)]);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("demoterer udsolgte til bunden (men beholder dem)", () => {
    const out = rankGuideEntries([entry("oos", 1, false), entry("ok", 2, true)]);
    expect(out.map((e) => e.id)).toEqual(["ok", "oos"]);
  });

  it("demoterer blokerede til bunden", () => {
    const out = rankGuideEntries([entry("blk", 1, true, true), entry("ok", 2, true)]);
    expect(out.map((e) => e.id)).toEqual(["ok", "blk"]);
  });

  it("blandt demoterede bevares indbyrdes rank-rækkefølge", () => {
    const out = rankGuideEntries([entry("oos2", 5, false), entry("oos1", 3, false)]);
    expect(out.map((e) => e.id)).toEqual(["oos1", "oos2"]);
  });
});
```

- [ ] **Step 2: Kør → forventet FAIL** (`rankGuideEntries` findes ikke)

Run: `cd web && npx vitest run lib/__tests__/buying-guides.test.ts`

- [ ] **Step 3: Implementér typer + `rankGuideEntries`**

I `web/lib/buying-guides.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { AffiliateProduct } from "@/lib/affiliate-products";

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export interface BuyingGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
  intro: string | null;
  body_md: string | null;
  sources: { title: string; url: string }[] | null;
  faq: { q: string; a: string }[] | null;
  seo_title: string | null;
  seo_description: string | null;
  hero_image_url: string | null;
  status: "draft" | "published";
  last_reviewed_at: string | null;
  updated_at: string;
}

export interface GuideEntryWithProduct {
  id: string;
  rank: number;
  award_label: string | null;
  editorial_note: string;
  pros: string[];
  cons: string[];
  product: AffiliateProduct & { specs?: Record<string, unknown> | null };
}

/** Sortér entries efter rank; demotér udsolgte/blokerede til bunden (behold dem). */
export function rankGuideEntries(entries: GuideEntryWithProduct[]): GuideEntryWithProduct[] {
  const available = (e: GuideEntryWithProduct) => e.product.in_stock && !e.product.is_blocked;
  return [...entries].sort((a, b) => {
    const av = available(a) ? 0 : 1;
    const bv = available(b) ? 0 : 1;
    if (av !== bv) return av - bv;
    return a.rank - b.rank;
  });
}
```

- [ ] **Step 4: Kør → forventet PASS**

Run: `cd web && npx vitest run lib/__tests__/buying-guides.test.ts`

- [ ] **Step 5: Commit**

```bash
git add web/lib/buying-guides.ts web/lib/__tests__/buying-guides.test.ts
git commit -m "feat(guides): rankGuideEntries + typer (demotér udsolgte)"
```

---

## Task 3: Data-fetch (`getGuideBySlug`, `getPublishedGuides`)

Henter en guide + dens entries joinet til live produktdata. Ikke unit-testet (DB-koblet) — verificeres senere via siden. Følg `getTopDeals`-mønstret i `lib/affiliate-deals.ts`.

**Files:**
- Modify: `web/lib/buying-guides.ts`

- [ ] **Step 1: Tilføj fetch-funktioner**

```typescript
const PRODUCT_COLS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked, specs";

export async function getPublishedGuides(): Promise<BuyingGuide[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("buying_guides")
    .select("*")
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  return (data as BuyingGuide[]) ?? [];
}

export async function getPublishedGuideSlugs(): Promise<string[]> {
  return (await getPublishedGuides()).map((g) => g.slug);
}

export async function getGuideBySlug(
  slug: string
): Promise<{ guide: BuyingGuide; entries: GuideEntryWithProduct[] } | null> {
  const sb = getServiceClient();
  const { data: guide } = await sb
    .from("buying_guides")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!guide) return null;

  const { data: rawEntries } = await sb
    .from("buying_guide_entries")
    .select("id, rank, award_label, editorial_note, pros, cons, affiliate_product_id")
    .eq("guide_id", guide.id);

  const ids = (rawEntries ?? []).map((e) => e.affiliate_product_id);
  if (ids.length === 0) return { guide: guide as BuyingGuide, entries: [] };

  const { data: products } = await sb.from("affiliate_products").select(PRODUCT_COLS).in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const entries: GuideEntryWithProduct[] = (rawEntries ?? [])
    .map((e) => {
      const product = byId.get(e.affiliate_product_id);
      if (!product) return null;
      return {
        id: e.id, rank: e.rank, award_label: e.award_label,
        editorial_note: e.editorial_note ?? "", pros: e.pros ?? [], cons: e.cons ?? [],
        product,
      } as GuideEntryWithProduct;
    })
    .filter((e): e is GuideEntryWithProduct => e !== null);

  return { guide: guide as BuyingGuide, entries: rankGuideEntries(entries) };
}
```

- [ ] **Step 2: Verificér typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep buying-guides` → forventet: ingen output.

- [ ] **Step 3: Commit**

```bash
git add web/lib/buying-guides.ts
git commit -m "feat(guides): data-fetch getGuideBySlug + getPublishedGuides (live produktjoin)"
```

---

## Task 4: JSON-LD schema-buildere (TDD)

Rene funktioner der bygger `ItemList` + `Product`. FAQ genbruger eksisterende `faqToJsonLd` (`lib/faq.ts`). Følg `BreadcrumbSchema`-mønstret for output-form.

**Files:**
- Create: `web/lib/buying-guides-schema.ts`
- Test: `web/lib/__tests__/buying-guides-schema.test.ts`

- [ ] **Step 1: Skriv fejlende test**

```typescript
import { describe, it, expect } from "vitest";
import { buildItemListSchema, buildProductSchema } from "@/lib/buying-guides-schema";

const product = {
  product_name: "Test Sovepose", brand: "Acme", image_url: "https://x/i.jpg",
  price: 999, affiliate_url: "https://shop/x", retailer: "backpackerlife",
} as Parameters<typeof buildProductSchema>[0];

describe("buildItemListSchema", () => {
  it("laver ItemList med position pr. produkt", () => {
    const s = buildItemListSchema([product, product], "https://shelterdk.dk/bedste/sovepose");
    expect(s["@type"]).toBe("ItemList");
    expect((s.itemListElement as unknown[]).length).toBe(2);
    expect((s.itemListElement as { position: number }[])[0].position).toBe(1);
  });
});

describe("buildProductSchema", () => {
  it("inkluderer navn, brand og offers med pris", () => {
    const s = buildProductSchema(product);
    expect(s["@type"]).toBe("Product");
    expect(s.name).toBe("Test Sovepose");
    expect((s.offers as { price: number }).price).toBe(999);
    expect((s.offers as { priceCurrency: string }).priceCurrency).toBe("DKK");
  });
});
```

- [ ] **Step 2: Kør → FAIL**

Run: `cd web && npx vitest run lib/__tests__/buying-guides-schema.test.ts`

- [ ] **Step 3: Implementér**

```typescript
import type { AffiliateProduct } from "@/lib/affiliate-products";

type P = Pick<AffiliateProduct, "product_name" | "brand" | "image_url" | "price" | "affiliate_url" | "retailer">;

export function buildProductSchema(p: P): Record<string, unknown> {
  return {
    "@type": "Product",
    name: p.product_name,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    image: p.image_url,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "DKK",
      availability: "https://schema.org/InStock",
      url: p.affiliate_url,
    },
  };
}

export function buildItemListSchema(products: P[], pageUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildProductSchema(p),
    })),
  };
}
```

- [ ] **Step 4: Kør → PASS**

- [ ] **Step 5: Commit**

```bash
git add web/lib/buying-guides-schema.ts web/lib/__tests__/buying-guides-schema.test.ts
git commit -m "feat(guides): JSON-LD schema-buildere (ItemList + Product)"
```

---

## Task 5: `BuyingGuideEntry`-komponent (ét rangeret kort)

Præsentationskomponent. Genbruger `GearCardView` (`components/GearCard.tsx`) til pris/CTA (variant `"product"`) og wrapper med badge, "derfor", pros/cons, spec-række.

**Files:**
- Create: `web/components/buying-guide/BuyingGuideEntry.tsx`

- [ ] **Step 1: Implementér komponenten**

```tsx
import { GearCardView } from "@/components/GearCard";
import { Check, X } from "lucide-react";
import type { GuideEntryWithProduct } from "@/lib/buying-guides";

/** Pæn label for udvalgte spec-nøgler (kategori-agnostisk fallback = nøglen selv). */
const SPEC_LABELS: Record<string, string> = {
  komfort_temp: "Komforttemp.", graense_temp: "Grænsetemp.", vaegt_g: "Vægt",
  fyld: "Fyld", form: "Form", pakmaal: "Pakmål",
};
function formatSpec(key: string, val: unknown): string {
  if (key.endsWith("_temp")) return `${val} °C`;
  if (key === "vaegt_g") return `${val} g`;
  return String(val);
}

export function BuyingGuideEntry({ entry, position }: { entry: GuideEntryWithProduct; position: number }) {
  const { product } = entry;
  const specs = (product.specs ?? {}) as Record<string, unknown>;
  return (
    <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{position}</span>
        {entry.award_label && (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{entry.award_label}</span>
        )}
      </div>

      <GearCardView product={product} variant="product" />

      {entry.editorial_note && (
        <p className="mt-3 text-sm leading-relaxed text-primary/80">{entry.editorial_note}</p>
      )}

      {(entry.pros.length > 0 || entry.cons.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ul className="space-y-1">
            {entry.pros.map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-primary/80">
                <Check size={15} className="mt-0.5 shrink-0 text-green-600" /> {p}
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {entry.cons.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-primary/60">
                <X size={15} className="mt-0.5 shrink-0 text-red-500" /> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(specs).length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-primary/5 pt-3 text-xs text-primary/60">
          {Object.entries(specs).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium">{SPEC_LABELS[k] ?? k}:</dt>
              <dd>{formatSpec(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
```

> Verificér `GearCardView` accepterer `variant="product"` (se `components/GearCardClient.tsx`, `GearCardVariant = "editorial" | "product" | "pill"`). Justér prop-navn hvis nødvendigt.

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep BuyingGuideEntry` → ingen output.

- [ ] **Step 3: Commit**

```bash
git add web/components/buying-guide/BuyingGuideEntry.tsx
git commit -m "feat(guides): BuyingGuideEntry rangeret produktkort"
```

---

## Task 6: Guide-template `/bedste/[slug]`

ISR-side. Mønster: se `app/(site)/shelter-med-vand/page.tsx` (metadata, BreadcrumbSchema, ISR, llm-quote) og `app/(site)/tilbud/page.tsx`. Renderer entries, `body_md` via `renderContent`, kilder, FAQ, schema.

**Files:**
- Create: `web/app/(site)/bedste/[slug]/page.tsx`

- [ ] **Step 1: Implementér siden**

Nøgleelementer (fyld markup ud efter mønster fra `/tilbud` + `/shelter-med-vand`):

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuideBySlug, getPublishedGuideSlugs } from "@/lib/buying-guides";
import { buildItemListSchema } from "@/lib/buying-guides-schema";
import { BuyingGuideEntry } from "@/components/buying-guide/BuyingGuideEntry";
import { BuyingGuideSources } from "@/components/buying-guide/BuyingGuideSources";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { renderContent } from "@/lib/renderContent";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getPublishedGuideSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getGuideBySlug(params.slug);
  if (!data) return {};
  const { guide } = data;
  return {
    title: { absolute: guide.seo_title || guide.title },
    description: guide.seo_description ?? guide.intro ?? undefined,
    alternates: { canonical: `https://shelterdk.dk/bedste/${guide.slug}` },
    openGraph: { title: guide.seo_title || guide.title, url: `/bedste/${guide.slug}` },
  };
}

export default async function BuyingGuidePage({ params }: { params: { slug: string } }) {
  const data = await getGuideBySlug(params.slug);
  if (!data) notFound();
  const { guide, entries } = data;
  const pageUrl = `https://shelterdk.dk/bedste/${guide.slug}`;
  const itemList = buildItemListSchema(entries.map((e) => e.product), pageUrl);
  // FAQ kommer fra guide.faq ([{q,a}]) → synlig sektion + FAQPage-schema.
  const faqItems: FaqItem[] = (guide.faq ?? []).map((f) => ({ question: f.q, answer: f.a }));

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Bedste", href: "/bedste" }, { label: guide.title }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
      )}

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
          {/* breadcrumb-nav, H1, ingress */}
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">{guide.title}</h1>
          {guide.intro && <p className="text-primary/80 text-lg">{guide.intro}</p>}
          <p className="mt-2 text-xs text-primary/50">
            {guide.last_reviewed_at && <>Sidst opdateret {new Date(guide.last_reviewed_at).toLocaleDateString("da-DK")} · </>}
            <Link href="/saadan-vurderer-vi" className="underline hover:text-accent">Sådan vurderer vi</Link>
          </p>

          {/* Rangeret liste */}
          <div className="mt-8 space-y-5">
            {entries.map((e, i) => <BuyingGuideEntry key={e.id} entry={e} position={i + 1} />)}
          </div>

          {/* Lang købsguide-brødtekst (SEO-motor) */}
          {guide.body_md && (
            <div className="prose prose-primary mt-12 max-w-none">{await renderContent(guide.body_md)}</div>
          )}

          {/* Kilder */}
          <BuyingGuideSources sources={guide.sources} />

          {/* Disclosure */}
          <p className="mt-10 rounded-lg bg-primary/[0.03] p-4 text-xs text-primary/50">
            shelterdk anbefaler grej fra vores partnere og tjener en kommission når du handler via vores links.
            Det påvirker ikke prisen for dig. Vi labtester ikke selv — <Link href="/saadan-vurderer-vi" className="underline">se hvordan vi vurderer</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
```

> **FAQ:** Kommer fra `guide.faq` (`faq jsonb` i Task 1). Udover `faqToJsonLd`-schemaet skal en **synlig FAQ-sektion** renderes på siden (h2 "Ofte stillede spørgsmål" + liste af q/a) — tilføj den efter kilder-blokken.

- [ ] **Step 2: Verificér `renderContent` er awaitable / korrekt signatur** (`lib/renderContent.tsx`). Justér kald hvis den ikke er async.

- [ ] **Step 3: Typecheck + build af siden**

Run: `cd web && npx tsc --noEmit 2>&1 | grep "bedste/\[slug\]"` → ingen output.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(site)/bedste/[slug]/page.tsx"
git commit -m "feat(guides): /bedste/[slug] guide-template (ISR, schema, body, disclosure)"
```

---

## Task 7: Kilder-blok + guide-index + metodeside

**Files:**
- Create: `web/components/buying-guide/BuyingGuideSources.tsx`
- Create: `web/app/(site)/bedste/page.tsx`
- Create: `web/app/(site)/saadan-vurderer-vi/page.tsx`

- [ ] **Step 1: `BuyingGuideSources.tsx`**

```tsx
export function BuyingGuideSources({ sources }: { sources: { title: string; url: string }[] | null }) {
  if (!sources || sources.length === 0) return null;
  return (
    <section className="mt-10 border-t border-primary/10 pt-6">
      <h2 className="font-serif text-lg font-bold text-primary mb-2">Tests og kilder vi har gennemgået</h2>
      <ul className="space-y-1 text-sm">
        {sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} rel="nofollow noopener" target="_blank" className="text-accent hover:underline">{s.title}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: `/bedste/page.tsx`** — hub der lister publicerede guider (genbrug `getPublishedGuides`), kort med titel + intro + link. Metadata canonical `/bedste`. Mønster: `/tilbud`-headeren.

- [ ] **Step 3: `/saadan-vurderer-vi/page.tsx`** — statisk metodeside: kriterier (specs, pris/værdi, lager, friluftserfaring, eksterne tests), ærlig "vi labtester ikke", affiliate-disclosure. `robots: index,follow`. Ren tekst.

- [ ] **Step 4: Typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -E "bedste/page|saadan-vurderer|BuyingGuideSources"` → ingen output.

- [ ] **Step 5: Commit**

```bash
git add web/components/buying-guide/BuyingGuideSources.tsx "web/app/(site)/bedste/page.tsx" "web/app/(site)/saadan-vurderer-vi/page.tsx"
git commit -m "feat(guides): kilder-blok + /bedste hub + metodeside"
```

---

## Task 8: SEO-plumbing (sitemap + interne links)

**Files:**
- Modify: `web/app/sitemap.ts`

- [ ] **Step 1: Tilføj statiske ruter + guider i sitemap**

I `app/sitemap.ts`: tilføj `{ path: "/bedste", changeFrequency: "weekly", priority: 0.75 }` og `{ path: "/saadan-vurderer-vi", changeFrequency: "yearly", priority: 0.3 }` til den statiske liste (se linje ~92-102). Importér `getPublishedGuides` og push `/bedste/${slug}` (changeFrequency "weekly", priority 0.7, lastModified = guide.updated_at) i `sitemap()`-funktionen (mønster: blog/guides-loops).

- [ ] **Step 2: Verificér build genererer ruterne**

Run: `cd web && npx tsc --noEmit 2>&1 | grep sitemap` → ingen output. (Fuld sitemap-render verificeres post-deploy.)

- [ ] **Step 3: Commit**

```bash
git add web/app/sitemap.ts
git commit -m "feat(guides): inkludér købsguider + metodeside i sitemap"
```

---

## Task 9: Admin-API (guider, entries, produkt-specs)

Tre route-handlers. Auth: `x-admin-secret`. Service-role-klient. Mønster: `app/api/admin/affiliate-products/block/route.ts`.

**Files:**
- Create: `web/app/api/admin/buying-guides/route.ts` (GET liste, POST upsert, DELETE)
- Create: `web/app/api/admin/buying-guides/entries/route.ts` (POST upsert entry, DELETE, PUT reorder)
- Create: `web/app/api/admin/affiliate-products/specs/route.ts` (POST sæt specs/editor_score)

- [ ] **Step 1: Implementér `buying-guides/route.ts`**

GET → alle guider (inkl. draft) for admin. POST → upsert guide (slug/title/category/intro/body_md/sources/seo/status/last_reviewed_at). DELETE → `{id}`. Hver handler tjekker `x-admin-secret` først; bad request på manglende felter; service-role write.

- [ ] **Step 2: Implementér `buying-guides/entries/route.ts`**

POST `{guide_id, affiliate_product_id, rank, award_label, editorial_note, pros[], cons[]}` → upsert (onConflict `guide_id,affiliate_product_id`). DELETE `{id}`. PUT `{guide_id, order: id[]}` → opdatér `rank` efter rækkefølge.

- [ ] **Step 3: Implementér `affiliate-products/specs/route.ts`**

POST `{id, specs (object), editor_score?}` → update på `affiliate_products`.

- [ ] **Step 4: Typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -E "buying-guides/route|entries/route|products/specs"` → ingen output.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/buying-guides web/app/api/admin/affiliate-products/specs
git commit -m "feat(guides): admin-API for guider, entries og produkt-specs"
```

---

## Task 10: Admin-UI

**Files:**
- Create: `web/components/AdminBuyingGuides.tsx`
- Create: `web/app/(site)/admin/koebsguider/page.tsx`
- Modify: `web/app/(site)/admin/page.tsx` (link)

- [ ] **Step 1: `AdminBuyingGuides.tsx`** — mønster fra `components/AdminProducts.tsx`: secret fra `sessionStorage` (`shelterdk-admin-secret`), liste over guider, "opret guide"-form (slug/title/category/intro/body_md/sources/seo/status), per-guide entry-editor (søg produkter i feed via eksisterende admin-produkt-endpoint, tilføj, træk-sortér rank, sæt award/note/pros/cons), spec-editor pr. produkt (JSON eller felt-form). Alle kald med `x-admin-secret`.

- [ ] **Step 2: `admin/koebsguider/page.tsx`** — `dynamic="force-dynamic"`, `robots: noindex`, render `<AdminBuyingGuides />` (mønster: `admin/nyhedsbrev/page.tsx`).

- [ ] **Step 3:** Tilføj link til `/admin/koebsguider` i `admin/page.tsx` (følg eksisterende link-grid).

- [ ] **Step 4: Typecheck + commit**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -E "AdminBuyingGuides|koebsguider" # forventet tomt
git add web/components/AdminBuyingGuides.tsx "web/app/(site)/admin/koebsguider/page.tsx" "web/app/(site)/admin/page.tsx"
git commit -m "feat(guides): admin-UI til at bygge købsguider + berige specs"
```

---

## Task 11: Verifikation + seed af flagskibsguider (indhold)

- [ ] **Step 1: Fuld verifikation**

Run:
```bash
cd web && npx tsc --noEmit 2>&1 | grep -c "error TS"   # forventet: 12 (baseline, ingen nye)
npx vitest run                                          # forventet: alle grønne
```

- [ ] **Step 2: Bekræft feed-dækning pr. kategori** (afgør de 2-3 v1-kategorier)

Tjek antal produkter pr. `category_mapped` (service-role) for sovepose/telt/pandelampe + alternativer. Vælg de 2-3 med ≥6-8 gode produkter.

- [ ] **Step 3: Byg 2-3 guider via admin**

For hver: vælg ~6 produkter, sæt rank + awards (Bedst i test / budget / letvægt / vinter), skriv "derfor" + pros/cons, berig specs, skriv `body_md` (rådgivnings-sektion), tilføj 3-5 `sources`, FAQ, sæt `last_reviewed_at`, status=published.

- [ ] **Step 4: Verificér live (efter deploy)**

- `/bedste` lister guiderne; `/bedste/<slug>` returnerer 200 med rangeret liste + body + disclosure.
- Google Rich Results Test på guide-URL → ItemList/Product/FAQ valide.
- Affiliate-CTA-klik registreres i `/api/track`.
- Udsolgt produkt demoteres (test ved at sætte ét `in_stock=false`).

- [ ] **Step 5: Commit evt. justeringer; afslut**

Brug **superpowers:finishing-a-development-branch** til at afslutte.

---

## Noter til implementøren

- **YAGNI:** Ingen sammenligningstabel i v1 (fase-2). Ingen brugeranmeldelser. Ingen prissammenlignings-kobling.
- **DRY:** Genbrug `GearCardView`, `renderContent`, `faqToJsonLd`, `BreadcrumbSchema`, admin `x-admin-secret`-mønstret.
- **Push:** Brugeren styrer push (har sagt "lad være med at pushe" tidligere i sessioner). Commit lokalt; spørg før push.
- **FAQ:** Afgjort — `faq jsonb` på `buying_guides` (Task 1), renderet som synlig sektion + `FAQPage`-schema (Task 6).
```
