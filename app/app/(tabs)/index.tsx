import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ShelterMap } from "../../components/ShelterMap";
import { FilterChips } from "../../components/FilterChips";
import { useShelters } from "../../hooks/use-shelters";
import { useFilterStore } from "../../stores/filter-store";
import { FACILITY_FILTERS } from "@shared/constants/facilities";
import type { Shelter } from "@shared/types/shelter";

function matchesFilters(shelter: Shelter, activeFilters: string[]): boolean {
  if (activeFilters.length === 0) return true;

  return activeFilters.every((key) => {
    const filter = FACILITY_FILTERS.find((f) => f.key === key);
    if (!filter) return true;

    if (filter.filterType === "column") {
      const value = (shelter as any)[filter.filterKey];
      if (filter.filterValue === "NOT_NULL") return value != null && value !== "";
      return value === filter.filterValue;
    }

    if (filter.filterType === "geofa") {
      const raw = shelter.geofa_raw;
      if (!raw) return false;
      return (raw as any)[filter.filterKey] === filter.filterValue;
    }

    return true;
  });
}

export default function MapTab() {
  const { data: shelters } = useShelters();
  const router = useRouter();
  const { activeFilters } = useFilterStore();

  const filtered = useMemo(
    () => (shelters ?? []).filter((s) => matchesFilters(s, activeFilters)),
    [shelters, activeFilters]
  );

  return (
    <View style={styles.container}>
      <FilterChips overlay />
      <ShelterMap
        shelters={filtered}
        onShelterPress={(s) => router.push(`/shelter/${s.slug}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
