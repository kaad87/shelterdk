# Mobile Homepage UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mobile homepage to show shelters immediately, reduce hero size, and provide quick-action discovery entry points — without changing the desktop view.

**Architecture:** All changes are mobile-only using Tailwind `md:` breakpoints. Desktop sections use `hidden md:block` to keep rendering exactly as-is. Mobile gets new compact variants rendered alongside. No new API endpoints, DB tables, or dependencies.

**Tech Stack:** Next.js 14, Tailwind CSS, Lucide React icons, existing Supabase queries.

**Spec:** `docs/superpowers/specs/2026-04-04-mobile-homepage-ux-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/app/(site)/page.tsx` | Modify | Restructure homepage: add mobile hero, mobile pills, mobile region grid, hide desktop-only sections on mobile |
| `web/components/FrontPageShelterGrid.tsx` | Modify | Add horizontal carousel variant for mobile (`< md`) |
| `web/components/MobileHomePills.tsx` | Create | Client component for mobile quick-action pills (Lucide icons need `"use client"`) |

**Important:** `page.tsx` is a React Server Component (async, uses `await`). Lucide React icons may not work in RSC depending on the version. The mobile pills and hero search icon are extracted into client components to avoid potential build errors. If Lucide icons work in RSC at build time, the separate component can be inlined later.

---

### Task 1: Compact mobile hero with fake search input

**Files:**
- Modify: `web/app/(site)/page.tsx` (lines 280-305 — the `<header>` element)

- [ ] **Step 1: Add mobile-only compact hero above the existing hero**

In `page.tsx`, replace the current `<header>` block (lines 280-305) with a structure that renders two variants: a compact mobile hero and the existing desktop hero. The mobile hero is visible below `md:`, the desktop hero is hidden below `md:`.

```tsx
{/* ===== MOBILE HERO (< md) ===== */}
<header
  className="md:hidden bg-gradient-to-br from-[#2c3e2d] to-[#1a2b1a] text-white px-4 pt-14 pb-6"
  aria-label="Introduktion"
>
  <h1 className="font-serif text-2xl font-bold mb-3">
    Find dit næste shelter
  </h1>
  <Link
    href="/soeg"
    className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-primary/50 text-sm"
  >
    <Search size={16} className="shrink-0 text-primary/40" />
    <span>Søg by, område eller shelter…</span>
  </Link>
</header>

{/* ===== DESKTOP HERO (md+) ===== */}
<header
  className="hidden md:flex relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white min-h-[420px] flex-col justify-end"
  aria-label="Introduktion"
>
  {/* ... existing desktop hero content unchanged ... */}
</header>
```

**Note on Lucide in RSC:** `page.tsx` is a server component. The `Search` icon is a simple SVG — try importing it directly first. If the build fails, extract the mobile hero into a small client component (`"use client"`) or use an inline SVG instead:

```tsx
{/* Fallback if Lucide doesn't work in RSC: */}
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary/40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
```

- [ ] **Step 2: Verify desktop hero is unchanged**

Run the dev server and check that on a desktop-width viewport (≥768px), the homepage looks identical to the current version. The mobile hero should be hidden (`md:hidden`), and the desktop hero visible (`hidden md:flex`).

```bash
cd web && npx next dev
```

Open `http://localhost:3000` in a browser at desktop width. Verify the existing hero renders exactly as before.

- [ ] **Step 3: Verify mobile hero renders correctly**

Resize browser to mobile width (<768px). Verify:
- Compact hero with gradient background, ~140px tall
- H1 "Find dit næste shelter" visible
- Fake search input (styled Link) visible, tapping navigates to `/soeg`
- No background image, no region dropdown, no long subtitle

- [ ] **Step 4: Commit**

```bash
git add web/app/\(site\)/page.tsx
git commit -m "feat: add compact mobile hero with fake search input

Mobile-only hero (<md) replaces the full-height hero with a compact
gradient + search link. Desktop hero unchanged (hidden md:flex)."
```

