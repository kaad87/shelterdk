import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Play, MapPin } from "lucide-react-native";
import { getDatabase } from "../../lib/database";
import { useTrackingStore } from "../../stores/tracking-store";

interface TrackedRoute {
  id: number;
  name: string | null;
  distance_km: number;
  duration_seconds: number;
  started_at: string;
  finished_at: string | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}t ${m}m`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

export default function RoutesTab() {
  const router = useRouter();
  const { isTracking } = useTrackingStore();
  const [routes, setRoutes] = useState<TrackedRoute[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const rows = await db.getAllAsync<TrackedRoute>(
        "SELECT * FROM tracked_routes ORDER BY started_at DESC"
      );
      setRoutes(rows);
    })();
  }, [isTracking]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Ruter</Text>

      <Pressable
        style={[styles.startButton, isTracking && styles.startButtonActive]}
        onPress={() => router.push("/tracking")}
      >
        <Play size={20} color="#fff" fill="#fff" />
        <Text style={styles.startText}>
          {isTracking ? "Se aktiv tracking" : "Start ny tur"}
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Mine ture ({routes.length})</Text>

      {routes.length === 0 ? (
        <View style={styles.empty}>
          <MapPin size={32} color="#ccc" />
          <Text style={styles.emptyText}>Ingen ture endnu. Start en tur for at tracke din rute!</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => (
            <View style={styles.routeCard}>
              <Text style={styles.routeName}>{item.name ?? formatDate(item.started_at)}</Text>
              <View style={styles.routeMeta}>
                <Text style={styles.routeStat}>{item.distance_km.toFixed(1)} km</Text>
                <Text style={styles.routeStat}>{formatDuration(item.duration_seconds)}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    margin: 16,
    paddingVertical: 16,
    backgroundColor: "#1a3a2a",
    borderRadius: 12,
  },
  startButtonActive: { backgroundColor: "#f59e0b" },
  startText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#333", paddingHorizontal: 16, marginBottom: 8 },
  empty: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyText: { fontSize: 14, color: "#999", textAlign: "center", paddingHorizontal: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  routeCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, elevation: 1 },
  routeName: { fontSize: 15, fontWeight: "600", color: "#1a3a2a", marginBottom: 4 },
  routeMeta: { flexDirection: "row", gap: 16 },
  routeStat: { fontSize: 13, color: "#666" },
});
