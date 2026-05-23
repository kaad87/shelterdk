"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accessibility,
  Armchair,
  CalendarDays,
  ChevronDown,
  Clock,
  Dog,
  Droplets,
  Flame,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Map,
  MapPin,
  Navigation2,
  Search,
  ShowerHead,
  Star,
  CheckCircle,
  Tent,
  TreePine,
  TrendingUp,
  Umbrella,
  Users,
  X,
  ArrowRight,
} from "lucide-react";
import type { SoegFilters, SearchSuggestion } from "@/lib/soeg-db";
import { slugifySegment } from "@/lib/slug";
import { normalizeRegionFilter } from "@/lib/soeg-filters";
import { trackSearch, trackFilter } from "@/lib/tracking";
import { addRecentSearch } from "@/lib/search-helpers";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";

const REGIONS = [
  { value: "", label: "Hele Danmark" },
  { value: "Jylland", label: "Jylland" },
  { value: "Sjælland og Øerne", label: "Sjælland" },
  { value: "Fyn", label: "Fyn" },
  { value: "Bornholm", label: "Bornholm" },
] as const;

type ViewMode = "list" | "map" | "split";

const FILTER_OPTIONS: {
  key: keyof SoegFilters;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "toilet", label: "Toilet", icon: <Droplets size={15} /> },
  { key: "baalplads", label: "Bålplads", icon: <Flame size={15} /> },
  { key: "bookbar", label: "Bookbar", icon: <CheckCircle size={15} /> },
  // "Gratis"-filter er fjernet bevidst — payment-data er for upålideligt.
  // Bring tilbage når data-kvaliteten er bedre.
  { key: "vand", label: "Vand", icon: <Droplets size={15} /> },
  { key: "hund", label: "Hund tilladt", icon: <Dog size={15} /> },
  { key: "strand", label: "Strand", icon: <Umbrella size={15} /> },
  { key: "bruser", label: "Bruser/bad", icon: <ShowerHead size={15} /> },
  { key: "handicap", label: "Handicapegnet", icon: <Accessibility size={15} /> },
  { key: "bord_baenk", label: "Bord/bænke", icon: <Armchair size={15} /> },
  { key: "billede", label: "Med billede", icon: <ImageIcon size={15} /> },
  { key: "anmeldelser", label: "Anmeldelser", icon: <Star size={15} /> },
];

function SuggestionIcon({ type }: { type: SearchSuggestion["type"] }) {
  const cls = "w-4 h-4 shrink-0";
  switch (type) {
    case "naer-mig":   return <Navigation2 className={`${cls} text-accent`} />;
    case "recent":     return <Clock className={`${cls} text-primary/40`} />;
    case "popular":    return <TrendingUp className={`${cls} text-amber-500`} />;
    case "region":     return <Map className={`${cls} text-emerald-600`} />;
    case "område":     return <TreePine className={`${cls} text-emerald-600`} />;
    case "shelter":    return <Tent className={`${cls} text-amber-600`} />;
    case "by":
    default:           return <MapPin className={`${cls} text-primary/50`} />;
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
    case "by":
    default:          return "By";
  }
}

interface SearchBarProps {
  mode: "home" | "search";
  initialRegion?: string | null;
  initialQuery?: string | null;
  initialArea?: string | null;
  initialFilters?: SoegFilters;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  className?: string;
  /** Hvis sat, navigerer filter-toggles til denne URL-base i stedet for /soeg.
   *  Bruges på regions-sider (/danmark/bornholm) så filteret ikke nulstiller regionen. */
  filterBasePath?: string;
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
  filterBasePath,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [region, setRegion] = useState(
    () =>
      normalizeRegionFilter(initialRegion ?? searchParams.get("region")) ??
      REGIONS[0].value
  );
  const [query, setQuery] = useState(
    () => initialQuery ?? searchParams.get("q") ?? ""
  );
  const [filters, setFilters] = useState<SoegFilters>(() => initialFilters);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>("");
  const [pendingDateTo, setPendingDateTo] = useState<string>("");
  const [isSunday, setIsSunday] = useState(false);
  const [todayStr, setTodayStr] = useState("");
  const datePickerRef = useRef<HTMLDivElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { suggestions, loading, open: suggestOpen, setOpen: setSuggestOpen, openWithDefaults } =
    useSearchSuggestions(query, initialQuery);

