import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import Mapbox from "@rnmapbox/maps";
import { useTrackingStore } from "../stores/tracking-store";
import { Square, Play } from "lucide-react-native";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}t ${m}m`;
  return `${m}m ${s}s`;
}

export default function TrackingScreen() {
  const router = useRouter();
  const { isTracking, points, distanceKm, durationSeconds, start, stop } = useTrackingStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTracking) {
      start().catch((err) => setError(err.message));
    }
  }, []);

  const handleStop = async () => {
    Alert.alert("Stop tracking", "Vil du stoppe og gemme turen?", [
      { text: "Fortsæt" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          await stop();
          router.back();
        },
      },
    ]);
  };

  const routeLine: GeoJSON.Feature | null =
    points.length >= 2
      ? {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.lon, p.lat]),
          },
          properties: {},
        }
      : null;

  const lastPoint = points[points.length - 1];

  return (
    <>
      <Stack.Screen options={{ title: "Tracking", headerShown: false }} />
      <View style={styles.container}>
        <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Outdoors}>
          <Mapbox.Camera
            followUserLocation={isTracking}
            followZoomLevel={15}
            animationMode="flyTo"
          />
          <Mapbox.UserLocation visible animated />

          {routeLine && (
            <Mapbox.ShapeSource id="route" shape={routeLine}>
              <Mapbox.LineLayer
                id="route-line"
                style={{
                  lineColor: "#1a3a2a",
                  lineWidth: 4,
                  lineJoin: "round",
                  lineCap: "round",
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>

        <View style={styles.panel}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
                  <Text style={styles.statLabel}>tid</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{points.length}</Text>
                  <Text style={styles.statLabel}>punkter</Text>
                </View>
              </View>

              <Pressable style={styles.stopButton} onPress={handleStop}>
                <Square size={24} color="#fff" fill="#fff" />
                <Text style={styles.stopText}>Stop</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  statLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    borderRadius: 12,
  },
  stopText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  error: { color: "#ef4444", fontSize: 14, textAlign: "center" },
});
