# Photo Gallery Redesign — Design Spec

## Goal

Replace the split "officielle billeder / ejer-uploadede billeder" UI in the ejer dashboard with a single unified, drag-and-drop sortable gallery where owners control the display order of all photos — official and their own — freely.

## Architecture

### Data model

Add `photo_order text[]` (nullable, default null) to the `shelters` table.

**Display order resolution in `getPhotoUrls()`:**
1. If `photo_order` is non-null and non-empty, use it as the base order.
2. Append any URLs from `[image_url, ...image_urls, ...user_image_urls]` that are not already present in `photo_order` (handles new GeoFA-synced photos automatically).
3. If `photo_order` is null or empty, fall back to current behavior: `[image_url, ...image_urls, ...user_image_urls]`.

This is backward-compatible: existing shelters without `photo_order` work identically to today.

**Migration:** For all shelters with non-empty `user_image_urls`, compute and write the initial `photo_order` as `[...image_urls, ...user_image_urls]` (preserving existing display order).

### Distinguishing deletable photos

A photo URL is owner-deletable if and only if its storage path starts with `owner/<shelterDbId>/`. This is checked via the existing `isOwnerPhotoPath()` helper in `lib/owner-db.ts`. Official photos (GeoFA/admin) are never deletable by owners.

---

## Files

| File | Change |
|------|--------|
| `migrations/YYYYMMDD_photo_order.sql` | Add `photo_order text[]` column to `shelters` |
| `shared/lib/shelter-detail.ts` | Update `getPhotoUrls()` with merge logic |
| `lib/owner-db.ts` | Add `photo_order` to `getSharedShelterContent()` select; new `updatePhotoOrder()` function |
| `app/api/ejer/plads/[groupId]/settings/route.ts` | Accept `photo_order` in PATCH body |
| `app/api/ejer/shelter/[id]/bookinger/settings/route.ts` | Accept `photo_order` in PATCH body (single-shelter path) |
| `app/api/ejer/shelter/[id]/billeder/route.ts` | On DELETE: remove URL from `photo_order` |
| `components/ejer/PhotoGallery.tsx` | New component (see below) |
| `components/ejer/ShelterGroupSettingsForm.tsx` | Replace two-section gallery with `<PhotoGallery>` |
| `components/ejer/ShelterEditForm.tsx` | Same replacement for single-shelter form |

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
- Upload zone is a click-to-open file input at the bottom of the grid (not a drop target, to avoid conflicting with DnD).
- No inline save — parent controls when to persist via "Gem billeder" button.

**Dependencies to add:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## Backend changes

### `lib/owner-db.ts`

`getSharedShelterContent()` — add `photo_order` to the select clause.

New function:
```ts
export async function updatePhotoOrder(
  shelterDbId: string,
  photoOrder: string[]
): Promise<void>
```
Writes `photo_order` to `shelters` where `id = shelterDbId`.

### `app/api/ejer/plads/[groupId]/settings/route.ts` (group)

Accept optional `photo_order: string[]` in PATCH body. Validate it is an array of strings. Call `updatePhotoOrder()`.

### Single-shelter settings route

Same addition: accept and persist `photo_order`.

### `app/api/ejer/shelter/[id]/billeder/route.ts`

**DELETE handler:** After removing the URL from `user_image_urls` (existing logic), also remove it from `photo_order` using an array-remove RPC or inline filter.

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
- `photos: PhotoItem[]` state, initialised from `photo_order` if set, else from merge of `basePublicPhotos` (isDeletable: false) + `ownerPhotos` (isDeletable: true).
- `<PhotoGallery photos={photos} onReorder={setPhotos} onDelete={handleDeletePhoto} onUpload={handleUpload} uploading={uploading} uploadError={uploadError} />`.
- "Gem billeder"-knap that calls `updatePhotoOrder` with `photos.map(p => p.url)`.

### `ShelterEditForm.tsx`

Same treatment. The `photo_order` value is passed from the server page (via `getSharedShelterContent()`).

---

## Migration script

A one-time script `scripts/backfill-photo-order.ts`:
- Fetches all shelters where `user_image_urls` is non-empty and `photo_order` is null.
- For each: computes `[...image_urls, ...user_image_urls]` and writes to `photo_order`.
- Run once after deploying the migration.

---

## Error handling

- Upload failure: shown inline below gallery (existing pattern).
- Delete failure: shown inline, photo re-added to state.
- Save failure: shown next to "Gem billeder" button.
- DnD is purely client-side — no server calls until explicit save.

---

## Out of scope

- Owners cannot delete official (GeoFA) photos — only reorder them.
- No bulk delete.
- No crop/rotate.
- No caption/alt-text editing.
