"use client";

import { useRef } from "react";
import type { UploadedPhoto } from "../usePhotoUpload";

// Trin 4 — Billeder: stor drop-zone + thumbnail-stribe med hovedbillede-markering.

interface StepPhotosProps {
  photos: UploadedPhoto[];
  uploading: boolean;
  error: string | null;
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
}

export function StepPhotos({
  photos,
  uploading,
  error,
  onAdd,
  onRemove,
}: StepPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    // Cap batchen til resterende kapacitet HER — addPhoto's egen tælling læser en
    // forældet closure-værdi ved samtidige kald, så en multi-fil-drop af 6+ ellers
    // ville slippe forbi 5-grænsen og uploade forældreløse filer (afvist ved submit).
    const remaining = 5 - photos.length;
    if (remaining <= 0) return;
    Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining)
      .forEach((file) => onAdd(file));
  }

  return (
    <div className="space-y-4">
      {/* Stor drop-zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-pine/30 bg-pine/5 px-6 py-10 text-center transition-colors hover:border-accent hover:bg-accent/5"
      >
        <div className="text-3xl mb-2">📷</div>
        <p className="text-sm font-medium text-pine">
          Træk billeder hertil eller vælg filer
        </p>
        <p className="text-xs text-primary/50 mt-1">
          JPG/PNG/WebP · maks 5 · op til 10 MB
        </p>
        <p className="text-xs text-primary/40 mt-0.5">
          Første billede bliver hovedbillede
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // nulstil så samme fil kan vælges igen
        }}
      />

      {/* Upload-indikator */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-primary/60">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-pine/30 border-t-pine animate-spin" />
          Uploader...
        </div>
      )}

      {/* Fejlboks */}
      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 border border-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Thumbnail-stribe */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo, i) => (
            <div key={photo.path} className="relative w-24 h-24">
              {photo.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.previewUrl}
                  alt={`Billede ${i + 1}`}
                  className="w-24 h-24 object-cover rounded-lg border border-primary/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-xs text-primary/40">
                  📷
                </div>
              )}
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-pine text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  Hoved
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                aria-label="Fjern billede"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
