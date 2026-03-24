"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accessibility,
  Armchair,
  ChevronDown,
  Dog,
  Droplets,
  Flame,
  Gift,
  Image as ImageIcon,
  ShowerHead,
  Star,
  CheckCircle,
  LayoutGrid,
  List,
  MapPin,
  Umbrella,
  Users,
  X,
} from "lucide-react";
import type { SoegFilters, SearchSuggestion } from "@/lib/soeg-db";

const REGIONS = [
  { value: "", label: "Hele Danmark" },
  { value: "Jylland", label: "Jylland" },
  { value: "Sjælland", label: "Sjælland" },
  { value: "Fyn", label: "Fyn" },
] as const;

type ViewMode = "list" | "map" | "split";

const FILTER_OPTIONS: {
  key: keyof SoegFilters;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "vand", label: "Vand", icon: <Droplets size={15} /> },
  { key: "toilet", label: "Toilet", icon: <Droplets size={15} /> },
  { key: "baalplads", label: "Bålplads", icon: <Flame size={15} /> },
  { key: "hund", label: "Hund tilladt", icon: <Dog size={15} /> },
  { key: "bord_baenk", label: "Bord/bænke", icon: <Armchair size={15} /> },
  { key: "strand", label: "Strand", icon: <Umbrella size={15} /> },
  { key: "bruser", label: "Bruser/bad", icon: <ShowerHead size={15} /> },
  { key: "gratis", label: "Gratis", icon: <Gift size={15} /> },
  { key: "handicap", label: "Handicapegnet", icon: <Accessibility size={15} /> },
  { key: "bookbar", label: "Bookbar", icon: <CheckCircle size={15} /> },
  { key: "billede", label: "Med billede", icon: <ImageIcon size={15} /> },
  { key: "anmeldelser", label: "Anmeldelser", icon: <Star size={15} /> },
];

interface SearchBarProps {
  mode: "home" | "search";
  initialRegion?: string | null;
  initialQuery?: string | null;
  initialArea?: string | null;
  initialFilters?: SoegFilters;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  className?: string;
}

