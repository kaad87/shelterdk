"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown, List, LayoutGrid, MapPin } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";
import type { Shelter } from "@/types/shelter";
import type { SoegFilters } from "@/lib/soeg-db";
import { filterSheltersByRegion } from "@/lib/soeg-filters";
import { getLocationCoords } from "@/lib/shelter-detail";

// `gratis` er bevidst udeladt — chip'en er fjernet fra UI og parsers
// ignorerer den, så den må heller ikke deltage i activeFilterCount eller
// re-serialiseres fra URLSearchParams her.
const FILTER_KEYS: (keyof SoegFilters)[] = [
  "anmeldelser", "bookbar", "vand", "toilet", "hund",
  "baalplads", "bord_baenk", "strand", "bruser", "handicap",
];

function parseFiltersFromParams(sp: URLSearchParams): SoegFilters {
  const f: SoegFilters = {};
  for (const k of FILTER_KEYS) {
    if (sp.get(k) === "1") (f as Record<string, boolean>)[k] = true;
  }
  const mp = parseInt(sp.get("min_pladser") ?? "0", 10);
  if (mp > 0) f.min_pladser = mp;
  const date = sp.get("date")?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) f.date = date;
  const dateTo = sp.get("date_to")?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) f.date_to = dateTo;
  if (sp.get("confirmed_available") === "1") f.confirmed_available = true;
  return f;
}

type ViewMode = "list" | "map" | "split";
type SortMode = "standard" | "rating" | "reviews";

const SORT_LABELS: Record<SortMode, string> = {
  standard: "Anbefalede",
  rating: "Bedst bedømt",
  reviews: "Flest anmeldelser",
};

