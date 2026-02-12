"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, List, MapPin, SlidersHorizontal, X } from "lucide-react";
import type { SoegFilters } from "@/lib/soeg-db";

const REGIONS = [
  { value: "", label: "Hele Danmark" },
  { value: "Jylland", label: "Jylland" },
  { value: "Sjælland", label: "Sjælland" },
  { value: "Fyn", label: "Fyn" },
  { value: "Øerne", label: "Øerne" },
] as const;

type ViewMode = "list" | "map";

const FILTER_OPTIONS: { key: keyof SoegFilters; label: string }[] = [
  { key: "billede", label: "Med billede" },
  { key: "anmeldelser", label: "Med anmeldelser" },
  { key: "bookbar", label: "Bookbar" },
];

interface SearchBarProps {
  /** "home" = hero på forsiden (submit går til /soeg). "search" = på søgesiden med liste/kort-toggle. */
  mode: "home" | "search";
  /** Startværdi for region (fra URL). */
  initialRegion?: string | null;
  /** Startværdi for søgetekst (fra URL). */
  initialQuery?: string | null;
  /** Kun ved mode="search": aktive filtre fra URL. */
  initialFilters?: SoegFilters;
  /** Kun ved mode="search": aktiv visning. */
  view?: ViewMode;
  /** Kun ved mode="search": callback når bruger skifter liste/kort. */
  onViewChange?: (view: ViewMode) => void;
  /** For at style søgebjælken anderledes på forsiden (fx fuld bredde, stor). */
  className?: string;
}

