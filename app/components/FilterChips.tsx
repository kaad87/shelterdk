import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { FACILITY_FILTERS } from "@shared/constants/facilities";
import { useFilterStore } from "../stores/filter-store";

interface FilterChipsProps {
  /** When true, position absolutely over the map. Default false (inline). */
  overlay?: boolean;
}

export function FilterChips({ overlay = false }: FilterChipsProps) {
  const { activeFilters, toggle } = useFilterStore();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.container, overlay && styles.overlay]} contentContainerStyle={styles.content}>
      {FACILITY_FILTERS.map((f) => {
        const active = activeFilters.includes(f.key);
        return (
          <Pressable
            key={f.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(f.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  overlay: { position: "absolute", top: 8, left: 0, right: 0, zIndex: 10 },
  content: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  chipText: { fontSize: 13, color: "#333" },
  chipTextActive: { color: "#fff" },
});
