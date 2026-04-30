# Mobile Search Page UX Redesign

**Date:** 2026-04-04
**Scope:** Mobile only (< md / 768px). Desktop unchanged.
**Goal:** Make the search page more compact on mobile — show shelter results higher up, reduce filter/map overhead, keep split view but more efficient.

## Problem

The current `/soeg` page on mobile requires ~630px of scrolling before the first shelter card is visible. The region dropdown, search input, 12 wrapping filter chips, view-toggle buttons, and a 320px map all stack vertically above the results. Users who don't know a specific location have no inspiration and are overwhelmed by UI controls before seeing any content.

## Design

### Overview of changes

All changes are mobile-only (< md breakpoint). Desktop layout stays identical.

| Area | Before (mobile) | After (mobile) | Savings |
|------|-----------------|----------------|---------|
| Breadcrumbs/nav links | ~40px | Hidden on mobile | 40px |
| H1 + subtitle/area description | ~80px | Compact: smaller font, tighter margins | ~30px |
| Search + region | ~100px (stacked) | ~48px (inline) | 52px |
| Filter chips | ~120px (wrapping) | ~40px (horizontal scroll) | 80px |
| View-toggle | ~48px (separate row) | 0px (floating on map) | 48px |
| Map (split view) | 320px (above list) | 160px (below list) | 160px + reordered |
| **Total before results** | **~708px** | **~298px** | **~410px saved** |

### Section 1: Search + region (mobile only)

- **Region dropdown + search input on one line** — region as compact dropdown (~110px width), search field takes remaining space
- Combined height: ~48px (down from ~100px stacked)
- **Breadcrumb/nav links hidden on mobile** (`hidden md:block`) — "← Til forsiden | Udforsk efter område" is rarely used and costs 40px
- **H1 "Søg shelters" compacted on mobile** — smaller font (`text-2xl` instead of `text-3xl`), tighter bottom margin (`mb-2 md:mb-4`). Area description (when present) gets `text-sm` and `mb-2 md:mb-4`.
- Desktop: unchanged — keeps stacked region dropdown + search input

### Section 2: Filter chips (mobile only)

- **Horizontal scroll, single row** — all 12 filter chips in one scrollable row, no wrapping
- Uses `overflow-x: auto` + `scrollbar-hide` + `flex-nowrap` (same pattern as homepage pills)
- **Chip order** (approximate, based on common shelter search patterns — not analytics-derived): Toilet, Bål, Bookbar, Gratis, Vand, Hund, Strand, Bruser, Handicap, Bord/bænke, Med billede, Anmeldelser. Can be adjusted later based on actual usage data.
- **Min. pladser input removed on mobile** — niche feature that takes disproportionate space. Hidden with `hidden md:block`.
- **View-toggle removed from filter area** — moved to floating overlay on the map (Section 3)
- Combined height: ~40px (one row, down from ~120px wrapping)
- Desktop: unchanged — keeps wrapping layout with view-toggle and min. pladser

### Section 3: Map in split view (mobile only)

- **Map height reduced to 160px** (down from 320px)
- **Map moves below the list** — list renders first (order-1), map below (order-2). Reversed from current (map order-1, list order-2).
- **Floating view-toggle** — 3 small buttons (list/split/map) positioned bottom-right of the map with white background + shadow. Same icons as current toggle, just repositioned.
- **List-only mode:** When user selects "list" view, the map is hidden entirely. The view-toggle moves to a fixed-position floating button at bottom-right of the screen, so the user can always switch back to split or map mode.
- When user selects "Map" view mode, map expands to full height (500px) as currently.
- **Testing note:** After swapping mobile order classes (list order-1, map order-2), verify that the desktop `lg:sticky` behavior on the map still works correctly. Order + sticky in grid contexts can interact unexpectedly.
- Desktop: unchanged — keeps side-by-side sticky map layout

### Section 4: Results list (mobile only)

- **No changes** to shelter cards, grid layout, tæller/sortering, or infinite scroll
- Cards are simply visible ~380px higher than before due to the space savings above

### Removed/hidden on mobile

- Breadcrumb/nav links ("← Til forsiden | Udforsk efter område") — `hidden md:block`
- Min. pladser input — `hidden md:flex` (or similar)
- View-toggle in filter area — replaced by floating overlay on map

### Unchanged

- Desktop layout (all sections)
- Shelter card design
- Search autocomplete behavior
- Infinite scroll / pagination
- Sort dropdown
- Area-specific pages (FAQ, embed code, descriptions)

## Technical approach

### Files to modify

- `web/components/SearchBar.tsx` — Mobile: inline region+search, horizontal scroll chips, hide view-toggle and min. pladser
- `web/components/SoegContent.tsx` — Mobile: reduce map height to 160px, reorder list above map, add floating view-toggle
- `web/app/(site)/soeg/page.tsx` — Hide breadcrumbs on mobile

### Implementation strategy

- All changes use Tailwind responsive prefixes (`md:` breakpoint)
- No new components needed — modifications to existing files
- No new API endpoints or database changes
- Filter chip order change is just array reordering in the existing chip definitions
- Floating view-toggle uses `absolute` positioning within the map container
