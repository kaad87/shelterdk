# Købsguider v2 (SEO/GEO/konvertering) — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Løft de eksisterende købsguider (`/bedste/[slug]`) til best-in-class — scores + stjerner, sammenligningstabel, Hurtigt overblik, svarkapsel (GEO), dyb brødtekst — og genskriv indholdet mod konverterende mellemklasse-produkter.

**Architecture:** Additiv opgradering af v1-systemet. Ny ren logik (score→stjerne, Review-schema) bygges TDD. Template udvides med 2 nye præsentationskomponenter (overblik + tabel). Indhold (produktvalg, scores, tekst) leveres via et opdateret `seed_buying_guides.mjs`. Ingen nye tabeller.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres), TypeScript, Vitest (TDD), Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-09-buying-guides-v2-seo-geo-conversion-design.md`
**v1-plan (kontekst):** `docs/superpowers/plans/2026-06-06-buyer-intent-buying-guides.md`

**Konventioner:** migrations i `web/migrations/YYYYMMDD_*.sql` (manuelt mod Supabase, idempotent). Admin-auth `x-admin-secret`. Tests kun på rene funktioner. Baseline `tsc`-fejl: 12 (præeksisterende). Commit lokalt; spørg før push. Arbejd på branch `feature/buying-guides-v2`.

---

## File Structure

**Opret:**
- `web/migrations/20260609_buying_guides_v2.sql` — `score`, `best_for` på entries; `author` på guides
- `web/lib/buying-guides-score.ts` — ren: `scoreToStars`, `formatScore`
- `web/lib/__tests__/buying-guides-score.test.ts`
- `web/components/buying-guide/BuyingGuideComparisonTable.tsx` — sammenligningstabel
- `web/components/buying-guide/BuyingGuideOverview.tsx` — "Hurtigt overblik" (top-picks)

**Modificér:**
- `web/lib/buying-guides.ts` — typer (`score`, `best_for`, `author`) + fetch-select
- `web/lib/buying-guides-schema.ts` — `Product` får `review`/`reviewRating` fra score
- `web/lib/__tests__/buying-guides-schema.test.ts` — review-assertions
- `web/components/buying-guide/BuyingGuideEntry.tsx` — vis score/stjerner + `best_for`
- `web/app/(site)/bedste/[slug]/page.tsx` — svarkapsel + overblik + tabel + review-schema
- `web/app/(site)/saadan-vurderer-vi/page.tsx` — scoring-rubrik
- `web/app/api/admin/buying-guides/entries/route.ts` — modtag `score`, `best_for`
- `web/components/AdminBuyingGuides.tsx` — felter for score + best_for
- `seed_buying_guides.mjs` — genskriv 4 guider (reselektion + scores + dyb body) + nye kategorier

---

## Task 1: Migration (score, best_for, author)

**Files:** Create `web/migrations/20260609_buying_guides_v2.sql`

- [ ] **Step 1: Skriv migrationen**

```sql
-- Købsguider v2: scores, "bedst til"-label, forfatter.
alter table public.buying_guide_entries
  add column if not exists score numeric,          -- 0-10, én decimal (redaktionel, rubrik-baseret)
  add column if not exists best_for text;          -- kort "bedst til"-label til tabel/overblik

alter table public.buying_guides
  add column if not exists author text;            -- E-E-A-T, fx "ShelterDK Redaktionen"
```

- [ ] **Step 2: Anvend i Supabase SQL Editor.** Verificér: `select score, best_for from public.buying_guide_entries limit 1;` uden fejl.

- [ ] **Step 3: Commit**
```bash
git add web/migrations/20260609_buying_guides_v2.sql
git commit -m "feat(guides-v2): datamodel — score, best_for, author"
```

---

## Task 2: Data-lag — typer + fetch

**Files:** Modify `web/lib/buying-guides.ts`

- [ ] **Step 1:** Tilføj felter til `BuyingGuide` (`author: string | null`) og `GuideEntryWithProduct` (`score: number | null; best_for: string | null`).

- [ ] **Step 2:** Opdatér `getGuideBySlug`-select for entries til at hente `score, best_for` (tilføj til `.select("id, rank, award_label, editorial_note, pros, cons, score, best_for, affiliate_product_id")`) og map dem ind i objektet. Tilføj `author` til guide-select (`*` dækker allerede).

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep buying-guides` → ingen output.

