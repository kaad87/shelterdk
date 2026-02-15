"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";
import type { Shelter } from "@/types/shelter";
import type { SoegFilters } from "@/lib/soeg-db";
import { filterSheltersByRegion } from "@/lib/soeg-filters";

type ViewMode = "list" | "map" | "split";

interface SoegContentProps {
  initialShelters: Shelter[];
  initialHasMore: boolean;
  initialRegion: string | null;
  initialQuery: string | null;
  initialFilters?: SoegFilters;
  view: ViewMode;
}

export function SoegContent({
  initialShelters,
  initialHasMore,
  initialRegion,
  initialQuery,
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
      if (initialFilters?.billede) params.billede = "1";
      if (initialFilters?.anmeldelser) params.anmeldelser = "1";
      if (initialFilters?.bookbar) params.bookbar = "1";
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
  }, [loading, hasMore, nextPage, initialRegion, initialQuery, initialFilters]);

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
      const params: Record<string, string> = {
        minLat: String(bounds.south),
        maxLat: String(bounds.north),
        minLon: String(bounds.west),
        maxLon: String(bounds.east),
      };
      if (initialRegion != null && initialRegion !== "") params.region = initialRegion;
      if (initialQuery != null && initialQuery !== "") params.q = initialQuery;
      if (initialFilters?.billede) params.billede = "1";
      if (initialFilters?.anmeldelser) params.anmeldelser = "1";
      if (initialFilters?.bookbar) params.bookbar = "1";
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
    [initialRegion, initialQuery, initialFilters]
  );

  return (
    <div className="space-y-8">
      <SearchBar
        mode="search"
        initialRegion={initialRegion}
        initialQuery={initialQuery}
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
          <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1">
            <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
              {shelters.length} shelter{shelters.length !== 1 ? "s" : ""}{" "}
              {initialRegion?.trim() ? `i ${initialRegion.trim()}` : "i Danmark"}
              {(hasMore || listDisplayCount < shelters.length) && " · scroll for flere"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
              {shelters.slice(0, listDisplayCount).map((shelter) => (
                <ShelterCard key={shelter.id} shelter={shelter} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-4 flex items-center justify-center">
              {loading && (
                <span className="text-primary/60 text-sm">Indlæser flere…</span>
              )}
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0">
            <ShelterMap
              shelters={shelters}
              className="w-full h-full"
              onBoundsChange={fetchByBounds}
              initialRegion={initialRegion}
            />
          </div>
        </div>
      ) : view === "map" ? (
        <>
          <p className="text-primary/70 text-sm">
            Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} på kortet
            {loading && " · opdaterer…"}
          </p>
          <div className="rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[400px] sm:min-h-[500px] md:min-h-[700px] h-[70vh] sm:h-[80vh] md:h-[85vh] max-h-[1400px]">
            <ShelterMap
              shelters={shelters}
              className="w-full h-full"
              onBoundsChange={fetchByBounds}
              initialRegion={initialRegion}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-primary/70 text-sm">
            Viser {shelters.length} shelter{shelters.length !== 1 ? "s" : ""}
            {hasMore && " (scroll for at indlæse flere)"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {shelters.map((shelter) => (
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
