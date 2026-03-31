export interface FacilityFilter {
  key: string;
  label: string;
  icon: string; // lucide icon name
  /** Supabase column or geofa_raw key to filter on */
  filterType: "column" | "geofa";
  filterKey: string;
  filterValue: string;
}

export const FACILITY_FILTERS: FacilityFilter[] = [
  { key: "toilet", label: "Toilet", icon: "Bath", filterType: "column", filterKey: "toilet", filterValue: "Ja" },
  { key: "water", label: "Vand", icon: "Droplets", filterType: "column", filterKey: "water", filterValue: "Ja" },
  { key: "baalplads", label: "Bålplads", icon: "Flame", filterType: "geofa", filterKey: "baal_tilladelse", filterValue: "Ja" },
  { key: "hund", label: "Hund", icon: "Dog", filterType: "geofa", filterKey: "hund_tilladt", filterValue: "Ja" },
  { key: "strand", label: "Strand", icon: "Waves", filterType: "geofa", filterKey: "strand_naerhed", filterValue: "Ja" },
  { key: "bruser", label: "Bruser", icon: "ShowerHead", filterType: "geofa", filterKey: "bruser_bad", filterValue: "Ja" },
  { key: "bookable", label: "Kan bookes", icon: "CalendarCheck", filterType: "column", filterKey: "booking_url", filterValue: "NOT_NULL" },
];
