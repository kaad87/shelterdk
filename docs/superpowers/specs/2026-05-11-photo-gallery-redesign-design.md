# Photo Gallery Redesign — Design Spec

## Goal

Replace the split "officielle billeder / ejer-uploadede billeder" UI in the ejer dashboard with a single unified, drag-and-drop sortable gallery where owners control the display order of all photos — official and their own — freely.

## Architecture

### Data model

Add `photo_order text[]` (nullable, default null) to the `shelters` table.
Add `photo_order?: string[] | null` to the shelter type in `shared/types/shelter.ts`.

**Canonical source set:** The full set of URLs a shelter can ever display is built by running the same deduplication/filtering logic that already exists in `getPhotoUrls()` — reading `image_url`, `image_urls`, `user_image_urls`, and `geofa_raw` photo keys (`foto_link`, `foto_link1`–`foto_link3`, `geofafoto`, `geofafoto1`–`geofafoto3`), filtering invalid/excluded URLs. This canonical set is the authority for all merge, prune, and allowlist logic below.

**Display order resolution — updated `getPhotoUrls()`:**
1. Build the canonical source set as described above (same logic as today).
2. If `photo_order` is non-null and non-empty:
   a. Use it as the base order.
   b. **Prune** any entries no longer present in the source set (handles GeoFA-removed photos and deleted owner photos).
   c. **Append** any source URLs not already in the pruned order (handles newly GeoFA-synced photos).
3. If `photo_order` is null or empty, fall back to the canonical source set from step 1.
4. Apply `SKIP_FIRST_IMAGES` slicing at the end (same as today) — unchanged behaviour for public display.

This is backward-compatible: existing shelters without `photo_order` work identically to today.

**Ejer dashboard — `getOrderedPhotoItems(shelter): PhotoItem[]`:**
A new exported helper alongside `getPhotoUrls()` that runs steps 1–3 of the merge above **without** the `SKIP_FIRST_IMAGES` slice and returns `PhotoItem[]` (attaching `isDeletable` via `isOwnerPhotoPath()`). This gives the gallery editor the full unsliced list while leaving `getPhotoUrls()` — and all its existing callers — unchanged. Both `ShelterGroupSettingsForm` and `ShelterEditForm` call this helper to initialise their `photos` state.

**Migration:** For all shelters with non-empty `user_image_urls`, compute and write the initial `photo_order` as `[image_url, ...image_urls, ...user_image_urls]` (filtering null/empty, deduplicating), preserving the existing display order.

### Distinguishing deletable photos

A photo URL is owner-deletable if and only if its storage path starts with `owner/<shelterDbId>/`. This is checked via the existing `isOwnerPhotoPath()` helper in `lib/owner-db.ts`. Official photos (GeoFA/admin) are never deletable by owners.

### Photo count limit

A shelter may have at most **MAX_PHOTOS = 20** photos total. The frontend disables the upload button when the limit is reached. The backend validates `photo_order.length ≤ MAX_PHOTOS` on save and returns HTTP 422 if exceeded.

---

## Files

| File | Change |
|------|--------|
| `migrations/YYYYMMDD_photo_order.sql` | Add `photo_order text[]` column to `shelters` |
| `shared/types/shelter.ts` | Add `photo_order?: string[] \| null` to shelter type |
| `shared/lib/shelter-detail.ts` | Update `getPhotoUrls()` with prune-then-append merge + `SKIP_FIRST_IMAGES`; add new `getOrderedPhotoItems()` export (no SKIP slice, returns `PhotoItem[]`) |
| `lib/owner-db.ts` | Add `photo_order` to `getSharedShelterContent()` select; extend `updateSharedShelterContent()` fields type with `photo_order?: string[] \| null` |
| `app/api/ejer/plads/[groupId]/settings/route.ts` | Accept `photo_order` in PATCH body; validate allowlist |
| `app/api/ejer/shelter/[id]/bookinger/settings/route.ts` | Accept `photo_order` in PATCH body; validate allowlist |
| `app/api/ejer/shelter/[id]/billeder/route.ts` | On DELETE: atomically remove URL from both `user_image_urls` and `photo_order` |
| `components/ejer/PhotoGallery.tsx` | New component (see below) |
| `components/ejer/ShelterGroupSettingsForm.tsx` | Replace two-section gallery with `<PhotoGallery>` |
| `components/ejer/ShelterEditForm.tsx` | Same replacement; server page passes official photos via props |
| `scripts/backfill-photo-order.ts` | One-time backfill script |

---

## Component: `PhotoGallery`

```ts
interface PhotoItem {
  url: string;
  isDeletable: boolean; // false for official GeoFA photos
}

interface PhotoGalleryProps {
  photos: PhotoItem[];
  uploading: boolean;
  uploadError: string | null;
  onReorder: (newOrder: PhotoItem[]) => void;
  onDelete: (url: string) => void;
  onUpload: (file: File) => void;
}
```

