# Mobile Search Page UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce above-the-fold scroll distance on mobile `/soeg` from ~708px to ~298px by compacting search controls, using horizontal-scroll filter chips, and repositioning the map below the results list.

**Architecture:** All changes use Tailwind responsive prefixes (`md:` breakpoint) so mobile gets the new compact layout while desktop stays identical. Three existing files are modified — no new components or API changes needed.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, React client components, Lucide icons

---

## File Structure

| File | Responsibility | Changes |
|------|---------------|---------|
| `web/app/(site)/soeg/page.tsx` | Server component: metadata, data fetching, page shell | Hide breadcrumbs on mobile, compact H1 + area description |
| `web/components/SearchBar.tsx` | Client component: region dropdown, search input, filter chips, view-toggle | Mobile: inline region+search, horizontal scroll chips, hide view-toggle + min. pladser |
| `web/components/SoegContent.tsx` | Client component: split/list/map views, map, shelter cards | Mobile split view: 160px map below list, floating view-toggle, fixed-position toggle in list-only mode |

---

## Task 1: Hide breadcrumbs and compact H1 on mobile (`soeg/page.tsx`)

**Files:**
- Modify: `web/app/(site)/soeg/page.tsx:145-193`

- [ ] **Step 1: Hide breadcrumb nav on mobile**

In `soeg/page.tsx`, the `<nav>` element at line 145 contains breadcrumb links ("← Til forsiden | Udforsk efter område"). Add `hidden md:flex` to hide it on mobile:

```tsx
<nav className="hidden md:flex mb-8 flex-wrap items-center gap-3">
```

This saves ~40px on mobile. Desktop unchanged.

- [ ] **Step 2: Compact H1 on mobile**

The `<h1>` at line 161 currently uses `text-3xl`. Change to use smaller font and tighter margin on mobile:

```tsx
<h1 className="font-serif text-2xl md:text-3xl font-bold text-primary mb-1 md:mb-2">
```

- [ ] **Step 3: Compact area description on mobile**

For the area description section (line 167), add mobile-specific text size and margin:

```tsx
<section className="mb-4 md:mb-8" aria-label="Om området">
  {areaInfo.description ? (
    <p className="text-primary/90 text-sm md:text-lg leading-relaxed max-w-3xl">
      {areaInfo.description}
    </p>
  ) : (
    <p className="text-primary/80 max-w-3xl text-sm md:text-base">
```

For the non-area subtitle (line 185), same treatment:

```tsx
<p className="text-primary/80 mb-4 md:mb-8 text-sm md:text-base">
```

- [ ] **Step 4: Verify desktop is unchanged**

Run: `cd /Users/CKA/shelterdk && npm run build`
Expected: Build succeeds with no errors.

Visual verification: Open `/soeg` on desktop — breadcrumbs visible, H1 is `text-3xl`, area description is `text-lg`, margins are full size. On mobile viewport — breadcrumbs hidden, H1 is `text-2xl`, text is `text-sm`, margins tighter.

- [ ] **Step 5: Commit**

```bash
cd /Users/CKA/shelterdk
git add web/app/\(site\)/soeg/page.tsx
git commit -m "feat(soeg): hide breadcrumbs and compact H1/description on mobile"
```

---

## Task 2: Inline region + search and horizontal scroll chips (`SearchBar.tsx`)

**Files:**
- Modify: `web/components/SearchBar.tsx:218-452`

This is the largest task. It changes the search form layout and filter chips for mobile only.

- [ ] **Step 1: Make region + search inline on mobile**

The form container (line 223) currently uses `flex-col sm:flex-row`. The inner wrapper for region+search (line 228) uses `flex-col sm:flex-row`. Change the **inner wrapper** so region and search sit side-by-side on mobile too:

Replace line 228-229:
```tsx
<div className="flex flex-col sm:flex-row flex-1 min-w-0 gap-2 sm:gap-0 sm:border-r border-primary/10">
<div className="relative flex-shrink-0 sm:border-r-0">
```

With:
```tsx
<div className="flex flex-row flex-1 min-w-0 gap-0 border-r border-primary/10">
<div className="relative flex-shrink-0">
```

Then update the region `<select>` (line 230-236) to be compact on mobile:

Replace:
```tsx
className="w-full sm:w-auto min-w-0 sm:min-w-[160px] appearance-none bg-accent/15 text-primary font-medium py-3.5 pl-4 pr-10 text-base sm:text-sm rounded-xl sm:rounded-l-xl sm:rounded-r-none focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer touch-manipulation"
```

