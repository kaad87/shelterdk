"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, Trash2 } from "lucide-react";
import { getProxiedImageSrc, isUnoptimizedImageUrl } from "@/lib/image-proxy";
import { getWishlist, removeFromWishlist, type WishlistItem } from "@/lib/wishlist";
import { trackWishlist } from "@/lib/tracking";

export function FavoritterClient() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const renderedItems = useMemo(
    () =>
      (items ?? []).map((item) => {
        const imageSrc = item.imageUrl
          ? getProxiedImageSrc(item.imageUrl, { q: 70, w: 320 })
          : null;
        return {
          ...item,
          imageSrc,
          imageUnoptimized: imageSrc ? isUnoptimizedImageUrl(imageSrc) : false,
        };
      }),
    [items]
  );

  useEffect(() => {
    setItems(getWishlist());
    const handle = () => setItems(getWishlist());
    window.addEventListener("shelterdk:wishlist-changed", handle);
    return () => window.removeEventListener("shelterdk:wishlist-changed", handle);
  }, []);

  const handleRemove = (slug: string) => {
    const next = removeFromWishlist(slug);
    setItems(next);
    trackWishlist("remove", slug);
  };

  if (items === null) {
    return (
      <div className="rounded-2xl border border-primary/8 bg-white p-8 text-center text-sm text-primary/40">
        Indlæser…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/15 bg-white p-10 text-center">
        <Heart size={36} className="mx-auto mb-3 text-primary/20" />
        <p className="text-base text-primary/70 mb-1">Ingen favoritter endnu</p>
        <p className="text-sm text-primary/40 mb-6">
          Klik på hjertet på en shelterside for at gemme den til senere.
        </p>
        <Link
          href="/soeg"
          className="inline-flex items-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
        >
          Søg efter shelters
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderedItems.map((item) => (
        <article
          key={item.slug}
          className="flex gap-3 rounded-2xl border border-primary/8 bg-white p-3 hover:border-accent/30 transition-colors"
        >
          <Link
            href={`/shelter/${item.slug}`}
            className="relative flex-shrink-0 block w-24 h-24 sm:w-32 sm:h-24 rounded-xl overflow-hidden bg-primary/10"
            aria-label={`Åbn ${item.title}`}
          >
            {item.imageSrc ? (
              <Image
                src={item.imageSrc}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 96px, 128px"
                className="object-cover"
                loading="lazy"
                unoptimized={item.imageUnoptimized}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary/20">
                <Heart size={20} />
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <Link
              href={`/shelter/${item.slug}`}
              className="font-serif text-base font-bold text-primary hover:text-accent transition-colors truncate"
            >
              {item.title}
            </Link>
            {item.city && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-primary/55">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{item.city}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-primary/35">
              Gemt {new Date(item.addedAt).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleRemove(item.slug)}
            aria-label={`Fjern ${item.title} fra favoritter`}
            className="flex-shrink-0 self-start text-primary/35 hover:text-red-600 transition-colors p-2 -m-2"
          >
            <Trash2 size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}
