# Image Carousel & Performance — Design Spec

**Date:** 2026-04-05
**Status:** Approved

## Problem

1. Shelter images in search results show only one image with no way to browse more
2. Shelter detail pages have a thumbnail strip that loads 5-10 extra images on page load
3. Images load slowly — no placeholders, oversized `sizes` hints, and no blur preview

## Goals

- Swipeable image carousel in search cards and shelter detail pages (mobile)
- Blur placeholders (LQIP) for perceived performance
- Reduced image payload through correct sizing and lower quality for thumbnails

## Design

### 1. Shared ImageCarousel Component

A reusable `ImageCarousel` component used in both search cards and shelter detail page.

**Rendering:**
- Uses native CSS `scroll-snap` (`snap-x snap-mandatory`) for smooth, hardware-accelerated snapping
- Each slide is a `scroll-snap-align: start` child in a horizontal scroll container
- `overflow-x: auto` with hidden scrollbar (`scrollbar-width: none`)
- `touch-action: pan-y pinch-zoom` on the container to avoid blocking vertical scroll

**Dots indicator:**
- Rendered at bottom center of the image area
- Active dot is solid white, inactive dots are white/40%
- Only shown when 2+ images exist
- Max 5 dots visible; if more images, use a condensing pattern (small-medium-large-medium-small)

**Preloading strategy (current ± 1):**
- All slides rendered in DOM with `loading="lazy"` on their `<Image>` elements
- JavaScript `IntersectionObserver` on each slide; when a slide becomes visible, set `loading="eager"` on the next slide's image (preload the neighbor)
- On initial render: slide 0 is eager, slide 1 is eager, rest are lazy
- Result: next image is always ready before the user swipes to it

**Props:**
```typescript
interface ImageCarouselProps {
  urls: string[];              // Proxied image URLs
  alt: string;                 // Alt text base (appended with index)
  sizes: string;               // Responsive sizes hint
  blurDataUrl?: string;        // LQIP base64 for first image
  onTap?: () => void;          // Called on tap without swipe (navigation/lightbox)
  priority?: boolean;          // First image eager for LCP
  className?: string;          // Container class
  aspectRatio?: string;        // Default "4/3"
}
```

### 2. Search Cards (ShelterCard)

**Changes:**
- Replace the single `<Image>` with `<ImageCarousel>` when shelter has 2+ images
- Keep single `<Image>` for shelters with 1 image (no carousel overhead)
- `onTap` navigates to shelter page (current link behavior)
- Swipe gesture does NOT trigger navigation — only tap without horizontal movement does
- `sizes` changed from `"(max-width: 768px) 100vw, ..."` to `"(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"` — applies to both carousel and single-image cards (cards are never full viewport width on mobile in the search grid)
- `blurDataUrl` passed from shelter data

**Swipe vs. Link navigation:**
- When a carousel is rendered (2+ images), the `<Link>` wrapper is replaced with a `<div>`. The `onTap` callback calls `router.push(href)` to navigate. This avoids fragile preventDefault conflicts between swipe gestures and Next.js Link click handling.
- Swipe detection: track `touchstart` x-position. On `touchend`, if horizontal delta < 10px, treat as tap and call `onTap`. If >= 10px, it's a swipe — do nothing (scroll-snap handles it).
- For single-image shelters, the `<Link>` wrapper is kept as-is (no carousel, no swipe conflict).

### 3. Shelter Detail Page (ShelterGallery)

**Changes:**
- Hero image replaced with `<ImageCarousel>` using all photo URLs
- Thumbnail strip removed on mobile (`hidden md:flex`)
- Thumbnail strip kept on desktop (no performance concern with larger screens/bandwidth)
- `onTap` opens lightbox at current carousel index
- Carousel syncs with lightbox: when lightbox closes, carousel scrolls to the image the user was viewing

**Lightbox:**
- Unchanged: arrow navigation, keyboard support, counter, close on backdrop click
- Swipe support added to lightbox too (same scroll-snap approach)

### 4. LQIP (Blur Placeholders)

**Database:**
- New column `blur_data_url` (text, nullable) on `shelters` table in Supabase
- Contains a base64-encoded data URL of a tiny (16px wide) blurred version of the first image

**Generation:**
- Backfill script (`scripts/backfill-blur-placeholders.js`):
  1. Query all shelters where `blur_data_url IS NULL`
  2. For each: resolve first photo URL, fetch via image proxy, resize to 16px wide with Sharp, blur(5), encode as base64 JPEG data URL
  3. Update shelter row with result
  4. Rate-limited: concurrency pool of 5 parallel fetches. On fetch failure, log warning and skip (leave `blur_data_url` as NULL). No inter-request delay needed when concurrency is capped.
- On new/updated images: generate blur in the same flow that saves the image URL

**Usage:**
- Pass `blurDataUrl` to `next/image` as `blurDataURL` prop with `placeholder="blur"`
- Works in both `ImageCarousel` (first slide) and standalone `<Image>` components
- Fallback: if `blur_data_url` is null, no placeholder shown (current behavior)
- **Known limitation:** LQIP is generated from the first image only. If the first image fails and the carousel falls back to a later image, the blur won't match. This is acceptable — the blur disappears quickly once the real image loads.

### 5. Image Proxy Quality

**Changes to `/api/image/route.ts`:**
- Accept optional `q` query parameter for quality
- Parse as integer, clamp to range 1-100, default to 82 if missing or invalid
- Apply to `.jpeg({ quality: q, mozjpeg: true })` and `.webp({ quality: q })`
- Ignore for PNG (PNG is lossless, quality param not applicable)
- Search cards pass `q=70` via the proxy URL for smaller payloads
- Shelter detail page keeps default (82) for hero/lightbox images

**Changes to `web/lib/image-proxy.ts`:**
- `getProxiedImageSrc` gets an optional second argument: `opts?: { q?: number; w?: number }`
- New signature: `getProxiedImageSrc(url: string, opts?: { q?: number; w?: number }): string`
- Appends `&q=70` or `&w=400` etc. to the proxy URL when opts are provided

**Sizes fixes:**
- ShelterCard: `"(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"`
- ImageCarousel in ShelterGallery: `"(max-width: 1024px) 100vw, 896px"` (unchanged)

## Files to Create/Modify

### New files:
- `web/components/ImageCarousel.tsx` — shared carousel component
- `scripts/backfill-blur-placeholders.js` — one-time backfill script

### Modified files:
- `web/components/ShelterCard.tsx` — use ImageCarousel, pass blurDataUrl
- `web/components/ShelterGallery.tsx` — use ImageCarousel for hero, hide thumbnails on mobile
- `web/app/api/image/route.ts` — accept `q` param for quality
- `web/lib/image-proxy.ts` — add quality parameter support to `getProxiedImageSrc`
- Supabase migration for `blur_data_url` column
- Data fetching queries to include `blur_data_url` field

## Out of Scope

- Video support
- Pinch-to-zoom in carousel
- Image upload from carousel
- Desktop carousel in search cards (desktop keeps current single-image hover behavior)
- Note: The detail page carousel (ShelterGallery) IS used on both mobile and desktop. Only search card carousel is mobile-only.
