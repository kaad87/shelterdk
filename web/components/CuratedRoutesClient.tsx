// components/CuratedRoutesClient.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSafeSearchParams } from "@/lib/useSafeSearchParams";
import dynamic from "next/dynamic";
import type {
  CuratedRouteIndex,
  CuratedRouteDataMap,
} from "@/types/curated-route";
import type { GpxWaypoint } from "@/lib/gpx-export";
import type { GpxTrackPoint } from "@/lib/gpx-parser";
import type { ShelterWithDistance, LightShelter } from "@/lib/shelter-distance";
import Link from "next/link";
import { RouteCard } from "./RouteCard";
import { GpxUploadButton, GpxUploadZone } from "./GpxUpload";
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
  const searchParams = useSafeSearchParams();
  const router = useRouter();

  const [routes] = useState(initialIndex);
  const [region, setRegion] = useState<RegionFilter>(
    (searchParams.get("region") as RegionFilter) || ""
  );
  const [length, setLength] = useState<LengthFilter>(
    (searchParams.get("laengde") as LengthFilter) || ""
  );
  const [sort, setSort] = useState<SortOption>("shelters");
  const [routeDataCache, setRouteDataCache] = useState<CuratedRouteDataMap>({});
  const [toast, setToast] = useState<string | null>(null);
  const fullDataRef = useRef<CuratedRouteDataMap | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  // GPX Upload state
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadedRoute, setUploadedRoute] = useState<GpxTrackPoint[] | null>(null);
  const [uploadedShelters, setUploadedShelters] = useState<ShelterWithDistance[]>([]);
  const [uploadRouteName, setUploadRouteName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "parsing" | "loaded" | "error">("idle");
  const [radiusKm, setRadiusKm] = useState(2);
  const [allShelters, setAllShelters] = useState<LightShelter[]>([]);
  const sheltersFetchedRef = useRef(false);

  // URL ↔ filter sync
  const pushingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (length) params.set("laengde", length);
    const qs = params.toString();
    const url = `/ruteplanner${qs ? `?${qs}` : ""}`;

    pushingRef.current = true;
    router.replace(url, { scroll: false });
  }, [region, length, router]);

  const urlRegion = (searchParams.get("region") as RegionFilter) || "";
  const urlLength = (searchParams.get("laengde") as LengthFilter) || "";

  useEffect(() => {
    if (pushingRef.current) {
      pushingRef.current = false;
      return;
    }
    setRegion(urlRegion);
    setLength(urlLength);
  }, [urlRegion, urlLength]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Load full route data so the map shows real route lines
  useEffect(() => {
    if (fullDataRef.current) return;
    fetch("/data/curated-routes.json")
      .then((r) => {
        if (!r.ok) throw new Error("Fetch failed");
        return r.json();
      })
      .then((data: CuratedRouteDataMap) => {
        fullDataRef.current = data;
        setRouteDataCache(data);
      })
      .catch(() => {});
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

  const handleMapRouteClick = useCallback(
    (slug: string) => {
      router.push(`/ruteplanner/${slug}`);
    },
    [router]
  );

  // GPX Upload handlers
  const fetchShelters = useCallback(async () => {
    if (sheltersFetchedRef.current) return;
    sheltersFetchedRef.current = true;
    try {
      const resp = await fetch("/api/shelters/lightweight");
      if (!resp.ok) throw new Error("Fetch failed");
      const data = await resp.json();
      setAllShelters(data.shelters ?? []);
    } catch {
      showToast("Kunne ikke hente shelter-data");
      sheltersFetchedRef.current = false;
    }
  }, [showToast]);

  const handleEnterUploadMode = useCallback(() => {
    setUploadMode(true);
    fetchShelters();
  }, [fetchShelters]);

  const handleExitUploadMode = useCallback(() => {
    setUploadMode(false);
    setUploadedRoute(null);
    setUploadedShelters([]);
    setUploadRouteName(null);
    setUploadState("idle");
    setRadiusKm(2);
  }, []);

  const handleRouteLoaded = useCallback(
    (points: GpxTrackPoint[], shelters: ShelterWithDistance[], name: string | null) => {
      setUploadedRoute(points);
      setUploadedShelters(shelters);
      setUploadRouteName(name);
      setUploadState("loaded");
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    []
  );

  const handleUploadClear = useCallback(() => {
    setUploadedRoute(null);
    setUploadedShelters([]);
    setUploadRouteName(null);
    setUploadState("idle");
  }, []);

  const handleUploadDownload = useCallback(async () => {
    if (!uploadedRoute || uploadedShelters.length === 0) return;
    const { generateGpx } = await import("@/lib/gpx-export");
    const waypoints: GpxWaypoint[] = uploadedShelters.map((s) => ({
      name: s.title,
      lat: s.lat,
      lon: s.lon,
    }));
    const gpxString = generateGpx(waypoints);
    if (!gpxString) return;
    const blob = new Blob([gpxString], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shelterdk-gpx-shelters.gpx";
    a.click();
    URL.revokeObjectURL(url);
  }, [uploadedRoute, uploadedShelters]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-bold text-primary">
              Vandreruter med shelters
            </h1>
            <p className="text-primary/60 text-base mt-2">
              {uploadMode
                ? "Upload din GPX-fil og find shelters langs ruten"
                : `Udforsk ${routes.length} vandreruter fra Naturstyrelsen med shelters langs vejen`}
            </p>
          </div>
          {!uploadMode && (
            <GpxUploadButton onClick={handleEnterUploadMode} />
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapSectionRef} className="w-full h-[40vh] md:h-[40vh]">
        <CuratedRoutesMap
          routeIndex={filteredRoutes}
          routeData={null}
          selectedSlug={null}
          onRouteClick={handleMapRouteClick}
          allRouteData={fullDataRef.current}
          uploadedRoute={uploadedRoute ?? undefined}
          uploadedShelters={uploadedShelters.length > 0 ? uploadedShelters : undefined}
        />
      </div>

      {/* GPX Upload mode */}
      {uploadMode && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={handleExitUploadMode}
            className="text-sm text-accent hover:underline mb-4 inline-block"
          >
            &larr; Tilbage til kuraterede ruter
          </button>

          <GpxUploadZone
            onRouteLoaded={handleRouteLoaded}
            onClear={handleUploadClear}
            onDownload={handleUploadDownload}
            uploadedShelters={uploadedShelters}
            uploadState={uploadState}
            routeName={uploadRouteName}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            allShelters={allShelters}
          />
        </div>
      )}

      {/* Filters + Card grid */}
      {!uploadMode && (
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
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}

          <section className="mt-10 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">
              Udforsk mere
            </h2>
            <ul className="space-y-2 text-sm text-primary/80">
              <li>
                <Link href="/soeg" className="text-accent hover:underline">
                  Søg alle shelters
                </Link>
                {" "}– find shelters på kort og liste
              </li>
              <li>
                <Link href="/turvenner" className="text-accent hover:underline">
                  Find turvenner
                </Link>
                {" "}– del oplevelsen med andre
              </li>
              <li>
                <Link href="/omraade" className="text-accent hover:underline">
                  Udforsk områder
                </Link>
                {" "}– shelters efter område i Danmark
              </li>
            </ul>
          </section>
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
