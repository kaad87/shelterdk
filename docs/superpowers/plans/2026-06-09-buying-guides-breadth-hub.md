# Købsguider — bredde/hub/long-tail — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Udvid købsguiderne i bredden — grupperet hub, long-tail-variant-sider og flere kategorier — uden tyndt indhold, additivt på v2-systemet.

**Architecture:** Kun additiv datamodel (`parent_slug`). Hub-gruppering + "se også" er rene funktioner (statisk map), TDD. Long-tail-varianter og nye kategorier er nye `buying_guides`-rækker via `seed_buying_guides.mjs`, hver underlagt en hård indholds-bar (§0).

**Tech Stack:** Next.js 14, Supabase, TypeScript, Vitest (TDD), Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-09-buying-guides-breadth-hub-design.md` — **§0 (ingen tynde sider) er bindende.**

**Konventioner:** migrations i `web/migrations/`, manuelt mod Supabase (idempotent). Tests kun rene funktioner. Baseline tsc-fejl: 12. Commit lokalt; spørg før push. Branch `feature/guides-breadth`.

**§0 indholds-bar (gælder Task 6 & 7 — håndhæves før publicering):** ≥6 unikke produkter (de-dupliceret mod hovedguide), ~1.200-1.800+ unikke ord i `body_md`, ≥6 unik FAQ, unik svarkapsel/intro/vinkel, reel selvstændig søgeintention. **Kan en kandidat ikke møde baren → drop den.**

---

## File Structure

**Opret:**
- `web/migrations/20260609_buying_guides_parent.sql` — `parent_slug`
- `web/lib/buying-guides-hub.ts` — `HUB_GROUPS`, `groupGuides()`, `relatedGuides()`
- `web/lib/__tests__/buying-guides-hub.test.ts`
- `web/components/buying-guide/RelatedGuides.tsx` — "Se også"-blok

**Modificér:**
- `web/lib/buying-guides.ts` — `parent_slug` i type + fetch
- `web/app/(site)/bedste/page.tsx` — grupperet hub
- `web/app/(site)/bedste/[slug]/page.tsx` — breadcrumb m. parent + RelatedGuides
- `seed_buying_guides.mjs` — nye kategorier + long-tail-varianter (gated)

---

## Task 1: Migration — parent_slug

**Files:** Create `web/migrations/20260609_buying_guides_parent.sql`

- [ ] **Step 1:**
```sql
-- Long-tail-varianter kobles til deres hovedguide.
alter table public.buying_guides
  add column if not exists parent_slug text;  -- NULL for hovedguider; ellers slug på hovedguide
```
- [ ] **Step 2:** Anvend i Supabase. Verificér `select parent_slug from public.buying_guides limit 1;` uden fejl.
- [ ] **Step 3: Commit** `feat(guides): parent_slug på buying_guides`

---

## Task 2: Data-lag — parent_slug

**Files:** Modify `web/lib/buying-guides.ts`

- [ ] **Step 1:** Tilføj `parent_slug: string | null` til `BuyingGuide`-interface. (Guide-select bruger `*`, så fetch dækker den; bekræft `getPublishedGuides` returnerer feltet.)
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep buying-guides` → ingen output.
- [ ] **Step 3: Commit** `feat(guides): data-lag inkl. parent_slug`

---

## Task 3: Hub-gruppering + relatedGuides (TDD)

**Files:** Create `web/lib/buying-guides-hub.ts` + test.