With:
```tsx
className="w-[110px] md:w-auto md:min-w-[160px] appearance-none bg-accent/15 text-primary font-medium py-3 md:py-3.5 pl-3 md:pl-4 pr-8 md:pr-10 text-sm rounded-l-xl rounded-r-none focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer touch-manipulation"
```

And the ChevronDown icon (line 243-244):
```tsx
className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-primary/70 pointer-events-none"
```

And the search input (line 282):
```tsx
className="w-full py-3 md:py-3.5 pl-3 md:pl-4 pr-9 text-primary placeholder:text-primary/50 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm touch-manipulation"
```

- [ ] **Step 2: Hide view-toggle on mobile**

The view-toggle section (lines 340-387) should be hidden on mobile. It will be replaced by a floating toggle in SoegContent. Add `hidden md:flex` to the outer wrapper:

Replace line 341:
```tsx
<div className="flex items-stretch border-t sm:border-t-0 border-primary/10 pt-2 sm:pt-0 sm:border-l flex-shrink-0">
```

With:
```tsx
<div className="hidden md:flex items-stretch border-primary/10 border-l flex-shrink-0">
```

- [ ] **Step 3: Make filter chips horizontal scroll on mobile**

The filter chips wrapper (line 393) currently uses `flex-wrap`. Change to horizontal scroll on mobile, wrap on desktop:

Replace line 393:
```tsx
<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer efter faciliteter">
```

With:
```tsx
<div className="flex md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide flex-nowrap" role="group" aria-label="Filtrer efter faciliteter">
```

Add `shrink-0` to each chip button to prevent them from shrinking in the scroll container. In the button className (line 401), add `shrink-0`:

Replace:
```tsx
className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium whitespace-nowrap transition-all duration-200 touch-manipulation border ${
```

With:
```tsx
className={`flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 touch-manipulation border ${
```

- [ ] **Step 4: Hide min. pladser input on mobile**

The min. pladser input (lines 413-434) should be hidden on mobile. Wrap it with `hidden md:flex`:

Replace line 414:
```tsx
<div className="flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full border border-primary/15 bg-white text-[13px] sm:text-sm">
```

With:
```tsx
<div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/15 bg-white text-sm">
```

- [ ] **Step 5: Reorder filter chips for mobile relevance**

Reorder the `FILTER_OPTIONS` array (lines 36-53) to prioritize commonly-used filters. New order:

```tsx
const FILTER_OPTIONS: {
  key: keyof SoegFilters;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "toilet", label: "Toilet", icon: <Droplets size={15} /> },
  { key: "baalplads", label: "Bålplads", icon: <Flame size={15} /> },
  { key: "bookbar", label: "Bookbar", icon: <CheckCircle size={15} /> },
  { key: "gratis", label: "Gratis", icon: <Gift size={15} /> },
  { key: "vand", label: "Vand", icon: <Droplets size={15} /> },
  { key: "hund", label: "Hund tilladt", icon: <Dog size={15} /> },
  { key: "strand", label: "Strand", icon: <Umbrella size={15} /> },
  { key: "bruser", label: "Bruser/bad", icon: <ShowerHead size={15} /> },
  { key: "handicap", label: "Handicapegnet", icon: <Accessibility size={15} /> },
  { key: "bord_baenk", label: "Bord/bænke", icon: <Armchair size={15} /> },
  { key: "billede", label: "Med billede", icon: <ImageIcon size={15} /> },
  { key: "anmeldelser", label: "Anmeldelser", icon: <Star size={15} /> },
];
```

- [ ] **Step 6: Add shrink-0 to clear-filters button**

The "Ryd filtre" button (line 438) also needs `shrink-0` to not collapse in horizontal scroll:

Replace:
```tsx
className="flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium text-primary/50 hover:text-primary hover:bg-primary/5 whitespace-nowrap transition-colors touch-manipulation"
```

With:
```tsx
className="flex items-center gap-1 px-3 py-1.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium text-primary/50 hover:text-primary hover:bg-primary/5 whitespace-nowrap shrink-0 transition-colors touch-manipulation"
```

- [ ] **Step 7: Verify build and visual**

Run: `cd /Users/CKA/shelterdk && npm run build`
Expected: Build succeeds.

Visual verification: On mobile — region+search on one line (~48px), chips scroll horizontally in single row, no view-toggle, no min. pladser. On desktop — everything unchanged (stacked, wrapping chips, view-toggle visible, min. pladser visible).

- [ ] **Step 8: Commit**

```bash
cd /Users/CKA/shelterdk
git add web/components/SearchBar.tsx
git commit -m "feat(soeg): inline search+region, horizontal scroll chips, hide view-toggle on mobile"
```

---

## Task 3: Compact map, reorder list above map, floating view-toggle (`SoegContent.tsx`)

**Files:**
- Modify: `web/components/SoegContent.tsx:280-403`

- [ ] **Step 1: Reduce map height and reorder on mobile (split view)**

In the split view grid (line 307), the map container (line 344) currently has `h-[320px]` on mobile. The list has `order-2 lg:order-1` and map has `order-1 lg:order-2`.

Replace the map container (line 344):
```tsx
<div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[320px] sm:h-[400px] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-4 lg:mb-0 flex flex-col">
```

With:
```tsx
<div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 h-[160px] sm:h-[200px] lg:min-h-[420px] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-2 lg:order-2 mt-4 lg:mt-0 flex flex-col relative">
```

Key changes:
- `h-[160px]` (down from `h-[320px]`) on mobile
- `order-2` (was `order-1`) — map now below list on mobile
- `mt-4` instead of `mb-4` — spacing adjusts for new position
- Added `relative` for floating toggle positioning
- Removed mobile `min-h-*` values (not needed at 160px fixed height)

And the list container (line 308):
```tsx
<div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1">
```

With:
```tsx
<div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-1 lg:order-1">
```

Key change: `order-1` (was `order-2`) — list now above map on mobile.

- [ ] **Step 2: Add floating view-toggle on the map**

Add a floating view-toggle overlay inside the map container, right after the `<ShelterMap>` component (after line 351). This sits inside the map `<div>` that already has `relative`:

```tsx
{/* Floating view-toggle (mobile only) */}
<div className="absolute bottom-2 right-2 flex gap-1 bg-white/95 rounded-lg shadow-md border border-primary/10 p-1 md:hidden z-10">
  <button
    type="button"
    onClick={handleViewList}
    className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun liste"
  >
    <List className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewSplit}
    className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Liste og kort"
  >
    <LayoutGrid className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewMap}
    className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun kort"
  >
    <MapPin className="w-4 h-4" />
  </button>
