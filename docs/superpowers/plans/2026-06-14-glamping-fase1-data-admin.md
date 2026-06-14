# Glamping/naturophold — Fase 1: datalag + admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg datalaget (`nature_stays`, `stay_guides`, `stay_guide_entries`) og admin-fladen, så redaktionen kan indtaste kuraterede naturophold + guider, mens operatør-outreach kører — ingen offentlige sider endnu.

**Architecture:** Tre nye additive tabeller, der spejler `buying_guides`-systemet, med en `lib/nature-stays.ts` db-modul (rene, testbare funktioner) og to admin-flader (`/admin/naturophold`, `/admin/naturophold-guider`) der følger det eksisterende "tynd page → klient-komponent + `/api/admin/*`-route"-mønster (jf. `AdminBuyingGuides`).

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + PostGIS), TypeScript, Vitest. Migrationer = nummererede SQL-filer i `migrations/` (næste ledige = `048`). Genbrug `public.set_updated_at()`-trigger.

**Spec:** `docs/superpowers/specs/2026-06-14-glamping-naturophold-affiliate-design.md`

---

## Scope (Fase 1)
Kun datalag + admin + db-modul + types. **Ude af scope** (Fase 2, egen plan): guide-sider, Plan B-sektion, kort-markører, sitemap, JSON-LD. `getNearbyStays` bygges dog her (rent + testbart), så Fase 2 bare forbruger den.

## Filstruktur

| Fil | Ansvar |
|-----|--------|
| `migrations/048_nature_stays.sql` (create) | De tre tabeller, indeks, GIST på location, updated_at-triggere |
| `web/lib/nature-stays.ts` (create) | DB-modul: typer + læse/skrive-funktioner + `getNearbyStays` |
| `web/lib/__tests__/nature-stays.test.ts` (create) | Tests for rene funktioner (slug, disclosure-mapping, afstand/limit-logik via fixtures) |
| `web/app/(site)/admin/naturophold/page.tsx` (create) | Tynd admin-page → `<AdminNatureStays/>` |
| `web/components/AdminNatureStays.tsx` (create) | CRUD-UI for steder (spejl `AdminBuyingGuides`/`produkter`) |
| `web/app/api/admin/nature-stays/route.ts` (create) | GET/POST/PATCH/DELETE for steder (service-role) |
| `web/app/(site)/admin/naturophold-guider/page.tsx` (create) | Tynd admin-page → `<AdminStayGuides/>` |
| `web/components/AdminStayGuides.tsx` (create) | CRUD + kuratering/rækkefølge af guide-entries |
| `web/app/api/admin/stay-guides/route.ts` (create) | GET/POST/PATCH/DELETE for guider + entries |
| `web/app/(site)/admin/page.tsx` (modify) | Tilføj links til de to nye admin-flader |

---

### Task 1: Migration — tabeller + indeks + triggere

**Files:**
- Create: `migrations/048_nature_stays.sql`

- [ ] **Step 1: Skriv migrationen**

