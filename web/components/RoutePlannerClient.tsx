"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { RoutePlannerShelter } from "@/types/shelter";
import { RoutePlannerSidebar } from "./RoutePlannerSidebar";
import { getLocationCoords } from "@/lib/shelter-detail";
import { downloadGpx } from "@/lib/gpx-export";
import type { GpxWaypoint } from "@/lib/gpx-export";

const RoutePlannerMap = dynamic(() => import("./RoutePlannerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-primary/5 animate-pulse flex items-center justify-center">
      <span className="text-primary/30 text-sm">Indlæser kort...</span>
    </div>
  ),
});

interface Trail {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Geometry;
}

const MAX_WAYPOINTS = 20;

interface Props {
  shelters: RoutePlannerShelter[];
}

export function RoutePlannerClient({ shelters }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const shelterBySlug = useMemo(() => {
    const map = new Map<string, RoutePlannerShelter>();
    for (const s of shelters) map.set(s.slug, s);
    return map;
  }, [shelters]);

  const initialWaypoints = useMemo(() => {
    const w = searchParams.get("w");
    if (!w) return [];
    return w
      .split(",")
      .map((slug) => shelterBySlug.get(slug))
      .filter(Boolean) as RoutePlannerShelter[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [waypoints, setWaypoints] = useState<RoutePlannerShelter[]>(initialWaypoints);
  const [showTrails, setShowTrails] = useState(
    searchParams.get("trails") === "on"
  );
  const [trailData, setTrailData] = useState<Trail[] | null>(null);
  const [trailError, setTrailError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (waypoints.length > 0) {
      params.set("w", waypoints.map((w) => w.slug).join(","));
    }
    if (showTrails) params.set("trails", "on");
    const qs = params.toString();
    const url = `/ruteplanner${qs ? `?${qs}` : ""}`;
    router.replace(url, { scroll: false });
  }, [waypoints, showTrails, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleToggleShelter = useCallback(
    (shelter: RoutePlannerShelter) => {
      setWaypoints((prev) => {
        const idx = prev.findIndex((w) => w.id === shelter.id);
        if (idx >= 0) {
          return prev.filter((_, i) => i !== idx);
        }
        if (prev.length >= MAX_WAYPOINTS) {
          showToast(`Maks ${MAX_WAYPOINTS} shelters per rute`);
          return prev;
        }
        return [...prev, shelter];
      });
    },
    [showToast]
  );

  const handleRemove = useCallback((index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setWaypoints((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWaypoints((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
  }, []);

  const handleDownloadGpx = useCallback(() => {
    const gpxWaypoints: GpxWaypoint[] = waypoints
      .map((w) => {
        const coords = getLocationCoords(w);
        if (!coords) return null;
        return { name: w.title, lat: coords.lat, lon: coords.lon };
      })
      .filter(Boolean) as GpxWaypoint[];
    downloadGpx(gpxWaypoints);
  }, [waypoints]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {
      showToast("Kunne ikke kopiere link");
    });
  }, [showToast]);

  const handleToggleTrails = useCallback(async () => {
    const nextShow = !showTrails;
    setShowTrails(nextShow);

    if (nextShow && !trailData && !trailError) {
      try {
        const resp = await fetch("/data/trails.json");
        if (!resp.ok) throw new Error("Failed to fetch trails");
        const data: Trail[] = await resp.json();
        setTrailData(data);
      } catch {
        setTrailError(true);
        showToast("Kunne ikke indlæse vandreruter");
        setShowTrails(false);
      }
    }
  }, [showTrails, trailData, trailError, showToast]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div className="flex-1 h-[60vh] md:h-full">
        <RoutePlannerMap
          shelters={shelters}
          waypoints={waypoints}
          onToggleShelter={handleToggleShelter}
          showTrails={showTrails}
          onToggleTrails={handleToggleTrails}
          trailData={trailData}
        />
      </div>

      <div className="w-full md:w-[340px] md:border-l border-primary/10 h-[40vh] md:h-full">
        <RoutePlannerSidebar
          waypoints={waypoints}
          onRemove={handleRemove}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClear={handleClear}
          onDownloadGpx={handleDownloadGpx}
          onShare={handleShare}
        />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg animate-fade-in-up">
          {toast}
        </div>
      )}
    </div>
  );
}
