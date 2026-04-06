"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CuratedRouteData, CuratedRouteDataMap } from "@/types/curated-route";

const CuratedRoutesMap = dynamic(() => import("@/components/CuratedRoutesMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-primary/5 animate-pulse rounded-xl flex items-center justify-center">
      <span className="text-sm text-primary/40">Indlæser kort…</span>
    </div>
  ),
});

interface RouteDetailMapProps {
  slug: string;
}

export function RouteDetailMap({ slug }: RouteDetailMapProps) {
  const [routeData, setRouteData] = useState<CuratedRouteData | null>(null);

  useEffect(() => {
    fetch("/data/curated-routes.json")
      .then((res) => res.json())
      .then((map: CuratedRouteDataMap) => {
        if (map[slug]) setRouteData(map[slug]);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <div className="w-full h-[350px] sm:h-[450px] rounded-xl overflow-hidden border border-primary/10">
      <CuratedRoutesMap
        routeIndex={[]}
        routeData={routeData}
        selectedSlug={routeData ? slug : null}
        allRouteData={null}
      />
    </div>
  );
}
