# Kuraterede Vandreruter — Design Spec

## Sammenfatning

Erstat den nuværende interaktive ruteplanner med en inspirationsside der viser 234 kuraterede vandreruter fra Naturstyrelsen (GeoFA). Hver rute har mindst 5 shelters inden for 2 km. Siden viser et Danmark-kort øverst med alle ruter som linjer, en filtrerbar card-liste nedenunder, og et detalje-overlay når brugeren vælger en rute.

## Problem

Den nuværende `/ruteplanner` er et tomt kort hvor brugeren selv skal klikke shelters for at bygge en rute. Uden kurateret indhold er der ingen inspiration, og de færreste brugere vil bruge værktøjet.

## Løsning

Vis 234 færdige vandreruter fra Naturstyrelsen med AI-genererede beskrivelser og tilknyttede shelters. Brugeren browser, filtrerer og udforsker ruter — og kan downloade GPX til sin tur.

---

## Sidelayout

### Desktop (md+)

```
┌──────────────────────────────────────────────┐
│  ShelterDK navbar                            │
├──────────────────────────────────────────────┤
│  Overskrift: "Vandreruter med shelters"      │
│  Underoverskrift: "234 ruter fra Naturst..." │
├──────────────────────────────────────────────┤
│                                              │
│         Danmark-kort (40vh)                  │
│   Alle ruter som farvede linjer              │
│   Klik rute → zoom + highlight              │
│                                              │
├──────────────────────────────────────────────┤
│  [Region ▼]  [Længde ▼]  Sortér: [Shelters▼]│
├──────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ Hærvejen │ │Kystsporet│ │Gudenå-   │      │
│ │ 646 km   │ │ 157 km   │ │stien     │      │
│ │98 shelters│ │32 shelters│ │29 shelters│     │
│ │ Jylland  │ │ Sjælland │ │ Jylland  │      │
│ └──────────┘ └──────────┘ └──────────┘      │
│ ... (resten af ruterne)                      │
└──────────────────────────────────────────────┘
```

### Detalje-overlay (når rute er valgt)

Kortet zoomer ind på den valgte rute og et overlay vises:

```
┌──────────────────────────────────────────────┐
│  ← Tilbage til alle ruter                    │
│                                              │
│  Kort: ruten highlighted + shelter-markers   │
│  (40vh)                                      │
│                                              │
├──────────────────────────────────────────────┤
│  Hærvejen                                    │
│  646 km · 98 shelters · Jylland              │
│                                              │
│  "Danmarks ældste langdistancerute..."       │
│                                              │
│  Shelters langs ruten:                       │
│  1. Shelter Silkeborg    (2.3 km fra ruten)  │
│  2. Shelter Ry           (0.8 km fra ruten)  │
│  3. ...                                      │
│                                              │
│  [Download GPX]  [Del rute]                  │
└──────────────────────────────────────────────┘
```

### Mobil

Samme layout, men:
- Kort 50vh
- Card-grid 1 kolonne
- Detalje-overlay: kort 40vh, shelter-liste scrollbar nedenunder

---

## Filtrering

### Region
- Alle (default)
- Jylland
- Fyn og Øerne
- Sjælland og Øerne

### Rutelængde
- Alle (default)
- Kort: < 10 km
- Mellem: 10–50 km
- Lang: 50+ km

### Sortering
- Flest shelters (default)
- Længste rute
- Korteste rute
- Navn A-Å

---

## Datamodel

### Pre-computed JSON: `public/data/curated-routes.json`

Genereres af et build-script. Ikke i databasen — statisk JSON som `trails.json`.

```typescript
interface CuratedRoute {
  id: string;               // GeoFA trail ID
  name: string;             // Rutenavn fra GeoFA
  slug: string;             // URL-venlig: "haervejen"
  description: string;      // AI-genereret beskrivelse
  region: "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne";
  length_km: number;        // Beregnet fra geometri
  geometry: GeoJSON.Geometry; // MultiLineString fra GeoFA
  shelters: RouteShelter[];  // Shelters inden for 2km, sorteret langs ruten
}

interface RouteShelter {
  id: string;
  slug: string;
  title: string;
  lat: number;
  lon: number;
  distance_to_trail_km: number; // Afstand fra shelter til nærmeste punkt på ruten
  capacity?: number | null;
  water?: boolean | null;
  toilet?: "flush" | "mulch" | "none" | "unknown" | null;
}
```

### To-delt data: index + geometri