**Behaviour:**
- Renders photos as a 2–3 column grid (same breakpoints as today).
- Each card: thumbnail (aspect-video), visible drag handle (≡ icon, always shown), delete button (red, only when `isDeletable`), small "Officielt" badge on non-deletable photos.
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`. Fires `onReorder` with the new sorted array after drop.
- Upload zone is a click-to-open file input at the bottom of the grid (not a drop target, to avoid conflicting with DnD). Upload button is disabled and shows tooltip when `photos.length >= MAX_PHOTOS`.
- No inline save — parent controls when to persist via "Gem billeder" button.

**Dependencies to add:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## Backend changes

### `lib/owner-db.ts`

`getSharedShelterContent()` — add `photo_order` to the select clause.

Extend the existing `updateSharedShelterContent()` fields type to include `photo_order?: string[] | null`. Do **not** add a separate `updatePhotoOrder()` function — keeping the update in one call ensures `photo_order` and other fields (e.g. `description`) are written atomically.

### `app/api/ejer/plads/[groupId]/settings/route.ts` (group) and `app/api/ejer/shelter/[id]/bookinger/settings/route.ts` (single-shelter)

**Note:** The single-shelter settings route (`bookinger/settings`) is structurally different — it uses a different auth check and direct `supabase.from("shelters").update()` instead of going through `owner-db.ts`. Both routes must be updated to accept `photo_order`, but the implementation detail differs:
- Group route: pass `photo_order` through to `updateSharedShelterContent()`.
- Single-shelter route: mirror the same allowlist validation and include `photo_order` in the direct update call.

**Validation (both routes):**
1. Confirm `photo_order` is an array of strings (if present).
2. Confirm `photo_order.length ≤ MAX_PHOTOS`.
3. **Server-side URL allowlist:** Fetch the shelter's current `image_url`, `image_urls`, `user_image_urls`, and `geofa_raw` from the database. Build the allowset by running the same canonical source-set logic as `getPhotoUrls()` (including `geofa_raw` PHOTO_KEYS). Every URL in `photo_order` must be present in the allowset. Return HTTP 400 for any URL that fails this check. This prevents an owner from injecting URLs from other shelters or arbitrary external sources.

### `app/api/ejer/shelter/[id]/billeder/route.ts`

**DELETE handler (atomic):** After validating `isOwnerPhotoPath`, remove the URL from `user_image_urls` **and** from `photo_order` in a single `UPDATE` statement (using Postgres array operators or an RPC that handles both columns atomically). The existing two-step approach (remove from `user_image_urls`, then separately update `photo_order`) risks `photo_order` retaining stale entries on partial failure.

**POST handler:** No change — newly uploaded URL is returned to the client; the frontend appends it to local state and persists on next "Gem billeder" save.

---

## Frontend changes

### `ShelterGroupSettingsForm.tsx`

**Remove:**
- `basePublicPhotos` and `ownerPhotos` as separate state slices.
- The "Nuværende offentligt galleri" display section.
- The "Ejer-uploadede billeder" section with arrow buttons.
- The `moveOwnerPhoto()` function.
- `fileInputRef` and inline `handleFileChange` (moved to `PhotoGallery`).

**Add:**
- `photos: PhotoItem[]` state, initialised by calling `getOrderedPhotoItems(shelter)` (the new helper) — this reflects the full ordered list including `geofa_raw` photos, without the `SKIP_FIRST_IMAGES` slice, matching what guests see before slicing.
- `<PhotoGallery photos={photos} onReorder={setPhotos} onDelete={handleDeletePhoto} onUpload={handleUpload} uploading={uploading} uploadError={uploadError} />`.
- "Gem billeder"-knap that saves `photos.map(p => p.url)` as `photo_order` via the settings PATCH endpoint.

### `ShelterEditForm.tsx`

Same treatment. Currently this form does not receive official photos (`image_url`, `image_urls`, `geofa_raw`) as props. Since `getOrderedPhotoItems()` needs those fields, the server page must pass the full shelter object (or at minimum those fields plus `user_image_urls`, `photo_order`, `slug`, `geofa_raw`) already fetched via `getSharedShelterContent()`. The `getSharedShelterContent()` select must also include `geofa_raw` if not already present.

---

## Migration script

A one-time script `scripts/backfill-photo-order.ts`:
- Fetches all shelters where `user_image_urls` is non-empty and `photo_order` is null; selects `id, image_url, image_urls, user_image_urls, geofa_raw`.
- For each: runs the canonical source-set logic (same as `getPhotoUrls()` — including `geofa_raw` photo keys, filtering/deduplication) to produce the initial `photo_order`. This ensures the backfilled order matches exactly what `getPhotoUrls()` would display.
- Run once after deploying the migration.

---

## Error handling

- Upload failure: shown inline below gallery (existing pattern).
- Delete failure: shown inline, photo re-added to state.
- Save failure (including 400 from URL allowlist rejection or 422 from MAX_PHOTOS): shown next to "Gem billeder" button.
- DnD is purely client-side — no server calls until explicit save.

---

## Out of scope

- Owners cannot delete official (GeoFA) photos — only reorder them.
- No bulk delete.
- No crop/rotate.
- No caption/alt-text editing.
