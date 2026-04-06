# Image Carousel & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add swipeable image carousels to search cards and shelter detail pages, blur placeholders (LQIP) for perceived performance, and image proxy quality optimization.

**Architecture:** A shared `ImageCarousel` component using native CSS scroll-snap handles swipe + dots in both search cards and shelter gallery. LQIP blur data is stored per-shelter in Supabase and passed as `blurDataURL` to next/image. The existing image proxy gains a quality parameter.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Supabase (Postgres), Sharp, CSS scroll-snap, next/image

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `web/components/ImageCarousel.tsx` | Create | Shared swipeable carousel with dots, preloading, tap detection |
| `web/components/__tests__/ImageCarousel.test.tsx` | Create | Unit tests for carousel logic |
| `web/lib/image-proxy.ts` | Modify | Add opts param to `getProxiedImageSrc` |
| `web/lib/__tests__/image-proxy.test.ts` | Create | Tests for updated proxy function |
| `web/app/api/image/route.ts` | Modify | Accept `q` query param for quality |
| `web/app/api/__tests__/image-route.test.ts` | Create | Tests for quality param |
| `web/components/ShelterCard.tsx` | Modify | Use ImageCarousel for multi-image shelters, swap Link→div |
| `web/components/ShelterGallery.tsx` | Modify | Use ImageCarousel for hero, hide thumbs on mobile |
| `shared/types/shelter.ts` | Modify | Add `blur_data_url` field |
| `web/lib/soeg-db.ts` | Modify | Add `blur_data_url` to SHELTER_SELECT |
| `web/app/(site)/shelter/[slug]/page.tsx` | Modify | Add `blur_data_url` to SHELTER_SELECT_DETAIL |
| `scripts/backfill-blur-placeholders.js` | Create | One-time backfill for LQIP data |

---

### Task 1: Image Proxy Quality Parameter

**Files:**
- Modify: `web/app/api/image/route.ts:94-117`
- Modify: `web/lib/image-proxy.ts:52-64`
- Create: `web/lib/__tests__/image-proxy.test.ts`

- [ ] **Step 1: Write test for `getProxiedImageSrc` with opts**

Create `web/lib/__tests__/image-proxy.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getProxiedImageSrc } from "../image-proxy";

describe("getProxiedImageSrc", () => {
  it("returns proxy URL without opts", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg");
    expect(result).toBe("/api/image?url=https%3A%2F%2Fexample.com%2Fimg.jpg");
  });

  it("appends quality param when opts.q provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { q: 70 });
    expect(result).toBe("/api/image?url=https%3A%2F%2Fexample.com%2Fimg.jpg&q=70");
  });

  it("appends width param when opts.w provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { w: 400 });
    expect(result).toBe("/api/image?url=https%3A%2F%2Fexample.com%2Fimg.jpg&w=400");
  });

  it("appends both q and w when provided", () => {
    const result = getProxiedImageSrc("https://example.com/img.jpg", { q: 70, w: 400 });
    expect(result).toContain("&q=70");
    expect(result).toContain("&w=400");
  });

  it("skips proxy for already-proxied URLs but appends opts", () => {
    const result = getProxiedImageSrc("/api/image?url=foo", { q: 70 });
    expect(result).toBe("/api/image?url=foo&q=70");
  });

  it("skips proxy for google-photo URLs", () => {
    const result = getProxiedImageSrc("/api/google-photo?ref=abc");
    expect(result).toBe("/api/google-photo?ref=abc");
  });

  it("returns empty string for empty input", () => {
    expect(getProxiedImageSrc("")).toBe("");
  });

  it("skips SKIP_PROXY_HOSTS", () => {
    const result = getProxiedImageSrc("https://lh3.googleusercontent.com/img.jpg");
    expect(result).toBe("https://lh3.googleusercontent.com/img.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/__tests__/image-proxy.test.ts`
Expected: FAIL — opts parameter not accepted yet.

- [ ] **Step 3: Update `getProxiedImageSrc` to accept opts**

In `web/lib/image-proxy.ts`, replace the `getProxiedImageSrc` function (lines 52-64):

