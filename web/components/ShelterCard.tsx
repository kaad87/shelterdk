"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, CheckCircle, Droplets, Dog, Flame, Users } from "lucide-react";
import type { Shelter } from "@/types/shelter";
import { getCity, getResolvedPhotoUrls, isShelterPlace, isValidImageUrl, getWater, getToilet, getPetsAllowed, isBookable } from "@/lib/shelter-detail";
import { ShelterPlaceholder } from "@/components/ShelterPlaceholder";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";
import { ImageCarousel } from "@/components/ImageCarousel";

interface ShelterCardProps {
  shelter: Shelter;
  /** Kaldes når billedet ikke kan indlæses – bruges på forsiden for at skjule kort med defekte billeder. */
  onImageError?: () => void;
  /** Overstyring af link-URL (fx silo: /danmark/region/kommune/slug). */
  href?: string;
  /** Sæt for above-the-fold kort (fx forsiden) for hurtigere LCP. */
  priority?: boolean;
  /**
   * Marker kortet med "Ny"-badge. Beregnes af parent (server-komponent) via
   * isNewShelter() — holdes ude af klient-bundlen, da new-shelters.ts importerer
   * server-only Supabase-klient.
   */
  isNew?: boolean;
  /** Ledighedsstatus for aktiv datosøgning. */
  availabilityState?: "available" | "booked" | "partial" | null;
  /** Aktiv søgedato (ISO YYYY-MM-DD) – bruges i badge-tekst. */
  activeDate?: string | null;
  /**
   * Deaktiver image-carousel selv hvis shelteret har flere billeder.
   * Bruges i horisontalt-scrollende kontekster (forsidens "Populære
   * shelters"-strip) hvor en indre swipe-gesture kæmper mod den ydre
   * scroll og frustrerer brugeren. Vi viser blot første billede her.
   */
  disableCarousel?: boolean;
}

const IMAGE_LOAD_TIMEOUT_MS = 2500;
const CARD_SIZES = "(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw";

function FrontPageCardImage({
  src,
  alt,
  onError,
  timeoutRef,
  loadedRef,
  priority,
  blurDataUrl,
}: {
  src: string;
  alt: string;
  onError: () => void;
  timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadedRef: React.MutableRefObject<boolean>;
  priority?: boolean;
  blurDataUrl?: string;
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
      sizes={CARD_SIZES}
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      unoptimized={isUnoptimizedImageUrl(src)}
      onError={() => onErrorRef.current()}
      onLoad={handleLoad}
      priority={priority}
      {...(blurDataUrl
        ? { placeholder: "blur" as const, blurDataURL: blurDataUrl }
        : {})}
    />
  );
}

function formatDanishDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(d);
}

