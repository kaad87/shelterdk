"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Accessibility,
  Armchair,
  CheckCircle,
  Dog,
  Droplets,
  Flame,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  ShowerHead,
  Star,
  Umbrella,
  Users,
  X,
} from "lucide-react";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap, type MapBounds } from "@/components/ShelterMap";
import { getCapacity, getLocationCoords, getPetsAllowed, getToilet, getWater, hasAnyImage, isBookable } from "@/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";
import type { SoegFilters } from "@/lib/soeg-db";
import { slugifySegment } from "@/lib/slug";

type ViewMode = "list" | "map" | "split";
type SortMode = "standard" | "rating" | "reviews";

// `gratis` er bevidst udeladt — payment-data er for upålideligt og
// chip'en er fjernet fra FILTER_OPTIONS. At have den her ville få
// activeFilterCount til at tælle et usynligt filter.
const FILTER_KEYS: (keyof SoegFilters)[] = [
  "billede", "anmeldelser", "bookbar", "vand", "toilet", "hund",
  "baalplads", "bord_baenk", "strand", "bruser", "handicap",
];

const FILTER_OPTIONS: {
  key: keyof SoegFilters;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "toilet", label: "Toilet", icon: <Droplets size={15} /> },
  { key: "baalplads", label: "Bålplads", icon: <Flame size={15} /> },
  { key: "bookbar", label: "Bookbar", icon: <CheckCircle size={15} /> },
  // "Gratis"-filter er fjernet bevidst — payment-data er for upålideligt.
  { key: "vand", label: "Vand", icon: <Droplets size={15} /> },
  { key: "hund", label: "Hund tilladt", icon: <Dog size={15} /> },
  { key: "strand", label: "Strand", icon: <Umbrella size={15} /> },
  { key: "bruser", label: "Bruser/bad", icon: <ShowerHead size={15} /> },
  { key: "handicap", label: "Handicapegnet", icon: <Accessibility size={15} /> },
  { key: "bord_baenk", label: "Bord/bænke", icon: <Armchair size={15} /> },
  { key: "billede", label: "Med billede", icon: <ImageIcon size={15} /> },
  { key: "anmeldelser", label: "Anmeldelser", icon: <Star size={15} /> },
];

const NO_KOMMUNE_SLUG = "ukendt-kommune";

function parseFiltersFromParams(sp: URLSearchParams): SoegFilters {
  const filters: SoegFilters = {};
  for (const key of FILTER_KEYS) {
    if (sp.get(key) === "1") (filters as Record<string, boolean>)[key] = true;
  }
  const minPladser = parseInt(sp.get("min_pladser") ?? "0", 10);
  if (minPladser > 0) filters.min_pladser = minPladser;
  return filters;
}

function isTruthyJa(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase().includes("ja");
}

function matchesFilters(shelter: Shelter, filters: SoegFilters): boolean {
  if (filters.billede && !hasAnyImage(shelter)) return false;
  if (filters.anmeldelser && !((shelter.google_user_ratings_total ?? 0) > 0)) return false;
  if (filters.bookbar && !isBookable(shelter)) return false;
  if (filters.vand && getWater(shelter) !== true) return false;
  if (filters.toilet) {
    const toilet = getToilet(shelter);
    if (toilet !== "flush" && toilet !== "mulch") return false;
  }
  if (filters.hund && getPetsAllowed(shelter) !== true) return false;

  const raw = (shelter.geofa_raw || {}) as Record<string, unknown>;
  if (filters.baalplads && !isTruthyJa(raw.baalplads)) return false;
  // `filters.gratis` håndteres bevidst IKKE — feltet er fjernet fra alle
  // parsers så det aldrig burde være true her. Defensiv no-op for at
  // forhindre skjult state-leak hvis det alligevel kommer ind ad bagdøren.
  if (filters.handicap) {
    const handicap = raw.handicap;
    if (handicap !== "Handicapegnet" && handicap !== "Delvist handicapegnet") return false;
  }
  if (filters.bord_baenk && !isTruthyJa(raw.bord_baenk)) return false;
  if (filters.strand && !isTruthyJa(raw.strand_naerhed)) return false;
  if (filters.bruser && !isTruthyJa(raw.bruser_bad)) return false;

  if (filters.min_pladser && filters.min_pladser > 0) {
    const capacity = getCapacity(shelter);
    if (capacity == null || capacity < filters.min_pladser) return false;
  }

  return true;
}