**Index-fil: `public/data/curated-routes-index.json` (~50-100 KB)**

Letvægts-fil der loades ved page mount. Indeholder alt til card-listen og filtre:

```typescript
interface CuratedRouteIndex {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne";
  length_km: number;
  shelter_count: number;
  // Bounding box til kortet (så rute-linjer kan vises som simple rektangler/placeholder)
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}
```

**Fuld data: `public/data/curated-routes.json` (~3-8 MB)**

Lazy-loades kun når brugeren vælger en rute (eller klikker "Vis alle på kort"). Indeholder geometri + shelter-data.

```typescript
interface CuratedRouteData {
  [slug: string]: {
    geometry: GeoJSON.Geometry;
    shelters: RouteShelter[];
  };
}
```

Denne to-deling giver instant card-rendering og filtrering, mens tung geometri-data kun hentes on-demand.

### Loading states

- **Page mount:** Hent index-fil → vis skeleton cards mens den loader → render card-liste
- **Rute valgt:** Hent fuld data (hvis ikke cached) → vis `animate-pulse` kort-skeleton → render kort + detaljer
- **Fejl:** Toast med "Kunne ikke indlæse ruter" + retry-knap

---

## Build-scripts

### 1. `scripts/generate-curated-routes.ts`

1. Læs `public/data/trails.json` (eksisterende GeoFA-data)
2. Hent alle shelters med lokation fra Supabase
3. For hver trail: find shelters inden for 2 km af ruten (haversine, sample hvert ~200m for præcision — dette er et one-time script hvor runtime er irrelevant)
4. Filtrer til trails med mindst 5 shelters
5. Beregn rutelængde fra geometri
6. Bestem region fra rutens startpunkt (første koordinat). For lange ruter der krydser regioner er startpunktet det mest intuitive.
7. Generer slug fra navn
8. Skriv til `public/data/curated-routes.json` (uden beskrivelser — de genereres separat)

### 2. `scripts/generate-route-descriptions.ts`

1. Læs `public/data/curated-routes.json`
2. For hver rute uden beskrivelse: kald Claude API med prompt der inkluderer rutenavn, region, længde, antal shelters, og shelternavne
3. Opdater JSON med genererede beskrivelser
4. Skriv tilbage til `public/data/curated-routes.json`

Prompt-eksempel:
```
Skriv en kort, inspirerende beskrivelse (2-3 sætninger, maks 400 tegn) af vandreruten "{name}" på dansk.
Ruten er {length_km} km lang i {region} og passerer {shelter_count} shelters, bl.a. {shelter_names}.
Fokusér på naturoplevelsen og muligheden for overnatning i shelters.
```

---

## Komponenter

### Nye komponenter

| Komponent | Ansvar |
|-----------|--------|
| `CuratedRoutesPage` | Server component: metadata, lazy Suspense wrapper |
| `CuratedRoutesClient` | Client: state (valgt rute, filtre), data loading, layout |
| `CuratedRoutesMap` | Leaflet-kort med rute-linjer, shelter-markers, zoom-to-route |
| `RouteCard` | Card i listen: navn, længde, region, shelter-antal |
| `RouteDetail` | Detalje-view: beskrivelse, shelter-liste, GPX-download |
| `RouteFilters` | Region-dropdown, længde-dropdown, sortering |

### Genbrugte utilities

- `lib/haversine.ts` — afstandsberegning (runtime + build-script)
- `lib/gpx-export.ts` — GPX-download (udvides med `generateRouteGpx`)
- `lib/shelter-detail.ts` → `getLocationCoords()` — kun i build-scriptet (ikke runtime, da RouteShelter har pre-computed lat/lon)

### Fjernes

- `RoutePlannerMap.tsx` — erstattes af `CuratedRoutesMap`
- `RoutePlannerSidebar.tsx` — erstattes af `RouteCard` + `RouteDetail`
- `RoutePlannerClient.tsx` — erstattes af `CuratedRoutesClient`
- `app/globals.css` → `.waypoint-marker`, `.trail-tooltip` CSS — ikke længere nødvendigt

---

## Kortvisning

### Alle ruter (default)
- Center: `[56.26, 9.50]`, zoom 7 (hele Danmark)
- Hver rute renderes som en `<GeoJSON>` polyline
- Farve: `#C5A059` (accent) med opacity 0.5
- Hover: opacity 1.0, tykkere linje
- Klik: vælg rute → zoom til bounds

