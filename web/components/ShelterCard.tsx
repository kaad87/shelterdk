"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, CheckCircle, Droplets, Dog, Flame } from "lucide-react";
import type { Shelter } from "@/types/shelter";
import { getCity, getResolvedPhotoUrls, isShelterPlace, isValidImageUrl, getWater, getToilet, getPetsAllowed } from "@/lib/shelter-detail";
import { ShelterPlaceholder } from "@/components/ShelterPlaceholder";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";

interface ShelterCardProps {
  shelter: Shelter;
  /** Kaldes når billedet ikke kan indlæses – bruges på forsiden for at skjule kort med defekte billeder. */
  onImageError?: () => void;
  /** Overstyring af link-URL (fx silo: /danmark/region/kommune/slug). */
  href?: string;
  /** Sæt for above-the-fold kort (fx forsiden) for hurtigere LCP. */
  priority?: boolean;
}

const IMAGE_LOAD_TIMEOUT_MS = 2500;

function FrontPageCardImage({
  src,
  alt,
  onError,
  timeoutRef,
  loadedRef,
  priority,
}: {
  src: string;
  alt: string;
  onError: () => void;
  timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadedRef: React.MutableRefObject<boolean>;
  priority?: boolean;
}) {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!loadedRef.current) onErrorRef.current();
    }, IMAGE_LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [timeoutRef, loadedRef]);

  const handleLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    loadedRef.current = true;
  };

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      unoptimized={isUnoptimizedImageUrl(src)}
      onError={() => onErrorRef.current()}
      onLoad={handleLoad}
      priority={priority}
    />
  );
}

export function ShelterCard({ shelter, onImageError, href, priority }: ShelterCardProps) {
  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const photoRef = shelter.google_photo_ref ?? (Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null);
  const resolvedUrls = getResolvedPhotoUrls(shelter, photoRef);
  const displayableUrls = resolvedUrls.filter(
    (u) => u.startsWith("/api/google-photo") || isValidImageUrl(u)
  );
  const proxiedSrcs = displayableUrls.map(getProxiedImageSrc);

  const [cardImageIndex, setCardImageIndex] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  const hasImagesToTry = proxiedSrcs.length > 0;
  const currentSrc =
    hasImagesToTry && cardImageIndex < proxiedSrcs.length ? proxiedSrcs[cardImageIndex] : null;
  const hasValidImage = currentSrc && !gaveUp;

  const handleImageError = () => {
    if (cardImageIndex < proxiedSrcs.length - 1) {
      setCardImageIndex((i) => i + 1);
    } else {
      setGaveUp(true);
      onImageError?.();
    }
  };

  const loadedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRating =
    shelter.google_rating != null && isShelterPlace(shelter.google_place_name ?? null);
  // By/kommune: primært DB-felt kommune, ellers getCity (geofa_raw) eller region (ikke "Danmark").
  const city =
    (shelter.kommune && shelter.kommune.trim()) ||
    getCity(shelter) ||
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const linkHref = href ?? `/shelter/${shelter.slug}`;

  return (
    <Link
      href={linkHref}
      className="group block overflow-hidden rounded-xl bg-white shadow-sm transition-transform duration-300 hover:scale-[1.02] md:hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.98] touch-manipulation"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-primary/10">
        {!hasValidImage ? (
          <ShelterPlaceholder
            className="absolute inset-0"
            size="compact"
          />
        ) : onImageError ? (
          <FrontPageCardImage
            key={currentSrc}
            src={currentSrc!}
            alt={`Billede af shelter ${shelter.title}`}
            onError={handleImageError}
            timeoutRef={timeoutRef}
            loadedRef={loadedRef}
            priority={priority && cardImageIndex === 0}
          />
        ) : (
          <Image
            key={currentSrc}
            src={currentSrc!}
            alt={`Billede af shelter ${shelter.title}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized={currentSrc ? isUnoptimizedImageUrl(currentSrc) : false}
            onError={handleImageError}
            priority={priority && cardImageIndex === 0}
          />
        )}
        {showRating && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-primary/90 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
            <Star size={14} className="fill-accent text-accent" />
            <span>{shelter.google_rating!.toFixed(1)}</span>
            {shelter.google_user_ratings_total != null && (
              <span className="text-white/90">
                ({shelter.google_user_ratings_total})
              </span>
            )}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-semibold text-primary truncate">
          {shelter.title}
        </h3>
        {city && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{city}</span>
          </p>
        )}
        {/* Facility badges */}
        <div className="mt-1.5 flex items-center gap-1.5 min-h-[1.25rem]" aria-label="Faciliteter">
          {(() => {
            const water = getWater(shelter);
            const toilet = getToilet(shelter);
            const pets = getPetsAllowed(shelter);
            const hasToilet = toilet === "flush" || toilet === "mulch";
            return (
              <>
                {water === true && (
                  <span className="flex items-center gap-0.5 text-primary/50 text-[11px]" title="Vand" role="img" aria-label="Vand">
                    <Droplets size={13} aria-hidden="true" />
                  </span>
                )}
                {hasToilet && (
                  <span className="flex items-center gap-0.5 text-primary/50 text-[11px]" title="Toilet" role="img" aria-label="Toilet">
                    <span aria-hidden="true">🚽</span>
                  </span>
                )}
                {pets === true && (
                  <span className="flex items-center gap-0.5 text-primary/50 text-[11px]" title="Hund tilladt" role="img" aria-label="Hund tilladt">
                    <Dog size={13} aria-hidden="true" />
                  </span>
                )}
              </>
            );
          })()}
        </div>
        {/* Bookbar badge */}
        <div className="mt-1.5 min-h-[1.5rem]">
          {shelter.booking_url && (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full border border-green-200">
              <CheckCircle size={12} />
              Bookbar
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
