"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import { trackWishlist } from "@/lib/tracking";

interface WishlistButtonProps {
  slug: string;
  title: string;
  city: string | null;
  imageUrl: string | null;
  variant?: "icon" | "labeled";
  className?: string;
}

/**
 * Heart button that toggles wishlist state for a shelter.
 * Reads from localStorage and listens for cross-component updates.
 */
export function WishlistButton({
  slug,
  title,
  city,
  imageUrl,
  variant = "icon",
  className = "",
}: WishlistButtonProps) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSaved(isInWishlist(slug));
    const handle = () => setSaved(isInWishlist(slug));
    window.addEventListener("shelterdk:wishlist-changed", handle);
    return () => window.removeEventListener("shelterdk:wishlist-changed", handle);
  }, [slug]);

  if (!mounted) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { added } = toggleWishlist({ slug, title, city, imageUrl });
    setSaved(added);
    trackWishlist(added ? "add" : "remove", slug);
  };

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={saved ? "Fjern fra favoritter" : "Gem som favorit"}
        aria-pressed={saved}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-white px-3 py-1.5 text-sm font-medium text-primary/80 hover:bg-primary/5 transition-colors ${className}`}
      >
        <Heart
          size={16}
          className={saved ? "fill-red-500 text-red-500" : "text-primary/60"}
        />
        <span>{saved ? "Gemt" : "Gem"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={saved ? "Fjern fra favoritter" : "Gem som favorit"}
      aria-pressed={saved}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/85 hover:bg-white shadow backdrop-blur-sm transition-colors ${className}`}
    >
      <Heart
        size={18}
        className={saved ? "fill-red-500 text-red-500" : "text-primary/60"}
      />
    </button>
  );
}
