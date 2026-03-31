import { create } from "zustand";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDatabase } from "../lib/database";
import { getDeviceId } from "../lib/device-id";

const TRACKING_TASK = "shelterdk-bg-location";

interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
  accuracy: number | null;
}

interface TrackingState {
  isTracking: boolean;
  points: TrackPoint[];
  startedAt: string | null;
  distanceKm: number;
  durationSeconds: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addPoint: (point: TrackPoint) => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  isTracking: false,
  points: [],
  startedAt: null,
  distanceKm: 0,
  durationSeconds: 0,

  start: async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Baggrundslokation kræves for rute-tracking");
    }

    await Location.startLocationUpdatesAsync(TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "ShelterDK",
        notificationBody: "Tracker din rute...",
      },
    });

    set({ isTracking: true, points: [], startedAt: new Date().toISOString(), distanceKm: 0, durationSeconds: 0 });
  },

  stop: async () => {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
    const { points, startedAt } = get();
    const finishedAt = new Date().toISOString();

    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      totalKm += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    }

    const db = await getDatabase();
    const deviceId = await getDeviceId();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt!).getTime();

    await db.runAsync(
      "INSERT INTO tracked_routes (device_id, points, distance_km, duration_seconds, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)",
      [deviceId, JSON.stringify(points), totalKm, Math.round(durationMs / 1000), startedAt, finishedAt]
    );

    set({ isTracking: false });
  },

  addPoint: (point) => {
    set((state) => {
      const points = [...state.points, point];
      let distanceKm = state.distanceKm;
      if (points.length > 1) {
        const prev = points[points.length - 2];
        distanceKm += haversineKm(prev.lat, prev.lon, point.lat, point.lon);
      }
      const durationSeconds = state.startedAt
        ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)
        : 0;
      return { points, distanceKm, durationSeconds };
    });
  },
}));

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Background task handler
TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    for (const loc of locations) {
      useTrackingStore.getState().addPoint({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        timestamp: loc.timestamp,
        accuracy: loc.coords.accuracy,
      });
    }
  }
});
