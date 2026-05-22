// components/GpxUpload.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, MapPin, Download, X, Navigation } from "lucide-react";
import { parseGpxFile, type ParsedGpx, type GpxTrackPoint } from "@/lib/gpx-parser";
import {
  findSheltersNearRoute,
  type ShelterWithDistance,
  type LightShelter,
} from "@/lib/shelter-distance";

type UploadState = "idle" | "parsing" | "loaded" | "error";

interface GpxUploadProps {
  onRouteLoaded: (
    points: GpxTrackPoint[],
    shelters: ShelterWithDistance[],
    routeName: string | null
  ) => void;
  onClear: () => void;
  onDownload: () => void;
  uploadedShelters: ShelterWithDistance[];
  uploadState: UploadState;
  routeName: string | null;
}

export function GpxUploadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 bg-accent-dark text-white rounded-lg hover:bg-accent-dark/90 transition-colors text-sm font-medium"
    >
      <Upload size={16} />
      Upload din GPX
    </button>
  );
}

export function GpxUploadZone({
  onRouteLoaded,
  onClear,
  onDownload,
  uploadedShelters,
  uploadState: externalState,
  routeName,
  radiusKm,
  onRadiusChange,
  allShelters,
}: GpxUploadProps & {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  allShelters: LightShelter[];
}) {
  const [state, setState] = useState<UploadState>(externalState);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [routePoints, setRoutePoints] = useState<GpxTrackPoint[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(externalState);
  }, [externalState]);

  const processFile = useCallback(
    async (file: File) => {
      setState("parsing");
      setError(null);
      try {
        const parsed: ParsedGpx = await parseGpxFile(file);
        setRoutePoints(parsed.points);
        const nearbyShelters = findSheltersNearRoute(
          parsed.points,
          allShelters,
          radiusKm
        );
        setState("loaded");
        onRouteLoaded(parsed.points, nearbyShelters, parsed.name);
      } catch (err) {
        setState("error");
        setError(
          err instanceof Error ? err.message : "Ukendt fejl ved parsing"
        );
      }
    },
    [allShelters, radiusKm, onRouteLoaded]
  );

  // Recalculate when radius changes and we have route data
  useEffect(() => {
    if (state === "loaded" && routePoints.length > 0) {
      const nearbyShelters = findSheltersNearRoute(
        routePoints,
        allShelters,
        radiusKm
      );
      onRouteLoaded(routePoints, nearbyShelters, routeName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be re-uploaded
      e.target.value = "";
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    setState("idle");
    setError(null);
    setRoutePoints([]);
    onClear();
  }, [onClear]);

  if (state === "loaded") {
    return (
      <div className="space-y-6">
        {/* Route info bar */}
        <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-accent" />
            <span className="text-sm font-medium text-primary">
              {routeName || "Uploadet rute"}
            </span>
            <span className="text-xs text-primary/50">
              ({routePoints.length} punkter)
            </span>
          </div>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-sm text-primary/60 hover:text-primary transition-colors"
          >
            <X size={14} />
            Fjern rute
          </button>
        </div>

        {/* Radius slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-primary">
              Søgeradius fra ruten
            </label>
            <span className="text-sm font-semibold text-accent">
              {radiusKm} km
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={radiusKm}
            onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-primary/10 rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-primary/40">
            <span>1 km</span>
            <span>5 km</span>
            <span>10 km</span>
          </div>
        </div>

        {/* Shelter list */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-primary flex items-center gap-2">
            <MapPin size={16} className="text-accent" />
            {uploadedShelters.length} shelters inden for {radiusKm} km
          </h3>

          {uploadedShelters.length === 0 ? (
            <p className="text-sm text-primary/50 py-4 text-center">
              Ingen shelters fundet inden for {radiusKm} km fra ruten. Prøv at
              øge søgeradius.
            </p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {uploadedShelters.map((shelter) => (
                <a
                  key={shelter.id}
                  href={`/shelter/${shelter.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white border border-primary/10 rounded-lg px-4 py-3 hover:border-accent/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">
                      {shelter.title}
                    </span>
                    <span className="text-xs text-primary/50 whitespace-nowrap ml-2">
                      {shelter.distanceKm} km fra ruten
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Download button */}
        {uploadedShelters.length > 0 && (
          <button
            onClick={onDownload}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-accent-dark text-white rounded-lg hover:bg-accent-dark/90 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Download GPX med shelters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-accent bg-accent/5"
            : "border-primary/20 hover:border-accent/40"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          onChange={handleFileChange}
          className="hidden"
        />

        {state === "parsing" ? (
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-primary/60">Læser GPX-fil...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={32} className="mx-auto text-primary/30" />
            <p className="text-sm font-medium text-primary">
              Træk din GPX-fil hertil
            </p>
            <p className="text-xs text-primary/50">
              eller klik for at vælge en fil (maks 5 MB)
            </p>
          </div>
        )}
      </div>

      {state === "error" && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