</div>
```

This requires importing `List`, `LayoutGrid`, and `MapPin` from lucide-react. Add to `SoegContent.tsx` imports (around line 1-2):

```tsx
import { List, LayoutGrid, MapPin } from "lucide-react";
```

The `handleViewList`, `handleViewSplit`, `handleViewMap` functions don't exist in SoegContent — the view-toggle currently lives in SearchBar which uses `router.push`. In SoegContent, we need to call `handleViewChange` (which maps to `setView`) AND update the URL. We need to add a router reference and helper functions.

Add to imports at line 3:
```tsx
import { useSearchParams, useRouter } from "next/navigation";
```

(Note: `useSearchParams` is already imported. Just add `useRouter`.)

Add router ref and URL-aware view change handlers inside the component, after the existing `handleViewChange` (line 210-212):

```tsx
const router = useRouter();

const buildViewUrl = useCallback((newView: ViewMode) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", newView);
  return "/soeg?" + params.toString();
}, [searchParams]);

const handleViewList = useCallback(() => {
  setView("list");
  router.push(buildViewUrl("list"), { scroll: false });
}, [buildViewUrl, router]);

const handleViewSplit = useCallback(() => {
  setView("split");
  router.push(buildViewUrl("split"), { scroll: false });
}, [buildViewUrl, router]);

const handleViewMap = useCallback(() => {
  setView("map");
  router.push(buildViewUrl("map"), { scroll: false });
}, [buildViewUrl, router]);
```

- [ ] **Step 3: Add floating view-toggle for list-only mode**

When the user is in list-only mode (no map visible), the floating toggle needs to appear as a fixed-position button at the bottom-right of the screen so they can switch back.

In the list-only view section (lines 370-401), add a floating toggle after the sentinel div (after line 400, before the closing `</>`):

```tsx
{/* Fixed floating view-toggle (mobile, list-only mode) */}
<div className="fixed bottom-4 right-4 flex gap-1 bg-white/95 rounded-lg shadow-lg border border-primary/10 p-1 md:hidden z-50">
  <button
    type="button"
    onClick={handleViewList}
    className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun liste"
  >
    <List className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewSplit}
    className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Liste og kort"
  >
    <LayoutGrid className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewMap}
    className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun kort"
  >
    <MapPin className="w-4 h-4" />
  </button>
