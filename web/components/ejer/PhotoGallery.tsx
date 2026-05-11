"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PhotoItem } from "@shared/types/shelter";
import { MAX_PHOTOS } from "@shared/lib/shelter-detail";

interface PhotoGalleryProps {
  photos: PhotoItem[];
  uploading: boolean;
  uploadError: string | null;
  onReorder: (newOrder: PhotoItem[]) => void;
  onDelete: (url: string) => void;
  onUpload: (file: File) => void;
}

function SortablePhoto({
  item,
  onDelete,
}: {
  item: PhotoItem;
  onDelete: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-video rounded-xl overflow-hidden bg-primary/5 touch-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt="" className="w-full h-full object-cover" />

      {/* Drag handle — always visible */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-2 py-1 text-white cursor-grab active:cursor-grabbing"
        title="Træk for at ændre rækkefølgen"
        aria-label="Ryk billede"
      >
        <span className="text-xs leading-none">≡</span>
      </button>

      {/* Official badge for non-deletable (GeoFA/admin) photos */}
      {!item.isDeletable && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
          Officielt
        </span>
      )}

      {/* Delete button — only for owner photos */}
      {item.isDeletable && (
        <button
          type="button"
          onClick={() => onDelete(item.url)}
          className="absolute right-1.5 top-1.5 rounded-md bg-red-600/90 px-2 py-1 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-600"
          title="Slet billede"
        >
          Slet
        </button>
      )}
    </div>
  );
}

export function PhotoGallery({
  photos,
  uploading,
  uploadError,
  onReorder,
  onDelete,
  onUpload,
}: PhotoGalleryProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const atLimit = photos.length >= MAX_PHOTOS;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.url === active.id);
    const newIndex = photos.findIndex((p) => p.url === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(photos, oldIndex, newIndex));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {photos.length === 0 ? (
        <p className="text-sm text-primary/40">Ingen billeder endnu.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map((p) => p.url)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((item) => (
                <SortablePhoto key={item.url} item={item} onDelete={onDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Upload zone */}
      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 transition-colors ${
          atLimit || uploading
            ? "border-primary/8 bg-primary/[0.01] cursor-not-allowed opacity-50"
            : "border-primary/15 cursor-pointer hover:border-accent/40 hover:bg-accent/[0.02]"
        }`}
        title={atLimit ? `Maks. ${MAX_PHOTOS} billeder` : undefined}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploading || atLimit}
        />
        <span className="text-2xl mb-2">{uploading ? "⏳" : "📷"}</span>
        <span className="text-sm font-medium text-primary/60">
          {uploading
            ? "Uploader…"
            : atLimit
            ? `Maks. ${MAX_PHOTOS} billeder nået`
            : "Klik for at tilføje billede"}
        </span>
        <span className="text-xs text-primary/30 mt-1">JPEG, PNG eller WebP · maks. 5 MB</span>
      </label>

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
    </div>
  );
}
