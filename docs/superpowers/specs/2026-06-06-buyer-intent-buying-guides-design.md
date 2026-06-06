# Buyer-intent købsguider (affiliate) — Design

**Dato:** 2026-06-06
**Status:** Godkendt design → klar til implementeringsplan
**Mål (én sætning):** Fange brugere i købsintent via Google ved at bygge troværdige "bedste X"-købsguider på shelterdk, så affiliate-konverteringen stiger uden at virke utroværdig.

---

## 1. Baggrund & problem

shelterdk har allerede affiliate-infrastruktur:

- `affiliate_products` (Outmore, Backpackerlife, Outdoortid): `brand, product_name, description (fritekst), category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked`.
- `/tilbud` — rabat-drevet deals-grid; `HomepageDealsWidget` på forsiden.
- Gear-embeds i blog/guides via `::gear[id]` / `::gear-inline[id]` (`lib/renderContent.tsx`, `GearCard`/`GearCardView`).
- Klik-tracking (`/api/track`, `lib/tracking.ts`).
- Admin: produkt-sync, kategori-mapping, blokering.
- Prissammenlignings-platform: schema klar, scraper ikke bygget (separat delprojekt).

**Problemet:** Alt nuværende er **rabat-drevet og passivt** — det fanger bargain-browsere, ikke folk i aktiv købsintent ("jeg skal købe en sovepose nu"). Der mangler flader hvor købsintent opstår.

## 2. Trufne beslutninger (brainstorm)

1. **Intent-kilde:** Google-søgere (SEO buyer-intent), ikke kun eksisterende besøgende.
2. **Vinkel:** Generisk gear-review ("bedste sovepose 2026") — bevidst valgt trods hård konkurrence; hæver troværdigheds-barren.
3. **Troværdigheds-mekanisme:** Hybrid — data-drevet shortlist + redaktionel "derfor" pr. produkt + transparent metodeside.
4. **Produktionsmodel:** Genbrugeligt buying-guide-system (datamodel + sammenlignings-komponent + "bedst til X" + metodeside). Start med 2-3 dybe flagskibsguider, udvid.
5. **Datakonstraint (fund):** Feed'et har **ingen strukturerede specs** (ingen temperatur/vægt/anmeldelses-score som felter — kun fritekst-`description`). Specs skal beriges som strukturerede felter; redaktøren udfylder vurderingen.

## 3. Arkitektur & datamodel

Tre lag holder live-data (pris/lager) adskilt fra redaktion (rangering/vurdering):

### 3.1 `affiliate_products` (udvides)
- `specs JSONB` — kategori-formede strukturerede specs, fx sovepose: `{ komfort_temp:-2, graense_temp:-8, vaegt_g:950, fyld:"dun", form:"mumie" }`. Beriges i admin. Hører til produktet (genbruges på tværs af guider).
- `editor_score NUMERIC NULL` (valgfri samlet redaktionel score 0-100, til intern sortering — vises ikke nødvendigvis).

### 3.2 `buying_guides` (ny tabel)
`id, slug (unik), title, category (matcher category_mapped), intro (markdown/redaktionel), seo_title, seo_description, hero_image_url NULL, status ('draft'|'published'), last_reviewed_at TIMESTAMPTZ, created_at, updated_at`.

### 3.3 `buying_guide_entries` (ny tabel)
`id, guide_id FK, affiliate_product_id FK, rank INT, award_label TEXT NULL ('Bedst i test'|'Bedste budget'|'Bedste letvægt'|'Bedste til vinter'|…), editorial_note TEXT ("derfor anbefaler vi"), pros TEXT[], cons TEXT[]`.

RLS: tabeller læses offentligt for `status='published'`; skrivning kun service-role/admin (følg eksisterende mønster).

**Friskhed:** Live pris/lager hentes ved render fra feed'et. **Udsolgte produkter** (`in_stock=false`/`is_blocked=true`) demoteres/skjules automatisk — anbefal aldrig noget der ikke kan købes. `last_reviewed_at` vises som "Sidst opdateret".

## 4. Guide-siden (`/bedste/[slug]`)

Keyword-rig URL (`/bedste/sovepose`). Én genbrugelig server-rendered template (ISR), uafhængig af antal guider.

