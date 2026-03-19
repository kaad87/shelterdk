"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";
import type { Shelter } from "@/types/shelter";
import type { SoegFilters } from "@/lib/soeg-db";
import { filterSheltersByRegion } from "@/lib/soeg-filters";
import { getLocationCoords } from "@/lib/shelter-detail";

type ViewMode = "list" | "map" | "split";
type SortMode = "standard" | "rating" | "reviews";

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
  view: ViewMode;
}

export function SoegContent({
  initialShelters,
  initialHasMore,
  initialRegion,
  initialQuery,
  initialArea = null,
  initialFilters = {},
  view: initialView,
}: SoegContentProps) {
  const [shelters, setShelters] = useState<Shelter[]>(() =>
    filterSheltersByRegion(initialShelters, initialRegion)
  );
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
      const params: Record<string, string> = { page: String(nextPage) };
      if (initialRegion != null && initialRegion !== "") params.region = initialRegion;
      if (initialQuery != null && initialQuery !== "") params.q = initialQuery;
      if (initialArea != null && initialArea !== "") params.area = initialArea;
      if (initialFilters?.billede) params.billede = "1";
      if (initialFilters?.anmeldelser) params.anmeldelser = "1";
      if (initialFilters?.bookbar) params.bookbar = "1";
      if (initialFilters?.vand) params.vand = "1";
      if (initialFilters?.toilet) params.toilet = "1";
      if (initialFilters?.hund) params.hund = "1";
      if (initialFilters?.baalplads) params.baalplads = "1";
      const res = await fetch(`/api/soeg?${new URLSearchParams(params)}`);
      if (!res.ok) return;
      const data = await res.json();
      let more: Shelter[] = filterSheltersByRegion(data.shelters ?? [], initialRegion);
      const moreHasMore = Boolean(data.hasMore);
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
  }, [loading, hasMore, nextPage, initialRegion, initialQuery, initialArea, initialFilters]);

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

  const fetchByBounds = useCallback(
    async (bounds: MapBounds) => {
      // Skip the very first bounds report (initial map render) so the list
      // shows all shelters until the user actually interacts with the map.
      boundsReportCount.current += 1;
      if (boundsReportCount.current <= 1) return;

      // Update map bounds so list filters to visible area
      setMapBounds(bounds);
      hasPannedMap.current = true;
      // Reset list display count so we show the first batch for the new area
      setListDisplayCount(24);

      const params: Record<string, string> = {
        minLat: String(bounds.south),
        maxLat: String(bounds.north),
        minLon: String(bounds.west),
        maxLon: String(bounds.east),
      };
      if (initialRegion != null && initialRegion !== "") params.region = initialRegion;
      if (initialQuery != null && initialQuery !== "") params.q = initialQuery;
      if (initialArea != null && initialArea !== "") params.area = initialArea;
      if (initialFilters?.billede) params.billede = "1";
      if (initialFilters?.anmeldelser) params.anmeldelser = "1";
      if (initialFilters?.bookbar) params.bookbar = "1";
      if (initialFilters?.vand) params.vand = "1";
      if (initialFilters?.toilet) params.toilet = "1";
      if (initialFilters?.hund) params.hund = "1";
      if (initialFilters?.baalplads) params.baalplads = "1";
      setLoading(true);
      try {
        const res = await fetch(`/api/soeg?${new URLSearchParams(params)}`);
        if (!res.ok) return;
        const data = await res.json();
        let list: Shelter[] = filterSheltersByRegion(data.shelters ?? [], initialRegion);
        setShelters((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]));
          for (const s of list) byId.set(s.id, s);
          const merged = filterSheltersByRegion([...byId.values()], initialRegion);
          return merged.length > 5000 ? merged.slice(0, 5000) : merged;
        });
      } finally {
        setLoading(false);
      }
    },
    [initialRegion, initialQuery, initialArea, initialFilters]
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

  // Apply sorting
  const sortedShelters = useMemo(() => {
    if (sortMode === "standard") return visibleShelters;
    const sorted = [...visibleShelters];
    if (sortMode === "rating") {
      sorted.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0));
    } else if (sortMode === "reviews") {
      sorted.sort((a, b) => (b.google_user_ratings_total ?? 0) - (a.google_user_ratings_total ?? 0));
    }
    return sorted;
  }, [visibleShelters, sortMode]);

  // Also sort for list view
  const sortedAllShelters = useMemo(() => {
    if (sortMode === "standard") return shelters;
    const sorted = [...shelters];
    if (sortMode === "rating") {
      sorted.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0));
    } else if (sortMode === "reviews") {
      sorted.sort((a, b) => (b.google_user_ratings_total ?? 0) - (a.google_user_ratings_total ?? 0));
    }
    return sorted;
  }, [shelters, sortMode]);

  return (
    <div className="space-y-8">
      <SearchBar
        mode="search"
        initialRegion={initialRegion}
        initialQuery={initialQuery}
        initialArea={initialArea}
        initialFilters={initialFilters}
        view={view}
        onViewChange={handleViewChange}
      />

      {shelters.length === 0 && !loading ? (
        <p className="text-primary/70 py-8">
          Ingen shelters fundet. Prøv at ændre region eller søgetekst.
        </p>
      ) : view === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh] -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-1 lg:order-1">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/95 py-2 z-10">
            <p className="text-primary/70 text-sm">
              {visibleShelters.length} shelter{visibleShelters.length !== 1 ? "s" : ""}{" "}
              {hasPannedMap.current && mapBounds
                ? "i dette område"
                : initialRegion?.trim()
                  ? `${prepositionForRegionName(initialRegion)} ${initialRegion.trim()}`
                  : "i Danmark"}
              {!hasPannedMap.current && (hasMore || listDisplayCount < shelters.length) && " · scroll for flere"}
            </p>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sortér shelters"
              className="text-sm border border-primary/20 rounded-lg px-2 py-1 bg-white text-primary/80 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="standard">Standard</option>
              <option value="rating">Bedst bedømt</option>
              <option value="reviews">Flest anmeldelser</option>
            </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              {sortedShelters.slice(0, listDisplayCount).map((shelter) => (
                <ShelterCard key={shelter.id} shelter={shelter} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-4 flex items-center justify-center">
              {loading && (
                <span className="text-primary/60 text-sm">Indlæser flere…</span>
              )}
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-2 lg:order-2 mb-6 lg:mb-0 flex flex-col">
            <div className="flex-1 min-h-0 w-full relative">
              <ShelterMap
                shelters={shelters}
                className="absolute inset-0 w-full h-full"
                onBoundsChange={fetchByBounds}
                initialRegion={initialRegion}
              />
            </div>
          </div>
        </div>
      ) : view === "map" ? (
        <>
          <p className="text-primary/70 text-sm">
            Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} på kortet
            {loading && " · opdaterer…"}
          </p>
          <div className="rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[400px] sm:min-h-[500px] md:min-h-[700px] h-[70vh] sm:h-[80vh] md:h-[85vh] max-h-[1400px] relative">
            <ShelterMap
              shelters={shelters}
              className="absolute inset-0 w-full h-full"
              onBoundsChange={fetchByBounds}
              initialRegion={initialRegion}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-primary/70 text-sm">
              Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""}
              {hasMore && " (scroll for at indlæse flere)"}
            </p>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sortér shelters"
              className="text-sm border border-primary/20 rounded-lg px-2 py-1 bg-white text-primary/80 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="standard">Standard</option>
              <option value="rating">Bedst bedømt</option>
              <option value="reviews">Flest anmeldelser</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedAllShelters.map((shelter) => (
              <ShelterCard key={shelter.id} shelter={shelter} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-4 flex items-center justify-center">
            {loading && (
              <span className="text-primary/60 text-sm">Indlæser flere…</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
