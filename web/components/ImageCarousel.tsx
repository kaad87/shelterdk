"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { isUnoptimizedImageUrl } from "@/lib/image-proxy";

interface ImageCarouselProps {
  urls: string[];
  alt: string;
  sizes: string;
  blurDataUrl?: string;
  onTap?: () => void;
  priority?: boolean;
  className?: string;
  aspectRatio?: string;
}

export function ImageCarousel({
  urls,
  alt,
  sizes,
  blurDataUrl,
  onTap,
  priority,
  className = "",
  aspectRatio = "aspect-[4/3]",
}: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  // Filter out failed images
  const visibleUrls = urls.filter((u) => !failedUrls.has(u));

  const handleImageError = useCallback((url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  }, []);

  // Track active slide via scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    if (slideWidth === 0) return;
    const index = Math.round(el.scrollLeft / slideWidth);
    setActiveIndex(Math.max(0, Math.min(index, visibleUrls.length - 1)));
  }, [visibleUrls.length]);

  // Swipe vs tap detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (deltaX >= 10) {
      didSwipe.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    // Don't call onTap — let the click event handle it if no swipe occurred
  }, []);

  // Click handler: fires for both desktop clicks and mobile taps (after touchEnd)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didSwipe.current) {
        // Was a swipe — stop propagation to prevent parent onClick (e.g., ShelterCard div)
        e.stopPropagation();
        didSwipe.current = false;
        return;
      }
      if (onTap) {
        onTap();
      }
    },
    [onTap],
  );

  // Preload neighbor images: current ± 1 are eager
  const getLoading = (index: number): "eager" | "lazy" => {
    if (priority && index === 0) return "eager";
    if (index <= 1) return "eager";
    if (Math.abs(index - activeIndex) <= 1) return "eager";
    return "lazy";
  };

  // Scroll to a specific slide (used by parent for lightbox sync)
  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) (el as any)._scrollToIndex = scrollToIndex;
  }, [scrollToIndex]);

  if (visibleUrls.length === 0) return null;

  return (
    <div className={`relative ${aspectRatio} ${className}`}>
      <div
        ref={scrollRef}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", touchAction: "pan-y pinch-zoom" }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {visibleUrls.map((url, i) => (
          <div key={`${i}-${url}`} className="relative w-full flex-none snap-start">
            <Image
              src={url}
              alt={`${alt} – billede ${i + 1}`}
              fill
              sizes={sizes}
              className="object-cover"
              loading={getLoading(i)}
              priority={priority && i === 0}
              unoptimized={isUnoptimizedImageUrl(url)}
              onError={() => handleImageError(url)}
              {...(i === 0 && blurDataUrl
                ? { placeholder: "blur" as const, blurDataURL: blurDataUrl }
                : {})}
            />
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      {visibleUrls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
          {visibleUrls.length <= 5 ? (
            visibleUrls.map((_, i) => (
              <div
                key={i}
                className={`w-[7px] h-[7px] rounded-full transition-colors ${
                  i === activeIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))
          ) : (
            (() => {
              const dots: { index: number; size: "sm" | "md" | "lg" }[] = [];
              for (let offset = -2; offset <= 2; offset++) {
                const idx = activeIndex + offset;
                if (idx < 0 || idx >= visibleUrls.length) continue;
                const absOff = Math.abs(offset);
                dots.push({
                  index: idx,
                  size: absOff === 0 ? "lg" : absOff === 1 ? "md" : "sm",
                });
              }
              const sizeClass = { sm: "w-[5px] h-[5px]", md: "w-[6px] h-[6px]", lg: "w-[7px] h-[7px]" };
              return dots.map((d) => (
                <div
                  key={d.index}
                  className={`rounded-full transition-all ${sizeClass[d.size]} ${
                    d.index === activeIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
