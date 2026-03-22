// components/RouteDetail.tsx
"use client";

import { ArrowLeft, Download, Share2 } from "lucide-react";
import { formatDistance } from "@/lib/haversine";
import type { CuratedRouteIndex, RouteShelter } from "@/types/curated-route";
import Link from "next/link";
import { useState } from "react";

interface Props {
  route: CuratedRouteIndex;
  shelters: RouteShelter[];
  onBack: () => void;
  onDownloadGpx: () => void;
  onShare: () => void;
}

export function RouteDetail({ route, shelters, onBack, onDownloadGpx, onShare }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white border-t border-primary/10 px-6 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Tilbage til alle ruter
      </button>

      <h2 className="font-serif text-2xl font-bold text-primary">{route.name}</h2>
      <div className="flex items-center gap-2 mt-1 text-sm text-primary/50">
        <span>{route.length_km} km</span>
        <span>·</span>
        <span>{route.shelter_count} shelters</span>
        <span>·</span>
        <span>{route.region}</span>
      </div>

      {route.description && (
        <p className="text-primary/70 mt-4 leading-relaxed">{route.description}</p>
      )}

      <h3 className="font-serif text-lg font-semibold text-primary mt-6 mb-3">
        Shelters langs ruten
      </h3>
      <div className="divide-y divide-primary/5">
        {shelters.map((shelter, i) => (
          <div key={shelter.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div>
                <Link
                  href={`/shelter/${shelter.slug}`}
                  className="text-sm font-medium text-primary hover:text-accent transition-colors"
                >
                  {shelter.title}
                </Link>
                <div className="text-xs text-primary/40 flex items-center gap-2 mt-0.5">
                  {shelter.capacity && <span>{shelter.capacity} pl.</span>}
                  {shelter.water && <span>Vand</span>}
                  {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && (
                    <span>Toilet</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs text-primary/40">
              {formatDistance(shelter.distance_to_trail_km)} fra ruten
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onDownloadGpx}
          className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={16} />
          Download GPX
        </button>
        <button
          onClick={handleShare}
          className="py-2.5 px-5 rounded-xl border border-primary/15 text-primary/70 text-sm font-medium hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5"
        >
          <Share2 size={14} />
          {copied ? "Kopieret!" : "Del rute"}
        </button>
      </div>
    </div>
  );
}