```sql
-- 048_nature_stays.sql — kurateret naturophold-/glamping-datalag (affiliate)

create table if not exists public.nature_stays (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  operator_name text,
  type         text not null,                       -- glamping_telt | naturhytte | dome | traehus | tiny_house | luksus_shelter ...
  region       text,
  kommune      text,
  place        text,
  location     geography(Point, 4326),              -- ejer-oplyst eller geokodet
  short_description text,
  body_md      text,
  image_url    text,
  image_urls   text[] not null default '{}',
  image_permission text,                            -- proveniens: hvem/hvornår gav lov
  price_from   integer,                             -- kr/nat, vejledende
  capacity     integer,
  amenities    jsonb not null default '{}'::jsonb,
  rating       numeric(2,1),
  booking_url  text,
  link_source  text not null default 'direkte'      -- booking_com | direkte | andet_netvaerk
                 check (link_source in ('booking_com','direkte','andet_netvaerk')),
  featured     boolean not null default false,
  sort_boost   integer not null default 0,
  status       text not null default 'draft' check (status in ('draft','published')),
  last_verified_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists nature_stays_location_gix on public.nature_stays using gist (location);
create index if not exists nature_stays_status_idx on public.nature_stays (status);
create index if not exists nature_stays_region_idx on public.nature_stays (region);

create table if not exists public.stay_guides (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  intro        text,
  body_md      text,
  seo_title    text,
  seo_description text,
  faq          jsonb not null default '[]'::jsonb,
  sources      jsonb not null default '[]'::jsonb,
  author       text,
  parent_slug  text,
  status       text not null default 'draft' check (status in ('draft','published')),
  last_reviewed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.stay_guide_entries (
  id            bigint generated always as identity primary key,
  guide_id      bigint not null references public.stay_guides(id) on delete cascade,
  nature_stay_id bigint not null references public.nature_stays(id) on delete cascade,
  rank          integer not null default 0,
  award_label   text,
  best_for      text,
  editorial_note text,
  created_at    timestamptz not null default now(),
  unique (guide_id, nature_stay_id)
);

drop trigger if exists nature_stays_updated_at on public.nature_stays;
create trigger nature_stays_updated_at before update on public.nature_stays
  for each row execute function public.set_updated_at();
drop trigger if exists stay_guides_updated_at on public.stay_guides;
create trigger stay_guides_updated_at before update on public.stay_guides
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Kør migrationen mod Supabase** (samme metode som tidligere migrationer — via Supabase SQL editor eller projektets migrate-script). Verificér i `psql`/Supabase at de tre tabeller findes og at PostGIS-extension er aktiv (`create extension if not exists postgis;` hvis `geography`-typen fejler — tjek om allerede aktiv via shelters.location).

- [ ] **Step 3: Commit**
```bash
git add migrations/048_nature_stays.sql
git commit -m "feat(naturophold): migration — nature_stays, stay_guides, stay_guide_entries"
```

---

### Task 2: Typer + slug-helper (TDD)

**Files:**
- Create: `web/lib/nature-stays.ts`
- Test: `web/lib/__tests__/nature-stays.test.ts`

- [ ] **Step 1: Skriv failing test for slug + disclosure-mapping**
```ts
import { describe, it, expect } from "vitest";
import { stayDisclosure, slugifyStayName } from "@/lib/nature-stays";

