# Mobile Homepage UX Redesign

**Date:** 2026-04-04
**Scope:** Mobile only (< md / 768px). Desktop unchanged.
**Goal:** Make shelter discovery easier for users who don't know a specific location. Reduce hero size, show shelters immediately, provide quick-action entry points.

## Problem

The current homepage hero fills the full mobile screen (~320px) with text and a region dropdown + city search. Users must know _where_ they want to go before they can discover shelters. This doesn't match the shelter use case — unlike hotels, people browse for inspiration rather than searching for a specific destination.

## Design

### New mobile section order

| # | Section | Height (mobile) | Purpose |
|---|---------|-----------------|---------|
| 1 | Compact hero + search | ~140px | Branding + primary search |
| 2 | Quick-action pills | ~48px | GPS + top facility filters |
| 3 | Popular shelters carousel | ~200px | Visual browsing with images + ratings |
| 4 | Explore by region | ~180px | 2x2 grid (Jylland, Sjælland, Fyn, Bornholm) |
| 5 | Interactive map | ~300px | Existing map, moved down |
| 6 | Plan your trip | existing | Ruter + turvenner, kept as-is |
| 7 | Newsletter signup | existing | Kept as-is |
| 8 | Instagram feed | ~120px | Social proof (existing widget) |

### Section 1: Compact hero + search (mobile only)

- **Height:** ~140px (down from 320px)
- **Background:** Solid CSS gradient (`#2c3e2d` → `#1a2b1a`), no background image on mobile (faster load)
- **Content:**
  - H1: "Find dit næste shelter" (short, direct)
  - Single search field with placeholder "Søg by, område eller shelter..."
  - Region dropdown removed from hero on mobile
- **Search behavior:** On mobile, the hero search field is a `<Link href="/soeg">` styled to look like an input field. This avoids loading the full client-side SearchBar JS (autocomplete, suggestions, filters) on the mobile homepage. Simpler and better for performance than adding a new mode to the SearchBar component.
- **Desktop:** Unchanged — keeps existing large hero with region dropdown and full SearchBar component.

### Section 2: Quick-action pills

Horizontally scrollable row of 5 pills directly below hero:

| Pill | Icon (Lucide) | Action | Style |
|------|---------------|--------|-------|
| Nær mig | `MapPin` | `/shelter-naer-mig` | Green accent background |
| Bookbar | `CheckCircle` | `/soeg?bookbar=1` | Neutral |
| Med bål | `Flame` | `/shelter-med-baalplads` | Neutral |
| Gratis | `Gift` | `/soeg?gratis=1` | Neutral |
| Med toilet | `Bath` | `/shelter-med-toilet` | Neutral |

- Uses Lucide React icons (consistent with rest of codebase), not emoji
- Pills with dedicated SEO pages link to those pages (`/shelter-med-toilet`, `/shelter-med-baalplads`) rather than search query params

- Replaces the current 6 quick-links on mobile (Bookbare, Med toilet, Med vand, Hundevenlige, Med bålplads, Guides)
- Horizontally scrollable to avoid line wrapping
- Desktop: unchanged, shows existing 6 pills

### Section 3: Popular shelters carousel

Horizontally scrollable shelter cards replacing the existing 2-4 column grid on mobile:

- **Card design:**
  - Image: ~200x140px, rounded corners, lazy-loaded
  - Rating badge: overlay at bottom of image (e.g., "⭐ 4.8")
  - Below image: shelter name (bold), location + facility tags (one line, gray text)
  - Tap → navigates to shelter detail page
- **Data source:** Existing `FEATURED_SHELTER_SLUGS` array (8 shelters), filtered to only show shelters with images
- **Desktop:** Unchanged, keeps existing 4-column grid layout

### Section 4: Explore by region

2x2 grid replacing the current 3 large region cards + 6 popular area cards:

| | Col 1 | Col 2 |
|---|-------|-------|
| Row 1 | Jylland (count) | Sjælland (count) |
| Row 2 | Fyn (count) | Bornholm (count) |

- Each cell: solid gradient background, region name + shelter count
- Tap → `/danmark/{region}`
- ~180px total height
- **Shelter counts:** Hardcoded approximate values (updated periodically). No new DB query needed — avoids adding API complexity for numbers that change rarely.
- **Bornholm:** Must be added to the regions array in `page.tsx` (currently only Jylland, Sjælland, Fyn). Link to `/danmark/bornholm` (consistent with other regions). Bornholm entry in `POPULAR_AREAS` can stay — it's hidden on mobile anyway (`hidden md:block`).
- Desktop: unchanged, keeps existing region cards

### Removed/downsized on mobile

- **Hero background image** → replaced by CSS gradient (faster load)
- **Hero subtitle** about Geodatastyrelsen/Naturstyrelsen → removed from mobile hero
- **"Populære områder" 6-grid** → hidden on mobile (`hidden md:block`), replaced by 2x2 region grid above
- **Region dropdown in hero** → moved to search page only

### Unchanged sections

These sections are kept as-is on both mobile and desktop:
- Interactive map (moved below region grid on mobile)
- Instagram feed widget
- Newsletter signup
- "Planlæg din sheltertur" (ruter + turvenner)

## Technical approach

### Files to modify

- `web/app/(site)/page.tsx` — Main changes: restructure mobile layout with responsive classes
- `web/components/SearchBar.tsx` — No changes needed; mobile hero uses a styled `<Link>` instead
- `web/components/FrontPageShelterGrid.tsx` — Add horizontal carousel variant for mobile

### Implementation strategy

- All changes use Tailwind responsive prefixes (`md:` breakpoint)
- Mobile gets new layout; desktop renders identically to current
- No new API endpoints needed — all data sources already exist
- No new database tables or queries
- Carousel uses CSS `overflow-x: auto` with `scroll-snap-type` (no JS library)
- Carousel cards: fixed width ~200px with 10px gap, partial card visible on right edge to hint scrollability
- Section reordering on mobile: use responsive `hidden`/`block` classes to show/hide mobile vs desktop variants, rather than CSS `order` (avoids accessibility issues with reading order)

## Success metrics

Track before/after (2-4 weeks):
- Scroll depth on homepage (mobile)
- Click-through rate to shelter detail pages from homepage
- Usage of "Nær mig" button
- Time to first shelter card tap
