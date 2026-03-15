"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MapPin, Star, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ShelterPhotoUpload } from "@/components/ShelterPhotoUpload";
import { ShelterPlaceholder } from "@/components/ShelterPlaceholder";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";

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
  const proxiedUrls = urls.map(getProxiedImageSrc);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroGaveUp, setHeroGaveUp] = useState(false);
  const hasImages = proxiedUrls.length > 0;
  const mainImageUrl = hasImages && heroIndex < proxiedUrls.length ? proxiedUrls[heroIndex] : null;
  const isGoogleProxyUrl = mainImageUrl?.startsWith("/api/google-photo") ?? false;
  const showMainImage = mainImageUrl && !heroGaveUp;
  const showUploadForm = !showMainImage && slug && shelterId && !isGoogleProxyUrl;

  const handleHeroError = () => {
    if (heroIndex < proxiedUrls.length - 1) {
      setHeroIndex((i) => i + 1);
    } else {
      setHeroGaveUp(true);
    }
  };

  // Tastaturstyring, når lightbox er åben
  useEffect(() => {
    if (lightboxIndex === null || proxiedUrls.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLightboxIndex(null);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev === null ? 0 : (prev + 1) % proxiedUrls.length,
        );
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setLightboxIndex((prev) =>
          prev === null ? 0 : (prev - 1 + proxiedUrls.length) % proxiedUrls.length,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, proxiedUrls.length]);

  return (
    <>
      {/* Hero: billede eller "Ingen billede"-placeholder */}
      <div className="relative w-full min-h-[200px] sm:min-h-[280px] aspect-[4/3] rounded-xl overflow-hidden bg-primary mb-3 isolate">
        {showMainImage ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(heroIndex)}
            className="absolute inset-0 z-0"
            aria-label="Vis hovedbilledet i fuld størrelse"
          >
            <Image
              key={mainImageUrl}
              src={mainImageUrl!}
              alt={`Billede af shelter ${title}`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority={heroIndex === 0}
              unoptimized={isUnoptimizedImageUrl(mainImageUrl)}
              onError={handleHeroError}
            />
          </button>
        ) : showUploadForm ? (
          <div className="absolute inset-0 z-0">
            <ShelterPhotoUpload
              shelterId={shelterId}
              slug={slug}
              variant="inline"
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0">
            <ShelterPlaceholder className="h-full w-full" size="default" />
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

      {/* Thumbnail-strip: vis kun fra heroIndex så fejlede første billeder ikke vises som ødelagte ikoner */}
      {(() => {
        const displayUrls = heroIndex > 0 ? proxiedUrls.slice(heroIndex) : proxiedUrls;
        if (displayUrls.length <= 1) return null;
        return (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {displayUrls.map((url, i) => {
              const fullIndex = heroIndex + i;
              return (
                <button
                  key={`${fullIndex}-${url}`}
                  type="button"
                  onClick={() => setLightboxIndex(fullIndex)}
                  aria-label={`Vis billede ${fullIndex + 1}`}
                  className={`relative flex-none w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    fullIndex === heroIndex
                      ? "border-accent"
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-accent/50"
                  }`}
                >
                  <Image
                    src={url}
                    alt={`${title} – miniature ${fullIndex + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized={isUnoptimizedImageUrl(url)}
                  />
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Lightbox med pile-navigation */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Billedvisning"
        >
          {/* Luk-knap */}
          <span className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer">
            <X size={24} />
          </span>

          {/* Tæller */}
          <span className="absolute top-4 left-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {proxiedUrls.length}
          </span>

          {/* Forrige-knap */}
          {proxiedUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) =>
                  prev === null ? 0 : (prev - 1 + proxiedUrls.length) % proxiedUrls.length,
                );
              }}
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Forrige billede"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Næste-knap */}
          {proxiedUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) =>
                  prev === null ? 0 : (prev + 1) % proxiedUrls.length,
                );
              }}
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Næste billede"
            >
              <ChevronRight size={28} />
            </button>
          )}

          <Image
            src={proxiedUrls[lightboxIndex]}
            alt={`${title} – billede ${lightboxIndex + 1} i fuld størrelse`}
            width={1200}
            height={900}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
            unoptimized={isUnoptimizedImageUrl(proxiedUrls[lightboxIndex])}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
