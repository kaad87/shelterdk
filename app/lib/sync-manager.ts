import { getDatabase } from "./database";
import { supabase } from "./supabase";
import { getDeviceId } from "./device-id";
import NetInfo from "@react-native-community/netinfo";

export async function enqueueSyncAction(type: string, payload: object): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_queue (type, payload) VALUES (?, ?)",
    [type, JSON.stringify(payload)]
  );
  processSyncQueue();
}

export async function processSyncQueue(): Promise<void> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) return;

  const db = await getDatabase();
  const pending = await db.getAllAsync<{ id: number; type: string; payload: string; attempts: number }>(
    "SELECT * FROM sync_queue WHERE status = 'pending' AND attempts < 10 ORDER BY created_at ASC LIMIT 10"
  );

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload);

      if (item.type === "photo_upload") {
        await uploadPhoto(payload);
      } else if (item.type === "route_sync") {
        await syncRoute(payload);
      }

      await db.runAsync("UPDATE sync_queue SET status = 'done' WHERE id = ?", [item.id]);
    } catch (err) {
      const nextAttempt = item.attempts + 1;
      await db.runAsync(
        "UPDATE sync_queue SET attempts = ?, last_attempt = datetime('now') WHERE id = ?",
        [nextAttempt, item.id]
      );
    }
  }
}

async function uploadPhoto(payload: { shelterId: number; uri: string; caption: string }): Promise<void> {
  const deviceId = await getDeviceId();
  const fileName = `${deviceId}/${Date.now()}.jpg`;

  const response = await fetch(payload.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("community-photos")
    .upload(fileName, blob, { contentType: "image/jpeg" });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("community-photos")
    .getPublicUrl(fileName);

  const { error: dbError } = await supabase
    .from("community_photos")
    .insert({
      shelter_id: payload.shelterId,
      image_url: publicUrl,
      caption: payload.caption,
      device_id: deviceId,
    });

  if (dbError) throw dbError;
}

async function syncRoute(payload: { points: string; distanceKm: number; durationSeconds: number; startedAt: string; finishedAt: string }): Promise<void> {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from("tracked_routes")
    .insert({
      device_id: deviceId,
      points: payload.points,
      distance_km: payload.distanceKm,
      duration_seconds: payload.durationSeconds,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt,
    });
  if (error) throw error;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncProcessor(): void {
  if (syncInterval) return;
  syncInterval = setInterval(processSyncQueue, 30_000);
  processSyncQueue();
}
