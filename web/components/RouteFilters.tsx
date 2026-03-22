// components/RouteFilters.tsx
"use client";

export type RegionFilter = "" | "Jylland" | "Fyn og Øerne" | "Sjælland og Øerne";
export type LengthFilter = "" | "short" | "medium" | "long";
export type SortOption = "shelters" | "longest" | "shortest" | "name";

interface Props {
  region: RegionFilter;
  length: LengthFilter;
  sort: SortOption;
  onRegionChange: (v: RegionFilter) => void;
  onLengthChange: (v: LengthFilter) => void;
  onSortChange: (v: SortOption) => void;
  resultCount: number;
}

const selectClass =
  "rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50";

export function RouteFilters({
  region,
  length,
  sort,
  onRegionChange,
  onLengthChange,
  onSortChange,
  resultCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={region}
        onChange={(e) => onRegionChange(e.target.value as RegionFilter)}
        className={selectClass}
        aria-label="Filtrer efter region"
      >
        <option value="">Alle regioner</option>
        <option value="Jylland">Jylland</option>
        <option value="Fyn og Øerne">Fyn og Øerne</option>
        <option value="Sjælland og Øerne">Sjælland og Øerne</option>
      </select>

      <select
        value={length}
        onChange={(e) => onLengthChange(e.target.value as LengthFilter)}
        className={selectClass}
        aria-label="Filtrer efter rutelængde"
      >
        <option value="">Alle længder</option>
        <option value="short">Kort (&lt; 10 km)</option>
        <option value="medium">Mellem (10–50 km)</option>
        <option value="long">Lang (50+ km)</option>
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className={selectClass}
        aria-label="Sortér ruter"
      >
        <option value="shelters">Flest shelters</option>
        <option value="longest">Længste rute</option>
        <option value="shortest">Korteste rute</option>
        <option value="name">Navn A-Å</option>
      </select>

      <span className="text-sm text-primary/40 ml-auto">
        {resultCount} ruter
      </span>
    </div>
  );
}
