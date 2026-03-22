"use client";

import {
  MapPin,
  ChevronUp,
  ChevronDown,
  X,
  Download,
  Share2,
  Trash2,
  Footprints,
} from "lucide-react";
import { haversineKm, formatDistance, estimateWalkingHours, formatWalkingTime } from "@/lib/haversine";
import { getLocationCoords } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";
import { useState } from "react";

interface Props {
  waypoints: Shelter[];
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClear: () => void;
  onDownloadGpx: () => void;
  onShare: () => void;
}

export function RoutePlannerSidebar({
  waypoints,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
  onDownloadGpx,
  onShare,
}: Props) {
  const [copied, setCopied] = useState(false);

  const distances: number[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const a = getLocationCoords(waypoints[i - 1]);
    const b = getLocationCoords(waypoints[i]);
    if (a && b) {
      distances.push(haversineKm(a.lat, a.lon, b.lat, b.lon));
    } else {
      distances.push(0);
    }
  }
  const totalKm = distances.reduce((s, d) => s + d, 0);
  const walkingHours = estimateWalkingHours(totalKm);

  const handleShare = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const hasWaypoints = waypoints.length > 0;

  return (
    <div className="bg-white p-5 overflow-y-auto h-full flex flex-col">
      <h1 className="font-serif text-xl font-semibold text-primary mb-4">
        Ruteplanner
      </h1>

      {!hasWaypoints ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <MapPin size={48} className="text-primary/20 mb-3" />
          <p className="text-sm text-primary/50 text-center max-w-[200px]">
            Klik på et shelter på kortet for at starte din rute
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {waypoints.map((shelter, i) => (
              <div key={shelter.id}>
                <div className="flex items-start gap-3 py-3 border-b border-primary/5">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {shelter.title}
                    </p>
                    <div className="text-xs text-primary/40 flex items-center gap-2 mt-0.5">
                      {shelter.capacity && <span>{shelter.capacity} pl.</span>}
                      {shelter.water && <span>Vand</span>}
                      {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && (
                        <span>Toilet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onMoveUp(i)}
                      disabled={i === 0}
                      className="p-1 rounded hover:bg-primary/5 text-primary/30 hover:text-primary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="Flyt op"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => onMoveDown(i)}
                      disabled={i === waypoints.length - 1}
                      className="p-1 rounded hover:bg-primary/5 text-primary/30 hover:text-primary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="Flyt ned"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => onRemove(i)}
                      className="p-1 rounded hover:bg-red-50 text-primary/30 hover:text-red-400 transition-colors"
                      aria-label="Fjern"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                {i < distances.length && (
                  <div className="text-xs text-primary/40 pl-9 py-1 border-l border-dashed border-primary/15 ml-3">
                    {formatDistance(distances[i])}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <Footprints size={16} className="text-primary/40" />
              <span className="text-lg font-semibold text-primary">
                {formatDistance(totalKm)}
              </span>
              <span className="text-primary/30 mx-1">·</span>
              <span className="text-sm text-primary/50">
                {formatWalkingTime(walkingHours)}
              </span>
            </div>

            <button
              onClick={onDownloadGpx}
              disabled={!hasWaypoints}
              className="w-full mt-4 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download size={16} />
              Download GPX
            </button>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleShare}
                disabled={!hasWaypoints}
                className="flex-1 py-2 rounded-xl border border-primary/15 text-primary/70 text-sm font-medium hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Share2 size={14} />
                {copied ? "Kopieret!" : "Del rute"}
              </button>
              <button
                onClick={onClear}
                className="py-2 px-4 rounded-xl text-sm text-primary/40 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                Ryd
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
