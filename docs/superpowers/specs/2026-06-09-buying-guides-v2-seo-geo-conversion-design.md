# Købsguider v2 — top-of-class SEO + GEO + konvertering — Design

**Dato:** 2026-06-09
**Status:** Godkendt design → klar til implementeringsplan
**Mål (én sætning):** Løft shelterdk's affiliate-købsguider til best-in-class, så de vinder organisk SEO- og GEO-trafik (AI-citationer) og konverterer markant bedre — primært ved at fjerne pris-skævheden, tilføje scores + sammenligningstabel + dybde, og optimere til både Google og generative motorer.

**Bygger på:** `docs/superpowers/specs/2026-06-06-buyer-intent-buying-guides-design.md` (v1-systemet, allerede live: `/bedste/[slug]`, `buying_guides`/`buying_guide_entries`, GearCardView, schema, sitemap, admin, intern linkning).

---

## 1. Motivation / kritik af v1 (evidensbaseret)

Benchmarket mod friluftsmagasinet.dk, friluftsfreak.dk og særligt **findshelter.dk/bedst-i-test/soveposer** (direkte konkurrent):

| Dimension | v1 (vores) | findshelter.dk |
|---|---|---|
| Pris-spænd / "Bedst i test" | "Bedst i test" = 5.198 kr; **ingen mellemklasse** | testvinder i mellemklassen; 299–2.949 kr |
| Antal produkter | 5 | 11 |
| Numeriske scores | ingen | 9,5/10 (→ SERP-stjerner, AI-citerbart) |
| Sammenligningstabel | udskudt | ja, priser synlige fra top |
| Dybde (brødtekst) | kort | ~6-7.000 ord |
| Hurtigt overblik | nej | top-4 fremhævet |

**Rod-årsag til dårlig konvertering:** produktvalget var skævt mod premium (Helsport/Carinthia/Sea to Summit, 5.000+ kr). Feed-analyse viser at sweet-spottet findes rigeligt: **49 soveposer i 500-999 kr, 47 i 1.000-1.499 kr**, og præcis de billige kendte brands konkurrenterne rangerer — **Nordisk Bjarni (699 kr), Highlander Rayet (549 kr), Robens Spire, Snugpak, Treklife**. De skal være helte.

## 2. Trufne beslutninger

1. **Scoring:** numeriske scores (0-10, én decimal) + transparent metode → Review-schema-stjerner + GEO-citerbarhed.
2. **Omfang:** opgradér systemet + genskriv de 4 nuværende (sovepose, telt, liggeunderlag, pandelampe) + tilføj flere kategorier.
3. **Score-vægtning (rubrik):** værdi-for-pengene > egnethed/specs > brand-pålidelighed > lager.
4. **Ekstra kategorier (forslag, bekræftes mod feed):** stormkøkken/kogegrej, vandfilter, hængekøje, tarp, drikkedunk, kniv/multitool. **Fravalgt:** `rygsaek` (mest taktiske/kamera-tasker = tynd kvalitet).

## 3. Scoring-model (troværdigheds-kernen)

- **`score` (0-10, én decimal) tildeles redaktionelt pr. produkt** efter en **publiceret rubrik** — ikke auto-beregnet (feed mangler strukturerede specs til det). Rubrikken vægter:
  - **Værdi-for-pengene** (tungest) — kvalitet/egnethed ift. pris, ikke bare laveste pris.
  - **Egnethed/specs** — temperatur, vægt, materiale ift. brugsscenariet.
  - **Brand-pålidelighed** — anerkendt mærke/garanti.
  - **Lager/tilgængelighed** — kan faktisk købes.
- **Schema:** hvert produkt = `Product` med en **`review` (Review)** forfattet af ShelterDK (`reviewRating.ratingValue` = scoren, `bestRating: 10`). Det er den Google-konforme måde at få review-stjerner fra en redaktionel score (tredjeparts-produkter, ikke egne → tilladt). Stjerne-rating i UI afledes af scoren.
- **Metodeside** (`/saadan-vurderer-vi`, opdateres) forklarer rubrik + vægtning + ærligt "vi labtester ikke — vi scorer på specs, pris, brand og friluftserfaring, og gennemgår eksterne tests".

## 4. Datamodel (udvider eksisterende — ingen nye tabeller)

- **`buying_guide_entries`** (tilføj): `score numeric` (0-10), `best_for text` (kort "bedst til"-label, fx "Ultralet vandring").
- **`affiliate_products.specs`** (findes) — beriges bredere pr. kategori.
- **`buying_guides`** (tilføj, valgfrit): `author text` (E-E-A-T), `methodology text`/ref. (kan også være statisk på metodesiden).

