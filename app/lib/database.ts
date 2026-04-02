import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("shelterdk.db");
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shelters (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      lat REAL,
      lon REAL,
      image_url TEXT,
      image_urls TEXT,
      user_image_urls TEXT,
      google_rating REAL,
      google_user_ratings_total INTEGER,
      google_place_name TEXT,
      google_photo_ref TEXT,
      booking_url TEXT,
      region TEXT,
      kommune TEXT,
      place TEXT,
      water TEXT,
      toilet TEXT,
      capacity INTEGER,
      display_score REAL,
      area_slug TEXT,
      geofa_raw TEXT,
      google_places TEXT,
      seo_description TEXT,
      updated_at TEXT,
      cached_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_shelters_region ON shelters(region);
    CREATE INDEX IF NOT EXISTS idx_shelters_area ON shelters(area_slug);
    CREATE INDEX IF NOT EXISTS idx_shelters_lat_lon ON shelters(lat, lon);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_attempt TEXT
    );

    CREATE TABLE IF NOT EXISTS tracked_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT,
      points TEXT NOT NULL,
      distance_km REAL,
      duration_seconds INTEGER,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'last_shelter_sync'"
  );
  return row?.value ?? null;
}

export async function setLastSyncTime(time: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_shelter_sync', ?)",
    time
  );
}
