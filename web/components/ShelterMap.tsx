"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo } from "react";
import type { MapShelter } from "@/lib/map-shelter";
import { getLocationCoords } from "@/lib/shelter-detail";
import { slugifySegment } from "@/lib/slug";

const NO_KOMMUNE_SLUG = "ukendt-kommune";

const SITE_ORIGIN = "https://shelterdk.dk";

function getShelterHref(shelter: MapShelter): string {
  const r = (shelter.region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${shelter.slug}`;
  const regionSlug = slugifySegment(r);
  const m = shelter.kommune ? slugifySegment(shelter.kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${regionSlug}/${m}/${shelter.slug}`;
}

/** Til embed: fuld URL så link åbner shelterdk.dk i ny fane uanset hvor iframe er indlejret. */
function getEmbedShelterHref(shelter: MapShelter): string {
  return `${SITE_ORIGIN}/shelter/${shelter.slug}`;
}

// Leaflet CSS – indlæses med kort-chunk
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [56.2639, 9.5018]; // Danmark
const DEFAULT_ZOOM = 7;

/** Regionsspecifik startposition for at undgå at vise hele Danmark når filter er sat. */
const REGION_CENTER_ZOOM: Record<string, { center: [number, number]; zoom: number }> = {
  Jylland: { center: [56.2, 9.2], zoom: 8 },
  Fyn: { center: [55.3, 10.4], zoom: 9 },
  Sjælland: { center: [55.7, 12.0], zoom: 8 },
};

/** Bounding boxes for regioner – bruges til at filtrere pins efter koordinater (da region-felt kan være forkert i DB). */
const REGION_BOUNDS: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  Jylland: { minLat: 54.5, maxLat: 57.8, minLon: 8.0, maxLon: 10.2 },
  Fyn: { minLat: 55.0, maxLat: 55.7, minLon: 9.9, maxLon: 10.8 },
  Sjælland: { minLat: 54.5, maxLat: 56.2, minLon: 10.7, maxLon: 13.0 },
};