export function ShelterCard({ shelter, onImageError, href, priority, availabilityState, activeDate, disableCarousel = false, isNew = false }: ShelterCardProps) {
  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const photoRef = shelter.google_photo_ref ?? (Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null);
  const resolvedUrls = getResolvedPhotoUrls(shelter, photoRef);
  const BROKEN_PATTERNS = [
    "cookiebot.com",
    "cookieinformation.com",
    "pixel",
    "tracking",
    "1x1",
    "spacer.gif",
    "blank.gif",
    "transparent.gif",
  ];
  const displayableUrls = resolvedUrls.filter((u) => {
    if (!u.startsWith("/api/google-photo") && !isValidImageUrl(u)) return false;
    if (!u.trim() || u.trim().length < 10) return false;
    const lower = u.toLowerCase();
    return !BROKEN_PATTERNS.some((pat) => lower.includes(pat));
  });
  // Card-billeder er en af de mest sete flader på sitet. Giv proxyen en fast
  // thumbnail-bredde, så vi ikke sender store originals rundt til lister.
  const proxiedSrcs = displayableUrls.map((u) => getProxiedImageSrc(u, { q: 70, w: 720 }));

  const [cardImageIndex, setCardImageIndex] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
  const city =
    (shelter.kommune && shelter.kommune.trim()) ||
    getCity(shelter) ||
    (shelter.region && shelter.region !== "Danmark" ? shelter.region : null);

  const linkHref = href ?? `/shelter/${shelter.slug}`;

  // Mobile carousel for multi-image shelters.
  // disableCarousel slukker carousel'en selv ved multi-image — bruges når
  // kortet sidder i en horisontalt-scrollende parent (forsidens
  // "Populære shelters") for at undgå nested swipe-gesture-konflikt.
  const useCarousel = isMobile && proxiedSrcs.length >= 2 && !gaveUp && !disableCarousel;

  const cardBody = (
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
      {/* Capacity + price quick-scan row */}
      {(() => {
        // "Gratis" badge er fjernet bevidst — payment-feltet er for upålideligt
        // (mange shelters har manglende eller forkerte payment-værdier) til at
        // vises som badge. Bring tilbage når data-kvaliteten er bedre.
        const showCapacity = shelter.capacity != null && shelter.capacity > 0;
        if (!showCapacity) return null;
        return (
          <div className="mt-1 flex items-center gap-2.5 text-xs text-primary/65">
            <span className="flex items-center gap-1">
              <Users size={12} aria-hidden="true" />
              {shelter.capacity} pladser
            </span>
          </div>
        );
      })()}
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
                  <span aria-hidden="true">&#x1F6BD;</span>
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
      {/* Bookbar + availability badges */}
      <div className="mt-1.5 flex flex-wrap gap-1 min-h-[1.5rem]">
        {isBookable(shelter) && (
          <span className="inline-flex items-center gap-1 bg-pine/5 text-pine text-xs font-medium px-2 py-0.5 rounded-full border border-pine/20">
            <CheckCircle size={12} />
            Bookbar
          </span>
        )}
        {availabilityState === "available" && activeDate && (
          <span className="inline-flex items-center gap-1 bg-pine-light/10 text-pine text-xs font-medium px-2 py-0.5 rounded-full border border-pine-light/30">
            <CheckCircle size={12} />
            Ledig {formatDanishDate(activeDate)}
          </span>
        )}
        {availabilityState === "partial" && activeDate && (
          <span className="inline-flex items-center gap-1 bg-accent/10 text-accent-dark text-xs font-medium px-2 py-0.5 rounded-full border border-accent/25">
            Delvist ledig {formatDanishDate(activeDate)}
          </span>
        )}
      </div>
    </div>
  );

  const isShelterDkBookable =
    Array.isArray(shelter.bookable_shelters) && shelter.bookable_shelters.length > 0;

  const ratingBadge = showRating && (
    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-primary/90 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm z-10">
      <Star size={14} className="fill-accent text-accent" />
      <span>{shelter.google_rating!.toFixed(1)}</span>
      {shelter.google_user_ratings_total != null && (
        <span className="text-white/90">
          ({shelter.google_user_ratings_total})
        </span>
      )}
    </div>
  );

  const bookBadge = isShelterDkBookable && (
    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-pine px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-white/25 z-10">
      <CheckCircle size={13} strokeWidth={2.5} />
      Book på ShelterDK
    </div>
  );

  // "Ny"-badge top-venstre. Rykkes ned hvis ShelterDK-book-badgen også vises,
  // så de to ikke overlapper.
  const nyBadge = isNew && (
    <div
      className={`absolute left-3 ${isShelterDkBookable ? "top-12" : "top-3"} flex items-center gap-1 rounded-full bg-accent-dark px-2.5 py-1 text-xs font-bold text-white shadow-sm ring-1 ring-white/25 z-10`}
    >
      <span aria-hidden="true">✨</span>
      Ny
    </div>
  );

  // Carousel path: outer is a real <Link> so Cmd/Ctrl-click and right-click work.
  // ImageCarousel handles swipe internally; on swipe it stopPropagation's the click
  // so the Link doesn't navigate. Normal clicks bubble up to Link and navigate.
  if (useCarousel) {
    return (
      <Link
        href={linkHref}
        prefetch={false}
        className="group block overflow-hidden rounded-xl bg-white border border-primary/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.98] touch-manipulation"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-primary/10">
          <ImageCarousel
            urls={proxiedSrcs}
            alt={`Billede af shelter ${shelter.title}`}
            sizes={CARD_SIZES}
            blurDataUrl={shelter.blur_data_url ?? undefined}
            priority={priority}
          />
          {bookBadge}
          {nyBadge}
          {ratingBadge}
        </div>
        {cardBody}
      </Link>
    );
  }

  // Standard path: Link wrapper with single image
  return (
    <Link
      href={linkHref}
      prefetch={false}
      className="group block overflow-hidden rounded-xl bg-white border border-primary/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.98] touch-manipulation"
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
            blurDataUrl={cardImageIndex === 0 ? shelter.blur_data_url ?? undefined : undefined}
          />
        ) : (
          <Image
            key={currentSrc}
            src={currentSrc!}
            alt={`Billede af shelter ${shelter.title}`}
            fill
            sizes={CARD_SIZES}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized={currentSrc ? isUnoptimizedImageUrl(currentSrc) : false}
            onError={handleImageError}
            priority={priority && cardImageIndex === 0}
            {...(shelter.blur_data_url && cardImageIndex === 0
              ? { placeholder: "blur" as const, blurDataURL: shelter.blur_data_url }
              : {})}
          />
        )}
        {bookBadge}
        {nyBadge}
        {ratingBadge}
      </div>
      {cardBody}
    </Link>
  );
}
