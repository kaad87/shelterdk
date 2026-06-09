# Købsguider — bredde, hub & long-tail — Design

**Dato:** 2026-06-09
**Status:** Godkendt design → klar til implementeringsplan
**Mål (én sætning):** Luk bredde-gabet til content/affiliate-konkurrenter (inspireret af babyogmor.dk's hub + volumen) ved at lave `/bedste` om til en grupperet kategori-hub, skalere antallet af guider, og tilføje long-tail-variant-sider — **uden tyndt indhold** og uden at miste shelterdk's kvalitets-/E-E-A-T-/GEO-kant.

**Bygger på:** v2-systemet (live): `buying_guides`/`buying_guide_entries` (m. `score`, `best_for`, `author`), `/bedste/[slug]`-template (Hurtigt overblik + sammenligningstabel + svarkapsel + Review-schema + FAQ), `/bedste`-hub, `seed_buying_guides.mjs`. Specs: `2026-06-09-buying-guides-v2-...md`.

---

## 0. Den vigtigste regel: INGEN tynde sider (brugerens eksplicitte krav)

Hver ny side (kategori-guide ELLER long-tail-variant) skal møde en **hård indholds-bar** før den publiceres. Kan en kandidat ikke møde baren, **droppes den** — vi udfylder ALDRIG med fyld eller near-duplikeret tekst.

**Indholds-bar pr. side:**
- **≥6 produkter** der reelt egner sig til sidens vinkel, og som er **de-dupликeret** mod en evt. hovedguide (en variant må ikke bare gentage hovedguidens top).
- **Unik brødtekst ~1.200-1.800+ ord** med vinkel-specifik rådgivning (ikke kopieret fra hovedguiden).
- **Unik FAQ (≥6)** målrettet sidens søgeintention.
- **Unik svarkapsel + intro + scores + "bedst til"-labels.**
- **Reel selvstændig søgeintention** (variant skal svare på en anden forespørgsel end hovedguiden).

**Feed-viabilitets-gate (kategorier):** kun kategorier med ≥8 rene, relevante produkter i et fornuftigt prisspænd. Rodede/tynde kategorier (fx tarp, generisk kogeudstyr) droppes — som besluttet i v2.

## 1. Trufne beslutninger

1. **Long-tail = selvstændige variant-sider** (egne URL'er), disciplineret efter §0.
2. **Stor første bølge (~15-20 nye sider)**, men hver side møder indholds-baren — ellers færre.
3. **Hub-gruppering:** Sovegrej · Telte & ly · Belysning · Vand & mad · Værktøj & udstyr.
4. **`parent_slug`-kobling** variant → hovedguide (additiv kolonne).

## 2. Arkitektur

### 2.1 Grupperet hub (`/bedste`)
- Statisk `kategori → gruppe`-map i kode (ingen tabel-ændring for grupper).
- Hub-siden renderer **sektioner** pr. gruppe i stedet for flad liste. Hver sektion: overskrift + kort + (evt.) intro-tekst (rangerer brede termer + dyb intern linkning).

### 2.2 Long-tail variant-sider
- En variant er en almindelig `buying_guides`-række: egen `slug` (fx `sovepose-til-vinter`), samme `category` (så produkt-søgning virker), men **unik** title/intro/body_md/faq/sources og **de-dupliceret** entry-udvalg.
- Ny additiv kolonne **`parent_slug text`** på `buying_guides` → kobler variant til hovedguide (breadcrumb "del af", krydslink). NULL for hovedguider.
- Genbruger `/bedste/[slug]`-templaten 1:1 (intet nyt render-arbejde ud over §2.4).

### 2.3 "Se også"-krydslinkning
- Blok nederst på hver guide: relaterede guider udledt **automatisk** af (a) samme hub-gruppe og (b) parent/variant-relation (`parent_slug`). Ingen manuel vedligeholdelse.
- Ny ren funktion `relatedGuides(currentSlug, allGuides)` (TDD).

### 2.4 Template-tilføjelser (`/bedste/[slug]`)
- Breadcrumb viser parent-guide hvis `parent_slug` sat (Hjem › Bedste › Sovepose › Til vinter).
- "Se også"-blok (fra §2.3).

## 3. Datamodel (kun additivt)
- `buying_guides`: tilføj `parent_slug text` (NULL for hovedguider).
- Hub-gruppe-map: statisk i `lib/buying-guides-hub.ts` (kategori → {gruppe, rækkefølge}). Ingen tabel.

## 4. Indholds-bølge (gated efter §0)

**Kandidater til hoved-kategorier** (kun dem der består feed-gate):
- drikkedunk/​drikkeflaske, stormkøkken (smalt udsnit af kogeudstyr), kikkert, evt. rygsæk-vandre (kun hvis hiking-produkter er nok), regntøj.

**Kandidater til long-tail-varianter** (kun dem der består §0):
- sovepose: `sovepose-til-vinter`, `letvaegts-sovepose`, `sovepose-til-boern`, `sommersovepose`.
- telt: `2-personers-telt`, `letvaegtstelt`, `familietelt`, `1-personers-telt`.
- liggeunderlag: `liggeunderlag-til-vinter`.
- pandelampe: `pandelampe-til-loeb`.

Endeligt antal afhænger af hvor mange der består gaten — **kvalitet før måltal.**

## 5. SEO/GEO-sikkerhed
- Self-canonical pr. side; varianter kannibaliserer ikke (de-dupliceret udvalg + distinkt vinkel).
- Intern linkning (hub-grupper + "se også" + parent/variant) — tæt graf som babyogmor.
- Sitemap inkluderer automatisk publicerede guider (findes).
- Bevarer pr. side: scores, Review-schema (stjerner), svarkapsel, SpeakableSchema, FAQPage, author, kilder, opdateringsdato — **det er vores kant over babyogmor (de mangler E-E-A-T + schema).**

## 6. Genbrug / ingen scope-creep
- Ingen nye tabeller (kun `parent_slug`). Ingen ny render-template (kun breadcrumb + "se også"). Indhold via `seed_buying_guides.mjs`.

## 7. Succeskriterier
- `/bedste` er en grupperet hub med sektioner.
- Alle nye sider møder §0-baren (≥6 unikke produkter, ~1.200-1.800+ unikke ord, ≥6 unik FAQ, distinkt vinkel) — ellers droppet.
- Varianter krydslinker til hovedguide og omvendt; "se også" på alle.
- Rich Results valide (ItemList + Product/Review + FAQ) pr. side.
- Ingen near-duplikat mellem variant og hovedguide.

## 8. Test-strategi
- **Rene funktioner (TDD):** hub-gruppering (kategori→gruppe + sortering), `relatedGuides` (samme gruppe + parent/variant, ekskl. sig selv, cappet), breadcrumb-sti med parent.
- **Datalag:** guide-fetch inkl. `parent_slug`.
- Indholds-baren håndhæves redaktionelt (jeg authorer) + verificeres (ordtælling/produkt-antal) før publicering.

## 9. Åbne punkter / antagelser
- Endeligt kategori- og variant-valg bestemmes af feed-viabilitet + §0-gaten under planen.
- Hub-gruppe-tilhør: statisk map (let at udvide).
- Jeg authorer alt indhold; "tag dig tid" → kvalitet/unikhed prioriteres over antal sider.
