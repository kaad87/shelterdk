"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MapPin, Star, X } from "lucide-react";
import { ShelterPhotoUpload } from "@/components/ShelterPhotoUpload";

interface ShelterGalleryProps {
  /** Alle billeder, inkl. hero-billedet som første element. Tom array = vis "Ingen billede"-placeholder. */
  urls: string[];
  title: string;
  rating?: number | null;
  ratingsTotal?: number | null;
  region?: string | null;
  /** Når sat og der ikke er billeder, vises upload-formular inde i placeholder. */
  slug?: string;
  shelterId?: string;
}

export function ShelterGallery({
  urls,
  title,
  rating,
  ratingsTotal,
  region,
  slug,
  shelterId,
}: ShelterGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const hasImages = urls.length > 0;
  const mainImageUrl = hasImages ? urls[0] : null;
  const galleryUrls = hasImages ? urls.slice(1) : [];
  const showMainImage = mainImageUrl && !mainImageFailed;

  // Tastaturstyring, når lightbox er åben
  useEffect(() => {
    if (lightboxIndex === null || urls.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLightboxIndex(null);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev === null ? 0 : (prev + 1) % urls.length,
        );
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev === null ? 0 : (prev - 1 + urls.length) % urls.length,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, urls.length]);

  return (
    <>
      {/* Hero: billede eller "Ingen billede"-placeholder */}
        <div className="relative w-full min-h-[200px] sm:min-h-[280px] aspect-[4/3] rounded-xl overflow-hidden bg-primary mb-6 isolate">
        {showMainImage ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute inset-0 z-0"
            aria-label="Vis hovedbilledet i fuld størrelse"
          >
            <Image
              src={mainImageUrl!}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
              unoptimized
              onError={() => setMainImageFailed(true)}
            />
          </button>
        ) : slug && shelterId ? (
          <div className="absolute inset-0 z-0">
            <ShelterPhotoUpload
              shelterId={shelterId}
              slug={slug}
              variant="inline"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 text-white/80"
            aria-hidden
          >
            <svg
              className="w-16 h-16 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium">Ingen billede</span>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-primary/90 to-transparent">
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-white">
            {title}
          </h1>
          {(rating != null || region) && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-white/90 text-sm">
              {rating != null && (
                <span className="flex items-center gap-1">
                  <Star size={16} className="fill-accent text-accent" />
                  {rating.toFixed(1)}
                  {ratingsTotal != null && (
                    <span className="text-white/80">
                      ({ratingsTotal} anmeldelser)
                    </span>
                  )}
                </span>
              )}
              {region && (
                <span className="flex items-center gap-1">
                  <MapPin size={16} />
                  {region}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnails under hero – klik åbner også lightbox */}
      {galleryUrls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          {galleryUrls.slice(0, 4).map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIndex(i + 1)}
              className="relative w-full aspect-square min-h-0 rounded-xl overflow-hidden bg-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              aria-label={`Vis billede ${i + 1} i fuld størrelse`}
            >
              <Image
                src={url}
                alt={`${title} – billede ${i + 2}`}
                fill
                className="object-cover transition-transform hover:scale-105"
                sizes="(max-width: 640px) 50vw, 25vw"
                unoptimized
              />
            </button>
          ))}
          {galleryUrls.length > 4 && (
            <div className="col-span-2 sm:col-span-4 flex items-center justify-center rounded-xl bg-primary/10 py-4">
              <span className="text-primary/80 text-sm font-medium">
                + {galleryUrls.length - 4} billeder i GeoFA
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lightbox: klik udenfor, på X eller brug tastatur (← → Esc) */}
      {lightboxIndex !== null && (
        <button
          type="button"
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 focus:outline-none"
          aria-label="Luk billede"
        >
          <span className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X size={24} />
          </span>
          <img
            src={urls[lightboxIndex]}
            alt={`${title} – billede ${lightboxIndex + 2}`}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      )}
    </>
  );
}
