# Glamping & naturophold — affiliate-integration — Design

**Dato:** 2026-06-14
**Status:** Godkendt design → klar til implementeringsplan
**Mål (én sætning):** Udvid shelterdk fra kun gratis shelters til også at dække betalt luksus i naturen (glamping, naturhytter, domes, træhuse) via et **kurateret, redaktionelt** datalag, der tjener affiliate-provision gennem kuraterede guider, "Plan B"-alternativer på shelter-sider og premium kort-markører — **uden tyndt indhold og uden at bringe det eksisterende domæne i fare.**

**Bygger på:** `buying_guides`/`buying_guide_entries`-systemet (guide-template, kort, ItemList-JSON-LD, `LastVerifiedBadge`, FAQ, affiliate-disclosure, klik-tracking), det eksisterende kort (`MapComponent`/`ShelterMap`), shelter-detaljesiderne, og `/admin`-mønstret.

---

## 0. Beslutningsgrundlag & afviste antagelser (vigtigt)

Idéen kom fra en brainstorm om at bruge **Booking.com's API/feed**. Research afdækkede tre blokkere, som ændrer præmissen:

1. **Booking.com's Demand API er gated** — forbeholdt "Managed Affiliate Partners" med høj bookingvolumen + flertrins-godkendelse. En affiliate med kun links/widgets får ikke API-adgang.
2. **Booking.com forbyder caching** af priser/ledighed og at bygge en **derivativ database** af deres indhold; fotos må kun bruges via deres API-leverede URL'er. → koncept "træk alle koordinater/data ned i Supabase" er **i strid med ToS**.
3. **Masse-programmatiske sider** fyldt fra et feed = Google "doorway page"/thin-affiliate-mønster → risiko for manuel handling, der kan skade hele domænets autoritet (det vi netop har styrket).

**Konsekvens (truffet med bruger):**
- Vi bygger **ikke** på Booking.com's API/feed, og **ikke** masse-doorway-sider (koncept 1) i MVP.
- Data er **kuraterede, navngivne steder** i vores eget bord — det er *vores* data (koordinater, redaktionel tekst), så koncept 3 (kort) og senere koncept 1 (landingssider) bliver lovlige.
- **Billeder kommer fra ejeren** (med dokumenteret tilladelse) — aldrig fra Booking.com.
- **Booking-link afkobles fra billedkilde:** et Booking.com *affiliate-deep-link til en konkret ejendom* (med `aid`) er tilladt affiliate-mekanik (linkning ≠ caching) og kræver ikke API. Steder uden Booking.com får direkte link eller andet netværk.

## 1. Den vigtigste regel: INGEN tynde sider, INGEN ulovlige billeder

- Hvert publiceret sted skal have **unik redaktionel tekst** (vores ord), ejer-godkendt billede, og et fungerende tracket booking-link.
- Hver guide møder samme indholds-bar som købsguiderne (≥ relevante steder, unik brødtekst, unik FAQ, scores/"bedst til").
- Et sted publiceres **kun** med dokumenteret billedtilladelse (`image_permission` udfyldt). Ingen Booking.com-fotos. Ingen hotlinkede/scrapede billeder.

## 2. Trufne beslutninger

1. **Arkitektur A:** dedikeret datalag (`nature_stays`) + guide-system (`stay_guides`/`stay_guide_entries`) der **spejler** `buying_guides`-systemet. (Afvist: polymorf genbrug af `buying_guides` — for høj risiko for det velfungerende grej-system.)
2. **MVP = alle tre visnings-features på én gang:** kuraterede guider (koncept 4) + Plan B på shelter-sider (koncept 2) + premium kort-markører (koncept 3).
3. **Kort-markør: "guld-pin"** (guld + diamant-glyf) som standard for betalte steder. Foto-markør m. pris er en *senere* opgradering ved høj zoom (ikke MVP).
4. **Plan B er altid-på & komplementær** — vises når der findes ≥1 publiceret naturophold inden for radius af shelteret. **Ingen ledigheds-påstande** (vi kan ikke se per-dato-ledighed, og de fleste shelters er gratis). Framing: "Vil du have luksus i samme natur?".
5. **Skaffe-strategi:** direkte operatør-outreach (~15-20 flagskibssteder til start) for billeder + aftale; Booking.com-affiliate-links bruges hvor stedet findes der.

## 3. Datamodel (nye borde, additivt — rører ikke eksisterende)

### 3.1 `nature_stays`
- **Identitet:** `id`, `slug` (unik), `name`, `operator_name`, `type` (text: glamping_telt | naturhytte | dome | traehus | tiny_house | luksus_shelter …)
- **Geografi:** `region`, `kommune`, `place`, `location` (PostGIS POINT — ejer-oplyst eller geokodet adresse). Driver Plan B-nærhed + kort.
- **Indhold:** `short_description`, `body_md` (**vores** tekst), `image_url`, `image_urls` (text[] — ejer-leveret), `image_permission` (text — hvem/hvornår gav lov; proveniens)
- **Fakta:** `price_from` (int, kr/nat, vejledende), `capacity` (int), `amenities` (jsonb), `rating` (numeric, valgfri)
- **Monetisering:** `booking_url` (tracket udgående link), `link_source` (text: booking_com | direkte | andet_netvaerk)
- **Drift:** `featured` (bool) / `sort_boost` (int), `status` (draft | published), `last_verified_at` (timestamptz), `created_at`, `updated_at` (+ updated_at-trigger som `buying_guides`)
- Indeks: GIST på `location` (nærhedssøgning), btree på `status`, `region`.