### Valgt rute
- Kort zoomer til rutens bounding box med padding
- Valgt rute: `#C5A059` opacity 1.0, 4px bred
- Andre ruter: skjules eller dæmpes kraftigt
- Shelter-markers vises langs ruten (standard Leaflet pins)
- "Tilbage"-knap øverst til venstre

### Tile layer
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

---

## Frontend design

### Typografi
- Overskrift: `font-serif text-3xl font-bold text-primary` (Playfair Display)
- Underoverskrift: `text-primary/60 text-base`
- Card-titel: `font-serif text-lg font-semibold text-primary`
- Card-meta: `text-sm text-primary/50`

### Cards (ruteliste)
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
```

Hvert card:
```
rounded-2xl border border-primary/10 bg-white shadow-sm
hover:border-accent/40 hover:shadow-md transition-all duration-200
cursor-pointer p-5
```

Valgt card:
```
border-accent ring-2 ring-accent/20
```

### Filtre
Dropdowns med samme stil som eksisterende søgefiltre:
```
rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary
```

### Detalje-overlay
Under kortet, erstatter card-listen:
```
bg-white border-t border-primary/10 px-6 py-6
```

Shelter-liste som kompakte rækker:
```
flex items-center justify-between py-3 border-b border-primary/5
```

### Action-knapper
- "Download GPX": `bg-accent text-white rounded-xl px-5 py-2.5 font-medium`
- "Del rute": `border border-primary/15 text-primary rounded-xl px-5 py-2.5`

---

## URL-state

```
/ruteplanner                          → alle ruter
/ruteplanner?region=jylland           → filtreret
/ruteplanner?rute=haervejen           → valgt rute (overlay)
/ruteplanner?region=jylland&rute=X    → filtreret + valgt
```

`router.replace()` bruges til at opdatere URL uden page reload.

**"Del rute"-knap:** Kopierer den aktuelle URL (med `?rute=slug`) til clipboard via `navigator.clipboard.writeText()`. Viser en "Kopieret!" toast i 2.5 sekunder.

**Bagudkompatibilitet:** Gamle URLs med `?w=` og `?trails=` parametre ignoreres stille — de har ingen effekt på den nye side.

---

## GPX-export

Når brugeren downloader GPX for en valgt rute:
- `<trk>` med rutens geometri (fra GeoJSON coordinates)
- `<wpt>` for hver shelter langs ruten
- Filnavn: `{slug}.gpx`

Tilføj ny funktion i `lib/gpx-export.ts`:

```typescript
export function generateRouteGpx(
  routeName: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): string;

export function downloadRouteGpx(
  routeName: string,
  slug: string,
  trackGeometry: GeoJSON.MultiLineString | GeoJSON.LineString,
  shelterWaypoints: GpxWaypoint[]
): void;
```

Den eksisterende `generateGpx()` og `downloadGpx()` bevares uændret (bruges ikke længere af ruteplanneren, men fjernes først når de gamle komponenter slettes).

---

## Error handling

| Scenario | Handling |
|----------|----------|
| Index-fil fetch fejler | Toast: "Kunne ikke indlæse ruter" + retry-knap |
| Rute-data fetch fejler | Toast: "Kunne ikke indlæse rutedetaljer" + forbliv på listevisning |
| `?rute=xyz` matcher ingen slug | Ignorer parameteren, vis listevisning |
| 0 ruter efter filtrering | "Ingen ruter matcher dine filtre" + nulstil-link |

---

## Performance

- Index-fil (~50-100 KB) loades ved page mount — instant card-rendering
- Fuld geometri-data lazy-loades per rute ved valg
- `CuratedRoutesMap` renderes med `dynamic(() => import(...), { ssr: false })` (Leaflet kræver browser)
- Kortet viser kun valgt rutes geometri (ikke alle 234 på én gang) — bboxes fra index bruges til overview
- Shelter-markers vises kun for valgt rute

---

## Hvad der IKKE ændres

- Navbar (linket hedder stadig "Ruteplanner", peger stadig på `/ruteplanner`)
- Sitemap-entry
- Database-schema (ingen nye tabeller)
- Eksisterende sider (shelter-detail, søg, områder)

## Ud af scope

- Individuelle rutesider (`/ruteplanner/haervejen`) — kan tilføjes senere for SEO
- Bruger-oprettede ruter
- Elevation/højdeprofil
- Turn-by-turn navigation
- Integration med Google Maps / Apple Maps
