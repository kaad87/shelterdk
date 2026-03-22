# Ruteplanner — Design Spec

## Summary

A single new page (`/ruteplanner`) that lets users plan multi-shelter hiking trips on an interactive map. Users click shelters to build a route, optionally overlay official hiking trails from GeoFA, and export their planned route as GPX. This is a standalone tool — no functional changes to existing page features (only a nav link and sitemap entry added).

## Problem

ShelterDK shows individual shelters but provides no way to plan a multi-day hiking trip connecting several shelters. Users must manually cross-reference shelter locations with external trail maps.

## Solution

An interactive route planner that combines ShelterDK's shelter data with Denmark's 4,314 official hiking trails from GeoFA.

---

## Page: `/ruteplanner`

### Layout

Full-width page with two panels:

- **Map (70% width on desktop, full width on mobile):** Leaflet map showing all shelter markers. Clicking a shelter adds it as a waypoint. Waypoints are connected with straight lines. Optional toggle to show GeoFA hiking trail polylines as an overlay layer.
- **Sidebar (30% width on desktop, bottom sheet on mobile):** Ordered list of selected shelters (waypoints), total distance, estimated walking time, and action buttons (clear, GPX export, share).

### User Flow

1. User opens `/ruteplanner` — sees map with all shelter markers
2. Clicks a shelter marker → shelter added as waypoint, line drawn from previous waypoint
3. Clicks more shelters → route extends (max 20 waypoints)
4. Optionally toggles "Vis vandreruter" → GeoFA hiking trails appear as colored polylines on the map for reference
5. Can reorder waypoints via up/down buttons in sidebar, or click to remove
6. Clicks "Download GPX" → gets a .gpx file of their planned route
7. Clicks "Del rute" → URL updates with waypoints encoded in query params for sharing

### Map Features

**Shelter markers:**
- Same marker style as existing ShelterMap component
- Clicking adds/removes from route
- Active waypoints get numbered markers (1, 2, 3...) using `L.divIcon` with CSS number overlay
- Desktop: popup on hover showing shelter name, capacity, facilities
- Mobile: tap adds to route, shelter info shown in sidebar/bottom sheet