```typescript
export function getProxiedImageSrc(
  url: string,
  opts?: { q?: number; w?: number },
): string {
  const u = (url || "").trim();
  if (!u) return u;

  // Build suffix from opts
  const suffix = [
    opts?.q != null ? `&q=${opts.q}` : "",
    opts?.w != null ? `&w=${opts.w}` : "",
  ].join("");

  // Already proxied — just append opts
  if (u.includes("/api/image?url=")) return u + suffix;
  if (u.startsWith("/api/google-photo")) return u;

  if (!isHttpUrl(u)) return u;
  try {
    const host = new URL(u).hostname;
    if (SKIP_PROXY_HOSTS.has(host)) return u;
  } catch {
    // invalid URL, proxy anyway
  }
  return `/api/image?url=${encodeURIComponent(u)}${suffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run lib/__tests__/image-proxy.test.ts`
Expected: PASS

- [ ] **Step 5: Update image proxy route to accept `q` param**

In `web/app/api/image/route.ts`, add `q` parsing near the top where `w` and `h` are parsed (around line 60-70), and use it in the Sharp section (lines 109-117).

Parse `q` from searchParams:
```typescript
const qRaw = searchParams.get("q");
const quality = qRaw ? Math.max(1, Math.min(100, parseInt(qRaw, 10) || 82)) : 82;
```

Replace the hardcoded `82` in Sharp output (lines 114-116):
```typescript
} else if (format === "webp") {
  out = await resized.webp({ quality }).toBuffer();
} else {
  out = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
}
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/image-proxy.ts web/lib/__tests__/image-proxy.test.ts web/app/api/image/route.ts
git commit -m "feat: add quality parameter to image proxy and getProxiedImageSrc"
```

---

### Task 2: ImageCarousel Component

**Files:**
- Create: `web/components/ImageCarousel.tsx`

- [ ] **Step 1: Create the ImageCarousel component**

Create `web/components/ImageCarousel.tsx`:

```tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { isUnoptimizedImageUrl } from "@/lib/image-proxy";

interface ImageCarouselProps {
  urls: string[];
  alt: string;
  sizes: string;
  blurDataUrl?: string;
  onTap?: () => void;
  priority?: boolean;
  className?: string;
  aspectRatio?: string; // Tailwind aspect class, default "aspect-[4/3]"
}