function isInRegionBounds(lat: number, lon: number, region: string): boolean {
  const b = REGION_BOUNDS[region];
  if (!b) return true;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

export interface ShelterWithCoords extends MapShelter {
  _coords: { lat: number; lon: number };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Hele Danmark inkl. Bornholm – til forsidens kort så mobil/desktop viser landet fra start. */
const DENMARK_BOUNDS: MapBounds = {
  north: 57.75,
  south: 54.56,
  west: 8.08,
  east: 15.19,
};

function getSheltersWithCoords(shelters: MapShelter[]): ShelterWithCoords[] {
  return shelters
    .map((s) => {
      const coords = getLocationCoords(s);
      if (!coords) return null;
      return { ...s, _coords: coords } as ShelterWithCoords;
    })
    .filter((s): s is ShelterWithCoords => s != null);
}

// Dynamisk import af kortet så Leaflet kun kører i browser
const MapInner = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Popup, useMap } = await import(
      "react-leaflet"
    );
    const L = await import("leaflet");
    const MarkerClusterGroup = (await import("react-leaflet-cluster")).default;
    const { useEffect, useRef } = await import("react");
    const Image = (await import("next/image")).default;
    const { isValidImageUrl } = await import("@/lib/shelter-detail");

    // Cluster-bobler i sitets farver. Inline styles så vi ikke afhænger af
    // leaflet.markercluster's default-CSS.
    const clusterIcon = (cluster: { getChildCount: () => number }) => {
      const n = cluster.getChildCount();
      const size = n >= 100 ? 48 : n >= 25 ? 42 : 36;
      return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:rgba(44,62,45,0.92);border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${n >= 100 ? 13 : 12}px;font-family:inherit;">${n}</div>`,
        className: "shelter-cluster",
        iconSize: L.point(size, size),
        iconAnchor: L.point(size / 2, size / 2),
      });
    };

    // Fix default marker-ikon (Next/Leaflet)
    const icon = L.icon({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    function FitBounds({
      items,
      fixedBounds,
    }: {
      items: { lat: number; lon: number }[];
      fixedBounds?: { north: number; south: number; east: number; west: number };
    }) {
      const map = useMap();
      const hasFittedRef = useRef(false);
      useEffect(() => {
        if (hasFittedRef.current) return;
        hasFittedRef.current = true;
        if (fixedBounds) {
          const bounds = L.latLngBounds(
            [fixedBounds.south, fixedBounds.west],
            [fixedBounds.north, fixedBounds.east]
          );
          map.fitBounds(bounds, { padding: [0, 0], maxZoom: 7 });
          return;
        }
        if (items.length === 0) return;
        if (items.length === 1) {
          map.setView([items[0].lat, items[0].lon], 12);
        } else {
          const bounds = L.latLngBounds(
            items.map((p) => [p.lat, p.lon] as [number, number])
          );
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
        }
      }, [map, items, fixedBounds]);
      return null;
    }

    /**
     * Annullér Leaflets pending zoom/pan-transitions ved unmount.
     *
     * react-leaflet kalder map.remove() når MapContainer unmountes, men
     * Leaflets zoom-transitions queues via setTimeout — de fyrer altså
     * efter map er destroyed og rammer:
     *
     *   TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
     *     at e._getMapPanePos
     *     at e._onZoomTransitionEnd
     *     [mechanism: auto.browser.browserapierrors.setTimeout]
     *
     * map.stop() flusher animations + cancellar pending transitions så
     * deres callbacks tjekker isAlive før de prøver at læse pane-position.
     * Fanget via Sentry-issue JAVASCRIPT-2 (24. maj 2026).
     */
    function MapCleanup() {
      const map = useMap();
      useEffect(() => {
        return () => {
          try {
            map.stop();
          } catch {
            // Map kan allerede være destroyed — defensiv no-op.
          }
        };
      }, [map]);
      return null;
    }

    function BoundsReporter({
      onBoundsChange,
      reportOnMount,
    }: {
      onBoundsChange?: (bounds: MapBounds) => void;
      reportOnMount?: boolean;
    }) {
      const map = useMap();
      useEffect(() => {
        if (!onBoundsChange) return;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let mountTimeout: ReturnType<typeof setTimeout> | null = null;
        const handler = () => {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => {
            timeout = null;
            const b = map.getBounds();
            if (b.isValid()) {
              onBoundsChange({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
              });
            }
          }, 400);
        };
        map.on("moveend", handler);
        map.on("zoomend", handler);

        if (reportOnMount) {
          // Forsidemap: vis få initiale pins hurtigt, og hent derefter flere
          // i det aktuelle viewport når Leaflet har afsluttet fitBounds.
          mountTimeout = setTimeout(() => {
            handler();
          }, 700);
        }

        return () => {
          if (timeout) clearTimeout(timeout);
          if (mountTimeout) clearTimeout(mountTimeout);
          map.off("moveend", handler);
          map.off("zoomend", handler);
        };
      }, [map, onBoundsChange, reportOnMount]);
      return null;
    }

    return function Inner({
      sheltersWithCoords,
      onBoundsChange,
      initialCenter,
      initialZoom,
      initialFitBounds,
      getHref,
      embedMode,
      reportBoundsOnMount,
    }: {
      sheltersWithCoords: ShelterWithCoords[];
      onBoundsChange?: (bounds: MapBounds) => void;
      initialCenter?: [number, number];
      initialZoom?: number;
      initialFitBounds?: { north: number; south: number; east: number; west: number };
      getHref: (s: MapShelter) => string;
      embedMode?: boolean;
      reportBoundsOnMount?: boolean;
    }) {
      const points = useMemo(
        () => sheltersWithCoords.map((s) => s._coords),
        [sheltersWithCoords]
      );
      const center = initialCenter ?? DEFAULT_CENTER;
      const zoom = initialZoom ?? DEFAULT_ZOOM;
      return (
        <MapContainer
          center={center}
          zoom={zoom}
          className={embedMode ? "h-full w-full z-0" : "h-full w-full rounded-xl z-0 min-h-[400px]"}
          scrollWheelZoom
          zoomAnimation={false}
          fadeAnimation={false}
          markerZoomAnimation={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCleanup />
          <FitBounds items={points} fixedBounds={initialFitBounds} />
          <BoundsReporter onBoundsChange={onBoundsChange} reportOnMount={reportBoundsOnMount} />
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={56}
            showCoverageOnHover={false}
            spiderfyOnMaxZoom
            iconCreateFunction={clusterIcon}
          >
          {sheltersWithCoords.map((shelter) => (
            <Marker
              key={shelter.id}
              position={[shelter._coords.lat, shelter._coords.lon]}
              icon={icon}
            >
              <Popup closeButton closeOnEscapeKey autoClose>
                {embedMode ? (
                  <div className="p-1 min-w-[180px]">
                    {isValidImageUrl(shelter.image_url) && (
                      <div className="w-full aspect-video rounded overflow-hidden bg-primary/10 mb-2 relative">
                        <Image
                          src={(shelter.image_url || "").trim()}
                          alt={`Billede af ${shelter.title}`}
                          width={240}
                          height={135}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="font-semibold text-primary mb-2">{shelter.title}</p>
                    <a
                      href={getHref(shelter)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 text-sm font-medium text-white bg-accent-dark rounded-lg hover:opacity-90"
                    >
                      Se detaljer & book
                    </a>
                  </div>
                ) : (
                  <a
                    href={getHref(shelter)}
                    className="block p-1 min-w-[180px] text-primary no-underline hover:opacity-90"
                  >
                    {isValidImageUrl(shelter.image_url) && (
                      <div className="w-full aspect-video rounded overflow-hidden bg-primary/10 mb-2 relative">
                        <Image
                          src={(shelter.image_url || "").trim()}
                          alt={`Billede af ${shelter.title}`}
                          width={240}
                          height={135}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <span className="font-semibold text-primary block">
                      {shelter.title}
                    </span>
                    {shelter.region && (
                      <p className="text-sm text-primary/70 mt-0.5">
                        {shelter.region}
                      </p>
                    )}
                    <span className="text-sm text-accent font-medium mt-2 inline-block">
                      Se shelter →
                    </span>
                  </a>
                )}
              </Popup>
            </Marker>
          ))}
          </MarkerClusterGroup>
        </MapContainer>
      );
    };
  },
  { ssr: false }
);

interface ShelterMapProps {
  shelters: MapShelter[];
  className?: string;
  /** Kaldes når brugeren pan/zoomer – bruges til at hente shelters i det synlige område. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Ved region-filter (Jylland, Fyn, Sjælland) zoomes kortet ind på regionen i stedet for hele Danmark. */
  initialRegion?: string | null;
  /** Ved load: fit til hele Danmark inkl. Bornholm (fx forsiden på mobil). */
  fitWholeDenmarkOnLoad?: boolean;
  /** Hent shelters for det aktuelle viewport lige efter første render. */
  loadViewportOnMount?: boolean;
  /** Embed-tilstand: simpelt popup med "Se detaljer & book" (target _blank til /shelter/slug). */
  embedMode?: boolean;
  /** Override center (bruges til at tvinge specifikt view fra parent). */
  overrideCenter?: [number, number];
  /** Override zoom (bruges til at tvinge specifikt zoom fra parent). */
  overrideZoom?: number;
}

export function ShelterMap({
  shelters,
  className = "",
  onBoundsChange,
  initialRegion,
  fitWholeDenmarkOnLoad,
  loadViewportOnMount,
  embedMode,
  overrideCenter,
  overrideZoom,
}: ShelterMapProps) {
  const regionView = initialRegion ? REGION_CENTER_ZOOM[initialRegion] : undefined;
  const toDisplay = initialRegion?.trim()
    ? shelters.filter((s) => (s.region || "").trim() === initialRegion.trim())
    : shelters;
  let withCoords = getSheltersWithCoords(toDisplay);
  if (initialRegion?.trim() && REGION_BOUNDS[initialRegion.trim()]) {
    const r = initialRegion.trim();
    withCoords = withCoords.filter((s) => isInRegionBounds(s._coords.lat, s._coords.lon, r));
  }

  const getHref = embedMode ? getEmbedShelterHref : getShelterHref;

  // Override props take precedence, then fitWholeDenmarkOnLoad, then region.
  const initialCenter = overrideCenter
    ?? (fitWholeDenmarkOnLoad ? DEFAULT_CENTER : regionView?.center);
  const initialZoom = overrideZoom
    ?? (fitWholeDenmarkOnLoad ? 6 : regionView?.zoom);

  if (withCoords.length === 0 && !onBoundsChange) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-xl bg-primary/5 text-primary/70 min-h-[400px] " +
          className
        }
      >
        <p>Ingen shelters med placering at vise på kortet.</p>
      </div>
    );
  }

  const wrapperClass =
    embedMode
      ? className
      : "rounded-xl overflow-hidden border border-primary/10 min-h-[280px] " + className;
  return (
    <div className={wrapperClass}>
      <MapInner
        sheltersWithCoords={withCoords}
        onBoundsChange={onBoundsChange}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        initialFitBounds={(!overrideCenter && fitWholeDenmarkOnLoad) ? DENMARK_BOUNDS : undefined}
        reportBoundsOnMount={loadViewportOnMount}
        getHref={getHref}
        embedMode={embedMode}
      />
    </div>
  );
}
