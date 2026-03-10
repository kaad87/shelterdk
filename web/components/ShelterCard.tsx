"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { Shelter } from "@/types/shelter";
import { getCity, getDisplayImageUrl, isShelterPlace, isValidImageUrl } from "@/lib/shelter-detail";
import { ShelterPlaceholder } from "@/components/ShelterPlaceholder";
import { getProxiedImageSrc } from "@/lib/image-proxy";

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
      onError={() => onErrorRef.current()}
      onLoad={handleLoad}
      priority={priority}
    />
  );
}

export function ShelterCard({ shelter, onImageError, href, priority }: ShelterCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayUrl = getDisplayImageUrl(shelter);
  const hasValidImage = displayUrl && isValidImageUrl(displayUrl) && !imageFailed;
  const imageUrl = hasValidImage ? displayUrl.trim() : null;
  const imageSrc = imageUrl ? getProxiedImageSrc(imageUrl) : null;
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
            src={imageSrc!}
            alt={`Billede af shelter ${shelter.title}`}
            onError={onImageError}
            timeoutRef={timeoutRef}
            loadedRef={loadedRef}
            priority={priority}
          />
        ) : (
          <Image
            src={imageSrc!}
            alt={`Billede af shelter ${shelter.title}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
            priority={priority}
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
        {/* Reserver plads så alle kort har samme højde uanset bookbar */}
        <p className="mt-2 min-h-[1.25rem] text-sm font-medium text-accent">
          {shelter.booking_url && "Bookbar"}
        </p>
      </div>
    </Link>
  );
}