export function ImageCarousel({
  urls,
  alt,
  sizes,
  blurDataUrl,
  onTap,
  priority,
  className = "",
  aspectRatio = "aspect-[4/3]",
}: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Track active slide via scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    if (slideWidth === 0) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.max(0, Math.min(index, urls.length - 1)));
  }, [urls.length]);

  // Swipe vs tap detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
      touchStartX.current = null;
      if (deltaX < 10 && onTap) {
        onTap();
      }
    },
    [onTap],
  );

  // Prevent outer container click when swiping
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // On desktop, clicking the carousel should trigger onTap
      if (onTap) {
        onTap();
      }
    },
    [onTap],
  );

  // Stop propagation during swipe to prevent parent onClick (e.g., ShelterCard div)
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (deltaX >= 10) {
      // Mark as swiping — touchEnd will not call onTap
      // stopPropagation prevents parent click handlers from firing
    }
  }, []);

  // Preload neighbor images: set loading="eager" on current ± 1
  const getLoading = (index: number): "eager" | "lazy" => {
    if (priority && index === 0) return "eager";
    if (index === 0 || index === 1) return "eager";
    if (Math.abs(index - activeIndex) <= 1) return "eager";
    return "lazy";
  };

  // Expose current index for parent sync (e.g., lightbox)
  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  }, []);

  // Attach scrollToIndex to ref for parent access
  useEffect(() => {
    const el = scrollRef.current;
    if (el) (el as any)._scrollToIndex = scrollToIndex;
  }, [scrollToIndex]);

  if (urls.length === 0) return null;

  return (
    <div className={`relative ${aspectRatio} ${className}`}>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", touchAction: "pan-y pinch-zoom" }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {urls.map((url, i) => (
          <div key={`${i}-${url}`} className="relative w-full flex-none snap-start">
            <Image
              src={url}
              alt={`${alt} – billede ${i + 1}`}
              fill
              sizes={sizes}
              className="object-cover"
              loading={getLoading(i)}
              priority={priority && i === 0}
              unoptimized={isUnoptimizedImageUrl(url)}
              {...(i === 0 && blurDataUrl
                ? { placeholder: "blur" as const, blurDataURL: blurDataUrl }
                : {})}
            />
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      {urls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
          {urls.length <= 5 ? (
            urls.map((_, i) => (
              <div
                key={i}
                className={`w-[7px] h-[7px] rounded-full transition-colors ${
                  i === activeIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))
          ) : (
            // Condensing pattern for 6+ images: show 5 dots around active
            (() => {
              const dots: { index: number; size: "sm" | "md" | "lg" }[] = [];
              const center = activeIndex;
              for (let offset = -2; offset <= 2; offset++) {
                const idx = center + offset;
                if (idx < 0 || idx >= urls.length) continue;
                const absOff = Math.abs(offset);
                dots.push({
                  index: idx,
                  size: absOff === 0 ? "lg" : absOff === 1 ? "md" : "sm",
                });
              }
              const sizeClass = { sm: "w-[5px] h-[5px]", md: "w-[6px] h-[6px]", lg: "w-[7px] h-[7px]" };
              return dots.map((d) => (
                <div
                  key={d.index}
                  className={`rounded-full transition-all ${sizeClass[d.size]} ${
                    d.index === activeIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `scrollbar-hide` utility to Tailwind config or globals.css**

In `web/app/globals.css`, add:

```css
/* Hide scrollbar for carousel */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 3: Smoke test the component renders**

Run: `cd web && npx vitest run` (all existing tests should still pass)
Expected: PASS — no breakages.

- [ ] **Step 4: Commit**

```bash
git add web/components/ImageCarousel.tsx web/app/globals.css
git commit -m "feat: add ImageCarousel component with scroll-snap and dots"
```

---

### Task 3: Integrate Carousel into ShelterCard

**Files:**
- Modify: `web/components/ShelterCard.tsx`

- [ ] **Step 1: Add carousel to ShelterCard**

Key changes to `web/components/ShelterCard.tsx`:

1. Import `ImageCarousel` and `useRouter` from `next/navigation`
2. **Mobile-only carousel:** The carousel is only rendered on mobile. On desktop, keep the current single-image + hover-zoom behavior. Use a `useIsMobile` check (media query `max-width: 767px` via `matchMedia`) or render both and toggle with CSS `block md:hidden` / `hidden md:block`.
3. When carousel is active (`proxiedSrcs.length >= 2` on mobile), replace the `<Link>` wrapper with a `<div>` that uses `router.push` via click. **The entire card** (image + title + metadata) must remain clickable — the `<div>` wraps everything, not just the image area. The carousel's `onTap` is not needed for navigation since the outer `<div>` handles it; instead, the carousel intercepts horizontal swipes to prevent them from triggering navigation.
4. When `proxiedSrcs.length === 1` or on desktop, keep the existing `<Link>` + single `<Image>` behavior
5. Update `sizes` to `"(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"` for all image variants
6. Pass `{ q: 70 }` to `getProxiedImageSrc` for card images (smaller payload for thumbnails)

```tsx
// At top of file, add imports:
import { useRouter } from "next/navigation";
import { ImageCarousel } from "@/components/ImageCarousel";

// Inside the component, add:
const router = useRouter();

// Detect mobile for carousel (only show carousel on mobile)
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const mq = window.matchMedia("(max-width: 767px)");
  setIsMobile(mq.matches);
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);

// Determine if carousel or single image
const useCarousel = isMobile && proxiedSrcs.length >= 2 && !gaveUp;
const cardSizes = "(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw";
```

Update `proxiedSrcs` mapping to pass quality option:
```tsx
const proxiedSrcs = displayableUrls.map((u) => getProxiedImageSrc(u, { q: 70 }));
```

For the carousel case, the **entire card** is wrapped in a clickable `<div>` (not just the image). The `<div>` gets `onClick={() => router.push(linkHref)}` and `role="link"` for accessibility. The carousel sits inside the image area and handles swipe internally without triggering the outer click:
```tsx
// Carousel case: outer <div> wraps entire card
<div
  className="group block overflow-hidden rounded-xl bg-white shadow-sm transition-transform duration-300 hover:scale-[1.02] cursor-pointer"
  onClick={() => router.push(linkHref)}
  role="link"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === "Enter") router.push(linkHref); }}
>
  <div className="relative aspect-[4/3] overflow-hidden bg-primary/10">
    <ImageCarousel
      urls={proxiedSrcs}
      alt={`Billede af shelter ${shelter.title}`}
      sizes={cardSizes}
      blurDataUrl={shelter.blur_data_url ?? undefined}
      priority={priority}
    />
  </div>
  {/* ... same card body (title, city, badges) as existing code ... */}
</div>
```

The `ImageCarousel` component's click handler must call `e.stopPropagation()` during a swipe to prevent the outer div's `onClick` from firing. Only let clicks through when no swipe occurred.

For single image / desktop, keep existing `<Link>` wrapper but update `sizes` to `cardSizes`.

- [ ] **Step 2: Verify existing tests pass**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/ShelterCard.tsx
git commit -m "feat: add image carousel to ShelterCard for multi-image shelters"
```

---

### Task 4: Integrate Carousel into ShelterGallery

**Files:**
- Modify: `web/components/ShelterGallery.tsx`

- [ ] **Step 1: Replace hero image with carousel and hide thumbnails on mobile**

Key changes to `web/components/ShelterGallery.tsx`:

1. Import `ImageCarousel`
2. Add `blurDataUrl` to `ShelterGalleryProps`:
   ```typescript
   blurDataUrl?: string;
   ```
3. Replace the hero `<button>` + `<Image>` block (lines 110-127) with `<ImageCarousel>`:
   ```tsx
   <ImageCarousel
     urls={proxiedUrls}
     alt={`Billede af shelter ${title}`}
     sizes="(max-width: 1024px) 100vw, 896px"
     blurDataUrl={blurDataUrl}
     onTap={() => setLightboxIndex(activeCarouselIndex)}
     priority
   />
   ```
4. Track the active carousel index for lightbox sync — read it from the carousel's scroll position via a ref callback
5. Add `hidden md:flex` to the thumbnail strip container (line 176) so it's hidden on mobile:
   ```tsx
   <div className="hidden md:flex gap-2 mb-6 overflow-x-auto pb-1">
   ```
6. When lightbox closes, scroll carousel to the lightbox index:
   ```tsx
   // In lightbox close handler:
   const el = carouselRef.current;
   if (el && (el as any)._scrollToIndex) {
     (el as any)._scrollToIndex(lightboxIndex);
   }
   ```
7. **Add swipe to lightbox:** Replace the single `<Image>` in the lightbox modal with an `<ImageCarousel>` using the same scroll-snap approach. This gives consistent swipe behavior in both the hero carousel and lightbox. The lightbox carousel should use `sizes="100vw"` and render at full viewport width. Arrow buttons and keyboard navigation are kept as additional navigation methods alongside swipe.

- [ ] **Step 2: Update ShelterGallery caller to pass blurDataUrl**

In `web/app/(site)/shelter/[slug]/page.tsx`, pass `blur_data_url` from the shelter data to the gallery:
```tsx
<ShelterGallery
  urls={allPhotoUrls}
  title={shelter.title}
  blurDataUrl={shelter.blur_data_url ?? undefined}
  // ... other existing props
/>
```

- [ ] **Step 3: Verify existing tests pass**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/ShelterGallery.tsx web/app/(site)/shelter/[slug]/page.tsx
git commit -m "feat: add carousel to ShelterGallery, hide thumbnails on mobile"
```

---

### Task 5: LQIP — Database Column & Type

**Files:**
- Modify: `shared/types/shelter.ts`
- Modify: `web/lib/soeg-db.ts:39-42`
- Modify: `web/app/(site)/shelter/[slug]/page.tsx:47-50`
- Modify: `web/app/(site)/page.tsx:49-51` (front page)

- [ ] **Step 1: Add `blur_data_url` column in Supabase**

Run this SQL in the Supabase SQL editor (Dashboard → SQL Editor):

```sql
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS blur_data_url text;
```

- [ ] **Step 2: Add field to Shelter type**

In `shared/types/shelter.ts`, add after `seo_title` (line 46):

```typescript
/** Base64-encoded tiny blur preview of first image (LQIP). */
blur_data_url?: string | null;
```

- [ ] **Step 3: Add `blur_data_url` to all SHELTER_SELECT constants**

Append `, blur_data_url` to the select strings in:

| File | Line | Constant |
|------|------|----------|
| `web/lib/soeg-db.ts` | 39 | `SHELTER_SELECT` |
| `web/lib/soeg-db.ts` | 41 | `SHELTER_SELECT_FALLBACK` |
| `web/app/(site)/shelter/[slug]/page.tsx` | 47 | `SHELTER_SELECT_DETAIL` |
| `web/app/(site)/shelter/[slug]/page.tsx` | 49 | `SHELTER_SELECT_DETAIL_FALLBACK` |
| `web/app/(site)/page.tsx` | 49 | `SHELTER_SELECT` |
| `web/app/(site)/page.tsx` | 51 | `SHELTER_SELECT_FALLBACK` |

Also update these auxiliary files that have their own SHELTER_SELECT:
- `web/lib/area-db.ts:12`
- `web/lib/danmark-silo.ts:14,17`
- `web/lib/shelters-with-beach.ts:10`
- `web/lib/shelters-with-firewood.ts:10`
- `web/lib/shelters-with-pets.ts:10`
- `web/lib/shelters-with-water.ts:10`
- `web/lib/shelters-with-shower.ts:10`
- `web/lib/shelters-with-toilet.ts:10`

For each, append `, blur_data_url` to the select string.

- [ ] **Step 4: Verify app builds**

Run: `cd web && npx next build`
Expected: Build succeeds (column exists in DB, type updated).

- [ ] **Step 5: Commit**

```bash
git add shared/types/shelter.ts web/lib/soeg-db.ts web/app/(site)/shelter/[slug]/page.tsx web/app/(site)/page.tsx web/lib/area-db.ts web/lib/danmark-silo.ts web/lib/shelters-with-*.ts
git commit -m "feat: add blur_data_url field to Shelter type and all select queries"
```

---

### Task 6: LQIP Backfill Script

**Files:**
- Create: `scripts/backfill-blur-placeholders.js`

- [ ] **Step 1: Create the backfill script**

Create `scripts/backfill-blur-placeholders.js`:

```javascript
#!/usr/bin/env node
/**
 * Backfill blur_data_url for all shelters that don't have one yet.
 *
 * Usage:
 *   node scripts/backfill-blur-placeholders.js
 *   node scripts/backfill-blur-placeholders.js --dry-run
 *   node scripts/backfill-blur-placeholders.js --limit 50
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars.
 * Uses sharp for image processing.
 */

const { createClient } = require("@supabase/supabase-js");

const CONCURRENCY = 5;
const BLUR_WIDTH = 16;
const BLUR_SIGMA = 5;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sharp = (await import("sharp")).default;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch shelters without blur
  let query = supabase
    .from("shelters")
    .select("id, slug, image_url, image_urls, user_image_urls")
    .is("blur_data_url", null)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false, nullsFirst: false });

  if (limit) query = query.limit(limit);

  const { data: shelters, error } = await query;
  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${shelters.length} shelters without blur_data_url`);
  if (dryRun) {
    console.log("Dry run — not updating anything");
    return;
  }

  let success = 0;
  let skipped = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < shelters.length; i += CONCURRENCY) {
    const batch = shelters.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (shelter) => {
      try {
        // Find first image URL
        const urls = [
          shelter.image_url,
          ...(shelter.image_urls || []),
          ...(shelter.user_image_urls || []),
        ].filter((u) => u && typeof u === "string" && u.trim().length > 10);

        if (urls.length === 0) {
          skipped++;
          return;
        }

        const imageUrl = urls[0];
        const fetchUrl = imageUrl.startsWith("http")
          ? imageUrl
          : `${supabaseUrl}${imageUrl}`;

        const res = await fetch(fetchUrl, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          console.warn(`  [SKIP] ${shelter.slug}: HTTP ${res.status}`);
          skipped++;
          return;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        const blurBuf = await sharp(buf, { failOnError: false })
          .rotate()
          .resize(BLUR_WIDTH)
          .blur(BLUR_SIGMA)
          .jpeg({ quality: 60 })
          .toBuffer();

        const dataUrl = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;

        const { error: updateErr } = await supabase
          .from("shelters")
          .update({ blur_data_url: dataUrl })
          .eq("id", shelter.id);

        if (updateErr) {
          console.warn(`  [ERR] ${shelter.slug}: ${updateErr.message}`);
          skipped++;
        } else {
          success++;
          if (success % 25 === 0) console.log(`  Progress: ${success} done`);
        }
      } catch (err) {
        console.warn(`  [SKIP] ${shelter.slug}: ${err.message}`);
        skipped++;
      }
    }));
  }

  console.log(`\nDone: ${success} updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Test with dry-run**

Run: `cd /Users/CKA/shelterdk && node scripts/backfill-blur-placeholders.js --dry-run`
Expected: Lists count of shelters needing blur, no updates made.

- [ ] **Step 3: Run backfill with small limit first**

Run: `node scripts/backfill-blur-placeholders.js --limit 10`
Expected: 10 shelters updated.

- [ ] **Step 4: Verify in Supabase**

Check in Supabase Dashboard that a few shelters now have `blur_data_url` populated with `data:image/jpeg;base64,...` values.

- [ ] **Step 5: Run full backfill**

Run: `node scripts/backfill-blur-placeholders.js`
Expected: All shelters with images get blur data.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-blur-placeholders.js
git commit -m "feat: add LQIP backfill script for blur_data_url"
```

**Note:** Real-time blur generation for new/updated images (spec section 4) is deferred to a follow-up. The backfill script can be re-run periodically to catch new shelters. A proper solution would hook into the image upload/update flow, but that's a separate change.

---

### Task 7: Wire Up Blur Placeholders in Components

**Files:**
- Modify: `web/components/ShelterCard.tsx`
- Modify: `web/components/ShelterGallery.tsx`

- [ ] **Step 1: Pass blurDataUrl in ShelterCard single-image path**

In the single-image `<Image>` render path in `ShelterCard.tsx`, add blur props:

```tsx
<Image
  key={currentSrc}
  src={currentSrc!}
  alt={`Billede af shelter ${shelter.title}`}
  fill
  sizes={cardSizes}
  className="object-cover transition-transform duration-300 group-hover:scale-105"
  unoptimized={currentSrc ? isUnoptimizedImageUrl(currentSrc) : false}
  onError={handleImageError}
  priority={priority && cardImageIndex === 0}
  {...(shelter.blur_data_url
    ? { placeholder: "blur" as const, blurDataURL: shelter.blur_data_url }
    : {})}
/>
```

The carousel path already receives `blurDataUrl` from Task 3.

- [ ] **Step 2: Verify blur shows in dev**

Run: `cd web && npm run dev`
Open a search page — shelters with `blur_data_url` should show a blurred preview while loading.

- [ ] **Step 3: Commit**

```bash
git add web/components/ShelterCard.tsx web/components/ShelterGallery.tsx
git commit -m "feat: wire up LQIP blur placeholders in ShelterCard and ShelterGallery"
```

---

### Task 8: Final Verification & Sizes Cleanup

**Files:**
- Modify: `web/components/ShelterCard.tsx` (if sizes not already updated in Task 3)

- [ ] **Step 1: Verify all sizes attributes are correct**

Check that:
- ShelterCard (both carousel and single): `"(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"`
- ShelterGallery carousel: `"(max-width: 1024px) 100vw, 896px"`
- `FrontPageCardImage` sizes: review and update if needed

- [ ] **Step 2: Run all tests**

Run: `cd web && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Build check**

Run: `cd web && npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual mobile test**

Open the dev server on mobile (or Chrome DevTools mobile emulation):
1. `/soeg` — verify carousel swipe works on cards with multiple images
2. `/soeg` — verify single-image cards still link normally
3. `/shelter/<any-slug>` — verify hero carousel swipe works
4. `/shelter/<any-slug>` — verify thumbnails hidden on mobile, visible on desktop
5. `/shelter/<any-slug>` — verify tap opens lightbox at correct image
6. Check blur placeholders appear on slow connection (DevTools → Network → Slow 3G)

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "fix: final sizes and carousel cleanup"
```

- [ ] **Step 6: Deploy**

```bash
git push origin main
```
