// components/CuratedRoutesClient.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  CuratedRouteIndex,
  CuratedRouteData,
  CuratedRouteDataMap,
} from "@/types/curated-route";
import type { GpxWaypoint } from "@/lib/gpx-export";
import { RouteCard } from "./RouteCard";
import { RouteDetail } from "./RouteDetail";
import {
  RouteFilters,
  type RegionFilter,
  type LengthFilter,
  type SortOption,
} from "./RouteFilters";

const CuratedRoutesMap = dynamic(() => import("./CuratedRoutesMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
      <span className="text-primary/30 text-sm">Indlæser kort...</span>
    </div>
  ),
});

interface Props {
  initialIndex: CuratedRouteIndex[];
}

export function CuratedRoutesClient({ initialIndex }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [routes] = useState(initialIndex);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    searchParams.get("rute") || null
  );
  const [region, setRegion] = useState<RegionFilter>(
    (searchParams.get("region") as RegionFilter) || ""
  );
  const [length, setLength] = useState<LengthFilter>(
    (searchParams.get("laengde") as LengthFilter) || ""
  );
  const [sort, setSort] = useState<SortOption>("shelters");
  const [routeDataCache, setRouteDataCache] = useState<CuratedRouteDataMap>({});
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fullDataRef = useRef<CuratedRouteDataMap | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // URL sync — push when selecting/deselecting a route (so browser back works),
  // replace for filter changes (so history doesn't fill with filter tweaks)
  const prevSlugRef = useRef(selectedSlug);
  useEffect(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (length) params.set("laengde", length);
    if (selectedSlug) params.set("rute", selectedSlug);
    const qs = params.toString();
    const url = `/ruteplanner${qs ? `?${qs}` : ""}`;

    const slugChanged = prevSlugRef.current !== selectedSlug;
    prevSlugRef.current = selectedSlug;

    if (slugChanged) {
      router.push(url, { scroll: false });
    } else {
      router.replace(url, { scroll: false });
    }
  }, [region, length, selectedSlug, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Filter + sort
  const filteredRoutes = useMemo(() => {
    let result = routes;

    if (region) {
      result = result.filter((r) => r.region === region);
    }

    if (length === "short") {
      result = result.filter((r) => r.length_km < 10);
    } else if (length === "medium") {
      result = result.filter((r) => r.length_km >= 10 && r.length_km <= 50);
    } else if (length === "long") {
      result = result.filter((r) => r.length_km > 50);
    }

    if (sort === "shelters") {
      result = [...result].sort((a, b) => b.shelter_count - a.shelter_count);
    } else if (sort === "longest") {
      result = [...result].sort((a, b) => b.length_km - a.length_km);
    } else if (sort === "shortest") {
      result = [...result].sort((a, b) => a.length_km - b.length_km);
    } else if (sort === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "da"));
    }

    return result;
  }, [routes, region, length, sort]);

  // Lazy-load full route data
  const loadRouteData = useCallback(
    async (slug: string): Promise<CuratedRouteData | null> => {
      if (routeDataCache[slug]) return routeDataCache[slug];

      // Load full file on first request
      if (!fullDataRef.current) {
        setLoadingRoute(true);
        try {
          const resp = await fetch("/data/curated-routes.json");
          if (!resp.ok) throw new Error("Fetch failed");
          const data: CuratedRouteDataMap = await resp.json();
          fullDataRef.current = data;
          setRouteDataCache(data);
        } catch {
          showToast("Kunne ikke indlæse rutedetaljer");
          setLoadingRoute(false);
          return null;
        }
        setLoadingRoute(false);
      }

      return fullDataRef.current?.[slug] || null;
    },
    [routeDataCache, showToast]
  );

  const handleSelectRoute = useCallback(
    async (slug: string) => {
      if (selectedSlug === slug) {
        setSelectedSlug(null);
        return;
      }
      setSelectedSlug(slug);
      await loadRouteData(slug);
      // Scroll to map
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [selectedSlug, loadRouteData]
  );

  const handleBack = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  const handleDownloadGpx = useCallback(async () => {
    if (!selectedSlug) return;
    const data = await loadRouteData(selectedSlug);
    if (!data) return;
    const selectedRoute = routes.find((r) => r.slug === selectedSlug);
    if (!selectedRoute) return;

    // Dynamic import to avoid loading GPX code until needed
    const { downloadRouteGpx } = await import("@/lib/gpx-export");
    const waypoints: GpxWaypoint[] = data.shelters.map((s) => ({
      name: s.title,
      lat: s.lat,
      lon: s.lon,
    }));
    downloadRouteGpx(
      selectedRoute.name,
      selectedRoute.slug,
      data.geometry,
      waypoints
    );
  }, [selectedSlug, routes, loadRouteData]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {
      showToast("Kunne ikke kopiere link");
    });
  }, [showToast]);

  const selectedRoute = selectedSlug
    ? routes.find((r) => r.slug === selectedSlug) || null
    : null;
  const selectedRouteData = selectedSlug
    ? routeDataCache[selectedSlug] || null
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <h1 className="font-serif text-3xl font-bold text-primary">
          Vandreruter med shelters
        </h1>
        <p className="text-primary/60 text-base mt-2">
          Udforsk {routes.length} vandreruter fra Naturstyrelsen med shelters langs vejen
        </p>
      </div>

      {/* Map */}
      <div ref={mapSectionRef} className="w-full h-[40vh] md:h-[40vh]">
        {loadingRoute ? (
          <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
            <span className="text-primary/30 text-sm">Indlæser rute...</span>
          </div>
        ) : (
          <CuratedRoutesMap
            routeIndex={routes}
            routeData={selectedRouteData}
            selectedSlug={selectedSlug}
            onRouteClick={handleSelectRoute}
            allRouteData={fullDataRef.current}
          />
        )}
      </div>

      {/* Detail overlay (when route selected) */}
      {selectedRoute && selectedRouteData && (
        <RouteDetail
          route={selectedRoute}
          shelters={selectedRouteData.shelters}
          onBack={handleBack}
          onDownloadGpx={handleDownloadGpx}
          onShare={handleShare}
        />
      )}

      {/* Filters + Card grid (when no route selected) */}
      {!selectedSlug && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <RouteFilters
            region={region}
            length={length}
            sort={sort}
            onRegionChange={setRegion}
            onLengthChange={setLength}
            onSortChange={setSort}
            resultCount={filteredRoutes.length}
          />

          {filteredRoutes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-primary/50">Ingen ruter matcher dine filtre</p>
              <button
                onClick={() => {
                  setRegion("");
                  setLength("");
                }}
                className="mt-2 text-sm text-accent hover:underline"
              >
                Nulstil filtre
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {filteredRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedSlug === route.slug}
                  onClick={() => handleSelectRoute(route.slug)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
