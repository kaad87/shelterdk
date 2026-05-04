"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Map, MapPin, Navigation2, Search, Tent, TrendingUp, TreePine, X } from "lucide-react";
import type { SearchSuggestion } from "@/lib/soeg-db";
import { addRecentSearch } from "@/lib/search-helpers";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";

function SuggestionIcon({ type }: { type: SearchSuggestion["type"] }) {
  const cls = "w-4 h-4 shrink-0";
  switch (type) {
    case "naer-mig":  return <Navigation2 className={`${cls} text-accent`} />;
    case "recent":    return <Clock className={`${cls} text-primary/40`} />;
    case "popular":   return <TrendingUp className={`${cls} text-amber-500`} />;
    case "region":    return <Map className={`${cls} text-emerald-600`} />;
    case "område":    return <TreePine className={`${cls} text-emerald-600`} />;
    case "shelter":   return <Tent className={`${cls} text-amber-600`} />;
    default:          return <MapPin className={`${cls} text-primary/50`} />;
  }
}

function typeLabel(type: SearchSuggestion["type"]): string {
  switch (type) {
    case "naer-mig":  return "";
    case "recent":    return "Seneste";
    case "popular":   return "Populær";
    case "region":    return "Region";
    case "område":    return "Område";
    case "shelter":   return "Shelter";
    default:          return "By";
  }
}

interface MobileSearchOverlayProps {
  onClose: () => void;
}

export function MobileSearchOverlay({ onClose }: MobileSearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { suggestions, loading, open: suggestOpen, openWithDefaults } =
    useSearchSuggestions(query);

  // Auto-focus and show defaults on mount
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      openWithDefaults();
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const navigate = (suggestion: SearchSuggestion) => {
    onClose();
    if (suggestion.type === "naer-mig") {
      router.push("/shelter-naer-mig");
      return;
    }
    if (suggestion.type === "region") {
      router.push(`/soeg?region=${encodeURIComponent(suggestion.name)}`);
      return;
    }
    addRecentSearch(suggestion.name);
    router.push(`/soeg?q=${encodeURIComponent(suggestion.name)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query.trim());
      router.push(`/soeg?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/soeg");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      {/* Header with search input */}
      <div className="flex items-center gap-3 px-4 pt-safe-top py-3 border-b border-primary/10">
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.03] focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 px-3 py-2.5"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={suggestOpen}
          aria-controls="mobile-search-suggestions"
          aria-owns="mobile-search-suggestions"
        >
          <Search className="w-4 h-4 text-primary/40 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg område, by eller shelter"
            className="flex-1 min-w-0 bg-transparent text-primary placeholder:text-primary/50 text-base focus:outline-none focus:ring-0 border-0"
            aria-label="Søg efter område eller by"
            aria-autocomplete="list"
            aria-controls="mobile-search-suggestions"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-0.5 rounded text-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Ryd søgefelt"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 text-primary/80 font-medium text-sm px-2 py-1 touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
        >
          Annuller
        </button>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto">
        {loading && query.trim().length >= 2 ? (
          <div className="px-4 py-3 text-primary/60 text-sm">Henter forslag…</div>
        ) : (
          <ul id="mobile-search-suggestions" role="listbox" aria-label="Søgeforslag">
            {query.trim().length < 2 && suggestions.length > 0 && (
              <li className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-primary/30">
                Forslag
              </li>
            )}
            {(suggestOpen || query.trim().length < 2) && suggestions.map((suggestion) => {
              const label = typeLabel(suggestion.type);
              return (
                <li
                  key={`${suggestion.type}-${suggestion.name}`}
                  className="border-b border-primary/5 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => navigate(suggestion)}
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-3 px-4 py-4 hover:bg-primary/5 active:bg-primary/10 touch-manipulation text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
                  >
                    <SuggestionIcon type={suggestion.type} />
                    <span className="flex-1 text-primary text-base">{suggestion.name}</span>
                    {label && (
                      <span className="text-xs text-primary/50 flex-shrink-0">{label}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {suggestOpen && suggestions.length === 0 && query.trim().length >= 2 && (
              <li className="px-4 py-4 text-primary/50 text-sm">
                Ingen resultater for &ldquo;{query}&rdquo;
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
