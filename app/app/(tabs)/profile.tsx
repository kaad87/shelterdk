import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDownloadStore } from "../../stores/download-store";
import { useEffect, useState } from "react";
import { getDatabase } from "../../lib/database";
import { Download, Trash2, Map, Camera, Route } from "lucide-react-native";

export default function ProfileTab() {
  const { regions, downloaded, downloading, progress, startDownload, deleteRegion } = useDownloadStore();
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [trackedRoutesCount, setTrackedRoutesCount] = useState(0);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const queue = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'");
      setSyncQueueCount(queue?.count ?? 0);
      const routes = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM tracked_routes");
      setTrackedRoutesCount(routes?.count ?? 0);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Profil</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Route size={20} color="#1a3a2a" />
          <Text style={styles.statNumber}>{trackedRoutesCount}</Text>
          <Text style={styles.statLabel}>Ture</Text>
        </View>
        <View style={styles.stat}>
          <Camera size={20} color="#1a3a2a" />
          <Text style={styles.statNumber}>{syncQueueCount}</Text>
          <Text style={styles.statLabel}>Venter</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Offline kort</Text>
      {regions.map((r) => (
        <View key={r.name} style={styles.regionRow}>
          <Map size={18} color="#1a3a2a" />
          <Text style={styles.regionName}>{r.name}</Text>
          {downloaded[r.name] ? (
            <Pressable onPress={() => {
              Alert.alert("Slet kort", `Slet offline kort for ${r.name}?`, [
                { text: "Annuller" },
                { text: "Slet", style: "destructive", onPress: () => deleteRegion(r.name) },
              ]);
            }}>
              <Trash2 size={18} color="#ef4444" />
            </Pressable>
          ) : downloading === r.name ? (
            <Text style={styles.progress}>{Math.round(progress)}%</Text>
          ) : (
            <Pressable onPress={() => startDownload(r.name)}>
              <Download size={18} color="#1a3a2a" />
            </Pressable>
          )}
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  stats: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 20, marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: 12 },
  stat: { alignItems: "center", gap: 4 },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  statLabel: { fontSize: 12, color: "#999" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#333", paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  regionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 1, borderRadius: 0 },
  regionName: { flex: 1, fontSize: 15, color: "#333" },
  progress: { fontSize: 13, color: "#1a3a2a", fontWeight: "600" },
});
