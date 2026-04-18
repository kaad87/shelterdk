/**
 * Search helpers: recent searches (localStorage), popular suggestions, "nær mig".
 * All localStorage access is SSR-safe (guards on typeof window).
 */

const RECENT_KEY = "shelterdk-recent-searches";
const MAX_RECENT = 5;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).filter((s) => typeof s === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  if (typeof window === "undefined") return;
  const t = term.trim();
  if (!t || t.length < 2) return;
  try {
    const prev = getRecentSearches();
    const next = [t, ...prev.filter((s) => s !== t)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export const POPULAR_SUGGESTIONS = [
  "Nationalpark Thy",
  "Rold Skov",
  "Møns Klint",
  "Silkeborg",
  "Bornholm",
];

export function getDefaultSuggestions(): { name: string; type: "naer-mig" | "recent" | "popular" }[] {
  const recent = getRecentSearches().map((name) => ({ name, type: "recent" as const }));
  const popular = POPULAR_SUGGESTIONS.map((name) => ({ name, type: "popular" as const }));
  return [
    { name: "Shelters nær mig", type: "naer-mig" },
    ...recent,
    ...popular,
  ];
}