/** Tydeligere sort-knap end et nøgent <select>. Native select bevares for a11y. */
function SortSelect({ value, onChange }: { value: SortMode; onChange: (mode: SortMode) => void }) {
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white pl-3 pr-7 py-1.5 md:py-2 text-sm hover:border-primary/40 transition-colors focus-within:ring-2 focus-within:ring-accent/50 cursor-pointer">
      <ArrowUpDown size={14} className="text-primary/55 shrink-0" aria-hidden />
      <span className="text-primary/65 font-medium hidden sm:inline">Sortér:</span>
      <span className="font-semibold text-primary">{SORT_LABELS[value]}</span>
      <ChevronDown size={14} className="text-primary/55 absolute right-2.5 pointer-events-none" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
        aria-label="Sortér shelters"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FloatingViewToggle({
  view,
  onList,
  onSplit,
  onMap,
  position = "absolute",
}: {
  view: ViewMode;
  onList: () => void;
  onSplit: () => void;
  onMap: () => void;
  position?: "absolute" | "fixed";
}) {
  const posClass = position === "fixed"
    ? "fixed bottom-4 right-4 shadow-lg z-50"
    : "absolute bottom-2 right-2 shadow-md z-10";
  return (
    <div className={`${posClass} flex gap-1 bg-white/95 rounded-lg border border-primary/10 p-1 md:hidden`}>
      <button
        type="button"
        onClick={onList}
        className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Kun liste"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onSplit}
        className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Liste og kort"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onMap}
        className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`}
        aria-label="Kun kort"
      >
        <MapPin className="w-4 h-4" />
      </button>
    </div>
  );
}

function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  // Landsdele/øer som typisk bruger "på" i dansk.
  if (r === "fyn" || r === "sjælland" || r === "bornholm") return "på";
  return "i";
}

interface SoegContentProps {
  initialShelters: Shelter[];
  initialHasMore: boolean;
  initialRegion: string | null;
  initialQuery: string | null;
  initialArea?: string | null;
  initialFilters?: SoegFilters;
  initialAvailabilityMap?: Record<string, "available" | "booked" | "partial">;
  view: ViewMode;
  /** Hvis sat, navigerer filter-toggles til denne URL-base i stedet for /soeg.
   *  Bruges på regions-sider (/danmark/bornholm) så filteret ikke nulstiller regionen. */
  basePath?: string;
}

export function SoegContent({
  initialShelters,
  initialHasMore,
  initialRegion,
  initialQuery,
  initialArea = null,
  initialFilters = {},
  initialAvailabilityMap,
  view: initialView,
  basePath,
}: SoegContentProps) {
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);
  const urlHasFilters = Object.values(urlFilters).some(v => v != null && v !== false && v !== 0);
  const effectiveFilters = urlHasFilters ? urlFilters : initialFilters;

  const [shelters, setShelters] = useState<Shelter[]>(() =>
    filterSheltersByRegion(initialShelters, initialRegion)
  );
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, "available" | "booked" | "partial"> | undefined>(initialAvailabilityMap);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextPage, setNextPage] = useState(
    initialShelters.length >= 1000 ? Math.floor(1000 / 24) + 1 : 2
  );
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>(initialView);
  const [listDisplayCount, setListDisplayCount] = useState(
    initialView === "split" ? Math.min(24, initialShelters.length) : initialShelters.length
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Track current map bounds so the list can filter to visible shelters
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const hasPannedMap = useRef(false);
  const boundsReportCount = useRef(0);

  // Sorting
  const [sortMode, setSortMode] = useState<SortMode>("standard");

  // "Mente du..." — populeres når søgning giver 0 resultater og bruger har
  // skrevet noget i søgefeltet. Henter forslag via samme autocomplete-endpoint
  // som SearchBar bruger, så typer som "kobenhavn" foreslår "København".
  const [didYouMean, setDidYouMean] = useState<{ name: string; type: string }[]>([]);
  const prevSortMode = useRef<SortMode>("standard");

  // Helper: build API params for current filters/sort/view (URL filters win in prod to fix cache)
  const buildApiParams = useCallback((extraParams?: Record<string, string>) => {
    const params: Record<string, string> = { page: "1", ...extraParams };
    if (view === "map" || view === "split") params.limit = "200";
    if (initialRegion != null && initialRegion !== "") params.region = initialRegion;
    if (initialQuery != null && initialQuery !== "") params.q = initialQuery;
    if (initialArea != null && initialArea !== "") params.area = initialArea;
    for (const k of FILTER_KEYS) {
      if (effectiveFilters?.[k]) params[k] = "1";
    }
    if (effectiveFilters?.min_pladser && effectiveFilters.min_pladser > 0) {
      params.min_pladser = String(effectiveFilters.min_pladser);
    }
    if (effectiveFilters?.date) params.date = effectiveFilters.date;
    if (effectiveFilters?.date_to) params.date_to = effectiveFilters.date_to;
    if (effectiveFilters?.confirmed_available) params.confirmed_available = "1";
    if (sortMode !== "standard") params.sort = sortMode;
    return params;
  }, [view, initialRegion, initialQuery, initialArea, effectiveFilters, sortMode]);

  // Hent "Mente du..."-forslag når søgning giver 0 resultater. Vi genbruger
  // autocomplete-endpoint'et (/api/soeg/byer) som allerede gør Danish-variant
  // expansion, så "kobenhavn" foreslår "København" automatisk.
  useEffect(() => {
    if (loading) return;
    if (shelters.length > 0 || !initialQuery || initialQuery.trim().length < 2) {
      if (didYouMean.length > 0) setDidYouMean([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/soeg/byer?q=${encodeURIComponent(initialQuery.trim())}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr: unknown) => {
        if (!Array.isArray(arr)) return;
        const items = (arr as Record<string, unknown>[])
          .slice(0, 5)
          .map((s) => ({
            name: String(s?.name ?? ""),
            type: String(s?.type ?? "by"),
          }))
          .filter((s) => s.name.trim().length > 0 && s.name.toLowerCase() !== initialQuery.trim().toLowerCase());
        setDidYouMean(items);
      })
      .catch(() => {
        // ignore aborted/network errors silently
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelters.length, initialQuery, loading]);

  // Fetch page 1 from API and replace shelters
  const fetchPage1 = useCallback((params: Record<string, string>) => {
    setLoading(true);
    fetch(`/api/soeg?${new URLSearchParams(params)}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Shelter[] = filterSheltersByRegion(data.shelters ?? [], initialRegion);
        setShelters(list);
        setAvailabilityMap(data.availabilityMap ?? undefined);
        setHasMore(Boolean(data.hasMore));
        setNextPage(2);
        setListDisplayCount(view === "split" ? Math.min(24, list.length) : list.length);
      })
      .finally(() => setLoading(false));
  }, [initialRegion, view]);

  // On mount: if URL or server indicates filters, refetch to avoid stale ISR/cache in production
  const hasActiveFilters = effectiveFilters && Object.values(effectiveFilters).some(Boolean);
  const didInitialFetch = useRef(false);
  useEffect(() => {
    if (!hasActiveFilters || didInitialFetch.current) return;
    didInitialFetch.current = true;
    fetchPage1(buildApiParams());
  }, [hasActiveFilters, fetchPage1, buildApiParams]);

  // Re-fetch when URL filters change via client-side navigation (filter chip clicks on region pages).
  // The didInitialFetch guard above is a one-shot; this effect handles subsequent filter changes.
  const prevUrlFiltersRef = useRef(urlFilters);
  useEffect(() => {
    if (prevUrlFiltersRef.current === urlFilters) return;
    prevUrlFiltersRef.current = urlFilters;
    fetchPage1(buildApiParams());
  }, [urlFilters, fetchPage1, buildApiParams]);

  // Re-fetch from page 1 when sort mode changes
  useEffect(() => {
    if (sortMode === prevSortMode.current) return;
    prevSortMode.current = sortMode;
    fetchPage1(buildApiParams());
  }, [sortMode, view, buildApiParams, fetchPage1]);

  useEffect(() => {
    setView(initialView);
    if (initialView === "split") {
      setListDisplayCount((c) => Math.min(c, Math.min(24, initialShelters.length)));
    } else {
      setListDisplayCount(initialShelters.length);
    }
  }, [initialView, initialShelters.length]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || loading || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = buildApiParams({ page: String(nextPage) });
      const res = await fetch(`/api/soeg?${new URLSearchParams(params)}`);
      if (!res.ok) return;
      const data = await res.json();
      let more: Shelter[] = filterSheltersByRegion(data.shelters ?? [], initialRegion);
      const moreHasMore = Boolean(data.hasMore);
      setAvailabilityMap((prev) => {
        const nextMap = data.availabilityMap as Record<string, "available" | "booked" | "partial"> | undefined;
        if (!nextMap) return prev;
        return prev ? { ...prev, ...nextMap } : nextMap;
      });
      setShelters((prev) => {
        const ids = new Set(prev.map((s) => s.id));
        const newOnes = more.filter((s) => !ids.has(s.id));
        const merged = newOnes.length ? [...prev, ...newOnes] : prev;
        return initialRegion?.trim()
          ? filterSheltersByRegion(merged, initialRegion)
          : merged;
      });
      setHasMore(moreHasMore);
      setNextPage((p) => p + 1);
      if (view === "split") {
        setListDisplayCount((c) => c + more.length);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [loading, hasMore, nextPage, initialRegion, buildApiParams, view]);

  // IntersectionObserver: split – afslør flere fra listen (op til shelters.length) eller hent næste side
  useEffect(() => {
    if (view !== "split") return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        if (listDisplayCount < shelters.length) {
          setListDisplayCount((c) => Math.min(c + 24, shelters.length));
        } else if (hasMore) {
          loadMore();
        }
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [view, listDisplayCount, shelters.length, hasMore, loadMore]);

  // IntersectionObserver: kun liste-view – load næste side
  useEffect(() => {
    if (view !== "list" || !hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) loadMore();
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [view, hasMore, loading, loadMore]);

  // Kort får 1000 ved indlæsning; flere tilføjes ved zoom via fetchByBounds (merge).

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
  }, []);

  const router = useRouter();

  const buildViewUrl = useCallback((newView: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    const base = basePath ?? "/soeg";
    const queryString = params.toString();
    return base + (queryString ? `?${queryString}` : "");
  }, [searchParams, basePath]);

  const handleViewList = useCallback(() => {
    setView("list");
    router.push(buildViewUrl("list"), { scroll: false });
  }, [buildViewUrl, router]);

  const handleViewSplit = useCallback(() => {
    setView("split");
    router.push(buildViewUrl("split"), { scroll: false });
  }, [buildViewUrl, router]);

  const handleViewMap = useCallback(() => {
    setView("map");
    router.push(buildViewUrl("map"), { scroll: false });
  }, [buildViewUrl, router]);

  const boundsAbortRef = useRef<AbortController | null>(null);

  const fetchByBounds = useCallback(
    async (bounds: MapBounds) => {
      // Skip the very first bounds report (initial map render) so the list
      // shows all shelters until the user actually interacts with the map.
      boundsReportCount.current += 1;
      if (boundsReportCount.current <= 1) return;

      // Abort any in-flight bounds fetch to prevent stale data overwriting newer data
      if (boundsAbortRef.current) boundsAbortRef.current.abort();
      const controller = new AbortController();
      boundsAbortRef.current = controller;

      // Update map bounds so list filters to visible area
      setMapBounds(bounds);
      hasPannedMap.current = true;
      // Reset list display count so we show the first batch for the new area
      setListDisplayCount(24);

      const params = buildApiParams({
        minLat: String(bounds.south),
        maxLat: String(bounds.north),
        minLon: String(bounds.west),
        maxLon: String(bounds.east),
      });
      setLoading(true);
      try {
        const res = await fetch(`/api/soeg?${new URLSearchParams(params)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        let list: Shelter[] = filterSheltersByRegion(data.shelters ?? [], initialRegion);
        setShelters((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]));
          for (const s of list) byId.set(s.id, s);
          const merged = filterSheltersByRegion([...byId.values()], initialRegion);
          return merged.length > 5000 ? merged.slice(0, 5000) : merged;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [initialRegion, buildApiParams]
  );

  // Filter shelters to only those visible on the map (split view after user pans/zooms)
  const visibleShelters = (view === "split" && hasPannedMap.current && mapBounds)
    ? shelters.filter((s) => {
        const coords = getLocationCoords(s);
        if (!coords) return false;
        return (
          coords.lat >= mapBounds.south &&
          coords.lat <= mapBounds.north &&
          coords.lon >= mapBounds.west &&
          coords.lon <= mapBounds.east
        );
      })
    : shelters;

  // Server handles sorting — just use the arrays directly
  const sortedShelters = visibleShelters;
  const sortedAllShelters = shelters;

  return (
    <div className="space-y-4 md:space-y-8">
      <SearchBar
        mode="search"
        initialRegion={initialRegion}
        initialQuery={initialQuery}
        initialArea={initialArea}
        initialFilters={effectiveFilters}
        view={view}
        onViewChange={handleViewChange}
        filterBasePath={basePath}
      />

      {effectiveFilters?.date && (
        <p className="text-xs text-primary/55 bg-primary/5 rounded-lg px-3 py-2 -mt-1">
          {(() => {
            const fmt = (d: string) => new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(new Date(d + "T12:00:00"));
            const from = fmt(effectiveFilters.date!);
            const to = effectiveFilters.date_to && effectiveFilters.date_to !== effectiveFilters.date ? fmt(effectiveFilters.date_to) : null;
            const period = to ? `${from}–${to}` : from;
            if (effectiveFilters.confirmed_available) {
              return `Viser kun shelters med bekræftet ledighedsdata der ikke er optaget ${to ? `i perioden ${period}` : `den ${period}`}. Andre shelters kan også være ledige, men kræver ikke forudbestilling.`;
            }
            return to
              ? `Shelters bekræftet optaget i perioden ${period} er skjult. Shelters uden ledighedsmærke kræver blot ikke forudbestilling.`
              : `Shelters bekræftet optaget den ${period} er skjult. Shelters uden ledighedsmærke kræver blot ikke forudbestilling.`;
          })()}
        </p>
      )}

      {shelters.length === 0 && !loading ? (
        <div className="text-center py-12">
          <p className="text-primary/70 text-lg mb-4">
            Ingen shelters matcher din søgning. Prøv at justere dine filtre eller søg på noget andet.
          </p>
          {didYouMean.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-primary/60 mb-3">Mente du:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {didYouMean.map((s) => (
                  <a
                    key={`${s.type}:${s.name}`}
                    href={`/soeg?q=${encodeURIComponent(s.name)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-sm text-accent hover:bg-accent/15 transition-colors"
                  >
                    {s.name}
                    <span className="text-primary/40 text-xs">({s.type})</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {hasActiveFilters && (
            <a
              href={basePath ?? (initialRegion ? `/soeg?region=${encodeURIComponent(initialRegion)}` : "/soeg")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 transition-colors"
            >
              Nulstil filtre
            </a>
          )}
        </div>
      ) : view === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[600px] lg:min-h-[70vh] -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/95 py-2 z-10">
            <p className="text-primary/70 text-sm">
              {hasPannedMap.current && mapBounds
                ? `${visibleShelters.length} shelter${visibleShelters.length !== 1 ? "s" : ""} i dette område`
                : hasMore
                  ? `Shelters ${initialRegion?.trim() ? `${prepositionForRegionName(initialRegion)} ${initialRegion.trim()}` : "i Danmark"} · scroll for flere`
                  : `${visibleShelters.length} shelter${visibleShelters.length !== 1 ? "s" : ""} ${initialRegion?.trim() ? `${prepositionForRegionName(initialRegion)} ${initialRegion.trim()}` : "i Danmark"}`}
            </p>
            <SortSelect value={sortMode} onChange={setSortMode} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              {sortedShelters.slice(0, listDisplayCount).map((shelter) => (
                <ShelterCard key={shelter.id} shelter={shelter} availabilityState={availabilityMap?.[shelter.id] ?? null} activeDate={effectiveFilters?.date ?? null} />
              ))}
            </div>
            <div ref={sentinelRef} className="py-6 flex items-center justify-center gap-2">
              {loading && (
                <>
                  <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-primary/60 text-sm">Indlæser flere shelters...</span>
                </>
              )}
            </div>
          </div>
          <div className="compact-map lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 h-[160px] sm:h-[200px] lg:min-h-[420px] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-2 lg:mb-0 relative">
              <ShelterMap
                shelters={shelters}
                className="absolute inset-0 w-full h-full"
                onBoundsChange={fetchByBounds}
                initialRegion={initialRegion}
                fitWholeDenmarkOnLoad={!initialRegion?.trim()}
                overrideCenter={!initialRegion?.trim() ? [56.0, 10.5] : undefined}
                overrideZoom={!initialRegion?.trim() ? 7 : undefined}
              />
            <FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="absolute" />
          </div>
        </div>
      ) : view === "map" ? (
        <>
          <p className="text-primary/70 text-sm">
            Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} på kortet
            {loading && " · opdaterer…"}
          </p>
          <div className="rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[400px] sm:min-h-[500px] md:min-h-[700px] h-[500px] sm:h-[600px] md:h-[85vh] max-h-[1400px] relative">
            <ShelterMap
              shelters={shelters}
              className="absolute inset-0 w-full h-full"
              onBoundsChange={fetchByBounds}
              initialRegion={initialRegion}
            />
          </div>
          <FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="fixed" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-primary/70 text-sm">
              Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""}
              {hasMore && " (scroll for at indlæse flere)"}
            </p>
            <SortSelect value={sortMode} onChange={setSortMode} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedAllShelters.map((shelter) => (
              <ShelterCard key={shelter.id} shelter={shelter} availabilityState={availabilityMap?.[shelter.id] ?? null} activeDate={effectiveFilters?.date ?? null} />
            ))}
          </div>
          <div ref={sentinelRef} className="py-6 flex items-center justify-center gap-2">
            {loading && (
              <>
                <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-primary/60 text-sm">Indlæser flere shelters...</span>
              </>
            )}
          </div>
          <FloatingViewToggle view={view} onList={handleViewList} onSplit={handleViewSplit} onMap={handleViewMap} position="fixed" />
        </>
      )}
    </div>
  );
}