export function SearchBar({
  mode,
  initialRegion,
  initialQuery,
  initialFilters = {},
  view = "list",
  onViewChange,
  className = "",
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [region, setRegion] = useState(
    () => initialRegion ?? searchParams.get("region") ?? REGIONS[0].value
  );
  const [query, setQuery] = useState(
    () => initialQuery ?? searchParams.get("q") ?? ""
  );
  const [filters, setFilters] = useState<SoegFilters>(() => initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synk filter-state med URL (initialFilters kommer fra server)
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters.billede, initialFilters.anmeldelser, initialFilters.bookbar]);

  // By-forslag: debounced fetch når brugeren skriver (min. 2 tegn). Vis ikke dropdown hvis vi allerede viser resultater for denne søgning.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      if (fetchRef.current) {
        clearTimeout(fetchRef.current);
        fetchRef.current = null;
      }
      return;
    }
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => {
      fetchRef.current = null;
      setSuggestLoading(true);
      fetch(`/api/soeg/byer?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((arr: string[]) => {
          setSuggestions(Array.isArray(arr) ? arr : []);
          const alreadySearched = mode === "search" && (initialQuery ?? searchParams.get("q") ?? "").trim() === q;
          setSuggestOpen(!alreadySearched && (arr?.length ?? 0) > 0);
          setSuggestIndex(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setSuggestOpen(false);
        })
        .finally(() => setSuggestLoading(false));
    }, 200);
    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
    };
  }, [query, mode, initialQuery, searchParams]);

  const buildSoegUrl = useCallback(
    (r: string, q: string, v?: ViewMode, f?: SoegFilters) => {
      const params = new URLSearchParams();
      if (r) params.set("region", r);
      if (q.trim()) params.set("q", q.trim());
      if (v) params.set("view", v);
      const active = f ?? filters;
      if (active.billede) params.set("billede", "1");
      if (active.anmeldelser) params.set("anmeldelser", "1");
      if (active.bookbar) params.set("bookbar", "1");
      const s = params.toString();
      return "/soeg" + (s ? `?${s}` : "");
    },
    [filters]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const initialView: ViewMode = mode === "search" ? view : "list";
    const url = buildSoegUrl(region, query, initialView);
    router.push(url);
  };

  const handleViewList = () => {
    if (mode === "search") {
      onViewChange?.("list");
      router.push(buildSoegUrl(region, query, "list"), { scroll: false });
    } else {
      router.push(buildSoegUrl(region, query, "list"));
    }
  };

  const handleViewMap = () => {
    if (mode === "search") {
      onViewChange?.("map");
      router.push(buildSoegUrl(region, query, "map"), { scroll: false });
    } else {
      router.push(buildSoegUrl(region, query, "map"));
    }
  };

  const applyFilter = useCallback(
    (key: keyof SoegFilters, checked: boolean) => {
      const next = { ...filters, [key]: checked || undefined };
      setFilters(next);
      setFilterOpen(false);
      const url = buildSoegUrl(region, query, mode === "search" ? view : "list", next);
      router.push(url);
    },
    [filters, region, query, view, mode, buildSoegUrl, router]
  );

  const isHome = mode === "home";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        "flex flex-row items-stretch gap-2 bg-white rounded-2xl shadow-lg border border-primary/5 px-2.5 py-2.5 sm:px-3 sm:py-3 overflow-visible " +
        className
      }
    >
      {/* Region – Glampdk-style dropdown */}
      <div className="relative sm:border-r border-primary/10">
        <select
          name="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full sm:w-auto min-w-[180px] appearance-none bg-accent/15 text-primary font-medium py-3.5 pl-4 pr-10 sm:py-3 sm:pr-9 text-sm rounded-l-xl sm:rounded-none focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          aria-label="Vælg region"
        >
          {REGIONS.map((r) => (
            <option key={r.value || "all"} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/70 pointer-events-none"
          aria-hidden
        />
      </div>

      {/* Søgefelt med by-forslag */}
      <div className="flex-1 flex items-center min-w-0 relative" ref={suggestRef}>
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim().length >= 2 && suggestions.length > 0) setSuggestOpen(true); }}
          onBlur={() => setTimeout(() => setSuggestOpen(false), 180)}
          onKeyDown={(e) => {
            if (!suggestOpen || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSuggestIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSuggestIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && suggestIndex >= 0 && suggestions[suggestIndex]) {
              e.preventDefault();
              const by = suggestions[suggestIndex];
              setQuery(by);
              setSuggestOpen(false);
              setSuggestIndex(-1);
              inputRef.current?.blur();
              const url = buildSoegUrl(region, by, mode === "search" ? view : "list", mode === "search" ? filters : undefined);
              router.push(url);
            } else if (e.key === "Escape") {
              setSuggestOpen(false);
              setSuggestIndex(-1);
            }
          }}
          placeholder="Indtast område eller by"
          className="w-full py-3.5 sm:py-3 pl-4 pr-9 text-primary placeholder:text-primary/50 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm"
          aria-label="Søg efter område eller by"
          aria-autocomplete="list"
          aria-expanded={suggestOpen}
          aria-controls="byer-forslag"
          aria-activedescendant={suggestIndex >= 0 ? `byer-${suggestIndex}` : undefined}
          id="soeg-by-input"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => { setQuery(""); setSuggestOpen(false); setSuggestions([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-primary/50 hover:text-primary hover:bg-primary/10"
            aria-label="Ryd søgefelt"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {suggestOpen && (
          <ul
            id="byer-forslag"
            role="listbox"
            className="absolute left-0 right-0 top-full z-[100] mt-1 py-1 bg-white border border-primary/10 rounded-xl shadow-lg max-h-60 overflow-auto"
          >
            {suggestLoading ? (
              <li className="px-4 py-2 text-primary/60 text-sm">Henter forslag…</li>
            ) : (
              suggestions.map((by, i) => (
                <li
                  key={by}
                  id={`byer-${i}`}
                  role="option"
                  aria-selected={i === suggestIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(by);
                    setSuggestOpen(false);
                    setSuggestions([]);
                    inputRef.current?.blur();
                    const url = buildSoegUrl(region, by, mode === "search" ? view : "list", mode === "search" ? filters : undefined);
                    router.push(url);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer ${i === suggestIndex ? "bg-accent/15 text-primary" : "text-primary hover:bg-primary/5"}`}
                >
                  {by}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Filter-knap (kun på søgesiden) */}
      {mode === "search" && (
        <div className="hidden sm:block relative border-l border-primary/10 flex-shrink-0" ref={filterPanelRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className={`flex items-center justify-center w-12 h-full min-h-[44px] text-primary transition-colors ${
              filterOpen || filters.billede || filters.anmeldelser || filters.bookbar
                ? "bg-primary/10 text-primary"
                : "text-primary/50 hover:bg-primary/5 hover:text-primary/70"
            }`}
            aria-expanded={filterOpen}
            aria-haspopup="true"
            aria-label="Filtre"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-[90]"
                aria-hidden
                onClick={() => setFilterOpen(false)}
              />
              <div
                role="dialog"
                aria-label="Vælg filtre"
                className="absolute left-0 top-full z-[100] mt-1 py-2 bg-white border border-primary/10 rounded-xl shadow-lg min-w-[200px]"
              >
                <p className="px-4 py-1.5 text-xs font-medium text-primary/60 uppercase tracking-wide">
                  Filtre
                </p>
                {FILTER_OPTIONS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-primary/5 text-sm text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(filters[key])}
                      onChange={(e) => applyFilter(key, e.target.checked)}
                      className="rounded border-primary/30 text-primary focus:ring-accent/50"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Liste / Kort – både på forsiden og på søgesiden (Glamp‑style) */}
      <div className="flex rounded-r-xl overflow-hidden border-l border-primary/10 flex-shrink-0">
        <button
          type="button"
          onClick={handleViewList}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            view === "list"
              ? "bg-primary/15 text-primary"
              : "bg-white text-primary/70 hover:bg-primary/5"
          }`}
          aria-pressed={view === "list"}
          aria-label="Vis som liste"
        >
          <List className="w-4 h-4" />
          Liste
        </button>
        <button
          type="button"
          onClick={handleViewMap}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            view === "map"
              ? "bg-primary/15 text-primary"
              : "bg-white text-primary/70 hover:bg-primary/5"
          }`}
          aria-pressed={view === "map"}
          aria-label="Vis på kort"
        >
          <MapPin className="w-4 h-4" />
          Kort
        </button>
      </div>
    </form>
  );
}
