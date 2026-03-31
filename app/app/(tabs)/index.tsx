import { useMemo, useRef } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Navigation } from "lucide-react-native";
import { ShelterMap } from "../../components/ShelterMap";
import { FilterChips } from "../../components/FilterChips";
import { useShelters } from "../../hooks/use-shelters";
import { useLocation } from "../../hooks/use-location";
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
  const { location } = useLocation();
  const { activeFilters } = useFilterStore();
  const mapRef = useRef<{ centerOnUser: () => void }>(null);

  const filtered = useMemo(
    () => (shelters ?? []).filter((s) => matchesFilters(s, activeFilters)),
    [shelters, activeFilters]
  );

  return (
    <View style={styles.container}>
      <FilterChips overlay />
      <ShelterMap
        ref={mapRef}
        shelters={filtered}
        onShelterPress={(s) => router.push(`/shelter/${s.slug}`)}
        userLocation={location}
      />
      {location && (
        <Pressable style={styles.locateButton} onPress={() => mapRef.current?.centerOnUser()}>
          <Navigation size={22} color="#1a3a2a" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  locateButton: {
    position: "absolute",
    bottom: 24,
    right: 16,
    backgroundColor: "#fff",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