### 3.2 `stay_guides` (spejler `buying_guides`)
`id, slug, title, intro, body_md, seo_title, seo_description, faq (jsonb), status, last_reviewed_at, author, parent_slug, created_at, updated_at (+trigger)`

### 3.3 `stay_guide_entries` (spejler `buying_guide_entries`)
`id, guide_id (fk stay_guides), nature_stay_id (fk nature_stays), rank, award_label, editorial_note, best_for, created_at` — unik (guide_id, nature_stay_id).

## 4. Komponenter & dataflow

### 4.1 Guide-sider (koncept 4) — `/naturophold/[slug]` (eller `/glamping/[slug]`; afklares)
- Genbruger `/bedste/[slug]`-templatens struktur: hero, "Hurtigt svar", kort (billede/pris/award), `LastVerifiedBadge`, FAQ, affiliate-disclosure, "Se også".
- JSON-LD: `ItemList` over stederne; pr. sted `LodgingBusiness`/`TouristAttraction` (navn, adresse/region, prisinterval, billede). FAQ-schema.
- Hub-side `/naturophold` (grupperet liste, som `/bedste`-hubben).

### 4.2 Plan B på shelter-detaljeside (koncept 2)
- Ny server-funktion `getNearbyStays(shelterLocation, { radiusKm = 25, limit = 3 })` (PostGIS `ST_DWithin` + `ORDER BY distance`), kun `status = published`.
- Sektion nederst på shelter-siden, vises kun hvis ≥1 resultat. Kort med billede, pris-fra, afstand ("4 km herfra"), tracket link. Komplementær tekst, ingen ledigheds-påstand.

### 4.3 Premium kort-markører (koncept 3)
- Ny slim pins-kilde for publicerede `nature_stays` (id, navn, lat/lng, pris_from, slug, booking_url).
- `ShelterMap` får et valgfrit `stays`-lag der renderer guld-pin-markører (distinkt fra shelter-markører) + popup (billede, pris, "Se & book"-link).
- Indgår i clustering på linje med shelters.

### 4.4 Admin
- `/admin/nature-stays` CRUD: indtast sted, billede + `image_permission`-note, koordinater (eller geokod fra adresse), `booking_url` + `link_source`, status.
- `/admin/stay-guides`: opret guide, kuratér + ordne entries.

### 4.5 Klik-tracking & disclosure
- Udgående links via samme redirect/tracking-mekanik som affiliate-produkter, `rel="sponsored nofollow"`.
- Disclosure-linje på guide- og Plan B-sektioner; tekst kan variere efter `link_source`.

## 5. SEO / freshness (konsistent med eksisterende arbejde)
- Guide-sider: synlig "Sidst opdateret" (`last_reviewed_at`) + JSON-LD `dateModified` = newest(last_reviewed_at, updated_at).
- Sitemap: nye `/naturophold/*`-ruter med `lastmod` fra `updated_at` (genbrug mønster).
- Ingen masse-doorway-sider; hver side møder indholds-baren (§1).

## 6. Fejlhåndtering
- Manglende billede/tilladelse → sted kan ikke sættes `published` (valideres i admin).
- Udsolgt/nedlagt sted → `status=draft`, demoteres fra guider, Plan B og kort (samme som affiliate-produkter der går OOS).
- Plan B uden nærliggende steder → sektion skjules helt (ingen tom tilstand).
- Døde booking-links → periodisk verificering (manuel via `last_verified_at`; auto-link-tjek som muligt senere).

## 7. Test (TDD)
- `getNearbyStays` — radius/limit/afstandssortering/kun-published (ren funktion mod fixtures).
- Slug/URL-bygning + `link_source`-disclosure-mapping.
- Guide-render: ItemList/LodgingBusiness-schema-form.
- Kort-pins-kilde: kun published, korrekt felt-shape.

## 8. Uden for scope (senere)
- Koncept 1 (programmatiske landingssider "Glamping [by]") — først når vi har nok kuraterede steder pr. område til reelt indhold.
- Foto-markør m. pris ved høj zoom.
- Live ledighed / per-dato (kræver integration).
- Booking.com Demand API (først hvis/ når Managed Partner-status nås).

## 9. Åbne spørgsmål
- URL-rod: `/naturophold` vs `/glamping` vs `/luksus` (SEO-volumen vs brand). Anbefaling: `/naturophold` (bredt, ejer-neutralt) med guld-vinkel i indhold.
- Skal Plan B også vises på region-/områdesider, ikke kun shelter-detalje? (kan være fase 2)