---

### Task 2: Mobile quick-action pills

**Files:**
- Modify: `web/app/(site)/page.tsx` (lines 308-357 — the quick-links section)

- [ ] **Step 1: Add mobile pills section and hide desktop pills on mobile**

Replace the current quick-links `<section>` (lines 308-357) with two variants: mobile pills (visible below `md:`) and existing desktop pills (hidden below `md:`).

First, create the client component `web/components/MobileHomePills.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MapPin, CheckCircle, Flame, Gift, Bath } from "lucide-react";

const PILLS = [
  { label: "Nær mig", href: "/shelter-naer-mig", icon: MapPin, accent: true },
  { label: "Bookbar", href: "/soeg?bookbar=1", icon: CheckCircle, accent: false },
  { label: "Med bål", href: "/shelter-med-baalplads", icon: Flame, accent: false },
  { label: "Gratis", href: "/soeg?gratis=1", icon: Gift, accent: false },
  { label: "Med toilet", href: "/shelter-med-toilet", icon: Bath, accent: false },
] as const;

export function MobileHomePills() {
  return (
    <section className="md:hidden py-3 bg-background" aria-label="Hurtige filtre">
      <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
        {PILLS.map((pill) => (
          <Link
            key={pill.href}
            href={pill.href}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium shrink-0 ${
              pill.accent
                ? "bg-green-50 border border-green-200 text-green-700"
                : "border border-primary/15 bg-white text-primary/70"
            }`}
          >
            <pill.icon size={15} />
            {pill.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

Then in `page.tsx`, import and use it:
```tsx
import { MobileHomePills } from "@/components/MobileHomePills";
```

Replace the current quick-links section with:
```tsx
{/* ===== MOBILE PILLS (< md) ===== */}
<MobileHomePills />

{/* ===== DESKTOP PILLS (md+) ===== */}
<section className="hidden md:block pt-8 pb-4 bg-background" aria-labelledby="heading-intro">
  {/* ... existing desktop intro text + nav pills, unchanged ... */}
</section>
```

- [ ] **Step 2: Add scrollbar-hide utility if not present**

Check if `scrollbar-hide` is already available in the Tailwind config. If not, add it to the global CSS (`web/app/globals.css`):

```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 3: Verify mobile pills render and scroll horizontally**

At mobile width, verify:
- 5 pills visible in a horizontal scrollable row
- "Nær mig" has green accent styling
- Horizontal scroll works with no visible scrollbar
- Each pill navigates to the correct URL

At desktop width, verify:
- Existing 6-pill layout renders unchanged

- [ ] **Step 4: Commit**

```bash
git add web/app/\(site\)/page.tsx web/app/globals.css web/components/MobileHomePills.tsx
git commit -m "feat: add mobile quick-action pills with GPS and filter shortcuts

Five horizontally scrollable pills on mobile: Nær mig (GPS),
Bookbar, Med bål, Gratis, Med toilet. Desktop pills unchanged."
```

---

### Task 3: Mobile shelter carousel

**Files:**
- Modify: `web/components/FrontPageShelterGrid.tsx`
- Modify: `web/app/(site)/page.tsx` (the featured shelters section, lines 359-375)

- [ ] **Step 1: Add carousel layout to FrontPageShelterGrid**

Modify `FrontPageShelterGrid.tsx` to render a horizontal carousel on mobile and the existing grid on desktop:

```tsx
"use client";

import { ShelterCard } from "@/components/ShelterCard";
import type { Shelter } from "@/types/shelter";

interface FrontPageShelterGridProps {
  shelters: Shelter[];
  maxVisible?: number;
}

export function FrontPageShelterGrid({
  shelters,
  maxVisible = 12,
}: FrontPageShelterGridProps) {
  const toShow = shelters.slice(0, maxVisible);
  const priorityCount = 6;

  return (
    <>
      {/* Mobile: horizontal carousel */}
      <div className="md:hidden flex gap-3 overflow-x-auto scroll-snap-x scrollbar-hide -mx-4 px-4">
        {toShow.map((shelter, index) => (
          <div
            key={shelter.id}
            className="shrink-0 w-[200px] scroll-snap-start"
          >
            <ShelterCard
              shelter={shelter}
              priority={index < 2}
            />
          </div>
        ))}
      </div>

      {/* Desktop: existing grid */}
      <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
        {toShow.map((shelter, index) => (
          <ShelterCard
            key={shelter.id}
            shelter={shelter}
            priority={index < priorityCount}
          />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add scroll-snap utilities to globals.css if needed**

Add to `web/app/globals.css` (in the `@layer utilities` block from Task 2):

```css
  .scroll-snap-x {
    scroll-snap-type: x mandatory;
  }
  .scroll-snap-start {
    scroll-snap-align: start;
  }
```

- [ ] **Step 3: Update section heading for mobile**

In `page.tsx`, update the featured shelters section heading to say "Populære shelters" on mobile:

```tsx
<h2 id="heading-udforsk-shelters" className="font-serif text-3xl font-bold text-primary mb-8 text-center">
  <span className="md:hidden">Populære shelters</span>
  <span className="hidden md:inline">Udforsk shelters</span>
</h2>
```

- [ ] **Step 4: Verify carousel on mobile, grid on desktop**

At mobile width:
- Shelter cards appear in a horizontally scrollable carousel
- Cards are ~200px wide with partial visibility of next card (hints scrollability)
- Scroll-snap locks to card edges
- No visible scrollbar

At desktop width:
- Existing 4-column grid renders unchanged

- [ ] **Step 5: Commit**

```bash
git add web/components/FrontPageShelterGrid.tsx web/app/\(site\)/page.tsx web/app/globals.css
git commit -m "feat: add horizontal shelter carousel on mobile homepage

Replaces the 2-col grid with a swipeable carousel on mobile.
Desktop keeps existing 4-col grid layout."
```

---

### Task 4: Mobile 2x2 region grid

**Files:**
- Modify: `web/app/(site)/page.tsx`

**Critical DOM ordering:** The current `page.tsx` renders sections in this order:
1. Hero (line 280)
2. Intro/pills (line 308)
3. Featured shelters (line 359)
4. Map (line 377)
5. Plan your trip (line 397)
6. Newsletter (line 433)
7. Instagram (line 439)
8. Regions (line 445)
9. Popular areas (line 482)

The mobile region grid must appear **after the featured shelters section** (after line 375) — NOT before the existing region section (which is at line 445, after Instagram). Insert the mobile region grid immediately after the `featuredShelters` closing `</section>` tag.

- [ ] **Step 1: Insert mobile 2x2 region grid after featured shelters section (line ~376)**

Add the mobile region grid right after the featured shelters `</section>` (around line 375), and hide the existing region/popular-areas sections on mobile:

```tsx
{/* ===== MOBILE REGION GRID (< md) ===== */}
<section className="md:hidden py-6 bg-background" aria-labelledby="heading-region-mobile">
  <div className="mx-auto px-4">
    <h2 id="heading-region-mobile" className="font-serif text-xl font-bold text-primary mb-4">
      Udforsk efter område
    </h2>
    <div className="grid grid-cols-2 gap-3">
      {[
        { name: "Jylland", href: "/danmark/jylland", count: "700+", gradient: "from-[#2c3e2d] to-[#4a6b4a]" },
        { name: "Sjælland", href: "/danmark/sjaelland", count: "500+", gradient: "from-[#2b3a5e] to-[#4a6b8a]" },
        { name: "Fyn", href: "/danmark/fyn", count: "250+", gradient: "from-[#5e4a2b] to-[#8a7b4a]" },
        { name: "Bornholm", href: "/danmark/bornholm", count: "30+", gradient: "from-[#4a2b5e] to-[#6b4a8a]" },
      ].map((r) => (
        <Link
          key={r.href}
          href={r.href}
          className={`rounded-xl bg-gradient-to-br ${r.gradient} p-4 text-white active:scale-[0.97] transition-transform touch-manipulation`}
        >
          <div className="font-serif text-lg font-bold">{r.name}</div>
          <div className="text-sm text-white/70">{r.count} shelters</div>
        </Link>
      ))}
    </div>
  </div>
</section>
```

Then wrap the existing "Udforsk efter region" section (lines 445-480) with `hidden md:block`:
```tsx
<section
  className="hidden md:block pt-4 pb-8 bg-background"
  ...
>
```

And wrap the existing "Populære områder" section (lines 482-525) with `hidden md:block`:
```tsx
<section
  className="hidden md:block py-8 bg-background"
  ...
>
```

- [ ] **Step 2: Verify mobile region grid and desktop sections**

At mobile width:
- 2x2 grid with Jylland, Sjælland, Fyn, Bornholm
- Each cell shows region name + approximate shelter count
- Gradient backgrounds, tapping navigates to `/danmark/{region}`
- No "Populære områder" 6-grid visible

At desktop width:
- Existing 3-column region cards render unchanged
- Existing 6-card popular areas grid renders unchanged

- [ ] **Step 3: Commit**

```bash
git add web/app/\(site\)/page.tsx
git commit -m "feat: add compact 2x2 region grid on mobile homepage

Mobile shows Jylland/Sjælland/Fyn/Bornholm in a compact grid.
Desktop keeps existing region cards and popular areas sections."
```

---

### Task 5: Reorder remaining sections on mobile + hide desktop intro text

**Files:**
- Modify: `web/app/(site)/page.tsx`

- [ ] **Step 1: Hide desktop intro text section on mobile**

The "Redaktionel intro" section (lines 308-357, now the desktop pills section) has a paragraph about Geodatastyrelsen. This is already hidden on mobile via the `hidden md:block` added in Task 2. Verify this is the case.

- [ ] **Step 2: Verify final mobile section order**

At mobile width, verify sections appear in this order:
1. Compact hero with search link
2. Quick-action pills (horizontally scrollable)
3. "Populære shelters" carousel
4. 2x2 region grid
5. Interactive map
6. "Planlæg din sheltertur"
7. Newsletter signup
8. Instagram feed
9. (Desktop-only sections hidden: region cards, popular areas)

This order matches the DOM order after Tasks 1-4's insertions. The mobile region grid was inserted after featured shelters (Task 4), so sections 1-4 are in the correct position. Sections 5-8 (map, trip planner, newsletter, Instagram) keep their existing DOM order — no reordering needed since they already flow correctly on mobile.

- [ ] **Step 3: Final cross-browser check**

Test on:
- Chrome mobile emulation (iPhone SE, iPhone 14, Pixel 7)
- Desktop Chrome at full width

Verify no layout shifts, no broken images, all links work.

- [ ] **Step 4: Commit**

```bash
git add web/app/\(site\)/page.tsx
git commit -m "feat: finalize mobile homepage section ordering

Ensures correct section order on mobile: compact hero, pills,
carousel, regions, map, trip planner, newsletter, Instagram."
```

---

### Task 6: Final review and cleanup

**Files:**
- Review: `web/app/(site)/page.tsx`
- Review: `web/components/FrontPageShelterGrid.tsx`
- Review: `web/app/globals.css`

- [ ] **Step 1: Run TypeScript type check**

```bash
cd web && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run build**

```bash
cd web && npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Audit for leftover issues**

Review all changes for:
- Duplicate `id` attributes (mobile + desktop sections with same `id` — deduplicate with `-mobile` suffix)
- Missing `aria-label` or `aria-labelledby` attributes
- Any desktop styling accidentally affected

- [ ] **Step 4: Final commit if cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup mobile homepage UX implementation"
```