export function SearchBar({
  mode,
  initialRegion,
  initialQuery,
  initialArea,
  initialFilters = {},
  view = "split",
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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synk filter-state med URL (initialFilters kommer fra server)
  useEffect(() => {
    setFilters(initialFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters.billede, initialFilters.anmeldelser, initialFilters.bookbar, initialFilters.vand, initialFilters.toilet, initialFilters.hund, initialFilters.baalplads, initialFilters.bord_baenk, initialFilters.strand, initialFilters.bruser, initialFilters.gratis, initialFilters.handicap, initialFilters.min_pladser]);

  // By-forslag: debounced fetch når brugeren skriver (min. 2 tegn).
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
        .then((arr: unknown) => {
          // Backwards-compat: ældre endpoint kan returnere `string[]` (bynavne)
          // mens ny endpoint returnerer `SearchSuggestion[]` ({ name, type }).
          const items: SearchSuggestion[] = Array.isArray(arr)
            ? arr.length > 0 && typeof arr[0] === "string"
              ? (arr as string[]).map((name) => ({ name, type: "by" as const }))
              : (arr as any[])
                  .map((s) => ({
                    name: String(s?.name ?? ""),
                    type: s?.type === "område" ? ("område" as const) : ("by" as const),
                  }))
                  .filter((s) => s.name.trim().length > 0)
            : [];
          setSuggestions(items);
          const alreadySearched = mode === "search" && (initialQuery ?? searchParams.get("q") ?? "").trim() === q;
          setSuggestOpen(!alreadySearched && items.length > 0);
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
      if (active.vand) params.set("vand", "1");
      if (active.toilet) params.set("toilet", "1");
      if (active.hund) params.set("hund", "1");
      if (active.baalplads) params.set("baalplads", "1");
      if (active.bord_baenk) params.set("bord_baenk", "1");
      if (active.strand) params.set("strand", "1");
      if (active.bruser) params.set("bruser", "1");
      if (active.gratis) params.set("gratis", "1");
      if (active.handicap) params.set("handicap", "1");
      if (active.min_pladser && active.min_pladser > 0) params.set("min_pladser", String(active.min_pladser));
      const s = params.toString();
      return "/soeg" + (s ? `?${s}` : "");
    },
    [filters]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasSearch = region || query.trim();
    const initialView: ViewMode = hasSearch ? "split" : (mode === "search" ? view : "split");
    const url = buildSoegUrl(region, query, initialView);
    router.push(url);
  };

  const handleViewList = () => {
    onViewChange?.("list");
    router.push(buildSoegUrl(region, query, "list"), { scroll: false });
  };

  const handleViewSplit = () => {
    onViewChange?.("split");
    router.push(buildSoegUrl(region, query, "split"), { scroll: false });
  };

  const handleViewMap = () => {
    onViewChange?.("map");
    router.push(buildSoegUrl(region, query, "map"), { scroll: false });
  };

  const toggleFilter = useCallback(
    (key: keyof SoegFilters) => {
      const next = { ...filters, [key]: filters[key] ? undefined : true };
      setFilters(next);
      const url = buildSoegUrl(region, query, mode === "search" ? view : "split", next);
      router.push(url, { scroll: false });
    },
    [filters, region, query, view, mode, buildSoegUrl, router]
  );

  const activeFilterCount = FILTER_OPTIONS.filter(({ key }) => filters[key]).length;

  const clearAllFilters = useCallback(() => {
    const next: SoegFilters = {};
    setFilters(next);
    const url = buildSoegUrl(region, query, mode === "search" ? view : "split", next);
    router.push(url, { scroll: false });
  }, [region, query, view, mode, buildSoegUrl, router]);

  return (
    <div className="space-y-3">
      <form
        onSubmit={handleSubmit}
        className={
          "flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-2 bg-white rounded-2xl shadow-lg border border-primary/5 p-3 sm:px-3 sm:py-3 overflow-visible " +
          className
        }
      >
        {/* Region + søgefelt */}
        <div className="flex flex-col sm:flex-row flex-1 min-w-0 gap-2 sm:gap-0 sm:border-r border-primary/10">
        <div className="relative flex-shrink-0 sm:border-r-0">
          <select
            name="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full sm:w-auto min-w-0 sm:min-w-[160px] appearance-none bg-accent/15 text-primary font-medium py-3.5 pl-4 pr-10 text-base sm:text-sm rounded-xl sm:rounded-l-xl sm:rounded-r-none focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer touch-manipulation"
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
                const name = suggestions[suggestIndex].name;
                setQuery(name);
                setSuggestOpen(false);
                setSuggestIndex(-1);
                inputRef.current?.blur();
                const url = buildSoegUrl(region, name, mode === "search" ? view : "split", mode === "search" ? filters : undefined);
                router.push(url, { scroll: false });
              } else if (e.key === "Escape") {
                setSuggestOpen(false);
                setSuggestIndex(-1);
              }
            }}
            placeholder="Indtast område eller by"
            className="w-full py-3.5 pl-4 pr-9 text-primary placeholder:text-primary/50 bg-transparent border-0 focus:outline-none focus:ring-0 text-base sm:text-sm touch-manipulation"
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
              aria-live="polite"
              className="absolute left-0 right-0 top-full z-[100] mt-1 py-1 bg-white border border-primary/10 rounded-xl shadow-lg max-h-[60vh] overflow-y-auto"
            >
              {suggestLoading ? (
                <li className="px-4 py-2 text-primary/60 text-sm">Henter forslag…</li>
              ) : (
                suggestions.map((suggestion, i) => (
                  <li
                    key={`${suggestion.type}-${suggestion.name}`}
                    id={`byer-${i}`}
                    role="option"
                    aria-selected={i === suggestIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setQuery(suggestion.name);
                      setSuggestOpen(false);
                      setSuggestions([]);
                      inputRef.current?.blur();
                      const url = buildSoegUrl(region, suggestion.name, mode === "search" ? view : "split", mode === "search" ? filters : undefined);
                      router.push(url, { scroll: false });
                    }}
                    className={`flex items-center justify-between px-4 py-3 sm:py-2.5 text-base sm:text-sm cursor-pointer touch-manipulation ${i === suggestIndex ? "bg-accent/15 text-primary" : "text-primary hover:bg-primary/5 active:bg-primary/10"}`}
                  >
                    <span>{suggestion.name}</span>
                    <span className="text-xs text-primary/40 ml-3 flex-shrink-0">
                      {suggestion.type === "område" ? "Område" : "By"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        </div>

        {/* View toggles (search mode only) */}
        {mode === "search" && (
          <div className="flex items-stretch border-t sm:border-t-0 border-primary/10 pt-2 sm:pt-0 sm:border-l flex-shrink-0">
            <div className="flex items-stretch rounded-lg sm:rounded-r-xl overflow-hidden border border-primary/10 sm:border-0 flex-shrink-0 ml-auto">
              <button
                type="button"
                onClick={handleViewList}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 py-3 sm:px-3 min-h-[48px] sm:min-h-0 text-sm font-medium transition-colors touch-manipulation ${
                  view === "list"
                    ? "bg-primary/15 text-primary"
                    : "bg-white text-primary/70 hover:bg-primary/5"
                }`}
                aria-pressed={view === "list"}
                aria-label="Kun liste"
              >
                <List className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Liste</span>
              </button>
              <button
                type="button"
                onClick={handleViewSplit}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 py-3 sm:px-3 min-h-[48px] sm:min-h-0 text-sm font-medium transition-colors touch-manipulation ${
                  view === "split"
                    ? "bg-primary/15 text-primary"
                    : "bg-white text-primary/70 hover:bg-primary/5"
                }`}
                aria-pressed={view === "split"}
                aria-label="Liste og kort"
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Liste + kort</span>
              </button>
              <button
                type="button"
                onClick={handleViewMap}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 py-3 sm:px-3 min-h-[48px] sm:min-h-0 text-sm font-medium transition-colors touch-manipulation ${
                  view === "map"
                    ? "bg-primary/15 text-primary"
                    : "bg-white text-primary/70 hover:bg-primary/5"
                }`}
                aria-pressed={view === "map"}
                aria-label="Kun kort"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Kort</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Filter chips — shown on search page */}
      {mode === "search" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer efter faciliteter">
            {FILTER_OPTIONS.map(({ key, label, icon }) => {
              const active = Boolean(filters[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium whitespace-nowrap transition-all duration-200 touch-manipulation border ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary hover:shadow-sm"
                  }`}
                  aria-pressed={active}
                >
                  <span className={active ? "text-white" : "text-primary/50"}>{icon}</span>
                  {label}
                </button>
              );
            })}
            {/* Min. pladser input */}
            <div className="flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full border border-primary/15 bg-white text-[13px] sm:text-sm">
              <Users size={15} className="text-primary/50 shrink-0" />
              <span className="text-primary/70 whitespace-nowrap">Min.</span>
              <input
                type="number"
                min={0}
                max={50}
                placeholder="–"
                value={filters.min_pladser ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const next = { ...filters, min_pladser: val > 0 ? val : undefined };
                  setFilters(next);
                  const url = buildSoegUrl(region, query, view, next);
                  router.push(url, { scroll: false });
                }}
                className="w-8 bg-transparent text-center text-primary font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Minimum antal pladser"
              />
              <span className="text-primary/70 whitespace-nowrap">pladser</span>
            </div>

            {(activeFilterCount > 0 || (filters.min_pladser && filters.min_pladser > 0)) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium text-primary/50 hover:text-primary hover:bg-primary/5 whitespace-nowrap transition-colors touch-manipulation"
                aria-label="Ryd alle filtre"
              >
                <X size={14} />
                Ryd filtre
              </button>
            )}
          </div>
          <p className="text-xs text-primary/40 leading-snug">
            Facilitetsoversigten er baseret på officielle data og udtræk fra beskrivelser — den kan være ufuldstændig.
          </p>
        </div>
      )}
    </div>
  );
}