- [ ] **Step 4: Commit** `feat(guides-v2): data-lag henter score/best_for/author`

---

## Task 3: Score → stjerne-afledning (TDD)

**Files:** Create `web/lib/buying-guides-score.ts` + test.

- [ ] **Step 1: Fejlende test** (`web/lib/__tests__/buying-guides-score.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { scoreToStars, formatScore } from "@/lib/buying-guides-score";

describe("scoreToStars", () => {
  it("afrunder til nærmeste halve stjerne (0-5 skala fra 0-10 score)", () => {
    expect(scoreToStars(10)).toBe(5);
    expect(scoreToStars(9.0)).toBe(4.5);
    expect(scoreToStars(8.7)).toBe(4.5); // 4.35 -> 4.5
    expect(scoreToStars(8.2)).toBe(4);   // 4.1 -> 4.0
    expect(scoreToStars(0)).toBe(0);
  });
  it("klamper til 0-5", () => {
    expect(scoreToStars(12)).toBe(5);
    expect(scoreToStars(-3)).toBe(0);
  });
});
describe("formatScore", () => {
  it("én decimal, dansk komma", () => {
    expect(formatScore(8.7)).toBe("8,7");
    expect(formatScore(9)).toBe("9,0");
  });
  it("null → tom streng", () => {
    expect(formatScore(null)).toBe("");
  });
});
```

- [ ] **Step 2: Kør → FAIL.** `cd web && npx vitest run lib/__tests__/buying-guides-score.test.ts`

- [ ] **Step 3: Implementér**

```typescript
/** Konverter 0-10 score til 0-5 stjerner, afrundet til nærmeste halve. */
export function scoreToStars(score: number): number {
  const onFive = (score / 10) * 5;
  const rounded = Math.round(onFive * 2) / 2;
  return Math.max(0, Math.min(5, rounded));
}

/** Formatér score med én decimal og dansk komma. Null → "". */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return "";
  return score.toFixed(1).replace(".", ",");
}
```

- [ ] **Step 4: Kør → PASS.** **Step 5: Commit** `feat(guides-v2): scoreToStars + formatScore (TDD)`

---

## Task 4: Review-schema fra score (TDD)

`Product` får et `review` (Review forfattet af ShelterDK) når score findes → review-stjerner i Google. Tredjeparts-produkt → tilladt.

**Files:** Modify `web/lib/buying-guides-schema.ts` + test.

- [ ] **Step 1: Tilføj fejlende test** i `buying-guides-schema.test.ts`

```typescript
it("buildProductSchema tilføjer review når score er sat", () => {
  const s = buildProductSchema({ ...product }, 8.7);
  const r = s.review as { reviewRating: { ratingValue: number; bestRating: number }; author: { name: string } };
  expect(r.reviewRating.ratingValue).toBe(8.7);
  expect(r.reviewRating.bestRating).toBe(10);
  expect(r.author.name).toMatch(/ShelterDK/);
});
it("buildProductSchema uden score → intet review-felt", () => {
  expect(buildProductSchema({ ...product }).review).toBeUndefined();
});
```

- [ ] **Step 2: Kør → FAIL.**

- [ ] **Step 3: Udvid `buildProductSchema`** med valgfri score-parameter:

```typescript
export function buildProductSchema(p: P, score?: number | null): Record<string, unknown> {
  return {
    "@type": "Product",
    name: p.product_name,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    image: p.image_url,
    ...(score != null
      ? {
          review: {
            "@type": "Review",
            author: { "@type": "Organization", name: "ShelterDK" },
            reviewRating: { "@type": "Rating", ratingValue: score, bestRating: 10, worstRating: 0 },
          },
        }
      : {}),
    offers: { "@type": "Offer", price: p.price, priceCurrency: "DKK", availability: "https://schema.org/InStock", url: p.affiliate_url },
  };
}
```

Opdatér `buildItemListSchema` til at sende score med pr. produkt (signatur: `buildItemListSchema(items: {product: P; score?: number|null}[], pageUrl)` — justér kald i page tilsvarende).

- [ ] **Step 4: Kør → PASS.** **Step 5: Commit** `feat(guides-v2): Product+Review-schema fra score (TDD)`

---

## Task 5: BuyingGuideEntry — vis score, stjerner, best_for

**Files:** Modify `web/components/buying-guide/BuyingGuideEntry.tsx`

- [ ] **Step 1:** Vis score-badge + stjerner (brug `scoreToStars`/`formatScore` + `lucide-react` `Star`) øverst i kortet ved siden af rank/award. Vis `best_for` som lille label hvis sat.
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep BuyingGuideEntry` → ingen output.
- [ ] **Step 3: Commit** `feat(guides-v2): score/stjerner/best_for på produktkort`

---

## Task 6: Sammenligningstabel

**Files:** Create `web/components/buying-guide/BuyingGuideComparisonTable.tsx`

- [ ] **Step 1:** Server-komponent der tager `entries: GuideEntryWithProduct[]` og renderer en tabel: kolonner **Produkt** (billede+navn), **Score** (tal+stjerner), **Bedst til** (`best_for`), **Pris** (live + "Se pris"-link til `affiliate_url` med `/api/track` via en lille klient-CTA eller direkte link). Mobil: horisontal scroll. Priser synlige fra toppen (konvertering + GEO-citerbarhed).
- [ ] **Step 2:** tsc rent. **Step 3: Commit** `feat(guides-v2): sammenligningstabel`

---

## Task 7: Hurtigt overblik (top-picks)

**Files:** Create `web/components/buying-guide/BuyingGuideOverview.tsx`

- [ ] **Step 1:** Komponent der tager de 3-4 højest-rangerede entries og viser fremhævede kort (badge + score + pris + CTA) i et grid — til hurtig scanning øverst.
- [ ] **Step 2:** tsc rent. **Step 3: Commit** `feat(guides-v2): Hurtigt overblik`

---

## Task 8: Page-wiring (svarkapsel + overblik + tabel + review-schema)

**Files:** Modify `web/app/(site)/bedste/[slug]/page.tsx`

- [ ] **Step 1:** Tilføj **svarkapsel** øverst via `QuickAnswer` (`components/seo/QuickAnswer`): `heading="Hurtigt svar"`, `answer` = kort tekst der nævner testvinderen + kerne-anbefaling (byg fra entries[0]). Det giver `.llm-quote` + SpeakableSchema (GEO).
- [ ] **Step 2:** Indsæt `<BuyingGuideOverview>` + `<BuyingGuideComparisonTable>` mellem svarkapsel og den rangerede liste.
- [ ] **Step 3:** Send score med i `buildItemListSchema` (Task 4-signatur), så Product/Review-schema får stjerner.
- [ ] **Step 4:** Vis `guide.author` + opdateringsdato i E-E-A-T-linjen.
- [ ] **Step 5:** tsc rent + lokal dev-tjek (`/bedste/sovepose` renderer overblik+tabel+kapsel). **Step 6: Commit** `feat(guides-v2): /bedste/[slug] med svarkapsel, overblik, tabel, review-schema`

---

## Task 9: Metodeside — scoring-rubrik

**Files:** Modify `web/app/(site)/saadan-vurderer-vi/page.tsx`

- [ ] **Step 1:** Tilføj sektion "Sådan scorer vi" der forklarer rubrikken (værdi-for-pengene > egnethed/specs > brand-pålidelighed > lager), 0-10-skalaen, og ærligt "vi labtester ikke". tsc rent.
- [ ] **Step 2: Commit** `feat(guides-v2): metodeside forklarer scoring-rubrik`

---

## Task 10: Admin — score + best_for

**Files:** Modify `web/app/api/admin/buying-guides/entries/route.ts` + `web/components/AdminBuyingGuides.tsx`

- [ ] **Step 1:** Route: medtag `score` (parse number) + `best_for` i POST-upsert-row.
- [ ] **Step 2:** UI: tilføj input for `score` (number) + `best_for` (text) i `EntryRow`.
- [ ] **Step 3:** tsc rent. **Step 4: Commit** `feat(guides-v2): admin redigerer score + best_for`

---

## Task 11: Genskriv de 4 guider (reselektion + scores + dyb body)

**Files:** Modify `seed_buying_guides.mjs` (kør med `node seed_buying_guides.mjs`)

- [ ] **Step 1:** For hver af de 4 (sovepose, telt, liggeunderlag, pandelampe): træk feed-kandidater i **500-1.500 kr-sweet-spot** + de billige kendte brands (Nordisk/Highlander/Robens/Snugpak/Treklife). Vælg **8-12** pr. guide.
- [ ] **Step 2:** Tildel pr. produkt: `rank`, `score` (0-10 efter rubrik), `award_label`, `best_for`, `editorial_note`, 3-4 `pros`, 2-3 `cons`, `specs`.
- [ ] **Step 3:** Skriv `body_md` (~1.500-2.500 ord: EN/ISO-temp, dun vs. fiber, form/str., typiske fejl, pro-tips, vedligehold), 8-10 `faq`, `sources`, `author="ShelterDK Redaktionen"`, `last_reviewed_at`.
- [ ] **Step 4:** Kør seed. Verificér i DB at score/best_for er sat. **Step 5: Commit** `feat(guides-v2): genskriv 4 guider — mellemklasse-reselektion + scores + dyb body`

---

## Task 12: Feed-viabilitet + nye kategorier

- [ ] **Step 1:** Tjek feed-dækning + prisfordeling for kandidat-kategorier: **stormkøkken/kogegrej, vandfilter, hængekøje, tarp, drikkedunk, kniv/multitool**. Behold kun dem med ≥8 rene produkter og rimelig mellemklasse. Drop tynde/støjende.
- [ ] **Step 2:** For hver levedygtig kategori: authorer en guide (samme standard som Task 11) i `seed_buying_guides.mjs` og kør seed.
- [ ] **Step 3: Commit** `feat(guides-v2): nye kategori-guider (<liste>)`

---

## Task 13: Verifikation + afslut

- [ ] **Step 1:** `cd web && npx tsc --noEmit 2>&1 | grep -c "error TS"` → 12 (baseline). `npx vitest run` → alle grønne.
- [ ] **Step 2:** Lokal dev: `/bedste/sovepose` viser svarkapsel + overblik + tabel + scorede kort + dyb body + FAQ. Ingen pris over ~3.000 kr som "Bedst i test".
- [ ] **Step 3 (efter deploy):** Google Rich Results Test → ItemList + Product/Review (stjerner) + FAQ valide.
- [ ] **Step 4:** Revalidér `/bedste` + guide-stier via `/api/revalidate`.
- [ ] **Step 5:** Afslut med **superpowers:finishing-a-development-branch**.

---

## Noter
- **YAGNI:** ingen nye tabeller; genbrug GearCardView/QuickAnswer/SpeakableSchema/renderContent/`/api/track`.
- **Review-schema:** kun for tredjeparts-produkter (grej) — overhold Googles guidelines.
- **Push:** brugeren styrer; commit lokalt, spørg før push.
- **Scores er redaktionelle** (rubrik-baserede), ikke labtest — metodesiden skal sige det ærligt.