- **H1** "Bedste sovepose 2026" + kort redaktionel intro + link til "Sådan vurderer vi" + **"Sidst opdateret"-dato**.
- **Top-pick fremhævet**, derefter rangeret liste pr. entry: award-badge, redaktionel "derfor", **pros/cons**, spec-række, **live pris + "Se pris hos [retailer]"**-CTA (genbruger `GearCard` + `/api/track`-tracking).
- **Sammenlignings-tabel** på tværs af shortlisten — sortérbar på pris, vægt, temperatur (data fra `specs`).
- **"Bedst til X"-genveje** (budget/letvægt/vinter) via award_label-anchors.
- **FAQ-sektion** (redaktionel, pr. guide eller delt) — fanger long-tail ("hvor varm sovepose til shelter?").
- **Schema.org:** `ItemList` (rangeringen) + `Product` (pr. produkt, m. `offers`/pris) + `FAQPage`. Breadcrumb-schema. Dynamisk OG-kort.

## 5. Metodeside `/saadan-vurderer-vi` (troværdigheds-anker)

- Transparente kriterier; ærlig formulering: **"vi labtester ikke — vi sammenligner specs, pris og friluftserfaring."**
- **Affiliate-disclosure** (lovpligtigt + tillidsskabende). Disclosure-linje gentages på hver guide.
- Ingen falsk "testet"-påstand; awards begrundes i data + note.

## 6. Admin & workflow

Udvider admin (`/admin/produkter` eller ny `/admin/koebsguider`):
- Opret/redigér guide: vælg kategori → søg produkter i feed → træk-sortér → tildel award + skriv note/pros/cons → publicér/draft.
- Berig produkt-`specs` via kategori-skema (pr. kategori defineres relevante spec-felter).
- En guide bygges på ~30-60 min.

## 7. SEO-plumbing & genbrug

- Sitemap: inkludér publicerede guider.
- Interne links: fra relevante shelter-/blog-/guide-sider og `/tilbud` → købsguiderne (topical authority + flow).
- Genbruger: `affiliate_products`-feed (live pris/lager via eksisterende sync), `GearCard`/`GearCardView`, `::gear`-embeds hvor relevant, `/api/track`.

## 8. Faser

**v1 (dette spec):**
- Datamodel (3.1–3.3) + RLS.
- Guide-template (`/bedste/[slug]`) + sammenlignings-tabel + "bedst til X".
- Metodeside + disclosure.
- Admin til at bygge guider + berige specs.
- **2-3 flagskibsguider** i kategorier med dybest feed-dækning (forslag: sovepose, telt, pandelampe — bekræftes mod feed under build).
- Schema (ItemList/Product/FAQPage), interne links, sitemap.

**Senere (uden for scope):** flere kategorier; kobling til prissammenlignings-platformen ("bedste pris på tværs af butikker"); evt. brugeranmeldelser.

## 9. Succeskriterier

- Mindst 2-3 publicerede guider live, hver med ≥5 produkter, awards, pros/cons, specs, FAQ og gyldig schema (Rich Results-test passerer).
- Live pris/lager korrekt; udsolgte demoteres.
- Metodeside + disclosure på plads.
- Klik på affiliate-CTA'er trackes via `/api/track`.
- Guiderne indekserbare (i sitemap, ingen noindex) og internt linket.

## 10. Test-strategi

- **Rene funktioner (unit/TDD):** rangering/sortering af entries (rank + demotér udsolgte), spec-tabel-normalisering, "bedst til X"-gruppering, schema-builder (ItemList/Product/FAQPage giver gyldig JSON-LD).
- **Datalag:** guide-fetch (published-filter, join til live produktdata), graceful tom-tilstand.
- **Ingen** afhængighed af live tredjeparts-kald i tests (mock feed-data).

## 11. Åbne punkter / antagelser

- Endelig kategori-valg for v1 afhænger af feed-dækning (verificeres under build; DB-adgang fejlede med 401 i brainstorm-fasen — tjekkes igen).
- Spec-skema pr. kategori defineres i implementeringen (start med sovepose/telt/pandelampe).
- `/bedste/[slug]` valgt som URL (godkendt).