**Route line:**
- Straight lines between waypoints (no snap-to-roads)
- Dashed line style to indicate "as the crow flies"
- Color: accent color (#C5A059)

**Trail overlay (toggle):**
- GeoFA hiking trails rendered as polylines
- Semi-transparent, distinct color (e.g., green)
- Click a trail → tooltip with trail name and length
- Off by default, toggled via button on map

### Sidebar

```
┌─────────────────────────┐
│  Ruteplanner            │
│                         │
│  1. Shelter Ravnedalen  │  ✕
│     ↕ 12.3 km           │
│  2. Ormstrup shelter    │  ✕
│     ↕ 8.7 km            │
│  3. Tversted shelter    │  ✕
│                         │
│  ─────────────────────  │
│  Total: 21.0 km         │
│  Est. gangtid: ~4.2 t   │
│                         │
│  [Download GPX]         │
│  [Del rute]  [Ryd]      │
└─────────────────────────┘
```

- Distance calculated as haversine between waypoints
- Walking time estimate: 5 km/h
- Up/down arrow buttons to reorder waypoints (simpler than drag-and-drop, no extra dependency)
- Click ✕ to remove a waypoint
- Max 20 waypoints

### Share / URL State

Route state encoded in URL query params:
```
/ruteplanner?w=shelter-slug-1,shelter-slug-2,shelter-slug-3&trails=on
```

- `w` = comma-separated shelter slugs (ordered waypoints)
- `trails` = `on`/`off` for trail overlay visibility
- URL is the single source of truth — no localStorage (avoids sync bugs, users bookmark to save)

### GPX Export

Client-side GPX generation from waypoint coordinates. Outputs both `<wpt>` elements (shelter waypoints — renders as POIs in GPS apps) and a `<trk>` with `<trkseg>` (connecting line):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ShelterDK Ruteplanner">
  <wpt lat="56.178" lon="10.055">
    <name>Shelter Ravnedalen</name>
  </wpt>
  <wpt lat="56.312" lon="10.201">
    <name>Ormstrup shelterplads</name>
  </wpt>
  <trk>
    <name>Min shelter-rute</name>
    <trkseg>
      <trkpt lat="56.178" lon="10.055" />
      <trkpt lat="56.312" lon="10.201" />
    </trkseg>
  </trk>
</gpx>
```

No server round-trip needed — generated in browser via Blob + download.

**Disabled states:** "Download GPX" and "Del rute" buttons are disabled when no waypoints are selected.

---

## Frontend Design

All styling follows the existing ShelterDK design language: DM Sans body text, Playfair Display for headings, primary `#2C3E50`, accent `#C5A059`, background `#F9FAFB`, opacity-based color hierarchy (`primary/80`, `primary/50`, `primary/10`), `rounded-2xl` cards, `shadow-sm` depth, and `transition-all duration-200` on interactives.

### Page Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│  Navbar (existing, sticky)                                       │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │                     │
│                                            │  Ruteplanner        │
│                                            │  ─────────────      │
│                                            │                     │
│           Leaflet Map                      │  Klik på et shelter │
│           (fills remaining height)         │  for at tilføje     │
│                                            │  det til din rute   │
│                                            │                     │
│     [shelter markers]                      │  ── Waypoints ──    │
│     [route polyline]                       │  1. Ravnedalen  ↑↓✕ │
│     [trail overlay when toggled]           │     12.3 km         │
│                                            │  2. Ormstrup    ↑↓✕ │
│                                            │     8.7 km          │
│   ┌───────────────────┐                    │  3. Tversted    ↑↓✕ │
│   │ 🥾 Vis vandreruter│ (floating toggle)  │                     │
│   └───────────────────┘                    │  ─────────────      │
│                                            │  21.0 km · ~4.2 t   │
│                                            │                     │
│                                            │  [Download GPX]     │
│                                            │  [Del rute] [Ryd]   │
├────────────────────────────────────────────┴─────────────────────┤
```

- Map and sidebar split: `flex` container, map `flex-1`, sidebar `w-[340px]`
- Full viewport height below navbar: `h-[calc(100vh-4rem)]`
- Sidebar has `border-l border-primary/10` separator
- No page padding — edge-to-edge for maximum map space

### Page Layout (Mobile)

```
┌──────────────────────┐
│  Navbar (existing)    │
├──────────────────────┤
│                      │
│                      │
│    Leaflet Map       │
│    (full width,      │
│     ~60vh)           │
│                      │
│  [🥾 Vis ruter]      │  ← floating bottom-left
│                      │
├──────────────────────┤
│ ═══ (drag handle) ══│  ← bottom sheet
│                      │
│ Ruteplanner          │
│ 1. Ravnedalen    ✕  │
│    12.3 km           │
│ 2. Ormstrup      ✕  │
│                      │
│ 21.0 km · ~4.2 t    │
│ [Download GPX] [Del] │
└──────────────────────┘
```

- Bottom sheet: `fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg`
- Collapsed state shows summary only: "3 shelters · 21.0 km"
- Drag handle: `w-10 h-1 rounded-full bg-primary/20 mx-auto mt-2`
- Expanded via tap on handle or summary bar
- Map height: `h-[60vh]` (collapsed sheet) / `h-[40vh]` (expanded sheet)

### Sidebar Design

**Container:**
```
bg-white
p-5
overflow-y-auto
```

**Header:**
```
font-serif text-xl font-semibold text-primary mb-1
```
Text: "Ruteplanner"

**Empty state** (no waypoints selected):
```
┌─────────────────────────┐
│                         │
│      (map pin icon)     │  ← MapPin icon, text-primary/20, size 48
│                         │
│  Klik på et shelter     │  ← text-sm text-primary/50 text-center
│  på kortet for at       │
│  starte din rute        │
│                         │
└─────────────────────────┘
```
- Icon: Lucide `MapPin`, `size={48}`, `className="text-primary/20 mx-auto mb-3"`
- Text: `text-sm text-primary/50 text-center max-w-[200px] mx-auto`

**Waypoint list item:**
```
┌─────────────────────────────────────────┐
│  ① Shelter Ravnedalen              ↑↓✕ │
│     🏕 4 pl. · 💧 · 🚻                  │
└─────────────────────────────────────────┘
     ┊ 12.3 km (dashed connector)
```

- Container: `flex items-start gap-3 py-3 border-b border-primary/5`
- Number badge: `w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0`
- Shelter name: `text-sm font-medium text-primary truncate`
- Facility icons: `text-xs text-primary/40 flex items-center gap-2 mt-0.5`
- Reorder buttons: `p-1 rounded hover:bg-primary/5 text-primary/30 hover:text-primary/60 transition-colors`
  - Lucide `ChevronUp` / `ChevronDown`, size 14
  - First waypoint: up button disabled (`opacity-30 pointer-events-none`)
  - Last waypoint: down button disabled
- Remove button: `p-1 rounded hover:bg-red-50 text-primary/30 hover:text-red-400 transition-colors`
  - Lucide `X`, size 14
- Distance connector between items: `text-xs text-primary/40 pl-9 py-1` with dashed left border `border-l border-dashed border-primary/15 ml-3`

**Summary bar:**
```
┌─────────────────────────────────────────┐
│  21.0 km    ·    ~4.2 timer             │
└─────────────────────────────────────────┘
```
- Container: `mt-4 pt-4 border-t border-primary/10`
- Distance: `text-lg font-semibold text-primary`
- Time: `text-sm text-primary/50`
- Separator dot: `text-primary/30 mx-2`
- Walking icon: Lucide `Footprints`, size 16, `text-primary/40`

**Action buttons:**
```
┌─────────────────────────────────────────┐
│  [  ↓  Download GPX                   ] │  ← primary button
│  [Del rute]              [Ryd]          │  ← secondary buttons
└─────────────────────────────────────────┘
```

- Primary (Download GPX):
  `w-full py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2`
  - Lucide `Download` icon, size 16
  - Disabled state: `opacity-40 pointer-events-none`

- Secondary (Del rute):
  `flex-1 py-2 rounded-xl border border-primary/15 text-primary/70 text-sm font-medium hover:border-primary/30 hover:text-primary transition-all`
  - Lucide `Share2` icon, size 14
  - On click: copies URL to clipboard, button text briefly changes to "Kopieret!" with a checkmark

- Destructive (Ryd):
  `py-2 px-4 rounded-xl text-sm text-primary/40 hover:text-red-500 hover:bg-red-50 transition-colors`
  - Lucide `Trash2` icon, size 14

- Button row: `flex gap-2 mt-3`

### Map Markers

**Default shelter marker** (not in route):
- Standard Leaflet marker (same blue pin as existing)
- Opacity: `0.7` to visually recede

**Active waypoint marker** (in route):
- `L.divIcon` with numbered circle:
```css
.waypoint-marker {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #C5A059;
  color: white;
  font-family: var(--font-dm-sans);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2.5px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
```
- Size matches the visual weight of default Leaflet markers
- White border creates separation from map
- Drop shadow for depth

**Route polyline:**
```typescript
{
  color: '#C5A059',
  weight: 3,
  opacity: 0.8,
  dashArray: '8, 6',
  lineCap: 'round',
}
```
- Dashed to communicate "approximate path, not exact trail"
- Accent gold matches the numbered markers

### Trail Overlay

**Toggle button** (floating on map, bottom-left):
```
rounded-xl bg-white shadow-md border border-primary/10
px-3 py-2 text-sm font-medium text-primary/70
hover:border-primary/20 hover:text-primary
transition-all
```
- Active state: `bg-primary text-white border-primary`
- Icon: Lucide `Route`, size 16
- Text: "Vis vandreruter"
- Position: `absolute bottom-4 left-4 z-[1000]`

**Trail polylines:**
```typescript
{
  color: '#2d6a4f',    // forest green
  weight: 2.5,
  opacity: 0.45,
  lineCap: 'round',
  lineJoin: 'round',
}
```
- Semi-transparent so shelters and route remain visually dominant
- On hover: `opacity: 0.85, weight: 3.5` with transition

**Trail tooltip** (on hover):
```
┌─────────────────────────┐
│  MARSKSTIEN             │  ← font-medium text-sm
│  54 km vandrerute       │  ← text-xs text-primary/60
└─────────────────────────┘
```
- Leaflet tooltip: `className: 'trail-tooltip'`
- Custom CSS: `bg-white rounded-lg shadow-md border border-primary/10 px-3 py-2`
- No arrow/pointer — clean floating card

### Toast Notifications

For "Kopieret!", max waypoints warning, and trail load error:

```
fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000]
bg-primary text-white text-sm font-medium
px-4 py-2.5 rounded-xl shadow-lg
animate-fade-in-up
```
- Auto-dismiss after 2.5 seconds
- Animation: existing `fadeInUp` keyframe + fade out

### Empty Route State on Map

When no waypoints are selected, show a subtle hint overlay at the top of the map:

```
absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
bg-white/90 backdrop-blur-sm rounded-full shadow-sm
px-4 py-2 text-sm text-primary/60
border border-primary/5
```
Text: "Klik på et shelter for at starte din rute"
- Fades out (`opacity-0 transition-opacity duration-500`) after first waypoint is added

### Color Reference

| Element | Color | Tailwind |
|---------|-------|----------|
| Waypoint marker fill | `#C5A059` | `bg-accent` |
| Route polyline | `#C5A059` | — (Leaflet option) |
| Trail overlay | `#2d6a4f` | — (Leaflet option) |
| Default marker opacity | `0.7` | — (Leaflet option) |
| Sidebar background | `#FFFFFF` | `bg-white` |
| Sidebar border | `#2C3E50/10` | `border-primary/10` |
| Number badge text | `#FFFFFF` | `text-white` |
| Distance text | `#2C3E50/40` | `text-primary/40` |
| Summary distance | `#2C3E50` | `text-primary` |
| Primary button | `#C5A059` | `bg-accent` |
| Destructive hover | `#EF4444` | `text-red-500` |

---

## Data: GeoFA Trail Import

### Source

GeoFA SQL API — 4,314 hiking routes (rute_ty_k=5), freely available, no auth.

```
GET https://geofa.geodanmark.dk/api/v2/sql/fkg?format=geojson&srs=4326&q=select objekt_id, navn, beskrivels, geometri from fkg.t_5802_fac_li WHERE rute_ty_k=5
```

### Storage

Trails are stored client-side only — no new database table. The import script fetches all trails from GeoFA and generates a static JSON file at build time:

**`/public/data/trails.json`** (~2-5 MB estimated)

```json
[
  {
    "id": "f1fe1cb8-...",
    "name": "MARSKSTIEN",
    "description": "54 km vandrerute rundt i...",
    "geometry": { "type": "MultiLineString", "coordinates": [...] }
  }
]
```

**Why static JSON instead of database:**
- Trails are reference data, not user data — no CRUD needed
- Avoids Supabase query overhead for 4,314 geometries
- Leaflet renders GeoJSON natively
- Easy to update: re-run import script, rebuild

**Lazy loading:** The 2-5 MB file is only fetched when the user toggles "Vis vandreruter" — not on initial page load.

### Import Script

`/scripts/import-geofa-trails.ts`

1. Fetch all hiking routes from GeoFA SQL API as GeoJSON
2. Filter out routes with empty/whitespace names
3. Trim whitespace from all text fields
4. Write to `/public/data/trails.json`
5. Run as part of build or manually: `npx tsx scripts/import-geofa-trails.ts`

---

## Technical Implementation

### Shelter Data Loading

The page server component fetches a minimal projection of all active shelters (slug, title, location, capacity, key facilities) in a single Supabase query. This is ~1,600 rows with minimal columns — small enough for a single fetch.

```typescript
// page.tsx (server component)
const { data: shelters } = await supabase
  .from("shelters")
  .select("id, slug, title, location, capacity, water, toilet, image_url")
  .is("duplicate_of_shelter_id", null)
  .not("location", "is", null);
```

Passed to `RoutePlannerClient` as a prop. This also handles shared URL resolution — when `?w=slug1,slug2` is in the URL, the client matches slugs against the already-loaded shelter array.

**Error handling for shared URLs:** Invalid/deleted shelter slugs in the `w` param are silently ignored. If all slugs are invalid, the page shows an empty route with all markers visible.

### Map Component Strategy

Create a new `RoutePlannerMap` component rather than modifying the existing `ShelterMap`. The existing component is tightly coupled to the search page's popup-and-link interaction model. The route planner needs click-to-add-waypoint behavior, numbered markers, and route polylines.

Shared logic extracted where practical:
- Tile layer config (OpenStreetMap)
- Marker icon setup
- Denmark bounds/zoom defaults
- Coordinate parsing (`getLocationCoords`)

### New Files

| File | Purpose |
|------|---------|
| `app/(site)/ruteplanner/page.tsx` | Server component — metadata, layout |
| `components/RoutePlannerClient.tsx` | Client component — map + sidebar |
| `components/RoutePlannerMap.tsx` | Leaflet map with click-to-add, route line, trail overlay |
| `components/RoutePlannerSidebar.tsx` | Waypoint list, distance, actions |
| `lib/gpx-export.ts` | GPX string generation from waypoints |
| `lib/haversine.ts` | Distance calculation between coordinates |
| `scripts/import-geofa-trails.ts` | GeoFA → trails.json build script |
| `public/data/trails.json` | Static trail data (generated) |

### Existing Files Modified

| File | Change |
|------|--------|
| `components/Header.tsx` or equivalent | Add "Ruteplanner" nav link |
| `app/sitemap.ts` | Add `/ruteplanner` entry |

### Dependencies

No new npm packages needed:
- Leaflet already installed — supports GeoJSON layers natively
- GPX export is simple XML string building
- Haversine formula is ~10 lines of code

### Component Architecture

```
page.tsx (RSC — fetches all shelters, metadata)
  └── <Suspense>
        └── RoutePlannerClient.tsx ("use client", receives shelters as prop)
              ├── RoutePlannerMap.tsx (new Leaflet map, dynamic import)
              │   ├── Shelter markers (click to add/remove waypoint)
              │   ├── Numbered waypoint markers (L.divIcon)
              │   ├── Route polyline (dashed, accent color)
              │   └── Trail GeoJSON layer (toggled, lazy-loaded)
              └── RoutePlannerSidebar.tsx
                  ├── Waypoint list (up/down buttons to reorder)
                  ├── Distance + time summary
                  └── Action buttons (GPX, share, clear)
```

### State Management

All state in RoutePlannerClient via useState:

```typescript
const [waypoints, setWaypoints] = useState<Shelter[]>([]);
const [showTrails, setShowTrails] = useState(false);
const [trailData, setTrailData] = useState<Trail[] | null>(null);
```

- `waypoints`: ordered array of selected shelters
- `showTrails`: whether GeoFA overlay is visible
- `trailData`: lazily loaded from `/data/trails.json` on first toggle

URL sync via `useSearchParams` + `router.replace` on waypoint change. Page wrapped in `<Suspense>` as required by Next.js 14 App Router for `useSearchParams`.

### Performance Considerations

- **Initial load:** Only shelter markers load (same as existing map). No trail data fetched.
- **Trail toggle:** Fetches `trails.json` once, cached by browser. Leaflet renders GeoJSON efficiently with canvas renderer for thousands of polylines.
- **If trails.json is too large (>5 MB):** First try coordinate simplification (reduce precision to 5 decimal places, ~1m accuracy). If still too large, split into regional files and load based on map viewport. Measure actual size after first import before deciding.

### Mobile UX

- Map takes full width
- Sidebar becomes a bottom sheet (collapsible)
- Waypoint list scrollable within bottom sheet
- "Vis vandreruter" toggle accessible via floating button on map
- GPX download works on mobile (triggers file save dialog)

---

## SEO

Minimal SEO scope — this is a tool page, not a content page:

- Static metadata: "Ruteplanner - Planlæg din shelter-vandring | ShelterDK"
- Description: "Planlæg din vandrerute mellem shelters i Danmark. Se vandreruter, beregn afstande og download GPX."
- Added to sitemap with priority 0.5
- No structured data needed

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Shared URL with invalid shelter slugs | Silently ignored; valid slugs still load |
| All slugs in shared URL invalid | Empty route shown, all markers visible |
| trails.json fetch fails | "Vis vandreruter" toggle shows error toast, map continues working |
| No waypoints selected | "Download GPX" and "Del rute" buttons disabled |
| Max waypoints (20) reached | Clicking additional shelters shows brief toast "Maks 20 shelters per rute" |

## Out of Scope

- Snap-to-roads/trails routing (requires routing engine)
- User accounts or saved routes (beyond URL sharing)
- Turn-by-turn directions
- Elevation profiles
- Route suggestions / AI recommendations
- Undo/redo for waypoint changes
- Changes to existing page features (shelter detail, search, region pages)
- Trail detail pages or trail SEO pages
- Drag-to-reorder (use up/down buttons instead — no extra dependency)

---

## Open Questions

1. **trails.json file size** — Need to fetch actual GeoFA data to measure. First import will determine if simplification or splitting is needed.
2. **Nav placement** — Where in the header navigation should "Ruteplanner" appear? Current nav has ~9 links.