</div>
```

Also add the same floating toggle to the map-only view section (after line 368, before the closing `</>`):

```tsx
{/* Fixed floating view-toggle (mobile, map-only mode) */}
<div className="fixed bottom-4 right-4 flex gap-1 bg-white/95 rounded-lg shadow-lg border border-primary/10 p-1 md:hidden z-50">
  <button
    type="button"
    onClick={handleViewList}
    className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun liste"
  >
    <List className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewSplit}
    className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Liste og kort"
  >
    <LayoutGrid className="w-4 h-4" />
  </button>
  <button
    type="button"
    onClick={handleViewMap}
    className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
    aria-label="Kun kort"
  >
    <MapPin className="w-4 h-4" />
  </button>
</div>
```

**DRY consideration:** The floating toggle JSX is repeated 3 times. Extract it to a local component at the top of SoegContent.tsx (inside the file, before the main export):

```tsx
function FloatingViewToggle({
  view,
  onList,
  onSplit,
  onMap,
  position = "absolute",
}: {
  view: ViewMode;
  onList: () => void;
  onSplit: () => void;
  onMap: () => void;
  position?: "absolute" | "fixed";
}) {
  const posClass = position === "fixed"
    ? "fixed bottom-4 right-4 shadow-lg z-50"
    : "absolute bottom-2 right-2 shadow-md z-10";
  return (
    <div className={`${posClass} flex gap-1 bg-white/95 rounded-lg border border-primary/10 p-1 md:hidden`}>
      <button
        type="button"
        onClick={onList}
        className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Kun liste"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onSplit}
        className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Liste og kort"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onMap}
        className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Kun kort"
      >
        <MapPin className="w-4 h-4" />
      </button>
    </div>
  );
}
```

Then use `<FloatingViewToggle>` in all three places:

- Split view (inside map container): `<FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="absolute" />`
- Map-only view: `<FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="fixed" />`
- List-only view: `<FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="fixed" />`

- [ ] **Step 4: Verify build**

Run: `cd /Users/CKA/shelterdk && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Visual verification**

Open `/soeg` in mobile viewport:
- Split view default: list appears first, 160px map below, floating toggle visible on map
- Tap "list" in toggle: map disappears, fixed floating toggle at bottom-right of screen
- Tap "split" in toggle: back to split view
- Tap "map" in toggle: full-height map, fixed floating toggle at bottom-right

Open `/soeg` in desktop viewport:
- Layout unchanged: side-by-side grid, sticky map on right, no floating toggles visible

- [ ] **Step 6: Verify desktop sticky map still works**

After swapping the mobile `order-*` classes, verify the desktop `lg:sticky` behavior is unaffected. The desktop order is still `lg:order-1` (list) and `lg:order-2` (map), so the grid positioning is unchanged. The `lg:sticky lg:top-24` on the map container should still work because we only changed the mobile order, not the lg: order.

- [ ] **Step 7: Commit**

```bash
cd /Users/CKA/shelterdk
git add web/components/SoegContent.tsx
git commit -m "feat(soeg): compact map below list, floating view-toggle on mobile"
```

---

## Task 4: Final integration test

- [ ] **Step 1: Full build**

```bash
cd /Users/CKA/shelterdk && npm run build
```

Expected: Build succeeds with no errors or warnings related to our changes.

- [ ] **Step 2: Visual verification checklist**

Open `/soeg` on mobile viewport (< 768px) and verify:

1. No breadcrumbs visible
2. H1 is compact (`text-2xl`)
3. Region dropdown + search input on one line (~48px height)
4. Filter chips in horizontal scroll, single row (~40px)
5. No view-toggle in search bar area
6. No min. pladser input
7. Shelter cards visible without excessive scrolling (~298px from top)
8. Map below list at 160px height
9. Floating view-toggle on bottom-right of map
10. Switching to list-only: map hidden, fixed floating toggle at bottom-right
11. Switching to map-only: full map, fixed floating toggle

Open `/soeg` on desktop viewport (>= 768px) and verify:

1. Breadcrumbs visible
2. H1 is `text-3xl`
3. Region dropdown + search stacked as before
4. Filter chips wrap normally
5. View-toggle in search bar
6. Min. pladser input visible
7. Side-by-side layout with sticky map
8. No floating toggles visible

- [ ] **Step 3: Test area page**

Open `/soeg?area=thy` (or any area) on mobile:
- Area description shows in `text-sm`
- No breadcrumbs
- All other mobile changes apply

- [ ] **Step 4: Final commit (if any fixes needed)**

If any issues found during verification, fix and commit:

```bash
cd /Users/CKA/shelterdk
git add -A
git commit -m "fix(soeg): mobile search UX adjustments from integration test"
```