function sortShelters(shelters: Shelter[], sortMode: SortMode): Shelter[] {
  if (sortMode === "rating") {
    return [...shelters].sort((a, b) => {
      const ratingDiff = (b.google_rating ?? -1) - (a.google_rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      const reviewsDiff = (b.google_user_ratings_total ?? -1) - (a.google_user_ratings_total ?? -1);
      if (reviewsDiff !== 0) return reviewsDiff;
      return a.title.localeCompare(b.title, "da");
    });
  }

  if (sortMode === "reviews") {
    return [...shelters].sort((a, b) => {
      const reviewsDiff = (b.google_user_ratings_total ?? -1) - (a.google_user_ratings_total ?? -1);
      if (reviewsDiff !== 0) return reviewsDiff;
      const ratingDiff = (b.google_rating ?? -1) - (a.google_rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return a.title.localeCompare(b.title, "da");
    });
  }

  return shelters;
}

function FloatingViewToggle({
  view,
  onList,
  onSplit,
  onMap,
  position = "absolute",
}: {
  view: ViewMode;
  onList: () => void;
  onSplit: () => void;
  onMap: () => void;
  position?: "absolute" | "fixed";
}) {
  const posClass = position === "fixed"
    ? "fixed bottom-4 right-4 shadow-lg z-50"
    : "absolute bottom-2 right-2 shadow-md z-10";
  return (
    <div className={`${posClass} flex gap-1 bg-white/95 rounded-lg border border-primary/10 p-1 md:hidden`}>
      <button type="button" onClick={onList} className={`p-1.5 rounded ${view === "list" ? "bg-primary/15 text-primary" : "text-primary/50"}`} aria-label="Kun liste">
        <List className="w-4 h-4" />
      </button>
      <button type="button" onClick={onSplit} className={`p-1.5 rounded ${view === "split" ? "bg-primary/15 text-primary" : "text-primary/50"}`} aria-label="Liste og kort">
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button type="button" onClick={onMap} className={`p-1.5 rounded ${view === "map" ? "bg-primary/15 text-primary" : "text-primary/50"}`} aria-label="Kun kort">
        <MapPin className="w-4 h-4" />
      </button>
    </div>
  );
}

function shelterHref(shelter: Shelter): string {
  if (!shelter.region) return `/shelter/${shelter.slug}`;
  const regionSlug = slugifySegment(shelter.region);
  const municipalitySlug = shelter.kommune ? slugifySegment(shelter.kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${regionSlug}/${municipalitySlug}/${shelter.slug}`;
}

export function ByShelterExplorer({
  placeName,
  shelters,
  initialView = "split",
  initialFilters = {},
}: {
  placeName: string;
  shelters: Shelter[];
  initialView?: ViewMode;
  initialFilters?: SoegFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>(initialView);
  const [sortMode, setSortMode] = useState<SortMode>("standard");
  const [listDisplayCount, setListDisplayCount] = useState(
    initialView === "split" ? Math.min(24, shelters.length) : shelters.length
  );
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [hasPannedMap, setHasPannedMap] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const activeFilters = useMemo(() => {
    const parsed = parseFiltersFromParams(searchParams);
    return Object.keys(parsed).length > 0 ? parsed : initialFilters;
  }, [initialFilters, searchParams]);

  useEffect(() => {
    const urlView = searchParams.get("view");
    const resolvedView: ViewMode =
      urlView === "map" ? "map" : urlView === "list" ? "list" : initialView;
    setView(resolvedView);
  }, [initialView, searchParams]);

  useEffect(() => {
    setListDisplayCount(view === "split" ? Math.min(24, shelters.length) : shelters.length);
  }, [shelters.length, view]);

  const buildUrl = useCallback((newView: ViewMode, newFilters: SoegFilters) => {
    const params = new URLSearchParams();
    params.set("view", newView);
    for (const key of FILTER_KEYS) {
      if (newFilters[key]) params.set(key, "1");
    }
    if (newFilters.min_pladser && newFilters.min_pladser > 0) {
      params.set("min_pladser", String(newFilters.min_pladser));
    }
    const query = params.toString();
    return `/by/${slugifySegment(placeName)}${query ? `?${query}` : ""}`;
  }, [placeName]);

  const updateUrl = useCallback((newView: ViewMode, newFilters: SoegFilters) => {
    router.push(buildUrl(newView, newFilters), { scroll: false });
  }, [buildUrl, router]);

  const filteredShelters = useMemo(() => (
    shelters.filter((shelter) => matchesFilters(shelter, activeFilters))
  ), [activeFilters, shelters]);

  const visibleShelters = useMemo(() => {
    if (!(view === "split" && hasPannedMap && mapBounds)) return filteredShelters;
    return filteredShelters.filter((shelter) => {
      const coords = getLocationCoords(shelter);
      if (!coords) return false;
      return (
        coords.lat >= mapBounds.south &&
        coords.lat <= mapBounds.north &&
        coords.lon >= mapBounds.west &&
        coords.lon <= mapBounds.east
      );
    });
  }, [filteredShelters, hasPannedMap, mapBounds, view]);

  const sortedShelters = useMemo(() => sortShelters(visibleShelters, sortMode), [sortMode, visibleShelters]);
  const sortedAllShelters = useMemo(() => sortShelters(filteredShelters, sortMode), [filteredShelters, sortMode]);

  useEffect(() => {
    if (view !== "split") return;
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (listDisplayCount < sortedShelters.length) {
        setListDisplayCount((count) => Math.min(count + 24, sortedShelters.length));
      }
    }, { rootMargin: "100px", threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [listDisplayCount, sortedShelters.length, view]);

  const toggleFilter = useCallback((key: keyof SoegFilters) => {
    const next = { ...activeFilters, [key]: activeFilters[key] ? undefined : true };
    updateUrl(view, next);
  }, [activeFilters, updateUrl, view]);

  const clearAllFilters = useCallback(() => {
    updateUrl(view, {});
  }, [updateUrl, view]);

  const activeFilterCount = FILTER_OPTIONS.filter(({ key }) => activeFilters[key]).length;

  const handleMinCapacityChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    const next = {
      ...activeFilters,
      min_pladser: parsed > 0 ? parsed : undefined,
    };
    updateUrl(view, next);
  }, [activeFilters, updateUrl, view]);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    setHasPannedMap(true);
    setListDisplayCount(24);
  }, []);

  const handleViewChange = useCallback((nextView: ViewMode) => {
    setView(nextView);
    updateUrl(nextView, activeFilters);
  }, [activeFilters, updateUrl]);

  return (
    <section className="mb-12">
      <div className="mb-4 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-primary">Kort og filtre for shelter i {placeName}</h2>
            <p className="mt-1 text-sm text-primary/70">
              Udforsk {shelters.length} shelters i og omkring {placeName} på kortet eller filtrer efter faciliteter.
            </p>
          </div>
          <div className="hidden md:flex items-stretch rounded-lg overflow-hidden border border-primary/10">
            <button type="button" onClick={() => handleViewChange("list")} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${view === "list" ? "bg-primary/15 text-primary" : "bg-white text-primary/70 hover:bg-primary/5"}`}>
              <List className="w-4 h-4" />
              Liste
            </button>
            <button type="button" onClick={() => handleViewChange("split")} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${view === "split" ? "bg-primary/15 text-primary" : "bg-white text-primary/70 hover:bg-primary/5"}`}>
              <LayoutGrid className="w-4 h-4" />
              Liste + kort
            </button>
            <button type="button" onClick={() => handleViewChange("map")} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${view === "map" ? "bg-primary/15 text-primary" : "bg-white text-primary/70 hover:bg-primary/5"}`}>
              <MapPin className="w-4 h-4" />
              Kort
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide flex-nowrap">
            {FILTER_OPTIONS.map(({ key, label, icon }) => {
              const active = Boolean(activeFilters[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200 border ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-primary/70 border-primary/15 hover:border-primary/30 hover:text-primary hover:shadow-sm"
                  }`}
                  aria-pressed={active}
                >
                  <span className={active ? "text-white" : "text-primary/50"}>{icon}</span>
                  {label}
                </button>
              );
            })}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/15 bg-white text-sm">
              <Users size={15} className="text-primary/50 shrink-0" />
              <span className="text-primary/70 whitespace-nowrap">Min.</span>
              <input
                type="number"
                min={0}
                max={50}
                placeholder="–"
                value={activeFilters.min_pladser ?? ""}
                onChange={(event) => handleMinCapacityChange(event.target.value)}
                className="w-8 bg-transparent text-center text-primary font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Minimum antal pladser"
              />
              <span className="text-primary/70 whitespace-nowrap">pladser</span>
            </div>
            {(activeFilterCount > 0 || (activeFilters.min_pladser && activeFilters.min_pladser > 0)) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 md:py-2 rounded-full text-[13px] md:text-sm font-medium text-primary/50 hover:text-primary hover:bg-primary/5 whitespace-nowrap shrink-0 transition-colors"
              >
                <X size={14} />
                Ryd filtre
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredShelters.length === 0 ? (
        <div className="rounded-2xl border border-primary/10 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-lg text-primary/70">Ingen shelters matcher de valgte filtre i {placeName}.</p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark/90 transition-colors"
          >
            Nulstil filtre
          </button>
        </div>
      ) : view === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[600px] lg:min-h-[70vh]">
          <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1">
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-background/95 py-2">
              <p className="text-sm text-primary/70">
                {hasPannedMap && mapBounds
                  ? `${visibleShelters.length} shelters i det viste kortområde`
                  : `${filteredShelters.length} shelters i og omkring ${placeName}`}
              </p>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="rounded-lg border border-primary/20 bg-white px-2 py-1 text-sm text-primary/80 focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label="Sortér shelters"
              >
                <option value="standard">Standard</option>
                <option value="rating">Bedst bedømt</option>
                <option value="reviews">Flest anmeldelser</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 pb-6 sm:grid-cols-2">
              {sortedShelters.slice(0, listDisplayCount).map((shelter) => (
                <ShelterCard key={shelter.id} shelter={shelter} href={shelterHref(shelter)} />
              ))}
            </div>
            <div ref={sentinelRef} className="py-6" />
          </div>
          <div className="relative order-1 mb-2 h-[220px] overflow-hidden rounded-xl border border-primary/10 bg-primary/5 lg:sticky lg:top-24 lg:order-2 lg:mb-0 lg:h-[calc(100vh-8rem)] lg:max-h-[720px]">
            <ShelterMap shelters={filteredShelters} className="absolute inset-0 h-full w-full" onBoundsChange={handleBoundsChange} />
            <FloatingViewToggle view={view} onList={() => handleViewChange("list")} onSplit={() => handleViewChange("split")} onMap={() => handleViewChange("map")} position="absolute" />
          </div>
        </div>
      ) : view === "map" ? (
        <>
          <p className="mb-3 text-sm text-primary/70">
            Viser {filteredShelters.length} shelters på kortet i og omkring {placeName}
          </p>
          <div className="relative h-[500px] overflow-hidden rounded-xl border border-primary/10 bg-primary/5 sm:h-[600px] md:h-[80vh] md:max-h-[1100px]">
            <ShelterMap shelters={filteredShelters} className="absolute inset-0 h-full w-full" />
          </div>
          <FloatingViewToggle view={view} onList={() => handleViewChange("list")} onSplit={() => handleViewChange("split")} onMap={() => handleViewChange("map")} position="fixed" />
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-primary/70">
              Viser {filteredShelters.length} shelters i og omkring {placeName}
            </p>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-lg border border-primary/20 bg-white px-2 py-1 text-sm text-primary/80 focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Sortér shelters"
            >
              <option value="standard">Standard</option>
              <option value="rating">Bedst bedømt</option>
              <option value="reviews">Flest anmeldelser</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAllShelters.map((shelter) => (
              <ShelterCard key={shelter.id} shelter={shelter} href={shelterHref(shelter)} />
            ))}
          </div>
          <FloatingViewToggle view={view} onList={() => handleViewChange("list")} onSplit={() => handleViewChange("split")} onMap={() => handleViewChange("map")} position="fixed" />
        </>
      )}
    </section>
  );
}
