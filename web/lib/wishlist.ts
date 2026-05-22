/**
 * Lightweight localStorage-backed wishlist of shelter slugs.
 * No account required; survives page reloads on same browser.
 */

const STORAGE_KEY = "shelterdk:wishlist:v1";
const MAX_ITEMS = 50;

export interface WishlistItem {
  slug: string;
  title: string;
  city: string | null;
  imageUrl: string | null;
  addedAt: string; // ISO timestamp
}

function isWindowAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getWishlist(): WishlistItem[] {
  if (!isWindowAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is WishlistItem =>
          it && typeof it.slug === "string" && typeof it.title === "string"
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function isInWishlist(slug: string): boolean {
  return getWishlist().some((it) => it.slug === slug);
}

export function addToWishlist(item: Omit<WishlistItem, "addedAt">): WishlistItem[] {
  if (!isWindowAvailable()) return [];
  const existing = getWishlist().filter((it) => it.slug !== item.slug);
  const next: WishlistItem[] = [
    { ...item, addedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("shelterdk:wishlist-changed"));
  } catch {
    /* ignore quota errors */
  }
  return next;
}

export function removeFromWishlist(slug: string): WishlistItem[] {
  if (!isWindowAvailable()) return [];
  const next = getWishlist().filter((it) => it.slug !== slug);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("shelterdk:wishlist-changed"));
  } catch {
    /* ignore */
  }
  return next;
}

export function toggleWishlist(item: Omit<WishlistItem, "addedAt">): {
  added: boolean;
  list: WishlistItem[];
} {
  if (isInWishlist(item.slug)) {
    return { added: false, list: removeFromWishlist(item.slug) };
  }
  return { added: true, list: addToWishlist(item) };
}