- [ ] **Step 1: Fejlende test** (`web/lib/__tests__/buying-guides-hub.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { groupGuides, relatedGuides, type HubGuide } from "@/lib/buying-guides-hub";

const g = (slug: string, category: string, parent_slug: string | null = null): HubGuide =>
  ({ slug, title: slug, category, intro: null, parent_slug });

describe("groupGuides", () => {
  it("grupperer guider efter hub-gruppe i defineret rækkefølge", () => {
    const out = groupGuides([g("kniv", "kniv"), g("sovepose", "sovepose"), g("telt", "telt")]);
    const labels = out.map((s) => s.group);
    expect(labels.indexOf("Sovegrej")).toBeLessThan(labels.indexOf("Telte & ly"));
    expect(out.find((s) => s.group === "Sovegrej")!.guides.map((x) => x.slug)).toContain("sovepose");
    expect(out.find((s) => s.group === "Værktøj & udstyr")!.guides.map((x) => x.slug)).toContain("kniv");
  });
  it("udelader tomme grupper", () => {
    const out = groupGuides([g("sovepose", "sovepose")]);
    expect(out.every((s) => s.guides.length > 0)).toBe(true);
  });
  it("ukendt kategori havner i en 'Andet'-gruppe (falder ikke ud)", () => {
    const out = groupGuides([g("x", "ukendt-kat")]);
    expect(out.flatMap((s) => s.guides).map((x) => x.slug)).toContain("x");
  });
});

describe("relatedGuides", () => {
  const all = [
    g("sovepose", "sovepose"),
    g("sovepose-til-vinter", "sovepose", "sovepose"),
    g("liggeunderlag", "liggeunderlag"),
    g("kniv", "kniv"),
  ];
  it("variant viser parent + søskende i samme gruppe, ekskl. sig selv", () => {
    const r = relatedGuides("sovepose-til-vinter", all).map((x) => x.slug);
    expect(r).toContain("sovepose");       // parent
    expect(r).toContain("liggeunderlag");  // samme gruppe (Sovegrej)
    expect(r).not.toContain("sovepose-til-vinter");
    expect(r).not.toContain("kniv");       // anden gruppe
  });
  it("cap'er antal", () => {
    expect(relatedGuides("sovepose", all, 1).length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Kør → FAIL.**

- [ ] **Step 3: Implementér** `web/lib/buying-guides-hub.ts`

```typescript
export interface HubGuide {
  slug: string;
  title: string;
  category: string;
  intro: string | null;
  parent_slug: string | null;
}

/** Hub-grupper i visningsrækkefølge + hvilke kategorier de rummer. */
export const HUB_GROUPS: { group: string; categories: string[] }[] = [
  { group: "Sovegrej", categories: ["sovepose", "liggeunderlag", "haengekoje", "soveudstyr"] },
  { group: "Telte & ly", categories: ["telt", "tarp"] },
  { group: "Belysning", categories: ["pandelampe", "lygte"] },
  { group: "Vand & mad", categories: ["vandfilter", "drikkedunk", "kogeudstyr", "stormkoekken"] },
  { group: "Værktøj & udstyr", categories: ["kniv", "multitool", "rygsaek", "kikkert"] },
];
const OTHER = "Andet";

function groupOf(category: string): string {
  return HUB_GROUPS.find((g) => g.categories.includes(category))?.group ?? OTHER;
}

/** Gruppér guider til hub-sektioner; udelad tomme; bevar HUB_GROUPS-rækkefølge, OTHER til sidst. */
export function groupGuides<T extends HubGuide>(guides: T[]): { group: string; guides: T[] }[] {
  const order = [...HUB_GROUPS.map((g) => g.group), OTHER];
  const byGroup = new Map<string, T[]>();
  for (const guide of guides) {
    const grp = groupOf(guide.category);
    (byGroup.get(grp) ?? byGroup.set(grp, []).get(grp)!).push(guide);
  }
  return order
    .filter((grp) => (byGroup.get(grp)?.length ?? 0) > 0)
    .map((grp) => ({ group: grp, guides: byGroup.get(grp)! }));
}

/** Relaterede guider til "Se også": parent + søskende i samme gruppe + egne varianter. Ekskl. sig selv. */
export function relatedGuides<T extends HubGuide>(currentSlug: string, all: T[], cap = 6): T[] {
  const current = all.find((g) => g.slug === currentSlug);
  if (!current) return [];
  const grp = groupOf(current.category);
  const seen = new Set<string>([currentSlug]);
  const out: T[] = [];
  const add = (g: T | undefined) => {
    if (g && !seen.has(g.slug)) { seen.add(g.slug); out.push(g); }
  };
  // 1) parent
  if (current.parent_slug) add(all.find((g) => g.slug === current.parent_slug));
  // 2) egne varianter
  for (const g of all) if (g.parent_slug === currentSlug) add(g);
  // 3) søskende i samme gruppe
  for (const g of all) if (groupOf(g.category) === grp) add(g);
  return out.slice(0, cap);
}
```

- [ ] **Step 4: Kør → PASS.** **Step 5: Commit** `feat(guides): hub-gruppering + relatedGuides (TDD)`

---

## Task 4: Grupperet hub-side

**Files:** Modify `web/app/(site)/bedste/page.tsx`

- [ ] **Step 1:** Hent `getPublishedGuides()`, map til `HubGuide` (slug/title/category/intro/parent_slug), kald `groupGuides()`. Render en `<section>` pr. gruppe med h2 + kort-grid (genbrug eksisterende kort-markup). Behold metadata + breadcrumb-schema.
- [ ] **Step 2:** tsc rent + lokal dev: `/bedste` viser grupper med sektioner.
- [ ] **Step 3: Commit** `feat(guides): /bedste som grupperet kategori-hub`

---

## Task 5: "Se også" + parent-breadcrumb på guide-siden

**Files:** Create `web/components/buying-guide/RelatedGuides.tsx`; Modify `web/app/(site)/bedste/[slug]/page.tsx`

- [ ] **Step 1:** `RelatedGuides.tsx` — server-komponent: tager `guides: HubGuide[]` (allerede relaterede) og renderer en "Se også"-blok med links (title → `/bedste/${slug}`).
- [ ] **Step 2:** I `[slug]/page.tsx`: hent alle publicerede guider (`getPublishedGuides`), kald `relatedGuides(slug, all)`, render `<RelatedGuides>` efter FAQ. Hvis `guide.parent_slug`: vis parent i breadcrumb (Hjem › Bedste › {parent.title} › {guide.title}).
- [ ] **Step 3:** tsc rent + dev-tjek. **Step 4: Commit** `feat(guides): Se også-blok + parent-breadcrumb`

---

## Task 6: Nye hoved-kategorier (gated efter §0)

**Files:** Modify `seed_buying_guides.mjs` (kør `node seed_buying_guides.mjs`)

- [ ] **Step 1:** For hver kandidat (drikkedunk, stormkøkken-udsnit, kikkert, evt. rygsæk-vandre, regntøj): kør feed-viabilitets-tjek (≥8 rene, relevante produkter, fornuftigt prisspænd). **Drop dem der ikke består.**
- [ ] **Step 2:** For hver levedygtig kategori: authorer en guide der møder **§0** (6-12 unikke produkter m. scores/best_for/awards/pros/cons/specs; ~1.200-1.800+ ords unik `body_md`; ≥6 unik FAQ; sources; author; last_reviewed_at). Ingen parent_slug (hoved-kategori).
- [ ] **Step 3:** Kør seed. Verificér i DB. **Step 4: Commit** `feat(guides): nye kategori-guider (<liste over dem der bestod>)`

---

## Task 7: Long-tail-varianter (gated efter §0, de-dupliceret)

**Files:** Modify `seed_buying_guides.mjs`

- [ ] **Step 1:** For hver kandidat-variant (sovepose-til-vinter, letvaegts-sovepose, sovepose-til-boern, sommersovepose, 2-personers-telt, letvaegtstelt, familietelt, 1-personers-telt, liggeunderlag-til-vinter, pandelampe-til-loeb): tjek at der er **≥6 produkter der adskiller sig fra hovedguidens udvalg** OG distinkt søgeintention. **Drop ellers.**
- [ ] **Step 2:** Authorer hver bestået variant til §0: `parent_slug` = hovedguidens slug, **de-dupliceret** produktudvalg, variant-specifik vinkel i `body_md` (~1.200-1.800+ unikke ord), unik FAQ, scores, best_for. Ingen genbrug af hovedguidens tekst.
- [ ] **Step 3:** Kør seed. Verificér: varianter har parent_slug + unikt udvalg (ingen near-dupe). **Step 4: Commit** `feat(guides): long-tail-varianter (<liste over dem der bestod>)`

---

## Task 8: Verifikation + afslut

- [ ] **Step 1:** `cd web && npx tsc --noEmit 2>&1 | grep -c "error TS"` → 12. `npx vitest run` → alle grønne.
- [ ] **Step 2:** Dev: `/bedste` grupperet; en variant (fx `/bedste/sovepose-til-vinter`) viser parent-breadcrumb + "Se også"; produktudvalg adskiller sig fra hovedguiden; ordtælling ≥~1.200.
- [ ] **Step 3:** Stikprøve §0 på 2-3 nye sider: ordtælling, ≥6 produkter, ≥6 FAQ, distinkt fra parent.
- [ ] **Step 4 (efter deploy):** Rich Results valide; revalidér `/bedste` + nye stier via `/api/revalidate`.
- [ ] **Step 5:** Afslut med **superpowers:finishing-a-development-branch**.

---

## Noter
- **§0 er bindende:** hellere færre sider end tynde. Drop kandidater der ikke består.
- **YAGNI:** ingen nye tabeller ud over `parent_slug`; ingen ny template ud over breadcrumb + Se også; hub-grupper som statisk map.
- **Bevar kant:** alle nye sider får fuld v2 (scores, Review-schema, svarkapsel, FAQ, E-E-A-T).
- **Push:** brugeren styrer; commit lokalt, spørg før push.
