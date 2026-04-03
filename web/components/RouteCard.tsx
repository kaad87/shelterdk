// components/RouteCard.tsx
"use client";

import Link from "next/link";
import { MapPin, Ruler } from "lucide-react";
import type { CuratedRouteIndex } from "@/types/curated-route";

interface Props {
  route: CuratedRouteIndex;
}

export function RouteCard({ route }: Props) {
  return (
    <Link
      href={`/ruteplanner/${route.slug}`}
      className="block rounded-2xl border border-primary/10 bg-white shadow-sm p-5 transition-all duration-200 hover:border-accent/40 hover:shadow-md"
    >
      <h3 className="font-serif text-lg font-semibold text-primary leading-tight">
        {route.name}
      </h3>
      <div className="flex items-center gap-3 mt-2 text-sm text-primary/50">
        <span className="flex items-center gap-1">
          <Ruler size={14} />
          {route.length_km} km
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={14} />
          {route.shelter_count} shelters
        </span>
      </div>
      <p className="text-xs text-primary/40 mt-1">{route.region}</p>
      {route.description && (
        <p className="text-sm text-primary/60 mt-3 line-clamp-2">
          {route.description}
        </p>
      )}
    </Link>
  );
}
