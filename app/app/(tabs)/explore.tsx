import { useState, useMemo } from "react";
import { View, TextInput, FlatList, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useShelters } from "../../hooks/use-shelters";
import { ShelterCard } from "../../components/ShelterCard";
import { FilterChips } from "../../components/FilterChips";
import { useFilterStore } from "../../stores/filter-store";
import { FACILITY_FILTERS } from "@shared/constants/facilities";
import type { Shelter } from "@shared/types/shelter";

const REGIONS = ["Jylland", "Fyn", "Sjælland", "Bornholm"];

export default function ExploreTab() {
  const { data: shelters, isLoading } = useShelters();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const { activeFilters } = useFilterStore();

  const filtered = useMemo(() => {
    if (!shelters) return [];
    let result = shelters;

    // Text search
    if (query.length >= 2) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.kommune?.toLowerCase().includes(q) || s.place?.toLowerCase().includes(q)
      );
    }

    // Region filter
    if (region) {
      result = result.filter((s) => s.region === region);
    }

    // Facility filters
    for (const key of activeFilters) {
      const def = FACILITY_FILTERS.find((f) => f.key === key);
      if (!def) continue;
      result = result.filter((s) => {
        if (def.filterType === "column") {
          if (def.filterValue === "NOT_NULL") return !!(s as any)[def.filterKey];
          return (s as any)[def.filterKey] === def.filterValue;
        }
        const raw = s.geofa_raw as Record<string, unknown> | null;
        return raw?.[def.filterKey] === def.filterValue;
      });
    }

    return result;
  }, [shelters, query, region, activeFilters]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Udforsk shelters</Text>

      <TextInput
        style={styles.search}
        placeholder="Søg shelter, kommune, sted..."
        value={query}
        onChangeText={setQuery}
        placeholderTextColor="#999"
      />

      <View style={styles.regions}>
        {REGIONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.regionChip, region === r && styles.regionActive]}
            onPress={() => setRegion(region === r ? null : r)}
          >
            <Text style={[styles.regionText, region === r && styles.regionTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <FilterChips />

      <Text style={styles.count}>{filtered.length} shelters</Text>

      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => <ShelterCard shelter={item} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  search: { margin: 16, padding: 12, backgroundColor: "#fff", borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: "#ddd" },
  regions: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  regionActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  regionText: { fontSize: 13, color: "#333" },
  regionTextActive: { color: "#fff" },
  count: { paddingHorizontal: 16, fontSize: 13, color: "#999", marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
});