## 5. Template-opgradering (`/bedste/[slug]`)

Rækkefølge (matcher/slår findshelter, server-rendered ISR):
1. **H1 + svarkapsel** ("Hurtigt svar": testvinderen + kerne-anbefaling i 2-3 sætninger — `.llm-quote` + SpeakableSchema, stærkt GEO-signal) + opdateringsdato + metodelink.
2. **Hurtigt overblik** — top 3-4 fremhævet (badge + score + pris + CTA).
3. **Sammenligningstabel** — alle produkter: billede, navn + score, "bedst til", nøgle-spec, **pris + "Se pris"** (synlig fra toppen; meget citerbar for AI).
4. **Rangerede produktkort** — rank, score (+ stjerner), badge, "derfor", **3-4 pros / 2-3 cons**, spec-række, live pris + CTA (GearCardView + `/api/track`).
5. **Dyb købsguide** (`body_md`, ~1.500-2.500 ord): EN/ISO-temp-ratings, dun vs. fiber, form/størrelse, **typiske købsfejl**, **pro-tips**, vedligehold.
6. **Kilder** (eksterne tests vi har gennemgået).
7. **FAQ** (8-10 spørgsmål, synlig + `FAQPage`-schema).
8. **E-E-A-T-blok**: forfatter/redaktion, opdateringsdato, metodelink, affiliate-disclosure.

**Schema samlet:** `ItemList` + pr. produkt `Product` m. `review`/`reviewRating` + `FAQPage` + `BreadcrumbList` + `SpeakableSchema`. Dynamisk OG-kort.

## 6. Produkt-selektion (konverterings-reglerne)

- **8-12 produkter pr. guide**, tyngden i **500-1.500 kr**.
- Billige kendte brands som helte (Nordisk, Highlander, Robens, Snugpak, Treklife) + 1-2 premium til "Bedste premium".
- **Award-slots:** Bedst i test (stærkt mellemklasse-valg) · Bedst til prisen · Bedste premium · Bedste letvægt · Bedste til vinter/3-sæson · Bedste til begyndere.
- **Udsolgte demoteres** automatisk (findes i v1).
- Filtrér kategori-støj fra (fx tilbehør i `telt`, taktiske tasker i `rygsaek`).

## 7. SEO/GEO-plumbing (meget er bygget i v1)

- Intern linkning (footer/menu/tilbud → /bedste) ✓.
- Sitemap inkl. guider ✓.
- **GEO-tilføjelser:** svarkapsel + eksplicitte "bedst til X"-udsagn (AI uddrager dem direkte), sammenligningstabel (citerbar), opdateringsdato, navngivet forfatter/redaktion (E-E-A-T), Review-schema.

## 8. Indholds-leverance

1. Opgradér datamodel + template + scoring + schema.
2. Genskriv de 4 til ny standard (rigtige mellemklasse-produkter + scores + tabel + dyb tekst + FAQ).
3. Tilføj de bekræftede ekstra kategorier (samme skabelon, via seed-script).
4. Opdatér metodesiden.

## 9. Succeskriterier

- Hver guide: 8-12 produkter, tyngde i 500-1.500 kr, scores, badges, pros/cons, specs, sammenligningstabel, ~1.500-2.500 ords guide, 8-10 FAQ.
- Google Rich Results Test: ItemList + Product/Review (stjerner) + FAQ valide.
- "Bedst i test" er et realistisk mellemklasse-køb, ikke premium.
- Metodeside + disclosure + opdateringsdato + forfatter på plads.
- Live priser/lager; udsolgte demoteres.

## 10. Test-strategi

- **Rene funktioner (TDD):** score→stjerne-afledning, score-formatering, schema-buildere (Product+Review m. reviewRating, ItemList, FAQPage), sammenligningstabel-sortering, "bedst til"-gruppering, rang/demotering (findes).
- **Datalag:** guide-fetch inkl. nye felter, graceful tom-tilstand.
- Ingen tredjeparts-kald i tests (mock feed-data).

## 11. Åbne punkter / antagelser

- Endeligt ekstra-kategori-valg bekræftes mod feed-dækning (rene kategorier + god mellemklasse) under planen.
- Score-tildeling er redaktionel pr. rubrik (jeg authorer), ikke auto-beregnet.
- Forfatter/E-E-A-T: foreslået "ShelterDK Redaktionen" medmindre en navngiven person ønskes.
- Genbruger v1-infrastruktur maksimalt; kun additive datamodel-ændringer.
