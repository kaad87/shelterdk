"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MapPin, Star, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ShelterPhotoUpload } from "@/components/ShelterPhotoUpload";
import { ShelterPlaceholder } from "@/components/ShelterPlaceholder";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";
import { ImageCarousel } from "@/components/ImageCarousel";

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
  blurDataUrl?: string;
  headingId?: string;
}

export function ShelterGallery({
  urls,
  title,
  rating,
  ratingsTotal,
  region,
  slug,
  shelterId,
  blurDataUrl,
  headingId,
}: ShelterGalleryProps) {
  const HERO_W = 1200;
  const THUMB_W = 320;
  const MAX_THUMBS = 10;

  const proxiedUrls = urls
    .map((u) => {
      const p = getProxiedImageSrc(u);
      if (p.includes("/api/image?url=")) return `${p}&w=${HERO_W}`;
      return p;
    })
    .filter((p) => p.trim().length > 0);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const visibleUrls = proxiedUrls.filter((u) => !brokenUrls.has(u));
  const markBroken = (url: string) => setBrokenUrls((prev) => new Set([...prev, url]));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroGaveUp, setHeroGaveUp] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const lightboxScrollRef = useRef<HTMLDivElement>(null);
  const hasImages = visibleUrls.length > 0;
  const showUploadForm = !hasImages && slug && shelterId;

  // Show keyboard hint for 3 seconds when lightbox opens
  useEffect(() => {
    if (lightboxIndex !== null && visibleUrls.length > 1) {
      setShowKeyboardHint(true);
      const timer = setTimeout(() => setShowKeyboardHint(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowKeyboardHint(false);
    }
  }, [lightboxIndex, visibleUrls.length]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [lightboxIndex]);

  // Scroll lightbox to correct image when opening
  useEffect(() => {
    if (lightboxIndex === null) return;
    const el = lightboxScrollRef.current;
    if (!el) return;
    // Instant scroll to the right position on open
    el.scrollTo({ left: el.clientWidth * lightboxIndex, behavior: "instant" as ScrollBehavior });
  }, [lightboxIndex !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation when lightbox is open
  useEffect(() => {
    if (visibleUrls.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateLightbox(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateLightbox(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, visibleUrls.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateLightbox = (direction: 1 | -1) => {
    const el = lightboxScrollRef.current;
    if (!el) return;
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      const next = (prev + direction + visibleUrls.length) % visibleUrls.length;
      el.scrollTo({ left: el.clientWidth * next, behavior: "smooth" });
      return next;
    });
  };

  const closeLightbox = () => {
    // Sync hero carousel to the image the user was viewing in lightbox
    if (lightboxIndex !== null) {
      const el = carouselRef.current;
      if (el) {
        const scrollTo = (el as any)._scrollToIndex;
        if (scrollTo) scrollTo(lightboxIndex);
      }
    }
    setLightboxIndex(null);
  };

  const openLightbox = () => {
    // Read current carousel index from scroll position
    const el = carouselRef.current;
    let idx = 0;
    if (el) {
      const slideWidth = el.clientWidth;
      if (slideWidth > 0) {
        idx = Math.round(el.scrollLeft / slideWidth);
      }
    }
    setLightboxIndex(Math.max(0, Math.min(idx, visibleUrls.length - 1)));
  };

  return (
    <>
      {/* Hero: carousel, upload form, or placeholder */}
      <div className="relative w-full min-h-[200px] sm:min-h-[280px] aspect-[4/3] rounded-xl overflow-hidden bg-primary mb-3 isolate">
        {hasImages && !heroGaveUp ? (
          <>
            <div ref={carouselRef} className="absolute inset-0">
              <ImageCarousel
                urls={visibleUrls}
                alt={`Billede af shelter ${title}`}
                sizes="(max-width: 1024px) 100vw, 896px"
                blurDataUrl={blurDataUrl}
                onTap={openLightbox}
                priority
                className="h-full"
                aspectRatio=""
              />
            </div>
          </>
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
          <h1 id={headingId} className="font-serif text-2xl md:text-3xl font-bold text-white">
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

      {/* Thumbnail strip — hidden on mobile, visible on desktop */}
      {(() => {
        if (visibleUrls.length <= 1) return null;
        const toShow = visibleUrls.slice(0, MAX_THUMBS);
        return (
          <div className="hidden md:flex gap-2 mb-6 overflow-x-auto pb-1">
            {toShow.map((url, i) => {
              const thumbUrl = url.startsWith("/api/google-photo")
                ? url.replace(/([?&])maxwidth=\d+/i, `$1maxwidth=${THUMB_W}`)
                : url.includes("/api/image?url=")
                  ? url.replace(/([?&])w=\d+/i, `$1w=${THUMB_W}`)
                  : url;
              return (
                <button
                  key={`${i}-${url}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Vis billede ${i + 1}`}
                  className="relative flex-none w-20 h-16 rounded-lg overflow-hidden border-2 transition-all border-transparent opacity-70 hover:opacity-100 hover:border-accent/50"
                >
                  <Image
                    src={thumbUrl}
                    alt={`${title} – miniature ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized={isUnoptimizedImageUrl(thumbUrl)}
                    onError={() => markBroken(url)}
                  />
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Lightbox with swipe support */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Billedvisning"
        >
          {/* Close button */}
          <span className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer z-20">
            <X size={24} />
          </span>

          {/* Counter */}
          <span className="absolute top-4 left-4 text-white/70 text-sm z-20">
            {lightboxIndex + 1} / {visibleUrls.length}
          </span>

          {/* Previous button */}
          {visibleUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 z-20"
              aria-label="Forrige billede"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Next button */}
          {visibleUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 z-20"
              aria-label="Næste billede"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Swipeable lightbox images */}
          <div
            ref={lightboxScrollRef}
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: "none", touchAction: "pan-y pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          >
            {visibleUrls.map((url, i) => (
              <div
                key={`lb-${i}-${url}`}
                className="relative w-full h-full flex-none snap-start flex items-center justify-center p-4"
              >
                <Image
                  src={url}
                  alt={`${title} – billede ${i + 1} i fuld størrelse`}
                  width={1200}
                  height={900}
                  className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                  unoptimized={isUnoptimizedImageUrl(url)}
                  loading={Math.abs(i - (lightboxIndex ?? 0)) <= 1 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>

          {/* Keyboard navigation hint */}
          {visibleUrls.length > 1 && (
            <span
              className={`absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1.5 rounded-full transition-opacity duration-500 z-20 ${
                showKeyboardHint ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              Brug piletaster eller swipe
            </span>
          )}

          {/* Aria-live announcement */}
          <div aria-live="polite" className="sr-only">
            Billede {lightboxIndex + 1} af {visibleUrls.length}
          </div>
        </div>
      )}
    </>
  );
}