  // Synk filter-state med URL (initialFilters kommer fra server)
  useEffect(() => {
    setFilters(initialFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters.billede, initialFilters.anmeldelser, initialFilters.bookbar, initialFilters.vand, initialFilters.toilet, initialFilters.hund, initialFilters.baalplads, initialFilters.bord_baenk, initialFilters.strand, initialFilters.bruser, initialFilters.gratis, initialFilters.handicap, initialFilters.min_pladser, initialFilters.date, initialFilters.date_to, initialFilters.confirmed_available]);

  const resolveBasePath = useCallback(
    (targetRegion: string) => {
      const normalizedInitialRegion = normalizeRegionFilter(initialRegion);
      const normalizedTargetRegion = normalizeRegionFilter(targetRegion);
      if (
        filterBasePath &&
        normalizedInitialRegion &&
        normalizedTargetRegion === normalizedInitialRegion
      ) {
        return filterBasePath;
      }
      return undefined;
    },
    [filterBasePath, initialRegion]
  );

  const buildSoegUrl = useCallback(
    (r: string, q: string, v?: ViewMode, f?: SoegFilters, base?: string) => {
      const params = new URLSearchParams();
      const basePage = base ?? "/soeg";
      if (!base && r) {
        const normalizedRegion = normalizeRegionFilter(r) ?? r;
        params.set("region", normalizedRegion);
      }
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
      if (active.date && /^\d{4}-\d{2}-\d{2}$/.test(active.date)) params.set("date", active.date);
      if (active.date_to && /^\d{4}-\d{2}-\d{2}$/.test(active.date_to)) params.set("date_to", active.date_to);
      if (active.confirmed_available) params.set("confirmed_available", "1");
      const s = params.toString();
      return basePage + (s ? `?${s}` : "");
    },
    [filters]
  );

  const navigate = useCallback(
    (suggestion: SearchSuggestion) => {
      setSuggestOpen(false);
      setSuggestIndex(-1);

      if (suggestion.type === "naer-mig") {
        router.push("/shelter-naer-mig");
        return;
      }

      if (suggestion.type === "region") {
        const regionValue = normalizeRegionFilter(suggestion.name) ?? suggestion.name;
        setRegion(regionValue);
        setQuery("");
        const basePath = `/danmark/${slugifySegment(suggestion.name)}`;
        const url = buildSoegUrl(
          "",
          "",
          mode === "search" ? view : "split",
          mode === "search" ? filters : undefined,
          basePath
        );
        router.push(url, { scroll: false });
        return;
      }

      addRecentSearch(suggestion.name);
      setQuery(suggestion.name);
      inputRef.current?.blur();
      const url = buildSoegUrl(
        region,
        suggestion.name,
        mode === "search" ? view : "split",
        mode === "search" ? filters : undefined,
        resolveBasePath(region)
      );
      router.push(url, { scroll: false });
    },
    [region, view, mode, filters, buildSoegUrl, router, setSuggestOpen, resolveBasePath]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasSearch = region || query.trim();
    const initialView: ViewMode = hasSearch ? "split" : (mode === "search" ? view : "split");
    if (query.trim()) addRecentSearch(query.trim());
    const url = buildSoegUrl(
      region,
      query,
      initialView,
      undefined,
      resolveBasePath(region)
    );
    const activeCount = FILTER_OPTIONS.filter(({ key }) => filters[key]).length;
    trackSearch(query.trim() || "(tom)", region, activeCount);
    router.push(url);
  };

  const handleViewList = () => {
    onViewChange?.("list");
    router.push(
      buildSoegUrl(region, query, "list", undefined, resolveBasePath(region)),
      { scroll: false }
    );
  };

  const handleViewSplit = () => {
    onViewChange?.("split");
    router.push(
      buildSoegUrl(region, query, "split", undefined, resolveBasePath(region)),
      { scroll: false }
    );
  };

  const handleViewMap = () => {
    onViewChange?.("map");
    router.push(
      buildSoegUrl(region, query, "map", undefined, resolveBasePath(region)),
      { scroll: false }
    );
  };

  const toggleFilter = useCallback(
    (key: keyof SoegFilters) => {
      const willBeActive = !filters[key];
      const next = { ...filters, [key]: willBeActive ? true : undefined };
      setFilters(next);
      trackFilter(key, willBeActive);
      const url = resolveBasePath(region)
        ? buildSoegUrl(region, query, mode === "search" ? view : "split", next, resolveBasePath(region))
        : buildSoegUrl(region, query, mode === "search" ? view : "split", next);
      router.push(url, { scroll: false });
    },
    [filters, region, query, view, mode, buildSoegUrl, router, resolveBasePath]
  );

  const activeFilterCount = FILTER_OPTIONS.filter(({ key }) => filters[key]).length + (filters.date ? 1 : 0);

  // Detect today's local date and day-of-week on mount (avoids SSR/client mismatch)
  useEffect(() => {
    const d = new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setTodayStr(ds);
    setIsSunday(d.getDay() === 0);
  }, []);

  // Close date picker on outside click
  useEffect(() => {
    if (!datePickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [datePickerOpen]);

  // Sync pending dates when picker opens
  useEffect(() => {
    if (datePickerOpen) {
      setPendingDate(filters.date ?? "");
      setPendingDateTo(filters.date_to ?? "");
    }
  }, [datePickerOpen, filters.date, filters.date_to]);

  function formatShortDate(iso: string): string {
    const d = new Date(iso + "T12:00:00");
    return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(d);
  }

  function getDateLabel(): string {
    if (!filters.date) return "Dato";
    if (filters.date_to && filters.date_to !== filters.date) {
      return `${formatShortDate(filters.date)} – ${formatShortDate(filters.date_to)}`;
    }
    return formatShortDate(filters.date);
  }

  function getNextWeekendDates(weeksAhead: number): { sat: string; sun: string } {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSat = day === 6 ? 7 * weeksAhead : (6 - day) + 7 * (weeksAhead - 1);
    const sat = new Date(today);
    sat.setDate(today.getDate() + daysUntilSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    // Use local date formatting to avoid UTC offset issues (toISOString gives UTC midnight)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { sat: fmt(sat), sun: fmt(sun) };
  }

  function applyDateFilter(date: string, dateTo: string) {
    const next: SoegFilters = {
      ...filters,
      date: date || undefined,
      date_to: (dateTo && dateTo >= date) ? dateTo : undefined,
    };
    setFilters(next);
    setDatePickerOpen(false);
    const url = buildSoegUrl(region, query, mode === "search" ? view : "split", next, resolveBasePath(region));
    router.push(url, { scroll: false });
  }

  function clearDateFilter() {
    const next: SoegFilters = { ...filters, date: undefined, date_to: undefined };
    setFilters(next);
    setPendingDate("");
    setPendingDateTo("");
    setDatePickerOpen(false);
    const url = buildSoegUrl(region, query, mode === "search" ? view : "split", next, resolveBasePath(region));
    router.push(url, { scroll: false });
  }

  const clearAllFilters = useCallback(() => {
    const next: SoegFilters = {};
    setFilters(next);
    const url = resolveBasePath(region)
      ? buildSoegUrl(region, query, mode === "search" ? view : "split", next, resolveBasePath(region))
      : buildSoegUrl(region, query, mode === "search" ? view : "split", next);
    router.push(url, { scroll: false });
  }, [region, query, view, mode, buildSoegUrl, router, resolveBasePath]);

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
        <div className="flex flex-row flex-1 min-w-0 gap-0 border-r border-primary/10">
        <div className="relative flex-shrink-0">
          <select
            name="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-[140px] md:w-auto md:min-w-[160px] appearance-none bg-accent/15 text-primary font-medium py-3 md:py-3.5 pl-3 md:pl-4 pr-8 md:pr-10 text-sm rounded-l-xl rounded-r-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 cursor-pointer touch-manipulation"
            aria-label="Vælg region"
          >
            {REGIONS.map((r) => (
              <option key={r.value || "all"} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-primary/70 pointer-events-none"
            aria-hidden
          />
        </div>

        {/* Søgefelt med by-forslag */}
        <div
          className="flex-1 flex items-center min-w-0 relative"
          ref={suggestRef}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={suggestOpen}
          aria-controls="byer-forslag"
          aria-owns="byer-forslag"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={openWithDefaults}
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
                navigate(suggestions[suggestIndex]);
              } else if (e.key === "Escape") {
                setSuggestOpen(false);
                setSuggestIndex(-1);
              }
            }}
            placeholder="Søg område eller by"
            className="w-full py-3 md:py-3.5 pl-9 pr-9 text-primary placeholder:text-primary/50 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm touch-manipulation"
            aria-label="Søg efter område eller by"
            aria-autocomplete="list"
            aria-controls="byer-forslag"
            aria-activedescendant={suggestIndex >= 0 ? `byer-${suggestIndex}` : undefined}
            id="soeg-by-input"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSuggestOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-primary/60 hover:text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
              aria-label="Søgeforslag"
              className="absolute left-0 right-0 top-full z-[100] mt-1 py-1 bg-white border border-primary/10 rounded-xl shadow-lg max-h-[60vh] overflow-y-auto"
            >
              {loading ? (
                <li className="px-4 py-2 text-primary/60 text-sm">Henter forslag…</li>
              ) : (
                <>
                  {query.trim().length < 2 && (
                    <li className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-primary/30">
                      Forslag
                    </li>
                  )}
                  {suggestions.map((suggestion, i) => {
                    const label = typeLabel(suggestion.type);
                    return (
                      <li
                        key={`${suggestion.type}-${suggestion.name}`}
                        id={`byer-${i}`}
                        className="px-0"
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            navigate(suggestion);
                          }}
                          onClick={() => navigate(suggestion)}
                          role="option"
                          aria-selected={i === suggestIndex}
                          className={`flex w-full items-center gap-3 px-4 py-3 sm:py-2.5 text-base sm:text-sm cursor-pointer touch-manipulation text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset ${i === suggestIndex ? "bg-accent/15 text-primary" : "text-primary hover:bg-primary/5 active:bg-primary/10"}`}
                        >
                          <SuggestionIcon type={suggestion.type} />
                          <span className="flex-1 min-w-0 truncate">{suggestion.name}</span>
                          {label && (
                            <span className="text-xs text-primary/50 ml-2 flex-shrink-0">{label}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>
          )}
        </div>
        </div>

        {/* View toggles (search mode only) */}
        {mode === "search" && (
          <div className="hidden md:flex items-stretch border-primary/10 border-l flex-shrink-0">
            <div className="flex items-stretch rounded-lg sm:rounded-r-xl overflow-hidden border border-primary/10 sm:border-0 flex-shrink-0 ml-auto">
              <button
                type="button"
                onClick={handleViewList}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-4 py-3 sm:px-3 min-h-[48px] sm:min-h-0 text-sm font-medium transition-colors touch-manipulation ${
                  view === "list"
                    ? "bg-primary/15 text-primary"
                    : "bg-white text-primary/70 hover:bg-primary/5"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
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
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
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
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset`}
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
          <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide flex-nowrap" role="group" aria-label="Filtrer efter faciliteter">
            {FILTER_OPTIONS.map(({ key, label, icon }) => {
              const active = Boolean(filters[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 touch-manipulation border ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary hover:shadow-sm"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2`}
                  aria-pressed={active}
                >
                  <span className={active ? "text-white" : "text-primary/50"}>{icon}</span>
                  {label}
                </button>
              );
            })}
            {/* Min. pladser input */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/15 bg-white text-sm">
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
                className="w-8 bg-transparent text-center text-primary font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Minimum antal pladser"
              />
              <span className="text-primary/70 whitespace-nowrap">pladser</span>
            </div>

            {/* Dato-filter med popover */}
            <div className="relative shrink-0" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setDatePickerOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-all touch-manipulation ${
                  filters.date
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
                aria-expanded={datePickerOpen}
                aria-haspopup="dialog"
              >
                <CalendarDays size={14} className="shrink-0" />
                {getDateLabel()}
                {filters.date && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); clearDateFilter(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); clearDateFilter(); } }}
                    className="ml-0.5 text-white/80 hover:text-white cursor-pointer"
                    aria-label="Fjern datofilter"
                  >
                    <X size={12} />
                  </span>
                )}
              </button>

              {datePickerOpen && (
                <div
                  role="dialog"
                  aria-label="Vælg datointerval"
                  className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-xl border border-primary/10 p-4 w-72"
                >
                  {/* Ankomst / Afgang */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-primary/50 uppercase tracking-wide mb-1">
                        Ankomst
                      </label>
                      <input
                        type="date"
                        value={pendingDate}
                        min={todayStr || undefined}
                        onChange={(e) => {
                          setPendingDate(e.target.value);
                          if (pendingDateTo && e.target.value > pendingDateTo) setPendingDateTo("");
                        }}
                        className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 [color-scheme:light]"
                        aria-label="Ankomstdato"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-primary/50 uppercase tracking-wide mb-1">
                        Afgang
                      </label>
                      <input
                        type="date"
                        value={pendingDateTo}
                        min={pendingDate || todayStr || undefined}
                        onChange={(e) => setPendingDateTo(e.target.value)}
                        className="w-full rounded-lg border border-primary/20 px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 [color-scheme:light]"
                        aria-label="Afrejsedato"
                      />
                    </div>
                  </div>

                  {/* Hurtige genveje */}
                  <div className="flex gap-2 mb-4">
                    {[1, 2].map((weeksAhead) => {
                      const { sat, sun } = getNextWeekendDates(weeksAhead);
                        const label = weeksAhead === 1
                        ? (isSunday ? "Næste weekend" : "Denne weekend")
                        : (isSunday ? "Weekenden derefter" : "Næste weekend");
                      const isActive = pendingDate === sat && pendingDateTo === sun;
                      return (
                        <button
                          key={weeksAhead}
                          type="button"
                          onClick={() => { setPendingDate(sat); setPendingDateTo(sun); }}
                          className={`flex-1 text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors ${
                            isActive
                              ? "bg-primary text-white border-primary"
                              : "border-primary/15 text-primary/70 hover:border-primary/30 hover:text-primary"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Handlingsknapper */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={clearDateFilter}
                      className="flex-1 rounded-lg border border-primary/15 px-3 py-2 text-sm font-medium text-primary/70 hover:bg-primary/5 transition-colors"
                    >
                      Ryd
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDateFilter(pendingDate, pendingDateTo)}
                      disabled={!pendingDate}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-dark px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Søg
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {(activeFilterCount > 0 || (filters.min_pladser && filters.min_pladser > 0)) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium text-primary/60 hover:text-primary hover:bg-primary/5 whitespace-nowrap shrink-0 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
                aria-label="Ryd alle filtre"
              >
                <X size={14} />
                Ryd filtre
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