describe("nature-stays helpers", () => {
  it("slugifyStayName laver rene slugs", () => {
    expect(slugifyStayName("Skovly Glamping Æø")).toBe("skovly-glamping-aeoe");
  });
  it("stayDisclosure varierer efter link_source", () => {
    expect(stayDisclosure("booking_com")).toMatch(/Booking\.com/);
    expect(stayDisclosure("direkte")).toMatch(/direkte/i);
    expect(stayDisclosure("andet_netvaerk")).toMatch(/kommission/i);
  });
});
```

- [ ] **Step 2: Kør og se den fejle** — `cd web && npx vitest run lib/__tests__/nature-stays.test.ts` → FAIL (modul/funktion findes ikke).

- [ ] **Step 3: Implementér typer + de to rene funktioner** i `web/lib/nature-stays.ts` (genbrug evt. eksisterende `slugifySegment` fra `@/lib/slug` hvis den dækker æøå — ellers tynd wrapper). Definér `NatureStay`, `StayGuide`, `StayGuideEntry`-interfaces + `STAY_SELECT_COLS`.

- [ ] **Step 4: Kør og se den passe.**

- [ ] **Step 5: Commit** `feat(naturophold): typer + slug/disclosure-helpers`

---

### Task 3: `getNearbyStays` (TDD — kerne til Fase 2 Plan B)

**Files:**
- Modify: `web/lib/nature-stays.ts`
- Modify: `web/lib/__tests__/nature-stays.test.ts`
- Evt. create RPC i `migrations/048_*` eller ny `049_nearby_stays_rpc.sql` (se `migrations/019_nearby_shelters_rpc.sql` som forlæg)

- [ ] **Step 1:** Beslut tilgang: spejl `get_shelters_in_bbox`/`019_nearby_shelters_rpc.sql` og lav en PostGIS-RPC `get_nearby_stays(lat, lng, radius_m, max)` der returnerer published stays sorteret efter afstand med `distance_m`. (RPC frem for klient-side, da location er `geography`.)

- [ ] **Step 2: Skriv test** for `getNearbyStays` med mocket Supabase-rpc (følg mønster fra `web/app/api/__tests__/*` eller eksisterende db-mock). Verificér: kun published, respekterer limit, returnerer afstand, tom-array ved ingen.

- [ ] **Step 3:** Tilføj RPC-SQL (i 048 eller 049) + kør mod Supabase.

- [ ] **Step 4:** Implementér `getNearbyStays(location, {radiusKm=25, limit=3})` der kalder RPC.

- [ ] **Step 5:** Kør tests grønne. **Commit** `feat(naturophold): getNearbyStays + PostGIS RPC`.

---

### Task 4: DB-læse/skrive-funktioner for admin

**Files:**
- Modify: `web/lib/nature-stays.ts`

- [ ] **Step 1:** Implementér (service-role client, jf. `@/utils/supabase/server` brugt i andre admin-routes):
  `listStays(filter?)`, `getStayById(id)`, `upsertStay(input)`, `setStayStatus(id, status)`, `deleteStay(id)`; og for guider: `listStayGuides()`, `upsertStayGuide(input)`, `setGuideEntries(guideId, entries[])` (DELETE+insert i rank-rækkefølge — spejl `seed_buying_guides`-mønstret). Validér: `status='published'` kun tilladt hvis `image_url` OG `image_permission` er sat (håndhæv §1 i spec).

- [ ] **Step 2:** Tilføj test for publicerings-validering (kaster/returnerer fejl hvis billede/tilladelse mangler). Kør grøn.

- [ ] **Step 3: Commit** `feat(naturophold): admin db-funktioner + publish-validering`.

---

### Task 5: Admin API-routes

**Files:**
- Create: `web/app/api/admin/nature-stays/route.ts`
- Create: `web/app/api/admin/stay-guides/route.ts`

- [ ] **Step 1:** Spejl `web/app/api/admin/buying-guides/route.ts` (auth-guard, service-role, metoder). `nature-stays`: GET (list), POST (create), PATCH (update/status), DELETE. `stay-guides`: GET, POST, PATCH (inkl. entries via `setGuideEntries`), DELETE.

- [ ] **Step 2:** Tilføj/justér route-test efter eksisterende `app/api/__tests__`-mønster (mindst happy-path POST + publish-validering-afvisning). Kør grøn.

- [ ] **Step 3: Commit** `feat(naturophold): admin API-routes`.

---

### Task 6: Admin-UI

**Files:**
- Create: `web/app/(site)/admin/naturophold/page.tsx`
- Create: `web/components/AdminNatureStays.tsx`
- Create: `web/app/(site)/admin/naturophold-guider/page.tsx`
- Create: `web/components/AdminStayGuides.tsx`
- Modify: `web/app/(site)/admin/page.tsx`

- [ ] **Step 1:** Lav de to tynde pages efter præcis samme mønster som `admin/koebsguider/page.tsx` (force-dynamic, noindex-metadata, breadcrumb, render klient-komponent).

- [ ] **Step 2:** Byg `AdminNatureStays.tsx` ved at spejle `components/AdminBuyingGuides.tsx`. Felter: name, slug (auto fra name), operator_name, type (select), region/kommune/place, lat/lng (eller adresse), short_description, body_md, image_url + image_urls, **image_permission (påkrævet før publish)**, price_from, capacity, amenities, booking_url, link_source (select), featured/sort_boost, status. Kald `/api/admin/nature-stays`.

- [ ] **Step 3:** Byg `AdminStayGuides.tsx` (spejl `AdminBuyingGuides`): opret guide, søg/tilføj steder som entries, træk-rækkefølge/rank, award_label/best_for/editorial_note. Kald `/api/admin/stay-guides`.

- [ ] **Step 4:** Tilføj to links i `admin/page.tsx` ("Naturophold", "Naturophold-guider").

- [ ] **Step 5:** Verificér lokalt med preview: opret et test-sted (draft), prøv at publicere uden billede/tilladelse → afvist; med billede+tilladelse → published. Slet test-stedet.

- [ ] **Step 6: Commit** `feat(naturophold): admin-UI for steder + guider`.

---

### Task 7: Verifikation + afslutning

- [ ] **Step 1:** `cd web && npx tsc --noEmit` → ingen fejl i kildekode.
- [ ] **Step 2:** `cd web && npx vitest run` → alle tests grønne (inkl. nye).
- [ ] **Step 3:** REQUIRED SUB-SKILL: Brug `superpowers:finishing-a-development-branch`.

---

## Noter til implementøren
- **Genbrug, ikke gentag:** spejl `buying_guides`-systemets filer 1:1 hvor muligt (admin-komponenter, API-routes, seed-mønster). Det er bevidst, at datalaget ligner — det gør Fase 2-renderingen næsten gratis.
- **PostGIS:** `shelters.location` bruger allerede geografi/PostGIS — extension er sandsynligvis aktiv. Verificér i Task 1.
- **RLS:** følg samme RLS-holdning som `buying_guides` (offentlig læsning af published; skrivning kun service-role). Tilføj RLS-policies i migrationen hvis `buying_guides` har dem (tjek schema).
- **Ingen offentlige ruter** oprettes i Fase 1 — `/naturophold/*` kommer i Fase 2.
